import test from "node:test";
import assert from "node:assert/strict";
import { countFilled, formatTime, getConflicts, getPeers, isComplete } from "../src/core/game.js";

test("conflicts include both matching editable entries", () => {
  const values = Array(81).fill(0);
  values[0] = 7;
  values[8] = 7;
  values[10] = 7;
  assert.deepEqual([...getConflicts(values)].sort((a, b) => a - b), [0, 8, 10]);
});

test("peer set has 20 unique cells and excludes selection", () => {
  const peers = getPeers(40);
  assert.equal(peers.size, 20);
  assert.ok(peers.has(39));
  assert.ok(!peers.has(40));
});

test("progress, completion, and timer formatting", () => {
  const solution = Array.from({ length: 81 }, (_, index) => (index % 9) + 1);
  assert.equal(countFilled([1, 0, 2]), 2);
  assert.equal(isComplete(solution, solution), true);
  assert.equal(formatTime(63), "01:03");
  assert.equal(formatTime(3661), "01:01:01");
});
