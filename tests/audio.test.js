import test from 'node:test';
import assert from 'node:assert/strict';

function audioEnvironment(t, { denied = false, unavailable = false, saved = null } = {}) {
  const stats = { contexts: 0, oscillators: [], intervals: new Set(), saved: null };
  const parameter = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {} });
  class FakeContext {
    constructor() { stats.contexts++; stats.instance = this; this.currentTime = 0; this.state = 'suspended'; this.destination = {}; }
    async resume() { if (denied) throw new Error('gesture required'); this.state = 'running'; }
    createGain() { return { gain: parameter(), connect() {}, disconnect() {} }; }
    createOscillator() {
      const osc = { frequency: parameter(), connect() {}, disconnect() {}, start() {}, stop() {} };
      stats.oscillators.push(osc);
      return osc;
    }
  }
  const previous = ['AudioContext', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: unavailable ? undefined : FakeContext });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem() { return saved === null ? null : JSON.stringify(saved); }, setItem(key, value) { stats.saved = JSON.parse(value); },
  } });
  let id = 0;
  t.mock.method(globalThis, 'setInterval', () => { const timer = ++id; stats.intervals.add(timer); return timer; });
  t.mock.method(globalThis, 'clearInterval', timer => stats.intervals.delete(timer));
  t.after(() => previous.forEach(([key, descriptor]) => {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  }));
  return stats;
}

test('effects reuse one context, use distinct notes, and respect the sound switch', async t => {
  const stats = audioEnvironment(t);
  const { audio, sfx } = await import('../src/audio.js?effects');
  await sfx.input();
  assert.equal(stats.contexts, 1);
  assert.equal(stats.oscillators.length, 2);
  assert.equal(stats.oscillators[0].type, 'sine');
  await sfx.error();
  assert.equal(stats.contexts, 1);
  assert.equal(stats.oscillators.length, 4);
  assert.equal(stats.oscillators[2].type, 'triangle');
  audio.setEffectsEnabled(false);
  await sfx.input();
  assert.equal(stats.oscillators.length, 4);
  assert.equal(stats.saved.effects, false);
});

test('legacy fractional volume is repaired from 0.35 to 35 percent', async t => {
  const stats = audioEnvironment(t, { saved: { effects:true, music:false, volume:0.35 } });
  const { audio } = await import('../src/audio.js?legacy-volume');
  assert.equal(audio.getSettings().volume, 35);
  await audio.setMusicEnabled(true);
  assert.equal(stats.saved.volume, 35);
  audio.setPaused(true);
});

test('music schedules one loop and stops on pause or disable; volume is clamped and saved', async t => {
  const stats = audioEnvironment(t);
  const { audio } = await import('../src/audio.js?music');
  assert.equal(audio.getSettings().music, false);
  await audio.setMusicEnabled(true);
  assert.equal(audio.getSettings().playing, true);
  assert.equal(stats.oscillators.length, 6);
  assert.equal(stats.intervals.size, 1);
  await audio.unlock();
  assert.equal(stats.intervals.size, 1);
  assert.equal(stats.oscillators.length, 6);
  audio.setPaused(true);
  assert.equal(audio.getSettings().playing, false);
  assert.equal(stats.intervals.size, 0);
  audio.setPaused(false);
  assert.equal(audio.getSettings().playing, true);
  assert.equal(stats.intervals.size, 1);
  assert.equal(stats.oscillators.length, 12);
  await audio.setMusicEnabled(false);
  assert.equal(stats.intervals.size, 0);
  audio.setVolume(200);
  assert.equal(stats.saved.volume, 100);
  audio.setVolume(-2);
  assert.equal(stats.saved.volume, 0);
  audio.setVolume('bad');
  assert.equal(audio.getSettings().volume, 0);
});

test('missing audio support and blocked playback degrade without an unhandled rejection', async t => {
  audioEnvironment(t, { unavailable: true });
  const missing = await import('../src/audio.js?missing');
  assert.equal(missing.audio.getSettings().supported, false);
  await assert.doesNotReject(missing.sfx.input());
});

test('an interrupted audio context stops its loop and a later gesture resumes exactly one loop', async t => {
  const stats = audioEnvironment(t);
  const { audio } = await import('../src/audio.js?interrupted');
  await audio.setMusicEnabled(true);
  stats.instance.state = 'interrupted';
  stats.instance.onstatechange();
  assert.equal(audio.getSettings().playing, false);
  assert.equal(stats.intervals.size, 0);
  await audio.unlock();
  assert.equal(audio.getSettings().playing, true);
  assert.equal(stats.intervals.size, 1);
  audio.setPaused(true);
});

test('browser resume rejection is caught and storage restrictions do not stop effects', async t => {
  const stats = audioEnvironment(t, { denied: true });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('storage denied'); } });
  const denied = await import('../src/audio.js?denied');
  await assert.doesNotReject(denied.audio.setMusicEnabled(true));
  assert.equal(denied.audio.getSettings().playing, false);
  assert.match(denied.audio.getSettings().playbackError, /重试/);
  await assert.doesNotReject(denied.sfx.error());
  assert.equal(stats.oscillators.length, 0);
  assert.equal(stats.intervals.size, 0);
});
