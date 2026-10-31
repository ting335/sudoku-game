// ============================================================
// 扫雷 · 静心一局 — minesweeper.js
// 与数独共用同一套视觉语言：同样的顶栏/侧栏骨架、同一套
// 计时器语义、同一套音效与暗色主题变量。
// 逻辑完全独立，不依赖数独的 state / DOM。
// ============================================================

import { sfx, audio } from './audio.js?v=20261031-dual';

const SAVE_KEY = 'minesweeper-progress-v1';
const RECORD_KEY = 'minesweeper-record-v1';

export const PRESETS = {
  easy:   { label: '初级', cols: 9,  rows: 9,  mines: 10, tone: 'easy' },
  medium: { label: '中级', cols: 16, rows: 16, mines: 40, tone: 'medium' },
  hard:   { label: '高级', cols: 30, rows: 16, mines: 99, tone: 'hard' },
};

const CELL = { HIDDEN: 0, REVEALED: 1, MINE: 2, FLAG: 3, QUESTION: 4 };

// ---------- 工具 ----------
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function idx(cols, r, c) { return r * cols + c; }
function inBounds(cols, rows, r, c) { return r >= 0 && r < rows && c >= 0 && c < cols; }

function makeGrid(cols, rows, fill) {
  const g = new Array(cols * rows);
  g.fill(fill);
  return g;
}

// 八邻域，按中心点是否越界裁剪，避免每帧重复判断
function neighbors(cols, rows, r, c) {
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    const nr = r + dr;
    if (nr < 0 || nr >= rows) continue;
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nc = c + dc;
      if (nc < 0 || nc >= cols) continue;
      out.push([nr, nc]);
    }
  }
  return out;
}

// ---------- 棋盘生成 ----------
// 采用经典规则：首次点击格及其八邻域绝不布雷，保证第一下永远安全。
function placeMines(cols, rows, total, safeR, safeC) {
  const safe = new Set();
  neighbors(cols, rows, safeR, safeC).forEach(([r, c]) => safe.add(idx(cols, r, c)));
  safe.add(idx(cols, safeR, safeC));

  const pool = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = idx(cols, r, c);
      if (!safe.has(i)) pool.push(i);
    }

  const mines = new Array(cols * rows).fill(false);
  for (const p of shuffle(pool).slice(0, total)) mines[p] = true;
  return mines;
}

function countAdjacent(mines, cols, rows) {
  const adj = makeGrid(cols, rows, 0);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (mines[idx(cols, r, c)]) { adj[idx(cols, r, c)] = -1; continue; }
      let n = 0;
      for (const [nr, nc] of neighbors(cols, rows, r, c)) {
        if (mines[idx(cols, nr, nc)]) n++;
      }
      adj[idx(cols, r, c)] = n;
    }
  return adj;
}

//  Flood-fill 展开空白区：遇到数字格就停下，形成连片"平原"。
function revealFlood(state, r, c) {
  const { cols, rows, board, adj } = state;
  const i = idx(cols, r, c);
  if (board[i] !== CELL.HIDDEN) return;
  const stack = [[r, c]];          // 局部栈：避免依赖实例字段，也避免跨局残留
  board[i] = CELL.REVEALED;
  while (stack.length) {
    const [cr, cc] = stack.pop();
    if (adj[idx(cols, cr, cc)] !== 0) continue;
    for (const [nr, nc] of neighbors(cols, rows, cr, cc)) {
      const k = idx(cols, nr, nc);
      if (board[k] === CELL.HIDDEN) {
        board[k] = CELL.REVEALED;
        if (adj[k] === 0) stack.push([nr, nc]);
      }
    }
  }
}

// ============================================================
//  Minesweeper 控制器
// ============================================================
export class Minesweeper {
  constructor(screen) {
    this.screen = screen;            // { root, board, status, timer, mines, ... } DOM 句柄
    this.listeners = new Set();     // 状态变化订阅（UI 层重渲染）
    this._onVis = () => this._resumeAudio();
    document.addEventListener('pointerdown', this._onVis, { passive: true });
  }

  _resumeAudio = () => { if (this.settings.music) void audio.unlock(); };

  // ---------- 存档 ----------
  _save() {
    if (!this.alive || this.over) return;
    const { cols, rows, mines, board, firstMove, elapsed, preset } = this;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        preset, cols, rows, mines: mines.slice(), board: board.slice(),
        firstMove, elapsed, at: Date.now(),
      }));
    } catch (e) { /* 配额不足时放弃，不阻断游戏 */ }
  }

  _clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }

  static resume(screen) {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      const p = PRESETS[d?.preset];
      if (!p || d.cols !== p.cols || d.rows !== p.rows ||
          !Array.isArray(d.board) || !Array.isArray(d.mines) ||
          d.board.length !== p.cols * p.rows || d.mines.length !== d.board.length ||
          d.mines.some(v => typeof v !== 'boolean') ||
          d.mines.filter(Boolean).length !== p.mines ||
          d.board.some((v,i) => ![CELL.HIDDEN,CELL.REVEALED,CELL.FLAG,CELL.QUESTION].includes(v) || (v === CELL.REVEALED && d.mines[i])) ||
          typeof d.firstMove !== 'boolean' || !Number.isInteger(d.elapsed) || d.elapsed < 0) return null;
      const m = new Minesweeper(screen);
      Object.assign(m, {
        preset: d.preset, mineTotal: p.mines, paused: false,
        cols: d.cols, rows: d.rows,
        mines: d.mines.slice(), board: d.board.slice(),
        firstMove: d.firstMove || false,
        elapsed: typeof d.elapsed === 'number' ? d.elapsed : 0,
      });
      m.adj = countAdjacent(m.mines, m.cols, m.rows);
      m.alive = true; m.over = false; m.won = false;
      // The active view starts the timer; loading alone must not run it.
      return m;
    } catch (e) { return null; }
  }

  // ---------- 生命周期 ----------
  start(preset = 'easy', seed) {
    const p = PRESETS[preset] || PRESETS.easy;
    this.preset = PRESETS[preset] ? preset : 'easy';
    this.cols = p.cols; this.rows = p.rows; this.mineTotal = p.mines;
    this.mines = placeMines(this.cols, this.rows, this.mineTotal, 0, 0);
    this.adj = countAdjacent(this.mines, this.cols, this.rows);
    this.board = makeGrid(this.cols, this.rows, CELL.HIDDEN);
    this.firstMove = false;
    this.elapsed = 0;
    this.alive = true; this.over = false; this.won = false; this.paused = false;
    this._lastTick = 0;
    this._notify();
    this._save();
  }

  restart(preset) { this.start(preset || this.preset); }

  destroy() {
    document.removeEventListener('pointerdown', this._onVis);
    this._stopTimer();
    this.listeners.clear();
  }

  // ---------- 计时 ----------
  _startTimer() {
    if (this._timer || this.paused || !this.firstMove || this.over) return;
    this._lastTick = performance.now();
    this._timer = requestAnimationFrame(this._loop);
  }

  _stopTimer() {
    if (!this._timer) return;
    cancelAnimationFrame(this._timer);
    this._timer = null;
  }

  _loop = (now) => {
    if (!this.alive || this.over || this.paused) { this._timer = null; return; }
    const dt = now - this._lastTick;
    if (dt >= 1000) {
      this._lastTick = now - (dt % 1000);
      this.elapsed++;
      this._notify({ tick: true });
      this._save();
    }
    this._timer = requestAnimationFrame(this._loop);
  };

  _tick() {
    if (this.firstMove && !this.over) this._startTimer();
    else this._notify({ tick: true });
  }

  setPaused(value) {
    this.paused = !!value;
    if (this.paused) this._stopTimer(); else this._startTimer();
    this._save();
  }

  // ---------- 操作 ----------
  reveal(r, c) {
    if (!this.alive || this.over || this.paused) return false;
    const i = idx(this.cols, r, c);
    if (!inBounds(this.cols, this.rows, r, c)) return false;
    if (this.board[i] !== CELL.HIDDEN) return false;

    // 首次点击：把雷位重新摆到点击点之外，保证零风险开局
    if (!this.firstMove) {
      this.mines = placeMines(this.cols, this.rows, this.mineTotal, r, c);
      this.adj = countAdjacent(this.mines, this.cols, this.rows);
      this.firstMove = true;
      this._startTimer();
    }

    if (this.mines[i]) {
      this.board[i] = CELL.MINE;
      this._explode(r, c);
      return true;
    }

    revealFlood(this, r, c);
    this._checkWin();
    this._notify();
    this._save();
    if (!this.over) safeSfx('dig');
    return true;
  }

  chord(r, c) {
    if (!this.alive || this.over || this.paused || !this.firstMove) return false;
    if (!inBounds(this.cols, this.rows, r, c)) return false;
    const i = idx(this.cols, r, c);
    if (this.board[i] !== CELL.REVEALED) return false;
    const n = this.adj[i];
    if (n <= 0) return false;
    const nb = neighbors(this.cols, this.rows, r, c);
    let flags = 0;
    for (const [nr, nc] of nb) if (this.board[idx(this.cols, nr, nc)] === CELL.FLAG) flags++;
    if (flags !== n) return false;
    let acted = false;
    for (const [nr, nc] of nb) {
      if (this.reveal(nr, nc)) acted = true;
    }
    return acted;
  }

  cycleMark(r, c) {
    if (!this.alive || this.over || this.paused || !this.firstMove) return false;
    const i = idx(this.cols, r, c);
    if (!inBounds(this.cols, this.rows, r, c)) return false;
    if (this.board[i] === CELL.REVEALED) return false;
    const next = this.board[i] === CELL.HIDDEN ? CELL.FLAG
      : this.board[i] === CELL.FLAG ? CELL.QUESTION : CELL.HIDDEN;
    this.board[i] = next;
    this._notify();
    this._save();
    safeSfx(next === CELL.FLAG ? 'flag' : 'unflag');
    return true;
  }

  // 数字格上左右键/空格：标旗；已标旗再按则取消（长按辅助）
  toggleFlag(r, c) {
    if (!this.alive || this.over || this.paused || !this.firstMove) return false;
    const i = idx(this.cols, r, c);
    if (!inBounds(this.cols, this.rows, r, c)) return false;
    if (this.board[i] === CELL.REVEALED || this.board[i] === CELL.MINE) return false;
    if (this.board[i] === CELL.FLAG) { this.board[i] = CELL.HIDDEN; safeSfx('unflag'); }
    else { this.board[i] = CELL.FLAG; safeSfx('flag'); }
    this._notify(); this._save(); return true;
  }

  _explode(r, c) {
    this.over = true; this.won = false;
    this._stopTimer();
    // 翻开全部雷：玩家标的旗里误标的也一并现形
    for (let i = 0; i < this.mines.length; i++) {
      if (this.mines[i] && this.board[i] !== CELL.FLAG) this.board[i] = CELL.MINE;
    }
    this.board[idx(this.cols, r, c)] = 'boom';
    this._notify({ boom: true });
    this._clearSave();
    safeSfx('boom');
  }

  _checkWin() {
    for (let i = 0; i < this.board.length; i++) {
      if (!this.mines[i] && this.board[i] !== CELL.REVEALED) return;
    }
    this.over = true; this.won = true;
    this._stopTimer();
    this._notify({ win: true });
    this._clearSave();
    this._updateRecord();
    safeSfx('win');
  }

  _updateRecord() {
    let raw;
    try { raw = localStorage.getItem(RECORD_KEY); } catch { raw = null; }
    const rec = raw ? (() => { try { return JSON.parse(raw); } catch (e) { return null; } })() : null;
    const cur = (rec && typeof rec === 'object') ? rec : { best: {} };
    const prev = cur.best?.[this.preset];
    if (prev == null || this.elapsed < prev) {
      cur.best = { ...(cur.best || {}), [this.preset]: this.elapsed };
    }
    try { localStorage.setItem(RECORD_KEY, JSON.stringify(cur)); } catch (e) {}
    this._notify({ recordChanged: true });
  }

  static getRecord(preset) {
    try {
      const cur = JSON.parse(localStorage.getItem(RECORD_KEY) || '{}');
      return cur?.best?.[preset] ?? null;
    } catch (e) { return null; }
  }

  // ---------- 派生状态（供渲染层使用，避免它自己算） ----------
  flags() {
    let n = 0;
    for (const v of this.board) if (v === CELL.FLAG) n++;
    return n;
  }

  minesLeft() { return Math.max(0, this.mineTotal - this.flags()); }

  get settings() { return { music: audio.getSettings().music }; }

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _notify(payload) { for (const fn of this.listeners) fn(this, payload || {}); }
}

// ---------- 音效包装（吞掉异常，避免打断交互） ----------
function safeSfx(name) {
  try { if (sfx && typeof sfx[name] === 'function') sfx[name](); } catch (e) {}
}

export const MINE_CELL = CELL;
export function formatTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

// 雷区数字配色：沿用数独的墨绿主色，只在 1/2 用柔和冷暖区分
export const COUNT_COLOR = [
  null,
  'var(--mine-1, #3d6b8a)',
  'var(--mine-2, #2f7a55)',
  'var(--mine-3, #c08a3a)',
  'var(--mine-4, #a8544e)',
  'var(--mine-5, #8a5a8f)',
  'var(--mine-6, #3f7a7a)',
  'var(--mine-7, #5a5a5a)',
  'var(--mine-8, #3a3a3a)',
];
