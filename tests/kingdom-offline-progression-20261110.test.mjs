import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildKingdomOfflineLevel } from '../src/features/games/kingdom/platform/kingdomOfflineGenerator.mjs';

const root = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
const catalog = JSON.parse(root('src/features/games/kingdom/platform/game-catalog.json'));
const games = catalog.characters.flatMap(c=>c.games.map(g=>g.id));
const screen = root('src/features/games/kingdom/platform/KingdomOfflineContinuation.tsx');
const center = root('src/features/games/kingdom/platform/KingdomInteriorCenter.tsx');
const christian = root('src/app/games/christian-civic-leadership.tsx');
const mitch = root('src/app/games/mitch-restore-mural.tsx');

test('all 39 canonical games have 200 deterministically generated, non-repeating, well-formed offline levels',()=>{
  assert.equal(games.length,39);
  assert.equal(new Set(games).size,39);
  for(const game of games){
    const seen=new Set();
    for(let level=1;level<=200;level++){
      const questions=buildKingdomOfflineLevel(game,level,'account-A');
      assert.equal(questions.length,3,game+' level '+level);
      assert.deepEqual(questions,buildKingdomOfflineLevel(game,level,'account-A'));
      for(const [i,q] of questions.entries()){
        assert.match(q.prompt,new RegExp('^Level '+level+', challenge '+(i+1)+':'));
        assert.equal(q.choices.length,4);
        assert.equal(new Set(q.choices).size,4);
        assert.ok(q.answer_index>=0 && q.answer_index<4);
        assert.match(q.explanation,/^Solution: \d+/);
        assert.equal(q.choices[q.answer_index],q.explanation.match(/Solution: (\d+)/)?.[1]);
        assert.ok(!seen.has(q.prompt),'duplicate prompt for '+game+' level '+level);
        seen.add(q.prompt);
      }
    }
    assert.equal(seen.size,600);
  }
});

test('account isolation, invalid inputs and gameplay no-credit rules remain enforced',()=>{
  assert.deepEqual(buildKingdomOfflineLevel('ace-rescue-grid',1,'account-A'),
    buildKingdomOfflineLevel('ace-rescue-grid',1,'account-A'));
  assert.notDeepEqual(buildKingdomOfflineLevel('ace-rescue-grid',1,'account-A'),
    buildKingdomOfflineLevel('ace-rescue-grid',1,'account-B'));
  for(const level of [0,-1,201,1.5,NaN]){
    assert.deepEqual(buildKingdomOfflineLevel('ace-rescue-grid',level,'account-A'),[]);
  }
  assert.deepEqual(buildKingdomOfflineLevel('invalid game',1,'account-A'),[]);
  assert.deepEqual(buildKingdomOfflineLevel('ace-rescue-grid',1,''),[]);
  assert.match(screen,/AsyncStorage\.getItem\(key\)/);
  assert.match(screen,/await AsyncStorage\.setItem\(key,String\(saved\)\)/);
  assert.match(screen,/buklod:kingdom:offline:v1:/);
  assert.match(screen,/user\?\.id/);
  assert.match(screen,/Math\.max\(completed,level\)/);
  assert.doesNotMatch(screen,/buklod_points_ledger|finish_my_buklod_kingdom_mastery|grant.*Points|claim.*BP/i);
});

test('every game center supports free offline next level independent of paid AI',()=>{
  assert.match(center,/<KingdomOfflineContinuation/);
  assert.match(christian,/<KingdomOfflineContinuation/);
  assert.match(mitch,/<KingdomOfflineContinuation/g);
  assert.match(center,/<KingdomAIContinuation/);
  assert.match(christian,/<KingdomAIContinuation/);
  assert.match(mitch,/<KingdomAIContinuation/);
  assert.match(screen,/phase === 'ready'/);
  assert.match(screen,/NEXT LEVEL/);
  assert.match(screen,/no AI charges|no AI charges|Walang AI charges/i);
});
