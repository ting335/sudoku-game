import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/minesweeper.js', import.meta.url), 'utf8')
  .replace(/^import .*;$/gm, '').replace(/export /g, '');
function environment() {
  const saved = new Map();
  const context = vm.createContext({
    document: {addEventListener(){},removeEventListener(){}},
    localStorage: {getItem:k=>saved.get(k) ?? null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},
    performance: {now:()=>0}, requestAnimationFrame:()=>1, cancelAnimationFrame(){},
    audio: {getSettings:()=>({music:false})}, sfx:{},
  });
  vm.runInContext(source+'\nthis.Engine=Minesweeper; this.Cell=CELL;',context);
  const game = new context.Engine({}); game.start('easy');
  return {context,game,saved,Cell:context.Cell};
}

test('all presets guarantee the first revealed cell and its eight neighbors are mine-free', () => {
  for(const preset of ['easy','medium','hard']) {
    const {game} = environment(); game.start(preset); game.reveal(4,4);
    for(let r=3;r<=5;r++) for(let c=3;c<=5;c++) assert.equal(game.mines[r*game.cols+c],false);
    assert.equal(game.mines.filter(Boolean).length,game.mineTotal);
  }
});
test('pause blocks reveal, flags and chord; resume allows actions', () => {
  const {game,saved} = environment(); game.reveal(4,4); game.setPaused(true);
  const before = JSON.stringify(game.board);
  assert.equal(game.reveal(0,0),false); assert.equal(game.toggleFlag(0,0),false);
  assert.equal(game.cycleMark(0,0),false); assert.equal(game.chord(4,4),false);
  assert.equal(JSON.stringify(game.board),before); assert.equal(game._timer,null);
  game.elapsed=29; game.setPaused(true);
  assert.equal(JSON.parse(saved.get('minesweeper-progress-v1')).elapsed,29);
  game.setPaused(false); assert.ok(game._timer);
});
test('resume restores mine total and adjacency without starting a hidden timer', () => {
  const {game,context} = environment(); game.start('medium'); game.reveal(5,5); game.elapsed=27; game._save();
  const restored=context.Engine.resume({});
  assert.equal(restored.mineTotal,40); assert.equal(restored.minesLeft(),40);
  assert.equal(restored.elapsed,27); assert.deepEqual(restored.adj,game.adj);
  assert.equal(restored._timer,undefined);
});
test('damaged saves are rejected before constructing a board', () => {
  const {game,context,saved} = environment(); game._save();
  const original=JSON.parse(saved.get('minesweeper-progress-v1'));
  for(const patch of [{cols:30},{mines:[]},{board:['boom']},{elapsed:-1},{preset:'missing'}]) {
    saved.set('minesweeper-progress-v1',JSON.stringify({...original,...patch}));
    assert.equal(context.Engine.resume({}),null);
  }
});
test('ended games cannot be changed using keyboard flag actions', () => {
  const {game} = environment(); game.reveal(4,4);
  const i=game.mines.findIndex(Boolean); game.reveal(Math.floor(i/game.cols),i%game.cols);
  const before=JSON.stringify(game.board); assert.equal(game.over,true);
  assert.equal(game.toggleFlag(0,0),false); assert.equal(JSON.stringify(game.board),before);
});
test('zero-second records remain valid and blocked storage does not break winning', () => {
  const {game,context,saved} = environment(); game.elapsed=0; game._updateRecord();
  game.elapsed=5; game._updateRecord(); assert.equal(context.Engine.getRecord('easy'),0);
  context.localStorage.getItem=()=>{throw new Error('blocked');};
  assert.doesNotThrow(()=>game._updateRecord());
});
test('both games import the same audio module URL', () => {
  const urls=['main.js','minesUI.js','minesweeper.js'].map(name=>
    readFileSync(new URL('../src/'+name,import.meta.url),'utf8').match(/from '(\.\/audio\.js[^']*)'/)[1]);
  assert.equal(new Set(urls).size,1);
});
