// ============================================================
// 数独 · 静心一局 - main.js
// ✅ 对角线模式 + 规则自动显隐
// ✅ 难度曲线细化（对称挖洞 + 唯一解验证 + 逻辑层级分析）
// ✅ 冲突高亮联动（选中/填数时冲突格子同步闪红）
// ============================================================

import { makeEvenCells, evenAllows } from './core/even.js';
import { sfx, audio } from './audio.js?v=20261031-dual';
import { showCandidates, highlightUniqueLocation, fillOneCorrect } from './hint.js?v=20261031-layout';

// ---------- 工具函数 ----------
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isDiagonalValid(grid, r, c, num) {
  if (r === c) {
    for (let i = 0; i < 9; i++) {
      if (i !== r && grid[i][i] === num) return false;
    }
  }
  if (r + c === 8) {
    for (let i = 0; i < 9; i++) {
      const j = 8 - i;
      if (i !== r && grid[i][j] === num) return false;
    }
  }
  return true;
}

function isValid(grid, row, col, num) {
  for (let i = 0; i < 9; i++) {
    if (grid[row][i] === num) return false;
    if (grid[i][col] === num) return false;
  }
  const br = Math.floor(row / 3) * 3;
  const bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r++)
    for (let c = bc; c < bc + 3; c++)
      if (grid[r][c] === num) return false;
  if (state.diagonalMode && !isDiagonalValid(grid, row, col, num)) return false;
  if (state.evenMode && !evenAllows(state.evenCells, row, col, num)) return false;
  return true;
}

function searchGrid(grid, limit = 1, keepSolution = false) {
  let row = -1, col = -1, choices = null;
  scan: for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    if (grid[r][c] !== 0) continue;
    const candidates = [];
    for (let n = 1; n <= 9; n++) if (isValid(grid, r, c, n)) candidates.push(n);
    if (!candidates.length) return 0;
    if (!choices || candidates.length < choices.length) {
      row = r; col = c; choices = candidates;
      if (choices.length === 1) break scan;
    }
  }
  if (row === -1) return 1;
  let count = 0;
  for (const n of choices) {
    grid[row][col] = n;
    count += searchGrid(grid, limit - count, keepSolution);
    if (keepSolution && count) return count;
    grid[row][col] = 0;
    if (count >= limit) break;
  }
  return count;
}

function solve(grid) { return searchGrid(grid, 1, true) === 1; }

// ---------- ✅ 难度分析系统 ----------
function getCandidates(grid, r, c) {
  if (grid[r][c] !== 0) return [];
  const candidates = [];
  for (let n = 1; n <= 9; n++) {
    if (isValid(grid, r, c, n)) candidates.push(n);
  }
  return candidates;
}

function analyzeDifficulty(puzzle) {
  const grid = puzzle.map(row => [...row]);
  let hiddenSingles = 0;

  function fillNakedSingles() {
    let changed = false;
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        if (grid[r][c] === 0) {
          const cands = getCandidates(grid, r, c);
          if (cands.length === 1) { grid[r][c] = cands[0]; changed = true; }
        }
    return changed;
  }

  function fillHiddenSingles() {
    let changed = false;
    for (let n = 1; n <= 9; n++) {
      for (let r = 0; r < 9; r++) {
        let cnt = 0, lc = -1;
        for (let c = 0; c < 9; c++)
          if (grid[r][c] === 0 && getCandidates(grid, r, c).includes(n)) { cnt++; lc = c; }
        if (cnt === 1) { grid[r][lc] = n; changed = true; hiddenSingles++; }
      }
      for (let c = 0; c < 9; c++) {
        let cnt = 0, lr = -1;
        for (let r = 0; r < 9; r++)
          if (grid[r][c] === 0 && getCandidates(grid, r, c).includes(n)) { cnt++; lr = r; }
        if (cnt === 1) { grid[lr][c] = n; changed = true; hiddenSingles++; }
      }
      for (let br = 0; br < 9; br += 3)
        for (let bc = 0; bc < 9; bc += 3) {
          let cnt = 0, lr = -1, lc = -1;
          for (let r = br; r < br + 3; r++)
            for (let c = bc; c < bc + 3; c++)
              if (grid[r][c] === 0 && getCandidates(grid, r, c).includes(n)) { cnt++; lr = r; lc = c; }
          if (cnt === 1) { grid[lr][lc] = n; changed = true; hiddenSingles++; }
        }
    }
    return changed;
  }

  let iter = 0;
  while (iter < 200) {
    const before = grid.flat().join('');
    fillNakedSingles();
    fillHiddenSingles();
    if (grid.flat().join('') === before) break;
    iter++;
  }

  const needsGuess = grid.some(row => row.some(v => v === 0));
  const level = needsGuess ? 'hard' : hiddenSingles > 0 ? 'medium' : 'easy';
  return { level, hiddenSingles, needsGuess };
}

function hasUniqueSolution(grid) {
  const temp = grid.map(row => [...row]);
  return searchGrid(temp, 2) === 1;
}

function digSymmetric(grid, solution, targetHoles) {
  const positions = shuffle([...Array(81).keys()]);
  let dug = 0;
  for (const p of positions) {
    if (dug >= targetHoles) break;
    const r1 = Math.floor(p / 9), c1 = p % 9;
    const r2 = 8 - r1, c2 = 8 - c1;
    if (grid[r1][c1] === 0) continue;
    const s1 = grid[r1][c1], s2 = grid[r2][c2];
    grid[r1][c1] = 0;
    if (r1 !== r2 || c1 !== c2) grid[r2][c2] = 0;
    if (hasUniqueSolution(grid)) {
      dug += (r1 === r2 && c1 === c2) ? 1 : 2;
    } else {
      grid[r1][c1] = s1;
      if (r1 !== r2 || c1 !== c2) grid[r2][c2] = s2;
    }
  }
  return dug;
}

function digRandom(grid, solution, targetHoles) {
  const positions = shuffle([...Array(81).keys()]);
  let dug = 0;
  for (const p of positions) {
    if (dug >= targetHoles) break;
    const r = Math.floor(p / 9), c = p % 9;
    if (grid[r][c] === 0) continue;
    const s = grid[r][c];
    grid[r][c] = 0;
    if (hasUniqueSolution(grid)) dug++;
    else grid[r][c] = s;
  }
  return dug;
}

const DIFFICULTY_CONFIG = {
  easy:   { holes: 38, symmetric: false, targetLevel: 'easy',   label: '简单' },
  medium: { holes: 48, symmetric: true,  targetLevel: 'medium', label: '中等' },
  hard:   { holes: 56, symmetric: true,  targetLevel: 'hard',   label: '困难' },
};

function generatePuzzle(difficulty) {
  const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.medium;
  const maxAttempts = 25;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const grid = Array.from({ length: 9 }, () => Array(9).fill(0));
    const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    let idx = 0;
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++)
        grid[r][c] = nums[idx++];
    if (!solve(grid)) continue;
    const solution = grid.map(row => [...row]);

    if (config.symmetric) digSymmetric(grid, solution, config.holes);
    else digRandom(grid, solution, config.holes);

    const analysis = analyzeDifficulty(grid);
    const isOK = state.diagonalMode
      ? (analysis.level === config.targetLevel) ||
        (config.targetLevel === 'hard' && analysis.needsGuess) ||
        (config.targetLevel === 'medium' && (analysis.hiddenSingles > 0 || analysis.needsGuess))
      : analysis.level === config.targetLevel;

    if (isOK) return { puzzle: grid, solution };
  }

  // 兜底
  const grid = Array.from({ length: 9 }, () => Array(9).fill(0));
  const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  let idx = 0;
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      grid[r][c] = nums[idx++];
  if (!solve(grid)) {
    grid.forEach(row => row.fill(0));
    solve(grid);
  }
  const solution = grid.map(row => [...row]);
  const holes = state.diagonalMode
    ? { easy: 30, medium: 40, hard: 48 }[difficulty] || 40
    : config.holes;
  digRandom(grid, solution, holes);
  return { puzzle: grid, solution };
}

// ---------- 状态 ----------
let state = {
  puzzle: [], solution: [], userGrid: [], given: [],
  selectedCell: null, mistakes: 0, timer: 0,
  timerInterval: null, paused: false, notesMode: false,
  history: [], historyIndex: -1, hintUsed: false,
  difficulty: 'medium', diagonalMode: false, evenMode: false, evenCells: [],
};
window.__sudokuDiagonalMode = false;

// ---------- DOM 引用 ----------
const $ = id => document.getElementById(id);
const boardEl = $('board'), timerEl = $('timer'), mistakesEl = $('mistakes');
const progressCountEl = $('progress-count'), progressBarEl = $('progress-bar');
const progressCaption = $('progress-caption'), difficultySelect = $('difficulty-select');
const diagonalToggle = $('diagonal-toggle'), diagonalRule = $('diagonal-rule');
const pauseButton = $('pause-button'), pauseOverlay = $('pause-overlay'), resumeButton = $('resume-button');
const eraseButton = $('erase-button'), notesButton = $('notes-button');
const hintButton = $('hint-button'), hintMenu = $('hint-menu');
const undoButton = $('undo-button'), redoButton = $('redo-button');
const newGameButton = $('new-game-button'), themeButton = $('theme-button');
const helpButton = $('help-button'), dailyButton = $('daily-button');
const winDialog = $('win-dialog'), winTimeEl = $('win-time');
const infoDialog = $('info-dialog'), toastEl = $('toast');

// ---------- 初始化 ----------
function init() {
  loadTheme(); bindEvents(); setupAudioControls(); loadProgress();
  if (!state.puzzle.length) startNewGame();
  else { renderBoard(); updateMistakes(); updateProgress(); if (!state.paused) startTimer(); }
  updateDiagonalRuleVisibility();
}

function updateDiagonalRuleVisibility() {
  if (diagonalRule) diagonalRule.style.display = state.diagonalMode ? 'block' : 'none';
  if (diagonalToggle) diagonalToggle.setAttribute('aria-pressed', String(state.diagonalMode));
  window.__sudokuDiagonalMode = state.diagonalMode;
  window.__sudokuEvenCells = state.evenMode ? state.evenCells : [];
  $('even-toggle')?.setAttribute('aria-pressed', String(state.evenMode));
  if ($('even-rule')) $('even-rule').hidden = !state.evenMode;
}

function startNewGame() {
  audio.setPaused(document.hidden);
  state.difficulty = difficultySelect ? difficultySelect.value : 'medium';
  state.evenCells = [];
  const { puzzle, solution } = generatePuzzle(state.difficulty);
  state.evenCells = state.evenMode ? makeEvenCells(solution, puzzle) : [];
  state.puzzle = puzzle; state.solution = solution;
  state.userGrid = puzzle.map(row => [...row]);
  state.given = puzzle.map(row => row.map(v => v !== 0));
  state.mistakes = 0; state.timer = 0; state.paused = false;
  state.notesMode = false; state.history = []; state.historyIndex = -1;
  state.hintUsed = false; state.selectedCell = null;
  if (pauseOverlay) pauseOverlay.hidden = true;
  if (timerEl) timerEl.textContent = formatTime(0);
  updateDiagonalRuleVisibility();
  renderBoard(); updateMistakes(); updateProgress();
  stopTimer(); startTimer(); saveProgress();
}

// ---------- 渲染 ----------
function renderBoard() {
  if (!boardEl) return;
  boardEl.setAttribute('aria-busy', 'false');
  boardEl.innerHTML = '';
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell'; cell.setAttribute('role', 'gridcell');
      cell.dataset.row = r; cell.dataset.col = c; cell.tabIndex = -1;
      if (state.given[r][c]) { cell.classList.add('given'); cell.textContent = state.puzzle[r][c]; }
      else if (state.userGrid[r][c] !== 0) { cell.textContent = state.userGrid[r][c]; }
      if (r % 3 === 0 && r !== 0) cell.style.borderTop = '2px solid var(--border-strong)';
      if (c % 3 === 0 && c !== 0) cell.style.borderLeft = '2px solid var(--border-strong)';
      if (state.diagonalMode && (r === c || r + c === 8)) cell.classList.add('diagonal-cell');
      if (state.evenMode && state.evenCells.includes(r * 9 + c)) cell.classList.add('even-cell');
      cell.setAttribute('aria-label', `第 ${r + 1} 行第 ${c + 1} 列${state.evenMode && state.evenCells.includes(r * 9 + c) ? '，圆圈内只能填偶数' : ''}`);
      updateCellFeedback(cell, r, c);
      cell.addEventListener('click', () => selectCell(cell, r, c));
      boardEl.appendChild(cell);
    }
  }
  renderDigitPad();
}

function renderDigitPad() {
  const digitPad = document.getElementById('digit-pad');
  if (!digitPad) return; digitPad.innerHTML = '';
  for (let n = 1; n <= 9; n++) {
    const btn = document.createElement('button');
    btn.className = 'digit-button'; btn.type = 'button'; btn.textContent = n;
    btn.addEventListener('click', () => inputNumber(n));
    digitPad.appendChild(btn);
  }
}

// ---------- ✅ 冲突高亮联动 ----------
/**
 * 找出所有与 (r,c) 填 value 相冲突的格子
 * 判定：同行 / 同列 / 同宫 /（对角线模式）同对角线，且值相同
 */
function getConflictCells(r, c, value) {
  if (!value) return [];
  const conflicts = [];
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (i === r && j === c) continue;               // 不看自己
      if (state.userGrid[i][j] !== value) continue;  // 值不同不算冲突
      const sameRow = i === r;
      const sameCol = j === c;
      const sameBox = Math.floor(i / 3) === Math.floor(r / 3) && Math.floor(j / 3) === Math.floor(c / 3);
      const sameDiag = state.diagonalMode && (
        (i === j && r === c) || (i + j === 8 && r + c === 8)
      );
      if (sameRow || sameCol || sameBox || sameDiag) {
        conflicts.push({ r: i, c: j });
      }
    }
  }
  return conflicts;
}

/** 给一组冲突格子加高亮；返回实际高亮了几个 */
function highlightConflicts(conflicts) {
  conflicts.forEach(({ r, c }) => {
    const el = boardEl.querySelector(`[data-row="${r}"][data-col="${c}"]`);
    if (el) el.classList.add('conflict-peer');
  });
  return conflicts.length;
}

/** 清除所有冲突联动高亮 */
function clearConflictHighlights() {
  boardEl.querySelectorAll('.cell.conflict-peer').forEach(el => el.classList.remove('conflict-peer'));
}

// ---------- 选格 ----------
function selectCell(cell, r, c) {
  if (state.paused) return;

  // ✅ 先清掉上一次的冲突高亮
  clearConflictHighlights();
  document.querySelectorAll('.cell.selected').forEach(el => el.classList.remove('selected'));

  if (state.selectedCell && state.selectedCell.el === cell) {
    state.selectedCell = null;
    return;
  }

  cell.classList.add('selected');
  cell.tabIndex = 0;
  cell.focus();
  state.selectedCell = { el: cell, r, c };

  // ✅ 选中已有数字的格子 → 联动高亮所有冲突格
  const value = state.userGrid[r][c];
  if (value !== 0) {
    const conflicts = getConflictCells(r, c, value);
    highlightConflicts(conflicts);
  }
}

// ---------- 反馈 ----------
function updateCellFeedback(cell, r, c) {
  const value = state.userGrid[r][c], given = state.given[r][c];
  const wrong = !given && value !== 0 && value !== state.solution[r][c];
  let diagonalConflict = false;
  if (state.diagonalMode && value !== 0 && !wrong) {
    if (r === c) {
      for (let i = 0; i < 9; i++)
        if (i !== r && state.userGrid[i][i] === value) { diagonalConflict = true; break; }
    }
    if (!diagonalConflict && r + c === 8) {
      for (let i = 0; i < 9; i++) {
        const j = 8 - i;
        if (i !== r && state.userGrid[i][j] === value) { diagonalConflict = true; break; }
      }
    }
  }
  cell.classList.toggle('user-entry', !given && value !== 0);
  cell.classList.toggle('error', wrong || diagonalConflict);
  cell.setAttribute('aria-invalid', String(wrong || diagonalConflict));
}

// ---------- 填数 ----------
function inputNumber(num) {
  if (!state.selectedCell || state.paused) return;
  const { el, r, c } = state.selectedCell;
  if (state.given[r][c]) return;

  state.history = state.history.slice(0, state.historyIndex + 1);
  state.history.push({ r, c, prev: state.userGrid[r][c], next: num });
  state.historyIndex++;
  state.userGrid[r][c] = num;
  el.textContent = num; el.classList.remove('notes', 'error'); el.dataset.notes = '';
  el.classList.remove('pop', 'error-flash'); updateCellFeedback(el, r, c); void el.offsetWidth;

  if (num !== state.solution[r][c]) {
    el.classList.add('error-flash'); state.mistakes++; updateMistakes(); safeSfx('error');
    if (state.mistakes >= 3) showToast('别急，静下心来慢慢填～');
  } else {
    el.classList.add('pop'); safeSfx('input'); updateProgress(); checkWin();
  }

  // ✅ 冲突联动：填完刷新（填错了也照样显示冲突格，方便你找出来）
  clearConflictHighlights();
  highlightConflicts(getConflictCells(r, c, num));

  saveProgress(); updateUndoRedoButtons();
}

function safeSfx(name) {
  try { if (sfx && typeof sfx[name] === 'function') sfx[name](); } catch (e) {}
}

// ---------- 擦除 ----------
function eraseCell() {
  if (!state.selectedCell || state.paused) return;
  const { el, r, c } = state.selectedCell;
  if (state.given[r][c] || state.userGrid[r][c] === 0) return;
  state.history.push({ r, c, prev: state.userGrid[r][c], next: 0 }); state.historyIndex++;
  state.userGrid[r][c] = 0; el.textContent = '';
  el.classList.remove('error', 'error-flash', 'notes', 'pop'); el.dataset.notes = '';
  updateCellFeedback(el, r, c);

  // ✅ 擦除后冲突自然解除，清掉高亮
  clearConflictHighlights();

  updateProgress(); saveProgress(); updateUndoRedoButtons();
}

// ---------- 笔记 ----------
function toggleNotes() {
  state.notesMode = !state.notesMode;
  if (notesButton) { notesButton.setAttribute('aria-pressed', String(state.notesMode)); notesButton.classList.toggle('active', state.notesMode); }
}

// ---------- 提示菜单 ----------
function setupHintMenu() {
  if (!hintButton || !hintMenu) return;
  hintButton.addEventListener('click', e => { e.stopPropagation(); hintMenu.hidden = !hintMenu.hidden; });
  document.addEventListener('click', () => { if (hintMenu) hintMenu.hidden = true; });
  hintMenu.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      if (hintMenu) hintMenu.hidden = true;
      if (!state.selectedCell) selectFirstEmpty();
      if (!state.selectedCell) return;
      const type = btn.dataset.hint;
      if (type === 'candidates') {
        const count = showCandidates(); safeSfx('hint'); state.hintUsed = true;
        showToast(count > 0 ? `已标出 ${count} 格候选数` : '当前没有可显示的候选数');
      } else if (type === 'location') {
        const count = highlightUniqueLocation(); safeSfx('hint'); state.hintUsed = true;
        showToast(count > 0 ? '找到了唯一位置，已高亮' : '暂时没有唯一位置的格子');
      } else if (type === 'fill') {
        const ok = fillOneCorrect(); safeSfx('hint'); state.hintUsed = true;
        if (ok) { syncUserGridFromBoard(); updateProgress(); checkWin(); }
        else showToast('当前没有可自动填入的格子');
      }
      saveProgress();
    });
  });
}

function syncUserGridFromBoard() {
  const cells = boardEl ? boardEl.querySelectorAll('.cell') : [];
  cells.forEach(cell => { const r = +cell.dataset.row, c = +cell.dataset.col, v = parseInt(cell.textContent, 10); if (!cell.classList.contains('notes') && !isNaN(v) && v >= 1 && v <= 9) state.userGrid[r][c] = v; });
  cells.forEach(cell => { const r = +cell.dataset.row, c = +cell.dataset.col; if (!state.given[r][c]) updateCellFeedback(cell, r, c); });
  clearConflictHighlights();
}

function selectFirstEmpty() {
  const cells = boardEl ? boardEl.querySelectorAll('.cell:not(.given)') : [];
  for (const cell of cells) { const r = +cell.dataset.row, c = +cell.dataset.col; if (state.userGrid[r][c] === 0) { selectCell(cell, r, c); break; } }
}

// ---------- 进度 / 错误 / 胜利 ----------
function updateProgress() {
  let filled = 0;
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (state.userGrid[r][c] !== 0) filled++;
  if (progressCountEl) progressCountEl.textContent = filled;
  if (progressBarEl) progressBarEl.style.width = (filled / 81 * 100) + '%';
  if (progressCaption) {
    progressCaption.textContent = filled === 81 ? '这一局，你静下来了。' : filled === 0 ? '慢慢来，每填一格都算进步。' : `还差 ${81 - filled} 格，节奏刚好。`;
  }
}

function updateMistakes() { if (mistakesEl) mistakesEl.textContent = state.mistakes; }

function checkWin() {
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (state.userGrid[r][c] !== state.solution[r][c]) return;
  stopTimer(); safeSfx('win');
  if (winTimeEl) winTimeEl.textContent = timerEl ? timerEl.textContent : formatTime(state.timer);
  if (winDialog && typeof winDialog.showModal === 'function') setTimeout(() => { audio.setPaused(true); winDialog.showModal(); }, 350);
  updateRecord();
}

function updateRecord() {
  const raw = localStorage.getItem('sudoku-record');
  const record = raw ? JSON.parse(raw) : { count: 0, best: null };
  record.count++;
  if (!record.best || state.timer < record.best) record.best = state.timer;
  localStorage.setItem('sudoku-record', JSON.stringify(record));
  const elC = document.getElementById('completed-count'), elB = document.getElementById('best-time');
  if (elC) elC.textContent = record.count;
  if (elB) elB.textContent = record.best !== null ? formatTime(record.best) : '—';
}

// ---------- 计时 / 暂停 / 撤销重做 ----------
function startTimer() {
  stopTimer();
  if (document.hidden || document.getElementById('view-sudoku')?.hidden) return;
  state.timerInterval = setInterval(() => {
    if (!state.paused) { state.timer++; if (timerEl) { timerEl.textContent = formatTime(state.timer); timerEl.setAttribute('datetime', `PT${state.timer}S`); } }
  }, 1000);
}
function stopTimer() { if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; } }
function formatTime(sec) { return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`; }

function togglePause() {
  state.paused = !state.paused; audio.setPaused(state.paused || document.hidden);
  if (pauseOverlay) pauseOverlay.hidden = !state.paused;
  if (state.paused) stopTimer(); else startTimer();
  clearConflictHighlights();
}

function undo() {
  if (state.historyIndex < 0 || state.paused) return;
  const a = state.history[state.historyIndex]; state.userGrid[a.r][a.c] = a.prev; state.historyIndex--;
  renderBoard(); updateProgress(); saveProgress(); updateUndoRedoButtons();
}

function redo() {
  if (state.historyIndex >= state.history.length - 1 || state.paused) return;
  const a = state.history[state.historyIndex + 1]; state.userGrid[a.r][a.c] = a.next; state.historyIndex++;
  renderBoard(); updateProgress(); saveProgress(); updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
  if (undoButton) undoButton.disabled = state.historyIndex < 0;
  if (redoButton) redoButton.disabled = state.historyIndex >= state.history.length - 1;
}

// ---------- 主题 / 音效 / 存档 ----------
function loadTheme() {
  const saved = localStorage.getItem('theme');
  const t = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', t); updateThemeButton(t);
}
function updateThemeButton(t) { if (themeButton) themeButton.textContent = t === 'dark' ? '☀️' : '🌓'; }
function toggleTheme() { const cur = document.documentElement.getAttribute('data-theme'); const next = cur === 'dark' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', next); localStorage.setItem('theme', next); updateThemeButton(next); }

function setupAudioControls() {
  const music = document.getElementById('music-button');
  const effects = document.getElementById('effects-button');
  const volume = document.getElementById('volume-slider');
  const status = document.getElementById('audio-status');
  function renderAudio() {
    const prefs = audio.getSettings();
    music.setAttribute('aria-pressed', String(prefs.music));
    effects.setAttribute('aria-pressed', String(prefs.effects));
    music.textContent = !prefs.music ? '♫ 播放音乐' : prefs.playing ? '♫ 暂停音乐' : prefs.paused ? '♫ 音乐已启用' : '♫ 点击恢复';
    effects.textContent = prefs.effects ? '♪ 音效开启' : '♪ 音效关闭';
    music.disabled = effects.disabled = volume.disabled = !prefs.supported;
    volume.value = prefs.volume;
    document.getElementById('volume-value').textContent = `${prefs.volume}%`;
    const message = !prefs.supported ? '当前浏览器不支持声音，仍可正常解题。' :
      !prefs.volume ? '当前已静音。' :
      prefs.music && prefs.paused ? '游戏暂停或页面在后台，继续游戏后播放音乐。' :
      prefs.music && prefs.playbackError ? prefs.playbackError :
      prefs.music && !prefs.unlocked ? '点击棋盘即可恢复舒缓音乐。' :
      prefs.playing ? '正在播放舒缓音乐。若听不到，请检查浏览器标签页和系统音量。' : '点击“播放音乐”，开启一段舒缓旋律。';
    if (status.textContent !== message) status.textContent = message;
  }
  music.addEventListener('click', () => {
    const prefs = audio.getSettings();
    if (prefs.music && !prefs.playing && !prefs.paused) void audio.unlock();
    else void audio.setMusicEnabled(!prefs.music);
  });
  effects.addEventListener('click', () => {
    audio.setEffectsEnabled(!audio.getSettings().effects);
    if (audio.getSettings().effects) sfx.hint();
  });
  volume.addEventListener('input', () => audio.setVolume(volume.value));
  window.addEventListener('sudoku-audio-change', renderAudio);
  const resumeAudio = (event) => {
    // The music button handles its own gesture. Resuming on pointerdown here
    // would make its subsequent click see "playing" and immediately turn it off.
    if (event.target.closest?.('#music-button, #mines-music-button')) return;
    if (audio.getSettings().music) void audio.unlock();
  };
  document.addEventListener('pointerdown', resumeAudio, { passive: true });
  document.addEventListener('keydown', resumeAudio);
  document.addEventListener('visibilitychange', () => {
    if (document.getElementById('view-sudoku')?.hidden) return;
    audio.setPaused(document.hidden || state.paused || winDialog.open);
  });
  renderAudio();
}

function saveProgress() {
  const data = { puzzle: state.puzzle, solution: state.solution, userGrid: state.userGrid, given: state.given, mistakes: state.mistakes, timer: state.timer, history: state.history.slice(-50), historyIndex: state.historyIndex, difficulty: state.difficulty, diagonalMode: state.diagonalMode, evenMode: state.evenMode, evenCells: state.evenCells };
  try { localStorage.setItem('sudoku-progress', JSON.stringify(data)); } catch (e) {}
}

function loadProgress() {
  const raw = localStorage.getItem('sudoku-progress'); if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    Object.assign(state, { puzzle: data.puzzle || [], solution: data.solution || [], userGrid: data.userGrid || [], given: data.given || [], mistakes: data.mistakes || 0, timer: data.timer || 0, history: data.history || [], historyIndex: data.historyIndex || -1, difficulty: data.difficulty || 'medium', diagonalMode: data.diagonalMode || false, evenMode: data.evenMode === true, evenCells: Array.isArray(data.evenCells) ? data.evenCells : [] });
    if (difficultySelect) difficultySelect.value = state.difficulty;
    if (timerEl) timerEl.textContent = formatTime(state.timer);
    updateDiagonalRuleVisibility(); return true;
  } catch (e) { return false; }
}

let toastTimer = null;
function showToast(msg) {
  if (!toastEl) return; toastEl.textContent = msg; toastEl.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2200);
}

// ---------- 键盘 / 事件绑定 ----------
function bindKeyboard() {
  document.addEventListener('keydown', e => {
    if (state.paused || document.getElementById('view-sudoku')?.hidden) return;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.target && e.target.closest?.('dialog')) return;
    if (e.key >= '1' && e.key <= '9') inputNumber(+e.key);
    else if (e.key === 'Delete' || e.key === 'Backspace') eraseCell();
    else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo(); }
    else if (e.key === 'y' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); redo(); }
    else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      if (!state.selectedCell) return; e.preventDefault();
      let { r, c } = state.selectedCell;
      if (e.key === 'ArrowUp') r = (r - 1 + 9) % 9; if (e.key === 'ArrowDown') r = (r + 1) % 9;
      if (e.key === 'ArrowLeft') c = (c - 1 + 9) % 9; if (e.key === 'ArrowRight') c = (c + 1) % 9;
      const nextCell = boardEl ? boardEl.querySelector(`[data-row="${r}"][data-col="${c}"]`) : null;
      if (nextCell) selectCell(nextCell, r, c);
    }
  });
}

function bindEvents() {
  if (pauseButton) pauseButton.addEventListener('click', togglePause);
  if (resumeButton) resumeButton.addEventListener('click', togglePause);
  if (eraseButton) eraseButton.addEventListener('click', eraseCell);
  if (notesButton) notesButton.addEventListener('click', toggleNotes);
  if (undoButton) undoButton.addEventListener('click', undo);
  if (redoButton) redoButton.addEventListener('click', redo);
  if (newGameButton) newGameButton.addEventListener('click', () => { if (confirm('开始新一局？当前进度将丢失。')) startNewGame(); });
  if (themeButton) themeButton.addEventListener('click', toggleTheme);
  if (difficultySelect) difficultySelect.addEventListener('change', () => { if (confirm('切换难度将开始新一局，确定？')) startNewGame(); });

  if (diagonalToggle) {
    diagonalToggle.addEventListener('click', () => {
      if (confirm('切换模式将开始新一局，确定？')) { state.diagonalMode = !state.diagonalMode; updateDiagonalRuleVisibility(); startNewGame(); }
    });
  }

  $('even-toggle')?.addEventListener('click', () => {
    if (confirm('切换偶数规则将开始新一局，确定？')) { state.evenMode = !state.evenMode; startNewGame(); }
  });

  // ✅ 难度说明悬浮
  const difficultyHelp = document.getElementById('difficulty-help');
  const difficultyTooltip = document.getElementById('difficulty-tooltip');
  if (difficultyHelp && difficultyTooltip) {
    difficultyHelp.addEventListener('click', e => { e.stopPropagation(); difficultyTooltip.hidden = !difficultyTooltip.hidden; });
    document.addEventListener('click', () => { if (difficultyTooltip) difficultyTooltip.hidden = true; });
  }

  if (helpButton && infoDialog) helpButton.addEventListener('click', () => {
    const dialog = document.getElementById('view-sudoku')?.hidden ? $('mines-help-dialog') : infoDialog;
    dialog?.showModal();
  });
  const dialogClose = document.getElementById('dialog-close'), dialogOk = document.getElementById('dialog-ok');
  if (dialogClose && infoDialog) dialogClose.addEventListener('click', () => infoDialog.close());
  if (dialogOk && infoDialog) dialogOk.addEventListener('click', () => infoDialog.close());
  const winNewGame = document.getElementById('win-new-game');
  if (winNewGame && winDialog) winNewGame.addEventListener('click', () => { winDialog.close(); startNewGame(); });
  if (dailyButton) dailyButton.addEventListener('click', () => { showToast('已为你开启今日挑战'); startNewGame(); });
  const syncActiveView = () => {
    if (document.getElementById('view-sudoku')?.hidden) { stopTimer(); saveProgress(); return; }
    audio.setPaused(document.hidden || state.paused || winDialog.open);
    if (!document.hidden && !state.paused && !winDialog.open) startTimer(); else stopTimer();
  };
  document.addEventListener('visibilitychange', syncActiveView);
  window.addEventListener('game-view-change', syncActiveView);
  setupHintMenu(); bindKeyboard();
}

init();
