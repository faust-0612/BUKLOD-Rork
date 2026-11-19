import test from 'node:test';
import assert from 'node:assert/strict';
import {ENGAGEMENT_ROLLOUT,ENGAGEMENT_RULES,EMPTY_MOMENTUM,canRequireJourneyToken,
  simulateJourneyTokenDay,previewMomentumSettlement,isAllowablePersistentRewardReversal
} from '../src/lib/buklodEngagementPolicyR1.ts';
const DAY='2026-11-18';
const receipt=(source,sourceId,extras={})=>({source,sourceId,manilaDay:DAY,serverVerified:true,accepted:true,...extras});
const common=[receipt('today_dugtong','d1'),receipt('kl_verified_chapter','kl1'),
  receipt('wall_original_post','p1'),receipt('wall_meaningful_comment','c1'),receipt('wall_meaningful_comment','c2')];

test('all currency, spend, momentum and gating rollout switches OFF',()=>{
  assert.deepEqual(Object.values(ENGAGEMENT_ROLLOUT),[false,false,false,false,false]);
});
test('illustrative two paths equal 16 raw and 12 capped, not live',()=>{
  const faith=simulateJourneyTokenDay([...common,receipt('formation_verified_unit','f1'),
    receipt('main_bible_qualified_quiz','b1')],'show_faith',DAY);
  const nonfaith=simulateJourneyTokenDay([...common,receipt('general_learning_verified_unit','g1'),
    receipt('community_verified_challenge','ch1')],'non_show_faith',DAY);
  assert.equal(faith.proposed,16);assert.equal(nonfaith.proposed,16);
  assert.equal(faith.capped,12);assert.equal(nonfaith.capped,12);assert.equal(faith.live,false);
});
test('no duplicate, unverified, stale or excess comment rewards',()=>{
  const s=simulateJourneyTokenDay([
    receipt('wall_meaningful_comment','c1'),receipt('wall_meaningful_comment','c1'),
    receipt('wall_meaningful_comment','c2'),receipt('wall_meaningful_comment','c3'),
    receipt('today_dugtong','d1',{serverVerified:false}),
    receipt('kl_verified_chapter','k1',{manilaDay:'2026-11-17'})
  ],'show_faith',DAY);
  assert.equal(s.proposed,2);
  assert.deepEqual(s.lines.map(x=>x.reason),[
    'PREVIEW_ELIGIBLE','DUPLICATE_SOURCE','PREVIEW_ELIGIBLE','SOURCE_DAILY_CAP',
    'SERVER_CONFIRMATION_REQUIRED','OUTSIDE_MANILA_DAY']);
});
test('faith source requires eligible scope; prayer/children generate no token',()=>{
  const x=simulateJourneyTokenDay([
    receipt('formation_verified_unit','f1'),receipt('private_prayer','pr1'),
    receipt('children_story_milestone','st1')
  ],'non_show_faith',DAY);
  assert.equal(x.proposed,0);assert.equal(ENGAGEMENT_RULES.private_prayer.proposedTokens,0);
});
test('tokens may unlock optional cosmetics but never basic features',()=>{
  for(const k of ['posting','commenting','chat','prayer','bible','formation',
    'children_story','report','attendance','accessibility'])
    assert.equal(canRequireJourneyToken(k),false,k);
  assert.equal(canRequireJourneyToken('optional_profile_frame'),true);
  assert.equal(canRequireJourneyToken('bonus_practice_mode'),true);
});
test('two-day grace, then separate seasonal-only reduction of five',()=>{
  const prior={...EMPTY_MOMENTUM,lastSettledManilaDay:'2026-11-15',
    activeStreakDays:4,seasonalMomentumPoints:35};
  const after=previewMomentumSettlement(prior,DAY,false,false);
  assert.equal(after.state.seasonalMomentumPoints,30);
  assert.equal(after.lost,5);
  assert.equal(after.state.consecutiveMissedDays,3);
});
test('offline operation postpones settlement, then confirmed activity and replay are safe',()=>{
  const before={...EMPTY_MOMENTUM,lastSettledManilaDay:'2026-11-16',
    seasonalMomentumPoints:25,activeStreakDays:2};
  assert.equal(previewMomentumSettlement(before,DAY,false,true).outcome,'DEFERRED_OFFLINE');
  assert.equal(previewMomentumSettlement(before,DAY,false,true).state,before);
  const after=previewMomentumSettlement(before,DAY,true,false);
  assert.equal(after.state.seasonalMomentumPoints,30);assert.equal(after.state.activeStreakDays,1);
  const replay=previewMomentumSettlement(after.state,DAY,true,false);
  assert.equal(replay.outcome,'UNCHANGED');assert.deepEqual(replay.state,after.state);
});
test('missed day/prayer/optional challenge cannot reverse original persistent awards',()=>{
  for(const k of ['INACTIVITY','MISSING_PRAYER','MISSION_TIMEOUT'])
    assert.equal(isAllowablePersistentRewardReversal(k,'audit'),false);
  assert.equal(isAllowablePersistentRewardReversal('VERIFIED_FRAUD'),false);
  assert.equal(isAllowablePersistentRewardReversal('VERIFIED_FRAUD','case-123'),true);
});
test('reject impossible Manila days and illegal caps',()=>{
  assert.throws(()=>simulateJourneyTokenDay([], 'show_faith','2026-02-30'));
  assert.throws(()=>simulateJourneyTokenDay([], 'show_faith',DAY,-1));
  assert.throws(()=>previewMomentumSettlement(EMPTY_MOMENTUM,'2026-13-44',true,false));
});
