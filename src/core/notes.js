export const cleanNotes = values => [...new Set(Array.isArray(values) ? values.filter(n => Number.isInteger(n) && n >= 1 && n <= 9) : [])].sort((a,b)=>a-b);
export function editCell(state, r, c, next, notes = []) {
  const key = r*9+c;
  const prevNotes = cleanNotes(state.notes[key]);
  const nextNotes = next ? [] : cleanNotes(notes);
  const prev = state.userGrid[r][c];
  if (state.given[r][c] || (prev === next && String(prevNotes) === String(nextNotes))) return false;
  const action = {r,c,prev,next,prevNotes,nextNotes};
  state.history = state.history.slice(0,state.historyIndex+1);
  state.history.push(action);
  if (state.history.length > 50) state.history.shift();
  state.historyIndex = state.history.length-1;
  state.userGrid[r][c] = next; state.notes[key] = [...nextNotes];
  return true;
}
export function travelHistory(state, direction) {
  const index = direction < 0 ? state.historyIndex : state.historyIndex+1;
  const a = state.history[index];
  if (!a) return false;
  state.userGrid[a.r][a.c] = direction < 0 ? a.prev : a.next;
  state.notes[a.r*9+a.c] = cleanNotes(direction < 0 ? a.prevNotes : a.nextNotes);
  state.historyIndex += direction;
  return true;
}
