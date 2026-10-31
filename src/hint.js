/**
 * hint.js — 提示系统
 * 提供三种提示级别：候选数 / 高亮唯一位置 / 直接填入
 * ✅ 已补齐对角线模式感知
 */

// ============================================================
// 工具函数
// ============================================================

function getBoard() {
  return document.querySelector('#board');
}

function getAllCells() {
  const board = getBoard();
  if (!board) return [];
  return Array.from(board.querySelectorAll('.cell'));
}

function getCellRC(cell) {
  const r = parseInt(cell.dataset.row, 10);
  const c = parseInt(cell.dataset.col, 10);
  return { r, c };
}

function getCell(r, c) {
  return document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
}

function getBoardSnapshot() {
  const cells = getAllCells();
  const snapshot = Array.from({ length: 9 }, () => Array(9).fill(0));
  cells.forEach(cell => {
    const { r, c } = getCellRC(cell);
    if (cell.classList.contains('notes')) return;
    const val = parseInt(cell.textContent, 10);
    if (!isNaN(val) && val >= 1 && val <= 9) {
      snapshot[r][c] = val;
    }
  });
  return snapshot;
}

/**
 * ✅ 对角线合法性检查（和 main.js 的 isDiagonalValid 对齐）
 */
function isDiagonalValid(snapshot, r, c, num) {
  // 主对角线：r === c
  if (r === c) {
    for (let i = 0; i < 9; i++) {
      if (i !== r && snapshot[i][i] === num) return false;
    }
  }
  // 副对角线：r + c === 8
  if (r + c === 8) {
    for (let i = 0; i < 9; i++) {
      const j = 8 - i;
      if (i !== r && snapshot[i][j] === num) return false;
    }
  }
  return true;
}

/**
 * 检查某数字在某位置是否合法
 * ✅ 新增对角线模式感知
 */
function isValid(snapshot, r, c, num) {
  if (window.__sudokuEvenCells?.includes(r * 9 + c) && num % 2 !== 0) return false;
  // 行
  for (let i = 0; i < 9; i++) {
    if (snapshot[r][i] === num) return false;
  }
  // 列
  for (let i = 0; i < 9; i++) {
    if (snapshot[i][c] === num) return false;
  }
  // 宫
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let i = br; i < br + 3; i++) {
    for (let j = bc; j < bc + 3; j++) {
      if (snapshot[i][j] === num) return false;
    }
  }

  // ✅ 对角线模式额外校验
  if (window.__sudokuDiagonalMode && !isDiagonalValid(snapshot, r, c, num)) {
    return false;
  }

  return true;
}

/**
 * 获取某格所有合法候选数
 */
function getCandidates(snapshot, r, c) {
  const candidates = [];
  if (snapshot[r][c] !== 0) return candidates;
  for (let n = 1; n <= 9; n++) {
    if (isValid(snapshot, r, c, n)) {
      candidates.push(n);
    }
  }
  return candidates;
}

// ============================================================
// 提示功能 ①：显示候选数
// ============================================================

export function showCandidates() {
  const snapshot = getBoardSnapshot();
  const cells = getAllCells();
  let count = 0;

  cells.forEach(cell => {
    const { r, c } = getCellRC(cell);
    if (snapshot[r][c] !== 0) return;

    const candidates = getCandidates(snapshot, r, c);
    if (candidates.length > 0 && candidates.length <= 4) {
      cell.classList.add('notes');
      cell.innerHTML = candidates
        .map(n => `<span class="note-num">${n}</span>`)
        .join('');
      count++;
    }
  });

  return count;
}

// ============================================================
// 提示功能 ②：高亮唯一位置
// ============================================================

export function highlightUniqueLocation() {
  const board = getBoard();
  if (!board) {
    console.warn('[hint] #board not found, skip highlightUniqueLocation');
    return 0;
  }

  const snapshot = getBoardSnapshot();
  const cells = getAllCells();

  cells.forEach(cell => cell.classList.remove('hint-highlight'));

  let highlightCount = 0;

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (snapshot[r][c] !== 0) continue;

      const candidates = getCandidates(snapshot, r, c);
      if (candidates.length === 1) {
        const cell = getCell(r, c);
        if (cell) {
          cell.classList.add('hint-highlight');
          highlightCount++;
        }
      }
    }
  }

  if (highlightCount === 0) {
    console.log('[hint] 当前没有唯一位置的空格');
  }

  return highlightCount;
}

// ============================================================
// 提示功能 ③：直接填入
// ============================================================

export function fillOneCorrect() {
  const board = getBoard();
  if (!board) {
    console.warn('[hint] #board not found, skip fillOneCorrect');
    return false;
  }

  const snapshot = getBoardSnapshot();

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (snapshot[r][c] !== 0) continue;

      const candidates = getCandidates(snapshot, r, c);
      if (candidates.length === 1) {
        const cell = getCell(r, c);
        if (cell) {
          const num = candidates[0];
          cell.textContent = num;
          cell.classList.add('filled');
          cell.classList.remove('notes');

          cell.dispatchEvent(new Event('input', { bubbles: true }));

          console.log(`[hint] 已填入 (${r}, ${c}) = ${num}`);
          return true;
        }
      }
    }
  }

  console.log('[hint] 没有找到可填入的空格');
  return false;
}