import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanNotes, editCell, travelHistory } from '../src/core/notes.js';
const fresh=()=>({userGrid:Array.from({length:9},()=>Array(9).fill(0)),given:Array.from({length:9},()=>Array(9).fill(false)),notes:{},history:[],historyIndex:-1});
test('notes normalize, preserve empty answer, and survive JSON with undo/redo',()=>{
  const s=fresh(); editCell(s,0,0,0,[5,2,5]); assert.deepEqual(s.notes[0],[2,5]); assert.equal(s.userGrid[0][0],0);
  const restored=JSON.parse(JSON.stringify(s)); travelHistory(restored,-1); assert.deepEqual(restored.notes[0],[]);
  travelHistory(restored,1); assert.deepEqual(restored.notes[0],[2,5]);
  assert.deepEqual(cleanNotes([0,10,'2',3,3]),[3]);
});
test('answer and erase replace notes, and undo restores them',()=>{
  const s=fresh(); editCell(s,0,0,0,[2,5]); editCell(s,0,0,5); assert.deepEqual(s.notes[0],[]);
  travelHistory(s,-1); assert.equal(s.userGrid[0][0],0); assert.deepEqual(s.notes[0],[2,5]);
  editCell(s,0,0,0,[]); assert.deepEqual(s.notes[0],[]); assert.equal(travelHistory(s,1),false);
  travelHistory(s,-1); assert.deepEqual(s.notes[0],[2,5]);
});
test('given cells are immutable and capped history retains a valid cursor',()=>{
  const s=fresh(); s.given[0][0]=true; assert.equal(editCell(s,0,0,0,[2]),false);
  for(let i=0;i<70;i++) editCell(s,0,1,0,[i%2?2:5]);
  assert.equal(s.history.length,50); assert.equal(s.historyIndex,49);
  for(let i=0;i<50;i++) assert.equal(travelHistory(s,-1),true);
  assert.equal(travelHistory(s,-1),false);
});
