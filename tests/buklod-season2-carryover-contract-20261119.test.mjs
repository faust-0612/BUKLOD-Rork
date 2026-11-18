import test from 'node:test';
import assert from 'node:assert/strict';
import {planSeason2Rollover,verifySeasonCarryover,SEASON2_RESET_POLICY}
 from '../src/lib/season2/buklodSeason2CarryoverContractR1.ts';
const input={fromSeason:2,toSeason:3,userId:'11111111-1111-4111-8111-111111111111',
 currentSeasonScore:2450,oldSeasonResultsSigned:true,pendingHistoryReconciled:true,
 serverInventoryReconciled:true,sourceRevision:'a'.repeat(40)};
test('never authorizes production and rollover idempotency deterministic',()=>{
 const a=planSeason2Rollover(input),b=planSeason2Rollover(input);
 assert.equal(a.status,'READY_FOR_STAGING_SERVER_REVIEW');
 assert.equal(a.nextSeasonScore,0);
 assert.deepEqual(a,b);
 assert.equal(a.productionAuthorized,false);
 assert.ok(SEASON2_RESET_POLICY.preserved.includes('qmp'));
});
test('unverified evidence blocks reset',()=>{
 for(const key of ['oldSeasonResultsSigned','pendingHistoryReconciled','serverInventoryReconciled']){
  const p=planSeason2Rollover({...input,[key]:false});
  assert.equal(p.status,'BLOCKED');assert.equal(p.nextSeasonScore,null);
 }
 assert.equal(planSeason2Rollover({...input,toSeason:7}).status,'BLOCKED');
});
const baseline={lifetimeScore:900,characters:{ivan:{level:42,xp:7500},other:{level:4,xp:400}},
 items:['helmet'],badges:['s1-diamond'],collectibles:['story-1'],
 qmp:150,withdrawable:32,withdrawn:44,memberships:['cluster-1']};
test('preserve earned assets, per-character levels and financial balances',()=>{
 assert.equal(verifySeasonCarryover(baseline,{...baseline,items:['helmet','s2-cape']}).valid,true);
 const altered={...baseline,characters:{ivan:{level:1,xp:0}},badges:[],
  withdrawable:0,items:[],memberships:[]};
 const r=verifySeasonCarryover(baseline,altered);
 assert.equal(r.valid,false);
 for(const marker of ['CHARACTER_PROGRESS_LOST:ivan','BADGE_LOST:s1-diamond',
  'FINANCIAL_DRIFT:withdrawable','ITEM_LOST:helmet','MEMBERSHIP_LOST:cluster-1'])
  assert.ok(r.violations.includes(marker),marker);
});
