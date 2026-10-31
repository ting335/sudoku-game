const SAVE_KEY = "quiet-sudoku-save-v1";
const STATS_KEY = "quiet-sudoku-stats-v1";

function browserStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}

export function loadSave(storage = browserStorage()) {
  try {
    const raw = storage?.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.puzzle) || parsed.puzzle.length !== 81 || !Array.isArray(parsed.values) || parsed.values.length !== 81) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveGame(game, storage = browserStorage()) {
  try {
    storage?.setItem(SAVE_KEY, JSON.stringify(game));
    return true;
  } catch {
    return false;
  }
}

export function loadStats(storage = browserStorage()) {
  try {
    const stats = JSON.parse(storage?.getItem(STATS_KEY) ?? "null");
    return {
      completed: Number.isInteger(stats?.completed) && stats.completed >= 0 ? stats.completed : 0,
      bestSeconds: Number.isFinite(stats?.bestSeconds) && stats.bestSeconds >= 0 ? stats.bestSeconds : null,
    };
  } catch {
    return { completed: 0, bestSeconds: null };
  }
}

export function saveStats(stats, storage = browserStorage()) {
  try {
    storage?.setItem(STATS_KEY, JSON.stringify(stats));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(storage = browserStorage()) {
  try { storage?.removeItem(SAVE_KEY); } catch { /* Private browsing may deny storage access. */ }
}
