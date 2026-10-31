// Additional even clues are derived from the existing unique solution.
export function makeEvenCells(solution, puzzle, limit = 12) {
  const positions = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    if (puzzle[r][c] === 0 && solution[r][c] % 2 === 0) positions.push(r * 9 + c);
  }
  const count = Math.min(limit, positions.length);
  return Array.from({ length: count }, (_, i) => positions[Math.floor(i * positions.length / count)]);
}

export function evenAllows(cells, r, c, value) {
  return !cells.includes(r * 9 + c) || [2, 4, 6, 8].includes(value);
}
