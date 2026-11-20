/* BUKLOD Empire Arena matchmaking planner.
 * Trust/scope membership and token signature validation MUST happen on the server
 * before calling this deterministic, side-effect-free team planner.
 */
export function safeQueueValue(x,fallback=0){return Number.isFinite(Number(x))?Number(x):fallback;}
export function validateCandidate(c,mode){
  return !!c&&typeof c.id==="string"&&c.id.length>0&&c.humanVerified===true&&
    c.loadoutVerified===true&&c.scopeVerified===true&&c.activeSession===true&&
    ["duel","cluster","grand"].includes(mode)&&
    Number.isFinite(c.rating)&&c.rating>=100&&c.rating<=3500&&
    Number.isInteger(c.effectiveLevel)&&c.effectiveLevel>=1&&c.effectiveLevel<=20&&
    Number.isFinite(c.latencyMs)&&c.latencyMs>=0&&c.latencyMs<=240;
}
export function teamDifference(a,b){
  const mean=(team,key)=>team.reduce((sum,p)=>sum+safeQueueValue(p[key]),0)/team.length;
  return Math.abs(mean(a,"rating")-mean(b,"rating"))+
    26*Math.abs(mean(a,"effectiveLevel")-mean(b,"effectiveLevel"))+
    0.30*Math.abs(mean(a,"latencyMs")-mean(b,"latencyMs"));
}
export function chooseBestTeams(entries,size){
  // 5v5: only 252 possible unique team partitions; exhaustive deterministic optimization.
  let best=null;
  const players=[...entries].sort((a,b)=>a.id.localeCompare(b.id));
  const chosen=[];
  function visit(start){
    if(chosen.length===size){
      const keys=new Set(chosen.map(x=>x.id)),a=chosen,b=players.filter(x=>!keys.has(x.id));
      const score=teamDifference(a,b);
      if(!best||score<best.score||score===best.score&&a.map(x=>x.id).join(",")<best.a.map(x=>x.id).join(","))
        best={a:[...a],b,score};
      return;
    }
    for(let i=start;i<=players.length-(size-chosen.length);i++){chosen.push(players[i]);visit(i+1);chosen.pop();}
  }
  visit(0);return best;
}
export function planRankedMatch({queue,mode="cluster",region,nowMs,scopeChallenge=null}){
  const sizes={duel:1,cluster:3,grand:5};
  const size=sizes[mode];
  if(!size||!Number.isFinite(nowMs))return {status:"invalid_request"};
  if(!Array.isArray(queue))return {status:"invalid_queue"};
  const candidates=queue.filter(c=>validateCandidate(c,mode)&&c.region===region);
  if(new Set(candidates.map(c=>c.id)).size!==candidates.length)return {status:"duplicate_queue_identity"};
  candidates.sort((a,b)=>safeQueueValue(a.queuedAtMs)-safeQueueValue(b.queuedAtMs)||a.id.localeCompare(b.id));
  let teams;
  if(scopeChallenge){
    const {scopeA,scopeB}=scopeChallenge;
    if(!scopeA||!scopeB||scopeA===scopeB)return {status:"invalid_scope_challenge"};
    // Each scope claim must have been server-verified; not taken from account metadata.
    const a=candidates.filter(p=>p.verifiedScopeId===scopeA).slice(0,size);
    const b=candidates.filter(p=>p.verifiedScopeId===scopeB).slice(0,size);
    if(a.length<size||b.length<size)return {status:"waiting_for_verified_members",needed:2*size};
    teams={a,b,score:teamDifference(a,b)};
  }else{
    if(candidates.length<2*size)return {status:"waiting_for_humans",needed:2*size};
    // Limit selection to the oldest reasonable cohort; avoid globally optimizing to
    // endlessly skip the oldest player in favor of easy queues.
    teams=chooseBestTeams(candidates.slice(0,2*size),size);
  }
  const elapsed=Math.max(0,nowMs-Math.min(...[...teams.a,...teams.b].map(p=>safeQueueValue(p.queuedAtMs,nowMs))));
  const maxDifference=elapsed>=90000?520:elapsed>=45000?390:270;
  if(teams.score>maxDifference)return {status:"searching_balanced_match",score:Math.round(teams.score),maxDifference};
  return {status:"ready",mode,region,score:Math.round(teams.score),
    roster:[...teams.a.map(p=>({id:p.id,team:"A",characterId:p.characterId,effectiveLevel:p.effectiveLevel,humanVerified:true})),
      ...teams.b.map(p=>({id:p.id,team:"B",characterId:p.characterId,effectiveLevel:p.effectiveLevel,humanVerified:true}))],
    scopeChallenge:scopeChallenge?{scopeA:scopeChallenge.scopeA,scopeB:scopeChallenge.scopeB}:null};
}
export function teamVoicePolicy(match,userId,voiceState){
  // Actual permission/mic and SFU token checks belong to the native voice adapter.
  const p=match?.players?.[userId];
  if(!p||match.status!=="active"||voiceState?.userMuted===true||voiceState?.consent!==true)
    return {allowed:false,channelId:null};
  return {allowed:true,channelId:"empire-arena:"+match.id+":team:"+p.team,
    pushToTalkDefault:true,noRecording:true,crossTeamDisabled:true};
}
