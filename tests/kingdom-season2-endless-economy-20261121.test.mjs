import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildKingdomOfflineLevel, KINGDOM_OFFLINE_MAX_LEVEL } from '../src/features/games/kingdom/platform/kingdomOfflineGenerator.mjs';
import {
  getKingdomWorldPosition,getKingdomPracticePosition,getKingdomPreviewWorkUnits,
  classifyKingdomRewardEvent,KINGDOM_REWARD_ROUTES,
} from '../src/features/games/kingdom/platform/kingdomEndlessProgression.mjs';
const root=new URL('../',import.meta.url);
const read=(relative)=>readFileSync(new URL(relative,root),'utf8');
const catalog=JSON.parse(read('src/features/games/kingdom/platform/game-catalog.json'));
const gameIds=catalog.characters.flatMap(c=>c.games.map(g=>g.id));
test('catalog is 13 distinct stations / 39 distinct routes including both pilots',()=>{
  assert.equal(catalog.characters.length,13);
  assert.equal(gameIds.length,39);assert.equal(new Set(gameIds).size,39);
  assert.equal(gameIds.filter(x=>x.includes('empire-arena')).length,0);
});
test('procedural Kingdom: all 39 games, 3 types, deterministic and beyond 5000',()=>{
  assert.ok(KINGDOM_OFFLINE_MAX_LEVEL>5000);
  for(const id of gameIds){
    for(const level of [1,9,20,5000,5001,1000000]){
      const rounds=buildKingdomOfflineLevel(id,level,'00000000-0000-4000-8000-000000000001');
      assert.equal(rounds.length,3,id);
      assert.deepEqual(rounds.map(x=>x.mode),['compass','pattern','supplies']);
      assert.deepEqual(rounds,buildKingdomOfflineLevel(id,level,'00000000-0000-4000-8000-000000000001'));
      for(const round of rounds){
        assert.ok(round.prompt.length>16);
        assert.equal(round.choices.length,4);
        assert.equal(new Set(round.choices).size,4);
        assert.ok(Number.isInteger(round.answer_index)&&round.answer_index>=0&&round.answer_index<4);
        assert.ok(round.visualTokens.length>=3&&round.visualTokens.length<=8);
      }
    }
  }
  assert.deepEqual(buildKingdomOfflineLevel('unknown bad',1,'u'),[]);
  assert.deepEqual(buildKingdomOfflineLevel(gameIds[0],KINGDOM_OFFLINE_MAX_LEVEL+1,'u'),[]);
});
test('10 world levels x 5 build scenes, then endless finite mastery',()=>{
  assert.equal(getKingdomWorldPosition('house',0,'server_receipts').majorLevel,1);
  assert.equal(getKingdomWorldPosition('lot',0,'server_receipts').nextScene,1);
  const stage49=getKingdomWorldPosition('cluster',49,'server_receipts');
  assert.equal(stage49.majorLevel,10);assert.equal(stage49.nextScene,5);
  const mastery=getKingdomWorldPosition('business',50,'server_receipts');
  assert.equal(mastery.kind,'mastery');assert.equal(mastery.masteryLevel,1);
  assert.equal(getKingdomWorldPosition('lot',15050,'server_receipts').masteryLevel,15001);
  assert.equal(getKingdomWorldPosition('lot',50,'local'),null);
  assert.equal(getKingdomWorldPosition('lot',-1,'server_receipts'),null);
  assert.ok(getKingdomPreviewWorkUnits(40)>getKingdomPreviewWorkUnits(0));
  assert.ok(getKingdomPreviewWorkUnits(5000000)<=45000);
  const preview=getKingdomPracticePosition(5001);
  assert.equal(preview.localOnly,true);assert.equal(preview.rewardEligible,false);
  assert.equal(preview.worldLevelEligible,false);
});
test('no rewards from local games, no BP mint via trade or Arena, fail closed on identity',()=>{
  for(const kind of ['game_preview','kingdom_practice']){
    const lane=classifyKingdomRewardEvent({kind,authority:'client'});
    assert.equal(lane.ledger,'none');assert.equal(lane.mintBP,false);
  }
  for(const key of Object.keys(KINGDOM_REWARD_ROUTES)){
    if(['game_preview','kingdom_practice','arena_match_flux'].includes(key))continue;
    assert.equal(classifyKingdomRewardEvent({kind:key,authority:'client',sourceId:'abcdefgh',idempotencyKey:'abcdefgh'}),null,key);
  }
  const verified={authority:'server',sourceId:'event_12345',idempotencyKey:'receipt_12345'};
  assert.equal(classifyKingdomRewardEvent({kind:'verified_participation_bp',...verified,ruleActive:true,antiFarmVerified:true}).changesCircleRank,true);
  assert.equal(classifyKingdomRewardEvent({kind:'verified_participation_bp',...verified,ruleActive:true}),null);
  assert.equal(classifyKingdomRewardEvent({kind:'bp_trade_transfer',...verified,conservedAvailableBP:true}).mintBP,false);
  assert.equal(classifyKingdomRewardEvent({kind:'bp_trade_transfer',...verified}),null);
  assert.equal(classifyKingdomRewardEvent({kind:'character_evolution',...verified,bpEligibilityVerified:true,requiredItemsVerified:false,equalNonFaithPathVerified:true}),null);
  assert.equal(classifyKingdomRewardEvent({kind:'arena_ranked_result',...verified,rankedEnabled:false,matchSettledByServer:true}),null);
  assert.equal(classifyKingdomRewardEvent({kind:'arena_ranked_result',...verified,rankedEnabled:true,matchSettledByServer:true}).ledger,'character_diamonds');
});
test('every pilot inherits existing approved character-scene art and music without new native modules',()=>{
  const media=read('src/features/games/runtime/rorkMedia.ts');
  const audio=read('src/features/games/runtime/rorkAudio.ts');
  const stage=read('src/features/games/kingdom/platform/KingdomInteriorCenter.tsx');
  for(const c of catalog.characters){
    assert.ok(media.includes(c.stationId));
    assert.ok(media.includes(c.stationId.split('-')[0]+':'));
  }
  assert.match(media,/PILOT_PARENT/);
  assert.match(audio,/All 39 mini-games must yield to ads/);
  assert.match(stage,/KingdomCinematicScene/);
});
