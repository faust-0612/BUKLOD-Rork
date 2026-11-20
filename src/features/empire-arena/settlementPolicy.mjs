/* BUKLOD Empire Arena V1 settlement PLANNER.
 * This module does not mint, debit, transfer or persist BP/Diamonds.
 * Only a trusted gateway may invoke it after verifying a signed match receipt.
 * Atomic ledger execution + canonical BP grant is a separate server gate.
 */
export const ECONOMY_POLICY = Object.freeze({
  bpPerEligibleWin:{duel:2,cluster:3,grand:4},
  bpDailyCap:12,
  diamondVictoryCredit:6,
  diamondParticipationCredit:10,
  diamondDailyEarnCap:50,
  diamondDailyLossCap:30,
  qualifyingPairWinCap24h:2,
  ratingK:24,
  ratingFloor:100,
  ratingCeiling:3500,
  maxLevel:20
});
export const PARTICIPATION_SOURCES = Object.freeze([
  "verified_community_contribution",
  "verified_real_world_service",
  "verified_learning_completion",
  "verified_member_assistance",
  "verified_creative_contribution",
  "verified_faith_activity" // Optional; equivalent non-faith routes must remain available.
]);
export function safeInt(value,minimum=0,maximum=1000000000){
  return Math.max(minimum,Math.min(maximum,Number.isFinite(Number(value))?Math.floor(Number(value)):minimum));
}
export function divisionForRating(rating){
  const n=safeInt(rating);
  if(n>=2000)return "Luminary";
  if(n>=1700)return "Vanguard";
  if(n>=1400)return "Guardian";
  if(n>=1100)return "Pathfinder";
  if(n>=850)return "Builder";
  return "Pioneer";
}
export function planParticipationDiamonds(proof,account){
  // proof is a canonical, independently verified participation event, never a user claim.
  if(!proof||proof.verifiedByParticipationService!==true||!PARTICIPATION_SOURCES.includes(proof.source)||typeof proof.sourceEventId!=="string"||proof.sourceEventId.length<8)return {eligible:false,amount:0,reason:"unverified_source"};
  if(!account||typeof account.userId!=="string"||account.userId!==proof.userId||typeof proof.characterId!=="string")return {eligible:false,amount:0,reason:"identity_mismatch"};
  if(proof.alreadyCredited===true)return {eligible:false,amount:0,reason:"already_credited"};
  if(proof.showFaithRequired===true)return {eligible:false,amount:0,reason:"faith_gate_forbidden"};
  const remaining=ECONOMY_POLICY.diamondDailyEarnCap-safeInt(account.diamondsEarned24h);
  const amount=Math.min(ECONOMY_POLICY.diamondParticipationCredit,Math.max(0,remaining));
  return {eligible:amount>0,amount,reason:amount>0?"qualified":"daily_cap",userId:proof.userId,characterId:proof.characterId,
    sourceKey:"empire_arena:participation:v1:"+proof.source+":"+proof.sourceEventId,settlementOnly:true};
}
export function planMatchSettlement(match,verified){
  // CRITICAL: verified is supplied only by the receipt-verifying server, not the app.
  if(!match||match.status!=="finished"||!match.result||!match.result.winner||!match.ranked)
    return {status:"not_ranked_or_not_decisive",effects:[]};
  if(!verified||verified.receiptValidated!==true||verified.matchId!==match.id||
     verified.ruleVersion!==match.ruleVersion||typeof verified.serverReceiptHash!=="string"||
     verified.serverReceiptHash.length<24)
    return {status:"verification_required",effects:[]};
  if(verified.riskHold===true||verified.serverIncident===true)return {status:"held_for_review",effects:[]};
  const roster=Object.values(match.players),accounts=verified.accounts||{};
  const teamA=roster.filter(p=>p.team==="A"),teamB=roster.filter(p=>p.team==="B");
  if(!teamA.length||!teamB.length||roster.some(p=>!accounts[p.id]||accounts[p.id].humanVerified!==true||
    accounts[p.id].characterId!==p.characterId||accounts[p.id].lockedLevel!==p.level))
    return {status:"roster_or_entitlement_mismatch",effects:[]};
  if(match.elapsedMs<({duel:45000,cluster:120000,grand:180000}[match.mode]||Infinity))
    return {status:"minimum_duration_not_met",effects:[]};
  const avg=(team)=>team.reduce((sum,p)=>sum+safeInt(accounts[p.id].rating,100,3500),0)/team.length;
  const expectedA=1/(1+Math.pow(10,(avg(teamB)-avg(teamA))/400));
  const deltaA=Math.round(ECONOMY_POLICY.ratingK*(1-expectedA));
  const winner=match.result.winner;
  const effects=[];
  for(const p of roster.sort((a,b)=>a.id.localeCompare(b.id))){
    const a=accounts[p.id],won=p.team===winner,oldRating=safeInt(a.rating,100,3500);
    const ratingDelta=won?(winner==="A"?deltaA:Math.round(ECONOMY_POLICY.ratingK*expectedA)):(winner==="A"?-Math.round(ECONOMY_POLICY.ratingK*expectedA):-deltaA);
    const newRating=safeInt(oldRating+ratingDelta,ECONOMY_POLICY.ratingFloor,ECONOMY_POLICY.ratingCeiling);
    const before=safeInt(a.characterDiamonds);
    const qualified=p.activeMs>=Math.min(60000,match.elapsedMs*.40)&&p.contributions>=2&&
      a.riskFlagged!==true&&a.afkPenalty!==true&&a.repeatedWinCollusion!==true;
    const repeated=safeInt(a.pairQualifiedWins24h)>=ECONOMY_POLICY.qualifyingPairWinCap24h;
    const bpRemaining=Math.max(0,ECONOMY_POLICY.bpDailyCap-safeInt(a.bpFromArena24h));
    const bpAward=won&&qualified&&!repeated?Math.min(bpRemaining,ECONOMY_POLICY.bpPerEligibleWin[match.mode]||0):0;
    const earnRemaining=Math.max(0,ECONOMY_POLICY.diamondDailyEarnCap-safeInt(a.diamondsEarned24h));
    const lossRemaining=Math.max(0,ECONOMY_POLICY.diamondDailyLossCap-safeInt(a.diamondsLost24h));
    const diamondDelta=won?(qualified&&!repeated?Math.min(ECONOMY_POLICY.diamondVictoryCredit,earnRemaining):0):
      -Math.min(before,lossRemaining,Math.min(12,3+safeInt(p.level,1,20)));
    effects.push({
      userId:p.id,team:p.team,characterId:p.characterId,won,qualified,
      ratingBefore:oldRating,ratingAfter:newRating,divisionBefore:divisionForRating(oldRating),divisionAfter:divisionForRating(newRating),
      diamondBefore:before,diamondAfter:before+diamondDelta,diamondDelta,
      bpAward,bpSourceKey:bpAward>0?"empire_arena:ranked_win:v1:"+match.id+":"+p.id:null,
      diamondSourceKey:diamondDelta!==0?"empire_arena:match_diamonds:v1:"+match.id+":"+p.id:null,
      settlementKey:"empire_arena:match:v1:"+match.id+":"+p.id,
      // Never write Character Development Level, Circle Rank, earned items or BP debits.
      protectedCanonicalFields:["character_development_level","item_ownership","circle_rank","historical_bp"]
    });
  }
  return {status:"planned_not_committed",matchId:match.id,ruleVersion:match.ruleVersion,serverReceiptHash:verified.serverReceiptHash,winnerTeam:winner,
    settlementIdempotencyKey:"empire_arena:settle:v1:"+match.id,effects};
}
