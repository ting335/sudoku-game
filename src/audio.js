// All sounds are synthesized locally. One shared context avoids opening a new
// audio device on every input; short attack/release envelopes avoid clicks.
const SETTINGS_KEY = 'sudoku-audio-v1';
const MUSIC_LEVEL = 0.42;
let settings = { effects: true, music: false, volume: 35 };
try {
  const saved = JSON.parse(globalThis.localStorage?.getItem(SETTINGS_KEY) || 'null');
  if (saved && typeof saved.effects === 'boolean') settings.effects = saved.effects;
  if (saved && typeof saved.music === 'boolean') settings.music = saved.music;
  if (saved && Number.isFinite(saved.volume)) {
    // A previous controller accidentally persisted 35% as 0.35. UI volume
    // steps are whole percentages, so fractional sub-1 values are legacy data.
    const volume = saved.volume > 0 && saved.volume < 1 ? Math.round(saved.volume * 100) : saved.volume;
    settings.volume = Math.max(0, Math.min(100, volume));
  }
} catch { /* Audio preferences are optional when storage is unavailable. */ }

let context, master, musicBus, effectBus, musicTimer;
let paused = false;
let unlocked = false;
let playbackError = '';
let chordIndex = 0;
const musicVoices = new Set();
const chords = [
  [130.81, 196, 261.63, 329.63],
  [110, 164.81, 220, 261.63],
  [87.31, 130.81, 174.61, 220],
  [98, 146.83, 196, 293.66],
];

function notify() {
  globalThis.dispatchEvent?.(new Event('sudoku-audio-change'));
}

function persist() {
  try { globalThis.localStorage?.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Keep the in-memory choice. */ }
  notify();
}

function smoothVolume(node, value, time = 0.08) {
  const now = context.currentTime;
  node.gain.cancelScheduledValues(now);
  node.gain.setTargetAtTime(value, now, time);
}

async function unlock() {
  const wasUnlocked = unlocked;
  try {
    if (!context) {
      const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = settings.volume / 100;
      master.connect(context.destination);
      effectBus = context.createGain();
      effectBus.gain.value = settings.effects ? 0.38 : 0;
      effectBus.connect(master);
      musicBus = context.createGain();
      musicBus.gain.value = MUSIC_LEVEL;
      musicBus.connect(master);
      context.onstatechange = () => {
        unlocked = context.state === 'running';
        if (unlocked) startMusic(); else stopMusic();
        notify();
      };
    }
    if (context.state !== 'running' && context.state !== 'closed') await context.resume();
    unlocked = context.state === 'running';
    playbackError = unlocked ? '' : '浏览器暂未允许播放，点击音乐按钮重试。';
    if (unlocked) startMusic();
    if (unlocked !== wasUnlocked) notify();
    return unlocked;
  } catch {
    unlocked = false;
    playbackError = '浏览器暂未允许播放，点击音乐按钮重试。';
    notify();
    return false;
  }
}

function voice(freq, type, start, duration, level, bus, attack = 0.012, music = false) {
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(level, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(bus);
  const entry = { osc, gain };
  if (music) musicVoices.add(entry);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
    musicVoices.delete(entry);
  };
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

function scheduleChord() {
  if (!settings.music || paused || !unlocked) return;
  const start = context.currentTime + 0.04;
  const chord = chords[chordIndex++ % chords.length];
  // Slow sine pads with a sparse pentatonic melody: no downloaded recordings.
  chord.slice(0, 3).forEach((freq, i) => voice(freq, 'sine', start + i * 0.05, 8.4, 0.19, musicBus, 0.65, true));
  [chord[2] * 2, chord[3] * 2, chord[1] * 2].forEach((freq, i) => {
    voice(freq, 'sine', start + 0.08 + i * 2.2, 3.1, 0.24, musicBus, 0.025, true);
  });
}

function startMusic() {
  if (!settings.music || paused || !unlocked || musicTimer) return;
  smoothVolume(musicBus, MUSIC_LEVEL, 0.08);
  scheduleChord();
  musicTimer = setInterval(scheduleChord, 8000);
}

function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = null;
  if (!context) return;
  const now = context.currentTime;
  for (const { osc, gain } of musicVoices) {
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(0, now, 0.04);
    osc.stop(now + 0.2);
  }
  musicVoices.clear();
}

async function effect(notes) {
  if (!settings.effects || paused || !await unlock() || !settings.effects || paused) return;
  const now = context.currentTime;
  notes.forEach(([freq, delay, duration, level = 0.25, type = 'sine']) => {
    voice(freq, type, now + delay, duration, level, effectBus);
  });
}

// Preserve the teammate's public sound API, including playTone.
export function playTone(freq = 440, type = 'sine', duration = 0.15) {
  return effect([[freq, 0, duration, 0.25, type]]);
}

export const sfx = {
  input: () => effect([[659.25, 0, 0.24], [987.77, 0.055, 0.34, 0.16]]),
  error: async () => {
    await effect([[196, 0, 0.22, 0.2, 'triangle'], [164.81, 0.10, 0.32, 0.18, 'triangle']]);
    if (context && settings.music && !paused) {
      const now = context.currentTime;
      musicBus.gain.cancelScheduledValues(now);
      musicBus.gain.setTargetAtTime(0.14, now, 0.03);
      musicBus.gain.setTargetAtTime(MUSIC_LEVEL, now + 0.7, 0.25);
    }
  },
  win: () => effect([[523.25, 0, 0.6], [659.25, 0.13, 0.6], [783.99, 0.26, 0.7], [1046.5, 0.4, 1.0, 0.18]]),
  hint: () => effect([[523.25, 0, 0.3, 0.17], [783.99, 0.08, 0.42, 0.14]]),

  // 🎮 扫雷音效
  dig: () => effect([[587.33, 0, 0.05, 0.15]]),                 // 揭开空格/数字
  flag: () => effect([[987.77, 0, 0.06, 0.16, 'triangle']]),    // 插旗
  unflag: () => effect([[329.63, 0, 0.06, 0.13, 'triangle']]),  // 撤旗 / 问号
  boom: async () => {
    await effect([
      [130.81, 0, 0.26, 0.26, 'sawtooth'],
      [98, 0.10, 0.32, 0.22, 'sawtooth'],
      [73.42, 0.22, 0.42, 0.2, 'sawtooth'],
    ]);
    if (context && settings.music && !paused) {
      const now = context.currentTime;
      musicBus.gain.cancelScheduledValues(now);
      musicBus.gain.setTargetAtTime(0.12, now, 0.03);
      musicBus.gain.setTargetAtTime(MUSIC_LEVEL, now + 0.8, 0.28);
    }
  },
};

export const audio = {
  unlock,
  getSettings: () => ({ ...settings, supported: !!(globalThis.AudioContext || globalThis.webkitAudioContext), unlocked, paused, playing: !!musicTimer && !paused && context?.state === 'running', playbackError }),
  async setMusicEnabled(enabled) {
    settings.music = !!enabled;
    if (!settings.music) stopMusic();
    persist();
    if (settings.music) await unlock();
    notify();
  },
  setEffectsEnabled(enabled) {
    settings.effects = !!enabled;
    if (effectBus) smoothVolume(effectBus, settings.effects ? 0.38 : 0);
    persist();
  },
  setVolume(value) {
    const volume = Number(value);
    if (!Number.isFinite(volume)) return;
    settings.volume = Math.max(0, Math.min(100, volume));
    if (master) smoothVolume(master, settings.volume / 100);
    persist();
  },
  setPaused(value) {
    paused = !!value;
    if (paused) stopMusic();
    else startMusic();
    notify();
  },
};
