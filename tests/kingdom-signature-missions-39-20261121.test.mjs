import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildKingdomSignatureMission,KINGDOM_SIGNATURE_GAME_IDS} from '../src/features/games/kingdom/platform/kingdomSignatureEncounters.mjs';
import {buildKingdomOfflineLevel} from '../src/features/games/kingdom/platform/kingdomOfflineGenerator.mjs';
const catalog=JSON.parse(readFileSync(new URL('../src/features/games/kingdom/platform/game-catalog.json',import.meta.url),'utf8'));
const ids=catalog.characters.flatMap(c=>c.games.map(g=>g.id));
test('every one of the 39 station titles has its own local signature challenge',()=>{
 assert.equal(KINGDOM_SIGNATURE_GAME_IDS.length,39);
 assert.deepEqual(new Set(KINGDOM_SIGNATURE_GAME_IDS),new Set(ids));
 const missions=ids.map(id=>buildKingdomSignatureMission(id,22,6,3));
 assert.ok(missions.every(Boolean));
 assert.equal(new Set(missions.map(x=>x.encounterTitle)).size,39);
 assert.equal(new Set(missions.map(x=>x.prompt)).size,39);
 for(const m of missions){
  assert.ok(m.prompt.length>50);
  assert.equal(m.visualTokens.length,3);
  assert.ok(m.visualTokens.every(x=>x.length>0));
  assert.ok(Number.isSafeInteger(m.answer)&&m.answer>=0);
  assert.ok(!m.prompt.includes('{'));
 }
 assert.equal(buildKingdomSignatureMission('not-a-game',22,6,3),null);
 assert.equal(buildKingdomSignatureMission(ids[0],Number.NaN,6,3),null);
});
test('all 39 endless practice routes retain 3 deterministic, noncredit encounters with a distinct signature finale',()=>{
 for(const id of ids){
  for(const level of [1,21,201,5001,1000000]){
   const questions=buildKingdomOfflineLevel(id,level,'a-private-test-account');
   assert.equal(questions.length,3);
   assert.deepEqual(questions.map(x=>x.mode),['compass','pattern','supplies']);
   assert.ok(questions[2].encounterTitle,id);
   assert.equal(questions[2].visualTokens.length,3);
   assert.ok(questions[2].prompt.includes('Level '+level));
   assert.ok(questions[2].choices.every(x=>/^\d+$/.test(x)));
   assert.deepEqual(questions,buildKingdomOfflineLevel(id,level,'a-private-test-account'));
  }
 }
});
test('client signature missions never write financial, character or Arena authority',()=>{
 const source=readFileSync(new URL('../src/features/games/kingdom/platform/kingdomSignatureEncounters.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/supabase|fetch\(|creditBP|grantXP|mintShards|awardBP|arena_ranked_result|AsyncStorage/);
});
