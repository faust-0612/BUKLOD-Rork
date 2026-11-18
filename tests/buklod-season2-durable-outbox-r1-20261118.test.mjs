import test from 'node:test';
import assert from 'node:assert/strict';
import {S2DurableOutboxR1,S2_DURABLE_OUTBOX_ROLLOUT}
from '../src/lib/season2/buklodSeason2DurableOutboxR1.ts';
const user='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const id='11111111-1111-4111-8111-111111111111';
const source='22222222-2222-4222-8222-222222222222';
const draft=(x={})=>({operationId:id,userId:user,sourceKind:'wall_original_post',
 sourceId:source,localQueuedAtMs:1000,...x});
const response=(x={})=>({operationId:id,userId:user,sourceKind:'wall_original_post',
 sourceId:source,authenticatedAdapter:true,decision:'EARNED',
 serverReceiptId:'receipt-verified-001',serverTokens:2,reason:'ok',...x});
function memory(){
 const data=new Map();let fail=false;
 return {data,failOnce:()=>{fail=true;},
 async getItem(k){return data.has(k)?data.get(k):null;},
 async setItem(k,v){if(fail){fail=false;throw Error('Storage unavailable');}
  data.set(k,v);}
 };
}
test('S2 storage and transport remain OFF without app import',()=>{
 assert.ok(Object.values(S2_DURABLE_OUTBOX_ROLLOUT).every(x=>x===false));
});
test('Failed write cannot report queued or pretend server earned',async()=>{
 const s=memory(),q=new S2DurableOutboxR1(s);
 s.failOnce();
 await assert.rejects(q.enqueue(user,draft()),/Storage unavailable/);
 assert.equal((await q.inspect(user)).length,0);
 assert.equal((await q.enqueue(user,draft())).queue[0].serverTokens,null);
});
test('Parallel enqueues serialize; double tap keeps one persistent item',async()=>{
 const q=new S2DurableOutboxR1(memory());
 const result=await Promise.all([q.enqueue(user,draft()),
   q.enqueue(user,draft({operationId:'33333333-3333-4333-8333-333333333333'}))]);
 assert.deepEqual(result.map(x=>x.status).sort(),['DUPLICATE','QUEUED']);
 assert.equal((await q.inspect(user)).length,1);
});
test('Offline, account isolation and single-flight survive simulated restart',async()=>{
 const s=memory(),q=new S2DurableOutboxR1(s);
 await assert.rejects(q.enqueue(other,draft()),/S2_ACCOUNT_MISMATCH/);
 await q.enqueue(user,draft());
 assert.equal(await q.reserve(user,false,1100),null);
 assert.equal(await q.reserve(other,true,1100),null);
 const sent=await q.reserve(user,true,1100);
 assert.equal(sent.status,'SENDING');
 assert.equal(await q.reserve(user,true,1100),null);
 const reboot=new S2DurableOutboxR1(s);
 assert.equal((await reboot.recover(user,2100))[0].status,'RETRY_WAIT');
 assert.equal((await reboot.reserve(user,true,2100)).operationId,id);
});
test('Backend reply controls earned view; wallet ack controls queue cleanup',async()=>{
 const s=memory(),q=new S2DurableOutboxR1(s);
 await q.enqueue(user,draft());await q.reserve(user,true,1100);
 await assert.rejects(q.confirm(user,response({userId:other}),1200),
   /S2_ACCOUNT_MISMATCH/);
 assert.equal((await q.inspect(user))[0].status,'SENDING');
 const confirmed=await q.confirm(user,response(),1200);
 assert.equal(confirmed[0].status,'CONFIRMED');
 assert.equal(confirmed[0].serverTokens,2);
 assert.equal((await q.acknowledgeWallet(user,new Set())).length,1);
 assert.equal((await q.acknowledgeWallet(user,new Set(['receipt-verified-001']))).length,0);
});
test('Corrupted cross-account queue blocks instead of leaking',async()=>{
 const s=memory(),q=new S2DurableOutboxR1(s);
 await q.enqueue(user,draft());
 s.data.set('buklod:s2:outbox:r1:'+user,JSON.stringify([{userId:other}]));
 await assert.rejects(q.inspect(user),/S2_CORRUPT_OUTBOX/);
 assert.equal((await q.inspect(other)).length,0);
});
test('Interrupted write on retry does not lose the stable operation',async()=>{
 const s=memory(),q=new S2DurableOutboxR1(s);
 await q.enqueue(user,draft());await q.reserve(user,true,1100);
 s.failOnce();
 await assert.rejects(q.unknown(user,id,1300),/Storage unavailable/);
 assert.equal((await q.inspect(user))[0].status,'SENDING');
 assert.equal((await q.recover(user,1400))[0].operationId,id);
});
