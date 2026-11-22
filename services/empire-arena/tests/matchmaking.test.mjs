import test from 'node:test';
import assert from 'node:assert/strict';
import { ArenaMatchCoordinator } from '../core.mjs';
import { RANKED_LEVEL_BANDS, MAX_RATING_SPREAD,
  verifiedArenaBracket, selectFairArenaGroup } from '../matchmaking.mjs';

const snapshot=level=>({characterLevel:level,bpEligibleLevel:level,
  itemVerifiedLevel:level,diamonds:Math.max(1,level*4),verifiedItems:[]});
function player(number,level=1,rating=1200) {
  const events=[];
  const session={
    userId:'00000000-0000-4000-8000-'+String(number).padStart(12,'0'),
    hero:'phan',eligible:true,verified:true,
    profile:{diamonds:40,rating},
    snapshot:snapshot(level),disconnectedAt:null,
    send:e=>events.push(e),events,
  };
  return session;
}
function setup() {
  const calls={open:[],settle:[],abort:[]};
  const store={
    open:async x=>(calls.open.push(x),{accepted:true}),
    settle:async x=>(calls.settle.push(x),{settled:true}),
    abort:async x=>(calls.abort.push(x),{aborted:true}),
  };
  let now=1000;
  const coordinator=new ArenaMatchCoordinator({store,clock:()=>now,
    randomId:()=>String(calls.open.length).padStart(36,'0')});
  return {coordinator,calls,advance:ms=>now+=ms};
}
test('All five canonical permanent progression brackets are exact and no missing profile is accepted',()=>{
  assert.deepEqual(RANKED_LEVEL_BANDS,[[1,4],[5,8],[9,12],[13,16],[17,20]]);
  for(let level=1;level<=20;level++)
    assert.equal(verifiedArenaBracket(player(level,level)),Math.floor((level-1)/4));
  assert.throws(()=>verifiedArenaBracket(player(1,0)),/ranked_bracket_not_verified/);
  assert.throws(()=>verifiedArenaBracket(player(1,21)),/ranked_bracket_not_verified/);
  assert.throws(()=>verifiedArenaBracket({...player(1),profile:{diamonds:20}}),/ranked_bracket_not_verified/);
  assert.throws(()=>verifiedArenaBracket({...player(1),snapshot:{characterLevel:1.5}}),/ranked_bracket_not_verified/);
});
test('Queue never matches permanent level 1 with level 20 or different brackets even at identical rating',async()=>{
  const h=setup(),lo=player(1,1,1300),hi=player(2,20,1300);
  await h.coordinator.enqueue(lo,'duel','genesis_rift');
  await h.coordinator.enqueue(hi,'duel','genesis_rift');
  assert.equal(h.coordinator.matches.size,0);
  assert.equal(h.calls.open.length,0);
  const peer=player(3,2,1350);
  await h.coordinator.enqueue(peer,'duel','genesis_rift');
  assert.equal(h.calls.open.length,1);
  const matched=[...h.coordinator.matches.values()][0].roster.map(r=>r.session.userId);
  assert.deepEqual(matched,[lo.userId,peer.userId]);
  assert.equal(h.coordinator.occupied.get(hi.userId).kind,'queued');
});
test('Outlier rating cannot force an unfair instant match; eligible rating pair can still match',async()=>{
  const h=setup(),a=player(11,7,1100),b=player(12,7,1800),c=player(13,7,1300);
  await h.coordinator.enqueue(a,'duel','aurora_foundry');
  await h.coordinator.enqueue(b,'duel','aurora_foundry');
  assert.equal(h.calls.open.length,0);
  await h.coordinator.enqueue(c,'duel','aurora_foundry');
  assert.equal(h.calls.open.length,1);
  assert.deepEqual([...h.coordinator.matches.values()][0].roster.map(r=>r.session.userId),
    [a.userId,c.userId]);
  assert.equal(h.coordinator.occupied.get(b.userId).kind,'queued');
});
test('Large ranked teams match exact 3v3 or 5v5 within a verified bracket and rating spread',async()=>{
  for(const [mode,n] of [['cluster',3],['grand',5]]){
    const h=setup();
    for(let i=1;i<=n*2;i++)
      await h.coordinator.enqueue(player(i,13+(i%4),1100+i*5),mode,'verdant_fracture');
    assert.equal(h.calls.open.length,1);
    const match=[...h.coordinator.matches.values()][0];
    assert.equal(match.roster.length,n*2);
    assert.ok(Math.max(...match.roster.map(x=>x.session.profile.rating))-
      Math.min(...match.roster.map(x=>x.session.profile.rating))<=MAX_RATING_SPREAD);
    assert.equal(new Set(match.roster.map(x=>verifiedArenaBracket(x.session))).size,1);
    await h.coordinator.abort(match,'test_cleanup');
  }
});
test('A mixed-rating queue cannot cherry-pick higher-rated players into a low band and invalid snapshots fail closed',async()=>{
  const h=setup();
  const invalid=player(21);
  invalid.snapshot={characterLevel:500};
  await assert.rejects(h.coordinator.enqueue(invalid,'duel','genesis_rift'),/ranked_bracket_not_verified/);
  assert.equal(h.coordinator.occupied.size,0);
  assert.equal(h.calls.open.length,0);
  const one=player(31,5,1500),two=player(32,5,1850);
  assert.equal(selectFairArenaGroup([{session:one},{session:two}],2),null);
});
