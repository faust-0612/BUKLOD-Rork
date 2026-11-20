import test from "node:test";
import assert from "node:assert/strict";
import {
  MODES,MAPS,HEROES,DIAMOND_THRESHOLDS,createMatch,stepMatch,
  levelForDiamonds,effectiveCombatLevel,validateCommandEnvelope,publicResult
} from "../src/features/empire-arena/arenaCore.mjs";
import {
  planMatchSettlement,planParticipationDiamonds,divisionForRating
} from "../src/features/empire-arena/settlementPolicy.mjs";

function roster(size=3,level=7){
  return Array.from({length:size*2},(_,i)=>({
    id:"player-"+i,team:i<size?"A":"B",
    characterId:i%2?"ace":"phan",effectiveLevel:level,humanVerified:true
  }));
}
function match(options={}){
  return createMatch({id:"test-match-0001",mode:"cluster",roster:roster(),ranked:true,...options});
}
function finished(){
  const s=match();
  s.status="finished";s.elapsedMs=240000;s.result={winner:"A",loser:"B",reason:"test",elapsedMs:240000};
  for(const p of Object.values(s.players)){p.activeMs=180000;p.contributions=12;}
  return s;
}
function receipt(s){
  const accounts={};
  for(const p of Object.values(s.players))accounts[p.id]={
    humanVerified:true,characterId:p.characterId,lockedLevel:p.level,
    rating:1000,characterDiamonds:125,diamondsEarned24h:0,diamondsLost24h:0,
    bpFromArena24h:0,pairQualifiedWins24h:0
  };
  return {matchId:s.id,ruleVersion:s.ruleVersion,receiptValidated:true,
    serverReceiptHash:"0123456789abcdef0123456789abcdef",accounts};
}
test("all thirteen canonical BUKLOD heroes are available in the catalog",()=>{
  assert.equal(Object.keys(HEROES).length,13);
  assert.ok(HEROES.ellusur);assert.equal(HEROES.elesur,undefined);
});
test("all three launch maps and modes are present",()=>{
  assert.equal(Object.keys(MAPS).length,3);assert.equal(Object.keys(MODES).length,3);
});
test("diamonds 125 -> 115 demotes effective combat level 7 -> 6",()=>{
  assert.equal(levelForDiamonds(125),7);assert.equal(levelForDiamonds(115),6);
  assert.equal(effectiveCombatLevel({developmentLevel:7,bpEligibleLevel:7,itemVerifiedLevel:7,diamondBalance:115}),6);
});
test("canonical BP and item gates independently limit combat level",()=>{
  assert.equal(effectiveCombatLevel({developmentLevel:10,bpEligibleLevel:4,itemVerifiedLevel:10,diamondBalance:2900}),4);
  assert.equal(effectiveCombatLevel({developmentLevel:10,bpEligibleLevel:10,itemVerifiedLevel:5,diamondBalance:2900}),5);
  assert.equal(effectiveCombatLevel({developmentLevel:10,diamondBalance:2900}),1);
});
test("ranked 3v3 refuses duplicate or unverified players",()=>{
  assert.equal(Object.keys(match().players).length,6);
  const duplicate=roster();duplicate[1].id=duplicate[0].id;
  assert.throws(()=>match({roster:duplicate}),/duplicate_identity/);
  const bots=roster();bots[0].humanVerified=false;
  assert.throws(()=>match({roster:bots}),/unverified_ranked_player/);
});
test("client cannot command a teammate or reuse a stale join ticket",()=>{
  const s=match(),ticket={matchId:s.id,userId:"player-0",expiresAtMs:5000};
  assert.equal(validateCommandEnvelope(s,"player-0",ticket,{actorId:"player-1",seq:1,type:"attack"},100),false);
  assert.equal(validateCommandEnvelope(s,"player-0",ticket,{actorId:"player-0",seq:1,type:"move"},5000),false);
  assert.equal(validateCommandEnvelope(s,"player-0",ticket,{actorId:"player-0",seq:1,type:"move"},100),true);
});
test("fixed tick, input sequence deduplication and no invalid movement",()=>{
  let s=match();assert.throws(()=>stepMatch(s,[],100),/fixed_tick_required/);
  s=stepMatch(s,[{actorId:"player-0",seq:1,type:"move",dx:1,dy:0}]);
  const x=s.players["player-0"].x;
  s=stepMatch(s,[{actorId:"player-0",seq:1,type:"move",dx:1,dy:0}]);
  assert.equal(s.players["player-0"].x,x);
  s=stepMatch(s,[{actorId:"player-0",seq:2,type:"move",dx:Infinity,dy:0}]);
  assert.equal(s.players["player-0"].x,x);
});
test("no friendly fire or remote hit through level caps",()=>{
  const s=match();const a=s.players["player-0"],b=s.players["player-2"];
  a.x=9;a.y=11;b.x=10;b.y=11;
  const hp=b.hp,after=stepMatch(s,[{actorId:a.id,seq:1,type:"attack",target:b.id}]);
  assert.equal(after.players[b.id].hp,hp);
});
test("capturing all three relays for 12 seconds yields a decisive network victory",()=>{
  let s=match();for(const relay of s.relays){relay.owner="A";relay.progress=100;}
  for(let i=0;i<240;i++)s=stepMatch(s);
  assert.equal(s.status,"finished");assert.equal(s.result.winner,"A");
  assert.equal(s.result.reason,"three_relay_network_lock");
});
test("one player can capture a neutral relay by sustained uncontested actions",()=>{
  let s=match();const p=s.players["player-0"];p.x=s.relays[0].x;p.y=s.relays[0].y;
  for(let i=0;i<82;i++)s=stepMatch(s,[{actorId:p.id,seq:i+1,type:"capture"}]);
  assert.equal(s.relays[0].owner,"A");
});
test("Buklod Link shields nearby teammates and spends temporary match Flux",()=>{
  const s=match(),p=s.players["player-0"],q=s.players["player-2"];
  const next=stepMatch(s,[{actorId:p.id,seq:1,type:"link",partnerId:q.id}]);
  assert.equal(next.players[p.id].shield,24);assert.equal(next.players[q.id].shield,24);
  assert.equal(next.teams.A.flux,25);
  assert.equal(next.events.find(e=>e.type==="buklod_link").team,"A");
});
test("an inactive overtime stalemate is void, not an invented win or loss",()=>{
  let s=match();s.overtime=true;s.elapsedMs=MODES.cluster.durationMs+59950;
  s=stepMatch(s);assert.equal(s.status,"void");assert.equal(s.result.winner,null);
});
test("competitive settlement cannot be created from unsigned or casual results",()=>{
  const s=finished(),v=receipt(s);
  v.receiptValidated=false;assert.equal(planMatchSettlement(s,v).effects.length,0);
  v.receiptValidated=true;s.ranked=false;assert.equal(planMatchSettlement(s,v).effects.length,0);
});
test("winners gain BP, losers lose Diamonds but not BP",()=>{
  const s=finished(),p=planMatchSettlement(s,receipt(s));
  assert.equal(p.status,"planned_not_committed");
  const wins=p.effects.filter(e=>e.won),losses=p.effects.filter(e=>!e.won);
  assert.ok(wins.every(e=>e.bpAward===3));assert.ok(losses.every(e=>e.bpAward===0));
  assert.ok(losses.every(e=>e.diamondBefore===125&&e.diamondAfter===115));
  assert.ok(p.effects.every(e=>e.protectedCanonicalFields.includes("historical_bp")));
});
test("Elo upsets reward the underdog more and losers lose symmetrically",()=>{
  const s=finished();s.result.winner="B";s.result.loser="A";
  const v=receipt(s);
  for(const p of Object.values(s.players))v.accounts[p.id].rating=p.team==="A"?1700:1000;
  const plan=planMatchSettlement(s,v);
  const winner=plan.effects.find(e=>e.won),loser=plan.effects.find(e=>!e.won);
  assert.ok(winner.ratingAfter-winner.ratingBefore>12);
  assert.equal(winner.ratingAfter-winner.ratingBefore,loser.ratingBefore-loser.ratingAfter);
});
test("pair rematch farming, AFK and daily BP caps block duplicate BP rewards",()=>{
  const s=finished(),v=receipt(s);
  v.accounts["player-0"].pairQualifiedWins24h=2;
  assert.equal(planMatchSettlement(s,v).effects.find(e=>e.userId==="player-0").bpAward,0);
  v.accounts["player-0"].pairQualifiedWins24h=0;
  v.accounts["player-0"].bpFromArena24h=11;
  assert.equal(planMatchSettlement(s,v).effects.find(e=>e.userId==="player-0").bpAward,1);
  s.players["player-0"].activeMs=0;
  assert.equal(planMatchSettlement(s,v).effects.find(e=>e.userId==="player-0").bpAward,0);
});
test("suspected abuse and server incidents hold all consequences",()=>{
  const s=finished(),v=receipt(s);
  v.serverIncident=true;assert.equal(planMatchSettlement(s,v).status,"held_for_review");
  v.serverIncident=false;v.riskHold=true;
  assert.equal(planMatchSettlement(s,v).effects.length,0);
});
test("match settlement planning has stable idempotency keys across retries",()=>{
  const s=finished(),v=receipt(s);
  assert.deepEqual(planMatchSettlement(s,v),planMatchSettlement(s,v));
});
test("Diamonds only credit independently verified faith-optional participation",()=>{
  const proof={userId:"u",characterId:"phan",source:"verified_community_contribution",
    sourceEventId:"unique-001",verifiedByParticipationService:true};
  const account={userId:"u",diamondsEarned24h:0};
  assert.equal(planParticipationDiamonds(proof,account).amount,10);
  assert.equal(planParticipationDiamonds({...proof,alreadyCredited:true},account).amount,0);
  assert.equal(planParticipationDiamonds({...proof,showFaithRequired:true},account).amount,0);
  assert.equal(planParticipationDiamonds({...proof,verifiedByParticipationService:false},account).amount,0);
});
test("results include complete winner-loser and player stats",()=>{
  const s=finished(),r=publicResult(s);assert.equal(r.winner,"A");
  assert.equal(r.players.length,6);assert.equal(r.matchId,s.id);
});
