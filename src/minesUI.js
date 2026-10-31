// ============================================================
// 扫雷 · UI 绑定层（minesweeper.js 的纯 DOM 外壳）
// 只在切换到扫雷视图时激活，暂停/切走时停掉计时与音效。
// ============================================================

import { Minesweeper, PRESETS, formatTime, COUNT_COLOR, MINE_CELL } from './minesweeper.js?v=20261031-ui2';
import { audio } from './audio.js?v=20261031-ui2';

const $ = id => document.getElementById(id);

let game = null;
let active = false;
let moveR = 0, moveC = 0;

const FACE = { idle: '☺', wow: '◉', win: '😎', boom: '☹' };

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// ---------- 渲染 ----------
function render() {
  const field = $('minefield');
  if (!field || !game) return;
  const { cols, rows, board, adj, over, won } = game;
  field.style.setProperty('--cols', cols);
  field.innerHTML = '';
  field.setAttribute('aria-colcount', cols);
  field.setAttribute('aria-rowcount', rows);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const cell = el('div', 'mcell', '');
      cell.dataset.row = r; cell.dataset.col = c;
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', `${r + 1} 行 ${c + 1} 列`);
      cell.tabIndex = (r === moveR && c === moveC) ? 0 : -1;
      const v = board[i];

      if (v === MINE_CELL.REVEALED) {
        cell.classList.add('open');
        const n = adj[i];
        if (n > 0) {
          const s = el('span', 'mnum', n);
          s.style.color = COUNT_COLOR[n] || 'var(--text)';
          cell.appendChild(s);
        }
      } else if (v === MINE_CELL.FLAG) {
        cell.classList.add('flag');
        cell.innerHTML = '<span aria-hidden="true">🚩</span>';
        cell.setAttribute('aria-label', `${r + 1} 行 ${c + 1} 列，已标旗`);
      } else if (v === MINE_CELL.QUESTION) {
        cell.classList.add('question');
        cell.textContent = '?';
      } else if (v === 'boom') {
        cell.classList.add('open', 'mine', 'boom');
        cell.textContent = '💥';
      } else if (over && game.mines[i]) {
        // 结算时露出所有雷；误标的旗单独区分
        cell.classList.add('mine');
        cell.textContent = board[i] === MINE_CELL.FLAG ? '🚩' : '◈';
        if (board[i] === MINE_CELL.FLAG) cell.classList.add('flag-was-right');
      } else if (game.mines[i] && won) {
        cell.classList.add('mine', 'mine-clear');
        cell.textContent = '◈';
      }

      cell.addEventListener('click', e => { e.preventDefault(); focusCell(cell, r, c); game.reveal(r, c); });
      cell.addEventListener('contextmenu', e => { e.preventDefault(); focusCell(cell, r, c); game.cycleMark(r, c); });
      cell.addEventListener('mouseenter', () => { if (active && !game.over) setFace('wow'); });
      cell.addEventListener('mouseleave', () => { if (active && !game.over) setFace('idle'); });
      cell.addEventListener('focus', () => { moveR = r; moveC = c; refreshFocus(); });
      field.appendChild(cell);
    }
  }
  refreshFocus();
}

function refreshFocus() {
  const field = $('minefield');
  if (!field || !game) return;
  field.querySelectorAll('.mcell').forEach(c => {
    const on = +c.dataset.row === moveR && +c.dataset.col === moveC;
    c.classList.toggle('cursor', on);
    c.tabIndex = on ? 0 : -1;
  });
}

function focusCell(cell, r, c) { moveR = r; moveC = c; refreshFocus(); cell.focus({ preventScroll: true }); }

// ---------- HUD ----------
function updateHud(_g, payload = {}) {
  if (!game) return;
  const left = game.minesLeft();
  const flags = game.flags();
  setText('mines-total', game.mineTotal);
  setText('mines-size', `${game.cols} × ${game.rows}`);
  setText('mines-flags', flags);
  setText('mines-left', left);
  setText('mines-flag-meter', flags);
  const tl = $('mines-hud-left');
  if (tl) tl.textContent = String(Math.max(0, Math.min(999, left))).padStart(3, '0');
  const t = $('mines-timer');
  if (t) { t.textContent = String(Math.min(999, game.elapsed)).padStart(3, '0'); t.setAttribute('datetime', `PT${game.elapsed}S`); }

  if (payload.win) setFace('win');
  else if (payload.boom) setFace('boom');
  else if (!game.firstMove) setFace('idle');
  else if (!game.over) setFace('idle');

  const cap = $('mines-objective-caption');
  if (cap) {
    cap.textContent = game.over ? (game.won ? '全部雷区已清空，这一局你很稳。' : '踩到雷了。没关系，下一局更清醒。')
      : !game.firstMove ? '左键揭开，右键插旗。第一下永远安全。'
      : left === 0 ? '旗数已对上雷数，再核对一遍就赢了。' : `还剩 ${left} 颗雷藏在未知里。`;
  }
  refreshRecords();
}

function setFace(state) {
  const g = $('mine-face-glyph');
  if (g) g.textContent = FACE[state] ?? '☺';
  const b = $('mine-face');
  if (b) b.setAttribute('aria-label', state === 'boom' ? '游戏结束，点击重来' : '重新开始');
}

function refreshRecords() {
  for (const k of ['easy', 'medium', 'hard']) {
    const e = $(`mine-record-${k}`);
    if (e) { const b = Minesweeper.getRecord(k); e.textContent = b == null ? '—' : formatTime(b); }
  }
}

function setText(id, v) { const e = $(id); if (e) e.textContent = v; }

// ---------- 键盘 ----------
function bindKeys() {
  document.addEventListener('keydown', e => {
    if (!active || !game) return;
    const tag = e.target?.tagName;
    if (tag === 'SELECT' || tag === 'INPUT' || e.target?.closest?.('dialog')) return;
    const field = $('minefield');
    if (!field?.contains(e.target) && e.target !== field) {
      // 允许在页面任意处用方向键移动雷区焦点
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'f', 'F', ' '].includes(e.key)) return;
      if (e.target?.closest?.('.game-tab')) return;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      const { cols, rows } = game;
      if (e.key === 'ArrowUp') moveR = (moveR - 1 + rows) % rows;
      if (e.key === 'ArrowDown') moveR = (moveR + 1) % rows;
      if (e.key === 'ArrowLeft') moveC = (moveC - 1 + cols) % cols;
      if (e.key === 'ArrowRight') moveC = (moveC + 1) % cols;
      const next = field?.querySelector(`.mcell[data-row="${moveR}"][data-col="${moveC}"]`);
      if (next) focusCell(next, moveR, moveC);
      return;
    }
    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault(); game.toggleFlag(moveR, moveC); return;
    }
    if (e.key === ' ') {
      e.preventDefault();
      const i = moveR * game.cols + moveC;
      const acted = game.chord(moveR, moveC) || game.reveal(moveR, moveC);
      if (!acted) { const c = field?.querySelector(`.mcell[data-row="${moveR}"][data-col="${moveC}"]`); if (c) c.animate?.([{ transform: 'scale(.9)' }, { transform: 'scale(1)' }], { duration: 120 }); }
    }
  });
}

// ---------- 生命周期 ----------
function start(preset) {
  stop();
  game = new Minesweeper({ root: document.body });
  game.start(preset || $('mines-difficulty')?.value || 'easy');
  moveR = 0; moveC = 0;
  game.subscribe((_g, p) => { render(); updateHud(_g, p); });
  render(); updateHud(game);
}

function stop() {
  if (game) { game.destroy(); game = null; }
}

function resume() {
  if (!game) {
    const saved = Minesweeper.resume({ root: document.body });
    if (saved) {
      game = saved;
      // 恢复视图时重绑渲染回调
      game.subscribe((_g, p) => { render(); updateHud(_g, p); });
      moveR = 0; moveC = 0;
      render(); updateHud(game);
    } else start($('mines-difficulty')?.value || 'easy');
  }
}

export const minesApp = {
  id: 'mines',
  label: '扫雷',
  activate() {
    active = true;
    if (!game || game.over || !game.firstMove) resume();
    else { game._startTimer?.(); render(); }
    audio.setPaused(false);
  },
  deactivate() {
    active = false;
    audio.setPaused(true);
    if (game) { game._stopTimer?.(); game._save(); }
  },
  start,
  restart(preset) { start(preset); },
  destroy() { stop(); },
};

// 延迟绑定：DOM 可能在本模块加载后才完整
requestAnimationFrame(() => {
  bindKeys();
  $('mines-difficulty')?.addEventListener('change', e => {
    if (game && !game.over && game.firstMove) {
      if (!confirm('切换难度将开始新一局，确定？')) { e.target.value = game.preset; return; }
    }
    start(e.target.value);
  });
  $('mines-new-button')?.addEventListener('click', () => start($('mines-difficulty')?.value));
  $('mines-restart-button')?.addEventListener('click', () => start(game?.preset || $('mines-difficulty')?.value));
  $('mine-face')?.addEventListener('click', () => start(game?.preset || $('mines-difficulty')?.value));
  $('mines-pause-button')?.addEventListener('click', () => {
    if (!game) return;
    const on = !game._timer;
    if (on) { game._startTimer(); $('mines-pause-button').setAttribute('aria-pressed', 'false'); $('mines-pause-overlay').hidden = true; }
    else { game._stopTimer(); $('mines-pause-button').setAttribute('aria-pressed', 'true'); $('mines-pause-overlay').hidden = false; }
  });
  $('mines-resume-button')?.addEventListener('click', () => $('mines-pause-button').click());
  $('mines-help')?.addEventListener('click', () => $('help-button')?.click());

  // 扫雷专属音量与音乐控件（与数独共用同一份 audio 设置，UI 双向同步）
  const sync = () => {
    const prefs = audio.getSettings();
    const mb = $('mines-music-button'), eb = $('mines-effects-button');
    if (mb) { mb.setAttribute('aria-pressed', String(prefs.music)); mb.textContent = prefs.music ? '♫ 暂停音乐' : '♫ 播放音乐'; mb.disabled = !prefs.supported; }
    if (eb) { eb.setAttribute('aria-pressed', String(prefs.effects)); eb.textContent = prefs.effects ? '♪ 音效开启' : '♪ 音效关闭'; eb.disabled = !prefs.supported; }
    const vol = $('mines-volume-slider');
    if (vol) vol.value = prefs.volume;
    const vo = $('mines-volume-value');
    if (vo) vo.textContent = `${prefs.volume}%`;
    const st = $('mines-audio-status');
    if (st) st.textContent = !prefs.supported ? '当前浏览器不支持声音。'
      : !prefs.volume ? '当前已静音。'
      : prefs.music ? '正在播放舒缓音乐。' : '点击"播放音乐"，让排雷也安静下来。';
  };
  $('mines-music-button')?.addEventListener('click', () => {
    const prefs = audio.getSettings();
    if (prefs.music && !prefs.playing && !prefs.paused) void audio.unlock();
    else void audio.setMusicEnabled(!prefs.music);
  });
  $('mines-effects-button')?.addEventListener('click', () => audio.setEffectsEnabled(!audio.getSettings().effects));
  $('mines-volume-slider')?.addEventListener('input', e => audio.setVolume(e.target.value));
  window.addEventListener('sudoku-audio-change', sync);
  document.addEventListener('pointerdown', () => { if (active && audio.getSettings().music) void audio.unlock(); }, { passive: true });
  sync();

  // 未激活时若已有存档也不急着启动，等切到扫雷再恢复
  if (document.querySelector('.game-view.active')?.dataset.gameView === 'mines') minesApp.activate();
  else refreshRecords();
});
