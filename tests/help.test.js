import test from 'node:test';
import assert from 'node:assert/strict';
import { createHelpPreferences, setupHelp } from '../src/help.js';

test('tutorial opt-out is per game, persists across visits and can be reversed', () => {
  const data = new Map();
  const storage = {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
  const prefs = createHelpPreferences(storage);
  assert.equal(prefs.shouldShow('sudoku'),true);
  prefs.markSeen('sudoku'); assert.equal(prefs.shouldShow('sudoku'),false);
  prefs.save('sudoku',true);
  const next = createHelpPreferences(storage);
  assert.equal(next.shouldShow('sudoku'),false); assert.equal(next.shouldShow('mines'),true);
  next.save('sudoku',false); assert.equal(next.shouldShow('sudoku'),true);
});
test('blocked preference storage still permits help once per game per visit', () => {
  const prefs = createHelpPreferences({getItem(){throw Error('denied');},setItem(){throw Error('denied');}});
  assert.doesNotThrow(()=>prefs.save('sudoku',true));
  assert.equal(prefs.shouldShow('sudoku'),true); prefs.markSeen('sudoku');
  assert.equal(prefs.shouldShow('sudoku'),false); assert.equal(prefs.shouldShow('mines'),true);
});
test('help opens automatically, manual entry overrides opt-out, and close notifies lifecycle', t => {
  const node = () => ({events:{},addEventListener(k,fn){this.events[k]=fn;}});
  const dialog = () => {
    const d = node(); d.checkbox=node(); d.content={scrollTop:40}; d.closeButton=node();
    d.querySelector=sel=>sel==='[data-help-hide]'?d.checkbox:d.content;
    d.querySelectorAll=()=>[d.closeButton];
    d.showModal=()=>{d.open=true;};
    d.close=()=>{d.open=false;d.events.close();};
    return d;
  };
  const nodes={'info-dialog':dialog(),'mines-help-dialog':dialog(),'view-sudoku':{hidden:false},'help-button':node(),'mines-help':node()};
  const data=new Map(); const listeners={}; let changes=0;
  const previous = ['window','document'].map(key => [key,Object.getOwnPropertyDescriptor(globalThis,key)]);
  t.after(()=>previous.forEach(([key,d])=>{if(d) Object.defineProperty(globalThis,key,d); else delete globalThis[key];}));
  Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:{getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},addEventListener:(k,fn)=>listeners[k]=fn,dispatchEvent:()=>changes++}});
  Object.defineProperty(globalThis,'document',{configurable:true,value:{getElementById:id=>nodes[id]}});
  setupHelp(); assert.equal(nodes['info-dialog'].open,true); assert.equal(changes,1);
  nodes['info-dialog'].checkbox.events.change({target:{checked:true}});
  nodes['info-dialog'].closeButton.events.click(); assert.equal(changes,2);
  nodes['help-button'].events.click(); assert.equal(nodes['info-dialog'].open,true);
  assert.equal(nodes['info-dialog'].checkbox.checked,true);
  nodes['info-dialog'].close();
  nodes['view-sudoku'].hidden=true; listeners['game-view-change']();
  assert.equal(nodes['mines-help-dialog'].open,true);
});
