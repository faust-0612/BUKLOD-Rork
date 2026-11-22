import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ArenaMatchCoordinator} from '../services/empire-arena/core.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const client=readFileSync(resolve(root,'src/features/games/empire/rankedClient.ts'),'utf8');
const server=readFileSync(resolve(root,'services/empire-arena/server.mjs'),'utf8');
const transport=readFileSync(resolve(root,'services/empire-arena/transport.mjs'),'utf8');
const uuid=i=>'00000000-0000-4000-8000-'+String(i).padStart(12,'0');
const session=(i,eligible=true)=>{
  const out=[];
  return {userId:uuid(i),hero:i===1?'phan':'quin',eligible,verified:true,
    profile:{diamonds:eligible?1:0,rating:1200},
    snapshot:eligible?{characterLevel:1,bpEligibleLevel:1,itemVerifiedLevel:1,
      diamonds:1,verifiedItems:[]}:null,
    disconnectedAt:null,send:event=>out.push(event),events:out};
};

test('Last reserved Diamond does not prohibit reattachment to server-owned active seat',async()=>{
  const reserve=[],settle=[],aborts=[];
  let now=1000;
  const c=new ArenaMatchCoordinator({
    store:{open:async o=>(reserve.push(o),{accepted:true}),
      settle:async o=>(settle.push(o),{settled:true}),
      abort:async o=>(aborts.push(o),{aborted:true})},
    clock:()=>now,randomId:()=>uuid(900),
  });
  const a=session(1),b=session(2);
  await c.enqueue(a,'duel','genesis_rift');
  await c.enqueue(b,'duel','genesis_rift');
  assert.equal(c.matches.size,1);
  assert.equal(reserve.length,1);
  c.disconnect(a);
  now+=7000;
  const reconnected=session(1,false);
  assert.equal(reconnected.profile.diamonds,0,'Funds held in server escrow');
  assert.equal(c.reattach(reconnected),true);
  assert.equal(c.matches.size,1);
  assert.equal(reserve.length,1,'Reconnect cannot reserve another Diamond');
  assert.ok(reconnected.events.some(e=>e.type==='match_resume'&&e.slot==='A0'));
  await c.heartbeat();
  assert.equal(settle.length,0);
});

test('Server allows authenticated resumed seat with zero spendable Diamonds',()=>{
  assert.match(transport,/const resumed=coordinator\.reattach\(session\)/);
  assert.match(transport,/rankedEligible:session\.eligible\|\|resumed/);
  assert.match(client,/if\(this\.resumeOnly&&packet\.resumed!==true\)/);
  assert.match(client,/if\(packet\.resumed!==true&&this\.queue\)/);
});

test('Ranked client has bounded retry/grace and fail-closed identity',()=>{
  assert.match(client,/RECONNECT_DELAYS_MS=\[800,1700,3200\]/);
  assert.match(client,/RANKED_REATTACH_WINDOW_MS=19000/);
  assert.match(client,/session\.user\.id!==this\.expectedUserId/);
  assert.match(client,/this\.retryAttempts>=RECONNECT_DELAYS_MS\.length/);
  assert.match(client,/this\.retryTimer=null/);
  assert.match(client,/if\(this\.retryTimer!==null\)clearTimeout\(this\.retryTimer\)/);
  assert.match(client,/ws\.bufferedAmount>64_000/);
  assert.match(client,/this\.finished=true/);
  assert.match(client,/if\(packet\.type==='match_resume'\)this\.nextSeq=0/);
  assert.doesNotMatch(client,/service_role|secretKey|awardDiamond|settleWorldTrade/);
});
