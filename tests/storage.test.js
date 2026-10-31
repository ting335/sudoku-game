import test from "node:test";
import assert from "node:assert/strict";
import { clearSave, loadSave, loadStats, saveGame, saveStats } from "../src/core/storage.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
}

test("save and restore retain a game; clear removes it", () => {
  const storage = memoryStorage();
  const game = { puzzle: Array(81).fill(0), values: Array(81).fill(0), elapsedSeconds: 12 };
  assert.equal(saveGame(game, storage), true);
  assert.deepEqual(loadSave(storage), game);
  clearSave(storage);
  assert.equal(loadSave(storage), null);
});

test("malformed or unavailable browser storage fails safely", () => {
  assert.equal(loadStats({ getItem() { return "{"; } }).completed, 0);
  assert.equal(loadSave({ getItem() { throw new Error("blocked"); } }), null);
  assert.equal(saveGame({}, { setItem() { throw new Error("quota"); } }), false);
});

test("statistics are normalized and saved", () => {
  const storage = memoryStorage();
  saveStats({ completed: 4, bestSeconds: 92 }, storage);
  assert.deepEqual(loadStats(storage), { completed: 4, bestSeconds: 92 });
});
