import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {kingdomSwipeDirection} from '../src/features/games/kingdom/platform/gestureRules.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('game gestures reject diagonal/noisy drags',()=>{
  for(const [x,y,result] of [[45,0,'right'],[-40,0,'left'],[0,38,'down'],[0,-47,'up'],[10,0,null],[40,39,null],[40,33,null],[NaN,22,null],[Infinity,0,null]]){
    assert.equal(kingdomSwipeDirection(x,y),result);
  }
});
test('existing game engines own swipes, illuminated word trail has no score writes',()=>{
  const match=read('src/features/games/kingdom/platform/MatchThreeGameV1.tsx');
  const merge=read('src/features/games/kingdom/platform/MergeGameV1.tsx');
  const word=read('src/features/games/kingdom/platform/WordTrailGameV1.tsx');
  assert.match(match,/onTouchStart/);assert.match(match,/swap\(start,target\)/);
  assert.match(merge,/PanResponder.create/);assert.match(merge,/if\(direction\)move\(direction\)/);
  assert.match(word,/viewBox="0 0 400 400"/);
  assert.match(word,/run.path.map\(\(cell,i\)/);
  assert.doesNotMatch(match+merge+word,/grantBP|creditBP|supabase\.rpc|mintShards/);
});
