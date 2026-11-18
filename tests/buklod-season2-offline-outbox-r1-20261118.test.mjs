import test from 'node:test';
import assert from 'node:assert/strict';
import {
 S2_OUTBOX_ROLLOUT,S2_OUTBOX_LIMITS,enqueueS2Evidence,
 reserveS2Next,retryDelayMs,markS2TransportUnknown,
 confirmS2ServerResult,recoverS2InterruptedSends,
 getS2RewardDisplay,compactS2ConfirmedOutbox
} from '../src/lib/season2/buklodSeason2OfflineOutboxR1.ts';
const USER='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SOURCE='22222222-2222-4222-8222-222222222222';
const OP='11111111-1111-4111-8111-111111111111';
const draft=(x={})=>({operationId:OP,userId:USER,
 sourceKind:'wall_original_post',sourceId:SOURCE,localQueuedAtMs:1000,...x});
const verified=(x={})=>({operationId:OP,userId:USER,
 sourceKind:'wall_original_post',sourceId:SOURCE,authenticatedAdapter:true,
 decision:'EARNED',serverReceiptId:'s2-source-001',serverTokens:2,reason:'Verified',...x});
test('All runtime transports and spending are OFF by default',()=>{
 assert.ok(Object.values(S2_OUTBOX_ROLLOUT).every(x=>x===false));
});
test('Queue durable operation ID, dedupe double tap and protect ID collision',()=>{
 const first=enqueueS2Evidence([],draft());
 assert.equal(first.status,'QUEUED');
 assert.equal(first.queue.length,1);
 assert.equal(first.queue[0].serverTokens,null);
 const repeat=enqueueS2Evidence(first.queue,draft({
  operationId:'33333333-3333-4333-8333-333333333333'}));
 assert.equal(repeat.status,'DUPLICATE');
 assert.equal(repeat.queue,first.queue);
 assert.throws(()=>enqueueS2Evidence(first.queue,draft({userId:OTHER})));
});
test('No submission while offline; strict active-account isolation and single flight',()=>{
 const p=enqueueS2Evidence([],draft()).queue;
 assert.equal(reserveS2Next(p,USER,false,1000).operation,null);
 assert.equal(reserveS2Next(p,OTHER,true,1000).operation,null);
 const sent=reserveS2Next(p,USER,true,1000);
 assert.equal(sent.operation.status,'SENDING');
 assert.equal(sent.operation.attempts,1);
 assert.equal(reserveS2Next(sent.queue,USER,true,1000).operation,null);
 assert.equal(getS2RewardDisplay(sent.queue[0]),'PENDING_VERIFICATION');
});
test('Unknown network outcome never credits; bounded retry same source and id',()=>{
 const q=reserveS2Next(enqueueS2Evidence([],draft()).queue,USER,true,1000).queue;
 const unknown=markS2TransportUnknown(q,OP,1500);
 assert.equal(unknown[0].status,'RETRY_WAIT');
 assert.equal(unknown[0].operationId,OP);
 assert.equal(unknown[0].sourceId,SOURCE);
 assert.equal(unknown[0].nextRetryAtMs,3000);
 assert.equal(reserveS2Next(unknown,USER,true,2999).operation,null);
 assert.equal(reserveS2Next(unknown,USER,true,3000).operation.attempts,2);
 assert.equal(retryDelayMs(20),S2_OUTBOX_LIMITS.maxRetryMs);
});
test('Only trusted matching server receipt confirms earned reward, no false credit',()=>{
 const sending=reserveS2Next(enqueueS2Evidence([],draft()).queue,USER,true,1000).queue;
 const wrongUser=confirmS2ServerResult(sending,verified({userId:OTHER}),1300);
 assert.equal(wrongUser[0].status,'MANUAL_RECONCILE');
 assert.equal(wrongUser[0].serverTokens,null);
 const malformed=confirmS2ServerResult(sending,verified({serverTokens:999}),1300);
 assert.equal(malformed[0].status,'MANUAL_RECONCILE');
 const correct=confirmS2ServerResult(sending,verified(),1300);
 assert.equal(correct[0].serverReceiptId,'s2-source-001');
 assert.equal(correct[0].serverTokens,2);
 assert.equal(getS2RewardDisplay(correct[0]),'EARNED');
 assert.equal(confirmS2ServerResult(correct,verified(),1400),correct.length && correct);
});
test('Server denial is not earned; retry response remains pending',()=>{
 const sending=reserveS2Next(enqueueS2Evidence([],draft()).queue,USER,true,1000).queue;
 const denied=confirmS2ServerResult(sending,verified({
  decision:'INELIGIBLE',serverReceiptId:null,serverTokens:0,reason:'Excluded source'}),1600);
 assert.equal(denied[0].status,'REJECTED');
 assert.equal(getS2RewardDisplay(denied[0]),'NOT_ELIGIBLE');
 const uncertain=confirmS2ServerResult(sending,verified({
  decision:'RETRY',serverReceiptId:null,serverTokens:null,reason:'Temporary network'}),1600);
 assert.equal(uncertain[0].status,'RETRY_WAIT');
 assert.equal(uncertain[0].serverTokens,null);
});
test('App kill recovers interrupted send without mint and preserves attempt budget',()=>{
 const sending=reserveS2Next(enqueueS2Evidence([],draft()).queue,USER,true,1000).queue;
 const resumed=recoverS2InterruptedSends(sending,5000);
 assert.equal(resumed[0].operationId,OP);
 assert.equal(resumed[0].status,'RETRY_WAIT');
 assert.equal(resumed[0].nextRetryAtMs,5000);
 assert.equal(resumed[0].serverTokens,null);
 const exhausted=recoverS2InterruptedSends([{...sending[0],attempts:6}],5000);
 assert.equal(exhausted[0].status,'MANUAL_RECONCILE');
});
test('Repeated silent failures become retained manual reconciliation, never deleted',()=>{
 let queue=enqueueS2Evidence([],draft()).queue,now=1000;
 for(let i=0;i<S2_OUTBOX_LIMITS.maxAttempts;i++){
  const sent=reserveS2Next(queue,USER,true,now);
  assert.ok(sent.operation);
  queue=markS2TransportUnknown(sent.queue,OP,now);
  now=queue[0].nextRetryAtMs;
 }
 assert.equal(queue[0].status,'MANUAL_RECONCILE');
 assert.equal(queue[0].serverTokens,null);
 assert.equal(queue.length,1);
});
test('Confirmed receipt can be compacted only after durable server wallet ack',()=>{
 const sending=reserveS2Next(enqueueS2Evidence([],draft()).queue,USER,true,1000).queue;
 const confirmed=confirmS2ServerResult(sending,verified(),1400);
 assert.equal(compactS2ConfirmedOutbox(confirmed,new Set()).length,1);
 assert.equal(compactS2ConfirmedOutbox(confirmed,new Set(['other'])).length,1);
 assert.equal(compactS2ConfirmedOutbox(confirmed,new Set(['s2-source-001'])).length,0);
 assert.equal(compactS2ConfirmedOutbox(sending,new Set(['s2-source-001'])).length,1);
});
test('Reject malformed IDs, fake timestamps and queue overcapacity',()=>{
 assert.throws(()=>enqueueS2Evidence([],draft({operationId:'bad'})));
 assert.throws(()=>enqueueS2Evidence([],draft({localQueuedAtMs:NaN})));
 assert.throws(()=>reserveS2Next([],USER,true,-1));
 const full=Array.from({length:S2_OUTBOX_LIMITS.maxEntries},(_,i)=>({
  ...enqueueS2Evidence([],draft({
   operationId:'10000000-1111-4111-8111-'+i.toString(16).padStart(12,'0'),
   sourceId:'20000000-2222-4222-8222-'+i.toString(16).padStart(12,'0')
  })).queue[0],
 }));
 assert.throws(()=>enqueueS2Evidence(full,draft({
  operationId:'f1111111-1111-4111-8111-111111111111',
  sourceId:'f2222222-2222-4222-8222-222222222222'
 })));
});
