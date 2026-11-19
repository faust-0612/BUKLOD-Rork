import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_MOMENTUM, DAILY_COMMITMENT_PREVIEW_RULE,
  previewDailyCommitmentSettlement, isAllowablePersistentRewardReversal,
} from '../src/lib/buklodEngagementPolicyR1.ts';
const day='2026-11-18';
const lane=(status='MISSED', overrides={})=>({
  enrolledBeforeDay:true, assignedAndAccessible:true, status, sourceVerifiedByServer:true, ...overrides,
});
const evidence=(dayValue=day, overrides={})=>({
  manilaDay:dayValue, verifiedByBackend:true, finalizedAfterGrace:true, verifiedAnyActivity:false,
  scopeModeAtDay:'show_faith', readingKind:'formation_reading',
  dailyReading:lane(), dailyCreatorPost:lane(), ...overrides,
});
const previous=(score=35,last='2026-11-15')=>({
  ...EMPTY_MOMENTUM,lastSettledManilaDay:last,seasonalMomentumPoints:score,
});

test('third missed day combines inactivity -5, daily formation reading -2 and post -2',()=>{
  const state=previous(35,'2026-11-17');
  const result=previewDailyCommitmentSettlement({...state,consecutiveMissedDays:2},day,[evidence()],false);
  assert.equal(result.outcome,'SETTLED');
  assert.deepEqual(result.daily,[{manilaDay:day,inactivity:5,reading:2,creatorPost:2}]);
  assert.equal(result.lost,9);assert.equal(result.state.seasonalMomentumPoints,26);
  assert.equal(result.live,false);
  assert.equal(DAILY_COMMITMENT_PREVIEW_RULE.maximumCombinedDailyMinus,9);
});
test('no penalty unless opted in, due, assigned and accessible',()=>{
  const result=previewDailyCommitmentSettlement(previous(20,'2026-11-17'),day,[evidence(day,{
    dailyReading:lane('MISSED',{enrolledBeforeDay:false}),
    dailyCreatorPost:lane('MISSED',{assignedAndAccessible:false}),
  })],false);
  assert.equal(result.lost,0); assert.equal(result.state.seasonalMomentumPoints,20);
});
test('verified complete, excused and non-due tasks have no commitment minus',()=>{
  const r=previewDailyCommitmentSettlement(previous(20,'2026-11-17'),day,[evidence(day,{
    verifiedAnyActivity:true,dailyReading:lane('COMPLETED'),dailyCreatorPost:lane('EXCUSED'),
  })],false);
  assert.equal(r.lost,0);assert.equal(r.state.seasonalMomentumPoints,25);
});
test('non-faith scope can use equivalent general reading; cannot be assigned faith-only reading',()=>{
  const allowed=previewDailyCommitmentSettlement(previous(20,'2026-11-17'),day,[evidence(day,{
    scopeModeAtDay:'non_show_faith',readingKind:'general_reading',
  })],false);
  assert.equal(allowed.lost,4);assert.equal(allowed.state.seasonalMomentumPoints,16);
  const rejected=previewDailyCommitmentSettlement(previous(20,'2026-11-17'),day,[evidence(day,{
    scopeModeAtDay:'non_show_faith',readingKind:'formation_reading',
  })],false);
  assert.equal(rejected.outcome,'INCOMPLETE_SERVER_EVIDENCE');assert.equal(rejected.lost,0);
});
test('offline or unknown server validation defers or fails closed without deduction',()=>{
  const state=previous(20,'2026-11-17');
  assert.equal(previewDailyCommitmentSettlement(state,day,[evidence()],true).outcome,'DEFERRED_OFFLINE');
  assert.equal(previewDailyCommitmentSettlement(state,day,[evidence(day,{dailyReading:lane('PENDING')})],false).outcome,'DEFERRED_OFFLINE');
  assert.equal(previewDailyCommitmentSettlement(state,day,[evidence(day,{verifiedByBackend:false})],false).outcome,'INCOMPLETE_SERVER_EVIDENCE');
  assert.equal(previewDailyCommitmentSettlement(state,day,[evidence(day,{finalizedAfterGrace:false})],false).outcome,'INCOMPLETE_SERVER_EVIDENCE');
  assert.equal(previewDailyCommitmentSettlement(state,day,[],false).outcome,'INCOMPLETE_SERVER_EVIDENCE');
  assert.deepEqual(previewDailyCommitmentSettlement(state,day,[evidence()],true).state,state);
});
test('two-day catch-up settles day-by-day, honors actual verified day and cannot be replayed',()=>{
  const state=previous(30,'2026-11-16');
  const r=previewDailyCommitmentSettlement(state,day,[
    evidence('2026-11-17',{verifiedAnyActivity:true,dailyReading:lane('COMPLETED'),dailyCreatorPost:lane('MISSED')}),
    evidence(day,{verifiedAnyActivity:false,dailyReading:lane('MISSED'),dailyCreatorPost:lane('MISSED')}),
  ],false);
  assert.equal(r.outcome,'SETTLED');assert.equal(r.state.seasonalMomentumPoints,29);
  assert.equal(r.lost,6);assert.equal(r.daily[0].creatorPost,2);assert.equal(r.daily[1].inactivity,0);
  assert.equal(previewDailyCommitmentSettlement(r.state,day,[],false).outcome,'UNCHANGED');
});
test('bad/missing out-of-order evidence or overlong backlog cannot invent penalties',()=>{
  const state=previous(30,'2026-11-15');
  assert.equal(previewDailyCommitmentSettlement(state,day,[evidence(day)],false).outcome,'INCOMPLETE_SERVER_EVIDENCE');
  const tooOld=previous(30,'2026-07-01');
  assert.equal(previewDailyCommitmentSettlement(tooOld,day,[],false).outcome,'INCOMPLETE_SERVER_EVIDENCE');
  assert.throws(()=>previewDailyCommitmentSettlement(state,'2026-02-30',[],false));
});
test('low balance never goes negative, nor are BP/QMP/cash subject to absence reversal',()=>{
  const r=previewDailyCommitmentSettlement({...previous(1,'2026-11-17'),consecutiveMissedDays:4},day,[evidence()],false);
  assert.equal(r.state.seasonalMomentumPoints,0);assert.equal(r.lost,1);
  assert.equal(isAllowablePersistentRewardReversal('INACTIVITY','some-case'),false);
});
