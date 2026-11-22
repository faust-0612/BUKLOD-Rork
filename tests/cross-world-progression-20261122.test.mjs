import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GENESIS_WORLDS, MAJOR_DEVELOPMENT_LEVELS, BUILD_STAGES_PER_LEVEL,
  quoteKingdomMastery, houseProgressionPolicy, previewCrossWorldCosmetics,
  rankedArenaWorldBonus, CROSS_WORLD_RULES,
} from '../src/features/season2/world/crossWorldProgression.mjs';

const samples = [[1,550,73,160,8],[10,1216,143,308,9],
  [100,6400,550,499,12],[1000,53562,3682,698,15]];
test('Kingdom XP/score estimates are monotonic, increasingly difficult but still playable',()=>{
  let prev = null;
  for (const [m,needed,earned,score,challenges] of samples) {
    const q = quoteKingdomMastery(m);
    assert.equal(q.authority,'estimate_only');
    assert.equal(q.requiredXp,needed);
    assert.equal(q.challengeXp,earned);
    assert.equal(q.completionScore,score);
    assert.equal(q.expectedChallenges,challenges);
    assert.equal(q.bpGranted,0);
    if (prev) {
      assert.ok(q.requiredXp > prev.requiredXp);
      assert.ok(q.challengeXp > prev.challengeXp);
      assert.ok(q.completionScore > prev.completionScore);
    }
    prev = q;
  }
  assert.ok(quoteKingdomMastery(1_000_000).expectedChallenges < 25);
});

test('Invalid or imprecise levels never result in a misleading economy estimate',()=>{
  for(const x of [0,-1,1.3,NaN,Infinity,'100',Number.MAX_SAFE_INTEGER+1]) {
    assert.throws(()=>quoteKingdomMastery(x),RangeError);
  }
  const extreme = quoteKingdomMastery(Number.MAX_SAFE_INTEGER);
  assert.equal(extreme.precisionLimited,true);
  assert.equal(extreme.requiredXp,null);
  assert.equal(extreme.bpGranted,0);
});

test('House estate progression preserves existing verified construction authority',()=>{
  const h=houseProgressionPolicy();
  assert.equal(h.majorLevels,10);
  assert.equal(h.stagesPerLevel,5);
  assert.equal(h.rewardAuthority,'verified_estate_rpc');
  assert.equal(h.noArenaParticipationRequired,true);
  assert.equal(MAJOR_DEVELOPMENT_LEVELS,10);
  assert.equal(BUILD_STAGES_PER_LEVEL,5);
});

test('Cross-world achievements are cosmetic-only, gated by server events',()=>{
  assert.deepEqual(GENESIS_WORLDS,['kingdom','arena','house']);
  for(const name of ['kingdom.mastery.25','kingdom.mastery.100','house.mastery.10','arena.ranked.first_win']) {
    const rewards=previewCrossWorldCosmetics(name);
    assert.equal(rewards.length,2);
    assert.notEqual(rewards[0].destination,rewards[1].destination);
    for(const r of rewards) {
      assert.ok(['kingdom','arena','house'].includes(r.destination));
      assert.equal(typeof r.cosmetic,'string');
      assert.deepEqual(Object.keys(r).sort(),['cosmetic','destination']);
      assert.equal(Object.isFrozen(r),true);
    }
    assert.equal(Object.isFrozen(rewards),true);
  }
  assert.deepEqual(previewCrossWorldCosmetics('arena.practice.win'),[]);
  assert.deepEqual(previewCrossWorldCosmetics('__proto__'),[]);
  assert.deepEqual(previewCrossWorldCosmetics(null),[]);
});

test('No BP multiplier, Diamond farming, PvP power creep or tradable practice loot',()=>{
  assert.equal(rankedArenaWorldBonus(),0);
  assert.equal(CROSS_WORLD_RULES.bpFromWorldTravel,0);
  assert.equal(CROSS_WORLD_RULES.bpFromMasteryLevel,0);
  assert.equal(CROSS_WORLD_RULES.rankedStatBonusFromOutsideArena,0);
  assert.equal(CROSS_WORLD_RULES.practiceLootIsTradable,false);
  assert.equal(CROSS_WORLD_RULES.clientMayGrantRewards,false);
  assert.equal(CROSS_WORLD_RULES.purchasesCreateLifetimeBp,false);
  assert.equal(CROSS_WORLD_RULES.sourceOwnership,'character_system');
});
