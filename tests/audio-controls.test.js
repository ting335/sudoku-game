import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

test('active page controls use the audio module API and pass volume on a 0–100 scale', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const code = source.slice(source.indexOf('function setupAudioControls()'), source.indexOf('function saveProgress()'));
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { handlers: {}, textContent: '', setAttribute() {}, addEventListener(name, callback) { this.handlers[name] = callback; } });
    return nodes.get(id);
  };
  const prefs = { music:false, effects:true, volume:35, supported:true, unlocked:false, playing:false, paused:false };
  const calls = [];
  const audio = {
    getSettings:()=>({...prefs}),
    setMusicEnabled(value) { prefs.music=value; calls.push(['music',value]); },
    setEffectsEnabled(value) { prefs.effects=value; calls.push(['effects',value]); },
    setVolume(value) { prefs.volume=Number(value); calls.push(['volume',Number(value)]); },
    unlock() { calls.push(['unlock']); }, setPaused() {},
  };
  vm.runInNewContext(code + '\nsetupAudioControls();', { audio, sfx:{hint(){}}, window:{addEventListener(){}}, document:{getElementById:node,addEventListener(){}}, state:{}, winDialog:{} });
  node('music-button').handlers.click();
  assert.deepEqual(calls.pop(), ['music',true]);
  node('effects-button').handlers.click();
  assert.deepEqual(calls.pop(), ['effects',false]);
  node('volume-slider').value='75';
  node('volume-slider').handlers.input();
  assert.deepEqual(calls.pop(), ['volume',75]);
  prefs.music=true; prefs.playing=false;
  node('music-button').handlers.click();
  assert.deepEqual(calls.pop(), ['unlock']);
});
