import test from 'node:test';
import assert from 'node:assert/strict';
import { RANKED_LEVEL_BANDS, MAX_RATING_SPREAD,
  selectFairArenaGroup, verifiedArenaBracket } from '../services/empire-arena/matchmaking.mjs';

function verified(level,rating){
  return {eligible:true,verified:true,
    snapshot:{characterLevel:level},
    profile:{rating}};
}
test('The trusted Arena engine never matches a newer 20-level character into a beginner bracket',()=>{
  const novice=verified(1,1400),veteran=verified(20,1400);
  assert.equal(verifiedArenaBracket(novice),0);
  assert.equal(verifiedArenaBracket(veteran),4);
  assert.equal(selectFairArenaGroup([{session:novice},{session:veteran}],2),null);
  assert.equal(RANKED_LEVEL_BANDS.length,5);
});
test('Server selection uses verified rating to prevent a high-skill outlier dominating a bracket',()=>{
  const first={session:verified(9,1000),joinedAt:1};
  const outlier={session:verified(9,2500),joinedAt:2};
  const matched={session:verified(10,1200),joinedAt:3};
  const selected=selectFairArenaGroup([first,outlier,matched],2);
  assert.deepEqual(selected,[first,matched]);
  assert.equal(MAX_RATING_SPREAD,300);
});
