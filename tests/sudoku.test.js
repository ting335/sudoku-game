import test from "node:test";
import assert from "node:assert/strict";
import { countSolutions, createSolvedGrid, dailySeed, generatePuzzle, isValidSolution } from "../src/core/sudoku.js";

test("generator returns a valid complete grid", () => {
  assert.equal(isValidSolution(createSolvedGrid("test-solution")), true);
});

test("each difficulty produces a reproducible puzzle with a unique solution", () => {
  for (const [difficulty, target] of [["easy", 40], ["medium", 34], ["hard", 30]]) {
    const first = generatePuzzle("stable-seed", difficulty);
    const second = generatePuzzle("stable-seed", difficulty);
    assert.deepEqual(first, second);
    assert.ok(first.puzzle.filter(Boolean).length >= target);
    assert.equal(countSolutions(first.puzzle, 2), 1);
    assert.equal(isValidSolution(first.solution), true);
    assert.ok(first.puzzle.every((value, index) => value === 0 || value === first.solution[index]));
  }
});

test("daily seed uses a stable UTC date", () => {
  assert.equal(dailySeed(new Date("2026-10-26T23:30:00-08:00")), "daily-2026-10-27-v1");
});

test("a contradictory puzzle has no solution", () => {
  const puzzle = Array(81).fill(0);
  puzzle[0] = 5;
  puzzle[1] = 5;
  assert.equal(countSolutions(puzzle, 2), 0);
});
