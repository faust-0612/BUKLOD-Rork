import test from "node:test";
import assert from "node:assert/strict";
import {planRankedMatch,teamVoicePolicy} from "../src/features/empire-arena/matchmaking.mjs";
function queue(size=3){
 return Array.from({length:size*2},(_,i)=>({
  id:"user-"+i,characterId:i%2?"ace":"phan",humanVerified:true,
  loadoutVerified:true,scopeVerified:true,activeSession:true,
  rating:1000+i%2*20,effectiveLevel:5,latencyMs:45,region:"ph",
  verifiedScopeId:i<size?"cluster-1":"cluster-2",queuedAtMs:1000
 }));
}
function matchRequest(overrides={}){
 return {queue:queue(),mode:"cluster",region:"ph",nowMs:1200,...overrides};
}
test("3v3 matchmaking returns a real, balanced six-person roster",()=>{
 const p=planRankedMatch(matchRequest());
 assert.equal(p.status,"ready");
 assert.equal(p.roster.length,6);
 assert.equal(p.roster.filter(x=>x.team==="A").length,3);
 assert.equal(p.roster.filter(x=>x.team==="B").length,3);
});
test("scope challenges require separate verified clusters",()=>{
 const p=planRankedMatch(matchRequest({scopeChallenge:{scopeA:"cluster-1",scopeB:"cluster-2"}}));
 assert.equal(p.status,"ready");assert.equal(p.scopeChallenge.scopeA,"cluster-1");
 assert.equal(planRankedMatch(matchRequest({scopeChallenge:{scopeA:"cluster-1",scopeB:"cluster-1"}})).status,"invalid_scope_challenge");
});
test("unverified humans and fake sessions cannot enter a ranked battle",()=>{
 const members=queue();members[0].humanVerified=false;
 assert.equal(planRankedMatch(matchRequest({queue:members})).status,"waiting_for_humans");
 members[0].humanVerified=true;members[0].activeSession=false;
 assert.equal(planRankedMatch(matchRequest({queue:members})).status,"waiting_for_humans");
});
test("cross-region users do not enter the PH ranked pool",()=>{
 assert.equal(planRankedMatch(matchRequest({region:"us"})).status,"waiting_for_humans");
});
test("strongly imbalanced premade teams cannot force an instant ranked match",()=>{
 const members=queue().map((x,i)=>({...x,rating:i<3?1000:2200}));
 const p=planRankedMatch(matchRequest({queue:members,scopeChallenge:{scopeA:"cluster-1",scopeB:"cluster-2"}}));
 assert.equal(p.status,"searching_balanced_match");
});
test("duplicate simultaneous queue identities are rejected",()=>{
 const members=queue();members[1].id=members[0].id;
 assert.equal(planRankedMatch(matchRequest({queue:members})).status,"duplicate_queue_identity");
});
test("voice consent cannot be bypassed and is isolated by team",()=>{
 const m={id:"match-voice-1",status:"active",players:{a:{team:"A"},b:{team:"B"}}};
 const p=teamVoicePolicy(m,"a",{consent:true});
 assert.equal(p.allowed,true);assert.ok(p.channelId.endsWith(":team:A"));
 assert.equal(teamVoicePolicy(m,"a",{consent:false}).allowed,false);
 assert.equal(teamVoicePolicy(m,"a",{consent:true,userMuted:true}).allowed,false);
 assert.notEqual(teamVoicePolicy(m,"a",{consent:true}).channelId,teamVoicePolicy(m,"b",{consent:true}).channelId);
});
