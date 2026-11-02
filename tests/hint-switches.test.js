import test from 'node:test';
import assert from 'node:assert/strict';
import { showCandidates, clearCandidateHints, highlightUniqueLocation, clearUniqueLocations } from '../src/hint.js';

function fixture(t) {
  const cells=Array.from({length:81},(_,i)=>{
    const r=Math.floor(i/9),c=i%9,classes=new Set();
    return {dataset:{row:String(r),col:String(c)},textContent:String((r*3+Math.floor(r/3)+c)%9+1),
      classList:{add:(...names)=>names.forEach(n=>classes.add(n)),remove:(...names)=>names.forEach(n=>classes.delete(n)),contains:n=>classes.has(n)},
      setAttribute(){},removeAttribute(){},
      set innerHTML(html){this.textContent=html.replace(/<[^>]*>/g,'');}};
  });
  cells[0].textContent=''; cells[1].textContent='25'; cells[1].dataset.notes='2,5';cells[1].classList.add('notes');
  const board={querySelectorAll:()=>cells};
  const previous=['window','document'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]);
  Object.defineProperty(globalThis,'window',{configurable:true,value:{}});
  Object.defineProperty(globalThis,'document',{configurable:true,value:{querySelector:s=>{
    if(s==='#board')return board;
    const [,r,c]=s.match(/data-row="(\d+)".*data-col="(\d+)"/);return cells[+r*9+ +c];
  }}});
  t.after(()=>previous.forEach(([k,d])=>{if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}));
  return cells;
}
test('candidate layer toggles off without clearing manual notes and can reopen', t=>{
  const cells=fixture(t); assert.equal(showCandidates(),1);
  assert.equal(cells[0].dataset.autoCandidates,'1'); assert.equal(cells[1].textContent,'25');
  clearCandidateHints(); assert.equal(cells[0].textContent,'');
  assert.equal(cells[1].textContent,'25');assert.equal(cells[1].dataset.notes,'2,5');
  assert.equal(showCandidates(),1);assert.equal(showCandidates(),1);
});
test('clearing an old candidate marker never deletes a newly entered answer',t=>{
  const cells=fixture(t);showCandidates();cells[0].textContent='1';cells[0].classList.remove('notes');
  clearCandidateHints();assert.equal(cells[0].textContent,'1');
});
test('unique-position overlay can clear and recompute without changing notes or answers',t=>{
  const cells=fixture(t);assert.equal(highlightUniqueLocation(),2);
  clearUniqueLocations();assert.ok(cells.every(c=>!c.classList.contains('hint-highlight')));
  assert.equal(cells[1].textContent,'25');
  cells[0].textContent='1';assert.equal(highlightUniqueLocation(),1);
  assert.equal(cells[0].classList.contains('hint-highlight'),false);
});
