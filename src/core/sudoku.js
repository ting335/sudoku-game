import { createRng, shuffled } from "./random.js";

export const SIZE = 9;
export const CELL_COUNT = SIZE * SIZE;
export const DIFFICULTIES = Object.freeze({
  easy: Object.freeze({ label: "初级", clues: 40 }),
  medium: Object.freeze({ label: "中级", clues: 34 }),
  hard: Object.freeze({ label: "高级", clues: 30 }),
});

const ALL_DIGITS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9]);

function rowOf(index) { return Math.floor(index / SIZE); }
function colOf(index) { return index % SIZE; }
function boxStart(index) {
  return Math.floor(rowOf(index) / 3) * 3 * SIZE + Math.floor(colOf(index) / 3) * 3;
}

function usedDigits(board, index) {
  const row = rowOf(index);
  const col = colOf(index);
  const box = boxStart(index);
  const used = new Set();
  for (let offset = 0; offset < SIZE; offset += 1) {
    used.add(board[row * SIZE + offset]);
    used.add(board[offset * SIZE + col]);
    used.add(board[box + Math.floor(offset / 3) * SIZE + offset % 3]);
  }
  return used;
}

function bestEmptyCell(board) {
  let bestIndex = -1;
  let bestCandidates = null;
  for (let index = 0; index < CELL_COUNT; index += 1) {
    if (board[index] !== 0) continue;
    const used = usedDigits(board, index);
    const candidates = ALL_DIGITS.filter((digit) => !used.has(digit));
    if (candidates.length === 0) return { index, candidates };
    if (bestCandidates === null || candidates.length < bestCandidates.length) {
      bestIndex = index;
      bestCandidates = candidates;
      if (candidates.length === 1) break;
    }
  }
  return { index: bestIndex, candidates: bestCandidates ?? [] };
}

function fillSolution(board, random) {
  const { index, candidates } = bestEmptyCell(board);
  if (index === -1) return true;
  if (candidates.length === 0) return false;
  for (const digit of shuffled(candidates, random)) {
    board[index] = digit;
    if (fillSolution(board, random)) return true;
  }
  board[index] = 0;
  return false;
}

/** Count solutions up to limit (normally 2, enough to detect ambiguity). */
export function countSolutions(puzzle, limit = 2) {
  if (!Array.isArray(puzzle) || puzzle.length !== CELL_COUNT) return 0;
  if (puzzle.some((value) => !Number.isInteger(value) || value < 0 || value > 9)) return 0;
  for (let group = 0; group < SIZE; group += 1) {
    const row = puzzle.slice(group * SIZE, group * SIZE + SIZE);
    const col = puzzle.filter((_, index) => colOf(index) === group);
    const boxStartRow = Math.floor(group / 3) * 3;
    const boxStartCol = (group % 3) * 3;
    const box = [];
    for (let rowIndex = boxStartRow; rowIndex < boxStartRow + 3; rowIndex += 1) {
      for (let colIndex = boxStartCol; colIndex < boxStartCol + 3; colIndex += 1) box.push(puzzle[rowIndex * SIZE + colIndex]);
    }
    if ([row, col, box].some((values) => {
      const filled = values.filter(Boolean);
      return new Set(filled).size !== filled.length;
    })) return 0;
  }
  const board = [...puzzle];
  let count = 0;
  function search() {
    if (count >= limit) return;
    const { index, candidates } = bestEmptyCell(board);
    if (index === -1) { count += 1; return; }
    for (const digit of candidates) {
      board[index] = digit;
      search();
      board[index] = 0;
      if (count >= limit) return;
    }
  }
  search();
  return count;
}

export function createSolvedGrid(seed = "sudoku") {
  const random = createRng(seed);
  const solution = Array(CELL_COUNT).fill(0);
  if (!fillSolution(solution, random)) throw new Error("Could not construct a solved Sudoku grid.");
  return solution;
}

/**
 * Build a puzzle by removing clues while keeping exactly one solution.
 * Difficulty is represented by clue-count targets; it is a course prototype
 * heuristic and does not claim a human-solving-technique difficulty rating.
 */
export function generatePuzzle(seed, difficulty = "medium") {
  const settings = DIFFICULTIES[difficulty] ?? DIFFICULTIES.medium;
  const random = createRng(`${seed}|${difficulty}|generator-v1`);
  const solution = createSolvedGrid(`${seed}|${difficulty}|solution-v1`);
  const puzzle = [...solution];
  const positions = shuffled(Array.from({ length: CELL_COUNT }, (_, index) => index), random);
  let clues = CELL_COUNT;

  for (const index of positions) {
    if (clues <= settings.clues) break;
    const original = puzzle[index];
    puzzle[index] = 0;
    if (countSolutions(puzzle, 2) === 1) clues -= 1;
    else puzzle[index] = original;
  }

  return { puzzle, solution, difficulty, clues, seed: String(seed) };
}

export function isValidSolution(board) {
  if (!Array.isArray(board) || board.length !== CELL_COUNT || board.some((value) => !Number.isInteger(value) || value < 1 || value > 9)) return false;
  for (let group = 0; group < SIZE; group += 1) {
    const row = board.slice(group * SIZE, group * SIZE + SIZE);
    const col = board.filter((_, index) => colOf(index) === group);
    const boxRow = Math.floor(group / 3) * 3;
    const boxCol = (group % 3) * 3;
    const box = [];
    for (let rowIndex = boxRow; rowIndex < boxRow + 3; rowIndex += 1) {
      for (let colIndex = boxCol; colIndex < boxCol + 3; colIndex += 1) box.push(board[rowIndex * SIZE + colIndex]);
    }
    if ([row, col, box].some((values) => new Set(values).size !== SIZE)) return false;
  }
  return true;
}

export function dailySeed(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `daily-${year}-${month}-${day}-v1`;
}
