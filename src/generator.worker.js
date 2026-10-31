import { generatePuzzle } from "./core/sudoku.js";

self.addEventListener("message", (event) => {
  const { requestId, seed, difficulty } = event.data ?? {};
  try {
    const game = generatePuzzle(seed, difficulty);
    self.postMessage({ requestId, game });
  } catch (error) {
    self.postMessage({ requestId, error: error instanceof Error ? error.message : "题目生成失败" });
  }
});
