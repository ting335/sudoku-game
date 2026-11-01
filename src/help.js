// Each game has an independent preference. A page visit shows each tutorial at
// most once; the visible button always opens it, including after opting out.
export function createHelpPreferences(storage) {
  const seen = new Set();
  const key = game => `quiet-game-help-${game}-v1`;
  return {
    hidden(game) { try { return storage?.getItem(key(game)) === 'hidden'; } catch { return false; } },
    save(game, hidden) { try { storage?.setItem(key(game), hidden ? 'hidden' : 'show'); } catch { /* Optional preference. */ } },
    shouldShow(game) { return !seen.has(game) && !this.hidden(game); },
    markSeen(game) { seen.add(game); },
  };
}

export function setupHelp() {
  let storage;
  try { storage = window.localStorage; } catch { /* Keep help available. */ }
  const prefs = createHelpPreferences(storage);
  const current = () => document.getElementById('view-sudoku')?.hidden ? 'mines' : 'sudoku';
  const notify = () => window.dispatchEvent(new Event('game-help-change'));
  function open(game, automatic = false) {
    if (automatic && !prefs.shouldShow(game)) return;
    const dialog = document.getElementById(game === 'mines' ? 'mines-help-dialog' : 'info-dialog');
    if (!dialog || dialog.open) return;
    dialog.querySelector('[data-help-hide]').checked = prefs.hidden(game);
    dialog.querySelector('.help-content').scrollTop = 0;
    dialog.showModal();
    prefs.markSeen(game);
    notify();
  }
  for (const game of ['sudoku', 'mines']) {
    const dialog = document.getElementById(game === 'mines' ? 'mines-help-dialog' : 'info-dialog');
    dialog.querySelectorAll('[data-help-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
    dialog.querySelector('[data-help-hide]').addEventListener('change', e => prefs.save(game, e.target.checked));
    dialog.addEventListener('close', notify); // Includes the native Escape key.
  }
  document.getElementById('help-button').addEventListener('click', () => open(current()));
  document.getElementById('mines-help').addEventListener('click', () => open('mines'));
  window.addEventListener('game-view-change', () => open(current(), true));
  open(current(), true);
}
