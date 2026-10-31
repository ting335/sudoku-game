import { CELL_COUNT, SIZE } from "./sudoku.js";

export function rowIndices(index) {
  const start = Math.floor(index / SIZE) * SIZE;
  return Array.from({ length: SIZE }, (_, offset) => start + offset);
}

export function columnIndices(index) {
  const col = index % SIZE;
  return Array.from({ length: SIZE }, (_, offset) => offset * SIZE + col);
}

export function boxIndices(index) {
  const row = Math.floor(index / SIZE);
  const col = index % SIZE;
  const startRow = Math.floor(row / 3) * 3;
  const startCol = Math.floor(col / 3) * 3;
  const indices = [];
  for (let r = startRow; r < startRow + 3; r += 1) {
    for (let c = startCol; c < startCol + 3; c += 1) indices.push(r * SIZE + c);
  }
  return indices;
}

export function getConflicts(values) {
  const conflicts = new Set();
  for (let index = 0; index < CELL_COUNT; index += 1) {
    const value = values[index];
    if (!value) continue;
    const peers = new Set([...rowIndices(index), ...columnIndices(index), ...boxIndices(index)]);
    for (const peer of peers) {
      if (peer !== index && values[peer] === value) {
        conflicts.add(index);
        conflicts.add(peer);
      }
    }
  }
  return conflicts;
}

export function getPeers(index) {
  const peers = new Set([...rowIndices(index), ...columnIndices(index), ...boxIndices(index)]);
  peers.delete(index);
  return peers;
}

export function countFilled(values) {
  return values.reduce((count, value) => count + (value ? 1 : 0), 0);
}

export function isComplete(values, solution) {
  return values.length === CELL_COUNT && values.every((value, index) => value === solution[index]);
}

export function formatTime(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function createBlankNotes() {
  return Array.from({ length: CELL_COUNT }, () => []);
}
