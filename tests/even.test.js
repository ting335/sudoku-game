import test from 'node:test';
import assert from 'node:assert/strict';
import { makeEvenCells, evenAllows } from '../src/core/even.js';

test('even clues only mark empty cells with an even solution and survive JSON round trips', () => {
  const solution = Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => (r * 3 + Math.floor(r / 3) + c) % 9 + 1));
  const puzzle = solution.map(row => row.map((n, c) => c % 3 ? 0 : n));
  const cells = makeEvenCells(solution, puzzle);
  assert.equal(cells.length, 12);
  assert.equal(new Set(cells).size, cells.length);
  for (const index of JSON.parse(JSON.stringify(cells))) {
    const r = Math.floor(index / 9), c = index % 9;
    assert.equal(puzzle[r][c], 0);
    assert.equal(solution[r][c] % 2, 0);
    for (let n = 1; n <= 9; n++) assert.equal(evenAllows(cells, r, c, n), n % 2 === 0);
  }
  assert.deepEqual(makeEvenCells(solution, solution), []);
  assert.equal(evenAllows([], 0, 0, 3), true);
});
