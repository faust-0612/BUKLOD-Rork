import test from 'node:test';
import assert from 'node:assert/strict';
import { ArenaMatchCoordinator, sanitizeArenaAction } from '../core.mjs';

const uuid=i=>'00000000-0000-4000-8000-'+String(i).padStart(12,'0');
const snapshot=(n=1)=>({characterLevel:n,bpEligibleLevel:n,itemVerifiedLevel:n,
  diamonds:Math.max(1,n*4),verifiedItems:[]});
function fakeSession(i,hero='phan',s=snapshot()){
  const events=[];
  return {userId:uuid(i),hero,eligible:true,verified:true,profile:{diamonds:s.diamonds},
    snapshot:s,disconnectedAt:null,send:message=>events.push(message),events};
}
function harness(){
  const calls={open:[],settle:[],abort:[]};
  const store={
    open:async x=>(calls.open.push(x),{accepted:true}),
    settle:async x=>(calls.settle.push(x),{settled:true}),
    abort:async x=>(calls.abort.push(x),{aborted:true}),
  };
  let now=1_000;
  const coordinator=new ArenaMatchCoordinator({store,clock:()=>now,
    randomId:()=>uuid(800+calls.open.length)});
  return {coordinator,calls,advance:ms=>now+=ms};
}

test('Unknown or forged client authority fields cannot change damage/seat/winner',()=>{
  assert.deepEqual(sanitizeArenaAction({type:'attack',targetId:'B0',damage:99999,playerId:'B0'}),
    {type:'attack',targetId:'B0'});
  assert.equal(sanitizeArenaAction({type:'move',dx:1e9,dy:0}),null);
  assert.equal(sanitizeArenaAction({type:'move',dx:NaN,dy:0}),null);
  assert.equal(sanitizeArenaAction({type:'ranked_settle',winner:'A',diamonds:9000}),null);
  assert.equal(sanitizeArenaAction({type:'build',kind:'watchtower',x:99999,y:3}),null);
  assert.equal(sanitizeArenaAction({type:'skill',slot:'ultimate',targetId:'../../auth'}),null);
  assert.equal(sanitizeArenaAction(Object.create(null)),null);
});

test('Real duel matchmaking binds verified account to server seat, not client-selected slot',async()=>{
  const h=harness(),a=fakeSession(1,'phan'),b=fakeSession(2,'quin');
  await h.coordinator.enqueue(a,'duel','genesis_rift');
  assert.equal(h.coordinator.matches.size,0);
  await h.coordinator.enqueue(b,'duel','genesis_rift');
  assert.equal(h.coordinator.matches.size,1);
  assert.equal(h.calls.open.length,1);
  const m=[...h.coordinator.matches.values()][0];
  assert.deepEqual(m.roster.map(x=>x.slot),['A0','B0']);
  assert.equal(m.state.players.A0.bot,false);
  assert.equal(m.state.players.B0.bot,false);
  assert.equal(m.state.players.B0.hero,'quin');
  assert.equal(a.events.find(x=>x.type==='match_start').slot,'A0');
  assert.equal(b.events.find(x=>x.type==='match_start').slot,'B0');
  const x=m.state.players.A0.x;
  assert.equal(h.coordinator.input(a,1,{type:'move',dx:1,dy:0,playerId:'B0'}),true);
  assert.ok(m.state.players.A0.x>x);
  assert.equal(h.coordinator.input(a,1,{type:'move',dx:1,dy:0}),false,'Replay blocked');
  assert.equal(h.coordinator.input(a,1000000000,{type:'move',dx:1,dy:0}),false,'Huge sequence blocked');
  assert.equal(h.coordinator.input(b,1,{type:'awardBp',amount:300}),false,'Unsafe action blocked');
  await h.coordinator.heartbeat();
  await h.coordinator.heartbeat();
  assert.ok(a.events.some(x=>x.type==='snapshot'),'Server-only state pushed to client');
  m.state.result={winner:'A',reason:'seal_breached'};m.state.status='finished';
  await h.coordinator.heartbeat();
  assert.equal(h.calls.settle.length,1);
  assert.equal(h.calls.settle[0].winner,'A');
  assert.ok(a.events.some(x=>x.type==='match_end'&&x.confirmed===true));
  assert.equal(h.coordinator.matches.size,0);
});

test('Three and five real users per side match with NO bot-controlled seats',async()=>{
  for(const [mode,n] of [['cluster',3],['grand',5]]){
    const h=harness(),sessions=[];
    for(let i=1;i<=2*n;i++){
      const s=fakeSession(i,i%2?'ace':'vhen');
      sessions.push(s);
      await h.coordinator.enqueue(s,mode,'verdant_fracture');
    }
    assert.equal(h.calls.open.length,1);
    const m=[...h.coordinator.matches.values()][0];
    assert.equal(Object.keys(m.state.players).length,2*n);
    assert.equal(Object.values(m.state.players).filter(p=>p.bot).length,0);
    assert.equal(m.roster.filter(x=>x.team==='A').length,n);
    assert.equal(m.roster.filter(x=>x.team==='B').length,n);
    await h.coordinator.abort(m,'test_refund');
    assert.equal(h.calls.abort.length,1);
  }
});

test('Disconnected player gets short reconnection grace; after grace server settles forfeit',async()=>{
  const h=harness(),a=fakeSession(1),b=fakeSession(2);
  await h.coordinator.enqueue(a,'duel','aurora_foundry');
  await h.coordinator.enqueue(b,'duel','aurora_foundry');
  const m=[...h.coordinator.matches.values()][0];
  a.lastCommandSeq=1450; // Long real-time match before weak-network disconnect.
  h.coordinator.disconnect(a);
  h.advance(5000);
  await h.coordinator.heartbeat();
  assert.equal(h.calls.settle.length,0);
  const reconnected=fakeSession(1,'quin',snapshot(4));
  assert.equal(h.coordinator.reattach(reconnected),true);
  assert.equal(reconnected.hero,'phan','Authenticated seat keeps original match hero');
  assert.equal(reconnected.snapshot.characterLevel,1,'Reattach cannot substitute a different hero level');
  assert.equal(m.state.players.A0.hero,'phan');
  assert.equal(h.coordinator.input(reconnected,1,{type:'move',dx:1,dy:0}),true,
    'New authenticated socket must accept sequence 1 even after prior seq 1450');
  await h.coordinator.heartbeat();
  assert.equal(h.calls.settle.length,0);
  h.coordinator.disconnect(reconnected);
  h.advance(25000);
  await h.coordinator.heartbeat();
  assert.equal(h.calls.settle.length,1);
  assert.equal(h.calls.settle[0].winner,'B');
});

test('Database reserve failure never starts a ranked match or gives counterfeit Diamonds',async()=>{
  const h=harness();
  h.coordinator.store.open=async()=>{throw Error('insufficient_earned_diamonds');};
  const a=fakeSession(1),b=fakeSession(2);
  await h.coordinator.enqueue(a,'duel','genesis_rift');
  await h.coordinator.enqueue(b,'duel','genesis_rift');
  assert.equal(h.coordinator.matches.size,0);
  assert.equal(h.calls.settle.length,0);
  assert.equal(h.coordinator.occupied.size,0);
  assert.ok(a.events.some(e=>e.type==='error'&&e.code==='match_setup_failed'));
});


test('Escrow reservation cancels and refunds when a participant disconnects mid-allocation',async()=>{
  const h=harness(),a=fakeSession(41),b=fakeSession(42);
  let releaseReservation;
  h.coordinator.store.open=async x=>{
    h.calls.open.push(x);
    await new Promise(resolve=>{releaseReservation=resolve;});
    return {accepted:true};
  };
  await h.coordinator.enqueue(a,'duel','genesis_rift');
  const pending=h.coordinator.enqueue(b,'duel','genesis_rift');
  assert.equal(typeof releaseReservation,'function','Escrow began asynchronously');
  assert.equal(h.coordinator.occupied.get(a.userId).kind,'allocating');
  h.coordinator.disconnect(a);
  releaseReservation();
  await pending;
  assert.equal(h.calls.open.length,1);
  assert.equal(h.calls.abort.length,1,'Escrow refunded via trusted server');
  assert.equal(h.coordinator.matches.size,0,'No ghost live match');
  assert.equal(h.coordinator.occupied.size,0,'Both seats become available');
  assert.ok(b.events.some(x=>x.type==='error'&&x.code==='match_setup_failed'));
});
