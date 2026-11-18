import test from 'node:test';
import assert from 'node:assert/strict';
import {
  S2_REWARD_ROLLOUT,S2_TERMS,S2_RULES,S2_COSMETIC_PRICE_PREVIEW,
  simulateS2TokenReceipts,evaluateS2WeeklyPriority,previewS2MomentumMinus,
  canS2TokenGate,addManilaDays
} from '../src/lib/season2/buklodSeason2RewardContractR1.ts';

const day='2026-12-07',uid='demo-user';
const receipt=(source,sourceId,extra={})=>({
  source,sourceId,userId:uid,manilaDay:day,
  backendVerified:true,accepted:true,mainApp:true,...extra
});
const common=[
  receipt('today_dugtong','dugtong-a'),receipt('kl_verified_chapter','kl-a'),
  receipt('wall_original_post','post-a'),
  receipt('wall_meaningful_comment','comment-a'),receipt('wall_meaningful_comment','comment-b')
];
const weekly=(patch={})=>({
  weekStartManilaDay:'2026-12-07',path:'non_show_faith',
  todayManilaDay:'2026-12-09',flexCreditsUsed:0,
  flexCreditsForThisWeek:0,flexOptedBeforeDeadline:false,
  pendingOffline:false,sourceUnavailable:false,receipts:[],
  ...patch,
});
test('Season2 rollout is entirely OFF; Season1 and financial protections are explicit',()=>{
  assert.ok(Object.values(S2_REWARD_ROLLOUT).every(v=>v===false));
  assert.ok(Object.values(S2_TERMS).every(v=>v===true || v===false));
  assert.equal(S2_TERMS.season1Unchanged,true);
  assert.equal(S2_TERMS.qmpAndAdMobUnchanged,true);
  assert.equal(S2_TERMS.existingBpUnchanged,true);
});
test('Path parity: common server-candidate opportunities identical, no actual mint',()=>{
  const a=simulateS2TokenReceipts(common,'show_faith',day,uid,true);
  const b=simulateS2TokenReceipts(common,'non_show_faith',day,uid,true);
  assert.equal(a.potential,9);assert.equal(b.potential,9);
  assert.equal(a.balanceMinted,0);assert.equal(a.live,false);
  assert.equal(S2_RULES.private_prayer.tokens,0);
  assert.equal(S2_RULES.formation_verified_unit.tokens,0);
  assert.equal(S2_RULES.general_learning_verified_unit.tokens,0);
});
test('Default stage backend adapter OFF means zero credited even for spoofed validated flags',()=>{
  const x=simulateS2TokenReceipts(common,'show_faith',day,uid);
  assert.equal(x.potential,0);
  assert.ok(x.lines.every(v=>v.reason==='BACKEND_NOT_LIVE'));
});
test('Source replay, per-source cap, wrong user, unverified and stale day not rewarded',()=>{
  const x=simulateS2TokenReceipts([
    receipt('wall_meaningful_comment','a'),receipt('wall_meaningful_comment','a'),
    receipt('wall_meaningful_comment','b'),receipt('wall_meaningful_comment','c'),
    receipt('kl_verified_chapter','kl',{userId:'someone-else'}),
    receipt('wall_original_post','p',{backendVerified:false}),
    receipt('today_dugtong','d',{manilaDay:'2026-12-06'})
  ],'non_show_faith',day,uid,true);
  assert.deepEqual(x.lines.map(x=>x.reason),[
    'ELIGIBLE_PREVIEW','DUPLICATE_SOURCE','ELIGIBLE_PREVIEW','SOURCE_CAP',
    'SOURCE_INVALID','UNVERIFIED','SOURCE_INVALID'
  ]);
  assert.equal(x.potential,2);
});
test('Missing P0 learning leaves only new Season2 bonus pending: BP/QMP unaffected',()=>{
  const x=evaluateS2WeeklyPriority(weekly({receipts:[receipt('wall_original_post','a')]}));
  assert.equal(x.gate,'NORMAL');assert.equal(x.completedCommunity,true);
  assert.equal(x.completedLearning,false);assert.equal(x.season2Bonus,'PENDING_FOUNDATION');
  assert.equal(x.season1BpAffected,false);assert.equal(x.qmpOrCashAffected,false);
});
test('P0 completed via two valid diverse sources, faith and nonfaith alike',()=>{
  const receipts=[receipt('kl_verified_chapter','k'),receipt('today_dugtong','d')];
  for(const path of ['show_faith','non_show_faith']){
    const x=evaluateS2WeeklyPriority(weekly({path,receipts}));
    assert.equal(x.gate,'COMPLETE');assert.equal(x.season2Bonus,'CLAIMABLE_PREVIEW');
  }
});
test('Ineligible faith-only source never satisfies nonfaith learning',()=>{
  const x=evaluateS2WeeklyPriority(weekly({receipts:[
    receipt('formation_verified_unit','f'),receipt('wall_original_post','p')
  ]}));
  assert.equal(x.completedLearning,false);
});
test('Seven regular days + three grace days are inclusive; flex is opt-in and capped',()=>{
  const base=weekly({receipts:[]});
  assert.equal(evaluateS2WeeklyPriority({...base,todayManilaDay:'2026-12-13'}).gate,'NORMAL');
  assert.equal(evaluateS2WeeklyPriority({...base,todayManilaDay:'2026-12-16'}).gate,'GRACE');
  assert.equal(evaluateS2WeeklyPriority({...base,todayManilaDay:'2026-12-17'}).gate,'CLOSED');
  const flex={...base,todayManilaDay:'2026-12-22',
    flexCreditsUsed:1,flexCreditsForThisWeek:1,flexOptedBeforeDeadline:true};
  assert.equal(evaluateS2WeeklyPriority(flex).gate,'FLEX');
  assert.equal(evaluateS2WeeklyPriority({...flex,flexOptedBeforeDeadline:false}).gate,'CLOSED');
  assert.throws(()=>evaluateS2WeeklyPriority({...flex,flexCreditsUsed:3}));
});
test('Offline and unavailable server evidence postpones deadline without fake bonus',()=>{
  assert.equal(evaluateS2WeeklyPriority(weekly({
    todayManilaDay:'2027-01-04',pendingOffline:true})).gate,'PENDING_SYNC');
  assert.equal(evaluateS2WeeklyPriority(weekly({
    todayManilaDay:'2027-01-04',sourceUnavailable:true})).gate,'UNAVAILABLE');
});
test('Only opt-in, closed, server-certified seasonal Momentum may preview a minus',()=>{
  const a={enrolledBeforeDay:true,serverCertified:true,
    dayClosedAfterGrace:true,pendingOffline:false,sourceAccessible:true,
    excused:false,verifiedActivity:false,readingDue:true,readingCompleted:false,
    creatorDue:true,creatorCompleted:false,missedDaysBeyondGrace:true};
  assert.equal(previewS2MomentumMinus(a).minus,9);
  assert.equal(previewS2MomentumMinus({...a,pendingOffline:true}).minus,0);
  assert.equal(previewS2MomentumMinus({...a,enrolledBeforeDay:false}).minus,0);
  assert.equal(previewS2MomentumMinus({...a,excused:true}).minus,0);
  assert.equal(previewS2MomentumMinus({...a,dayClosedAfterGrace:false}).minus,0);
});
test('Core features never token gated; only cosmetics; existing collectibles not sold',()=>{
  for(const k of ['chat','connect','posting','comments','attendance','bible',
    'prayer','lesson','children_story','report','safety','accessibility'])
    assert.equal(canS2TokenGate(k),false,k);
  assert.equal(canS2TokenGate('optional_profile_frame'),true);
  assert.equal(S2_COSMETIC_PRICE_PREVIEW.skin_variant,80);
  assert.equal('character_collectible' in S2_COSMETIC_PRICE_PREVIEW,false);
});
test('Manila date validation and flex misuse fail closed',()=>{
  assert.equal(addManilaDays('2026-12-31',1),'2027-01-01');
  assert.throws(()=>addManilaDays('2026-02-30',1));
  assert.throws(()=>evaluateS2WeeklyPriority(weekly({flexCreditsUsed:3})));
  assert.throws(()=>simulateS2TokenReceipts([], 'invalid',day,uid));
});
