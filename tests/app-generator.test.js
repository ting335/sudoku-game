import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { evenAllows } from '../src/core/even.js';

// Execute the application's actual generator, without copying its solver or DOM.
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const generation = main.slice(main.indexOf('function shuffle'), main.indexOf('// ---------- DOM 引用'));
for (const diagonal of [false, true]) {
  test(`active app generator has a valid unique ${diagonal ? 'diagonal' : 'classic'} answer`, () => {
    let seed = 117;
    const math = Object.create(Math);
    math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const output = vm.runInNewContext(`${generation}\nstate.diagonalMode=${diagonal}; const game=generatePuzzle('easy'); ({...game, unique:hasUniqueSolution(game.puzzle)});`, { Math: math, window: {}, evenAllows }, { timeout: 10000 });
    const { solution, puzzle } = JSON.parse(JSON.stringify(output));
    const complete = values => assert.deepEqual([...values].sort(), [1,2,3,4,5,6,7,8,9]);
    for (let r=0; r<9; r++) { complete(solution[r]); complete(solution.map(row => row[r])); }
    for (let r=0; r<9; r+=3) for(let c=0; c<9; c+=3) complete(solution.slice(r,r+3).flatMap(row=>row.slice(c,c+3)));
    if(diagonal) { complete(solution.map((row,i)=>row[i])); complete(solution.map((row,i)=>row[8-i])); }
    assert.equal(output.unique, true);
    puzzle.forEach((row,r)=>row.forEach((value,c)=>{if(value) assert.equal(value,solution[r][c]);}));
  });
}
