/**
 * Season 2 ONLY — pure rules contract. Never import from Season 1 reward services.
 * Nothing in this module writes BP, QMP, AdMob shares, cash, character levels,
 * inventory, backend tokens, or live seasons. Server-only receipts are mandatory.
 */
export const S2_REWARD_VERSION = 'season2-rewards-r1-disabled' as const;
export const S2_REWARD_ROLLOUT = Object.freeze({
  missionSettlement: false, journeyTokenMint: false, journeyTokenSpend: false,
  season2BadgeGrant: false, optionalMomentum: false, backendAdapter: false,
  productionAuthorized: false,
});
export const S2_TERMS = Object.freeze({
  tokensNonCash: true, tokensTransferable: false, coreAccessTokenGated: false,
  existingBpUnchanged: true, qmpAndAdMobUnchanged: true,
  existingItemOwnershipUnchanged: true, season1Unchanged: true,
});
export type S2Path = 'show_faith' | 'non_show_faith';
export type S2Source =
  | 'today_dugtong' | 'kl_verified_chapter' | 'wall_original_post'
  | 'wall_meaningful_comment' | 'formation_verified_unit'
  | 'main_bible_qualified_quiz' | 'general_learning_verified_unit'
  | 'community_verified_challenge' | 'kingdom_verified_mastery'
  | 'children_story_milestone' | 'private_prayer';
export type S2Priority = 'learning' | 'community' | 'optional';
export type S2Rule = Readonly<{
  mode: S2Path | 'both'; priority: S2Priority;
  tokens: number; dailyLimit: number; candidateServerVerifier: boolean;
}>;
/** Faith-only sources do not mint spendable tokens until genuinely equal
 * nonfaith sources are live and parity-tested. Prayer never mints tokens. */
export const S2_RULES: Readonly<Record<S2Source, S2Rule>> = Object.freeze({
  today_dugtong: {mode:'both',priority:'community',tokens:2,dailyLimit:1,candidateServerVerifier:true},
  kl_verified_chapter: {mode:'both',priority:'learning',tokens:3,dailyLimit:1,candidateServerVerifier:true},
  wall_original_post: {mode:'both',priority:'community',tokens:2,dailyLimit:1,candidateServerVerifier:true},
  wall_meaningful_comment: {mode:'both',priority:'community',tokens:1,dailyLimit:2,candidateServerVerifier:true},
  formation_verified_unit: {mode:'show_faith',priority:'learning',tokens:0,dailyLimit:1,candidateServerVerifier:false},
  main_bible_qualified_quiz: {mode:'show_faith',priority:'learning',tokens:0,dailyLimit:1,candidateServerVerifier:false},
  general_learning_verified_unit: {mode:'non_show_faith',priority:'learning',tokens:0,dailyLimit:1,candidateServerVerifier:false},
  community_verified_challenge: {mode:'non_show_faith',priority:'community',tokens:0,dailyLimit:1,candidateServerVerifier:false},
  kingdom_verified_mastery: {mode:'both',priority:'optional',tokens:0,dailyLimit:1,candidateServerVerifier:false},
  children_story_milestone: {mode:'both',priority:'optional',tokens:0,dailyLimit:1,candidateServerVerifier:false},
  private_prayer: {mode:'show_faith',priority:'optional',tokens:0,dailyLimit:1,candidateServerVerifier:false},
});
export const S2_WEEKLY_POLICY=Object.freeze({
  normalDays:7, automaticGraceDays:3, flexCreditsPerSeason:2,
  daysPerFlexCredit:7, dailyTokenCeiling:12,
  optionalMomentumDailyMinusLimit:9,
  noPermanentDeductions:true,
});
export const S2_COSMETIC_PRICE_PREVIEW=Object.freeze({
  accessory_finish:30, gallery_theme:60, skin_variant:80, premium_visual_effect:150,
});
export type S2Receipt=Readonly<{
  source:S2Source; sourceId:string; userId:string; manilaDay:string;
  backendVerified:boolean; accepted:boolean; mainApp:boolean;
}>;
export type S2ReceiptResult=Readonly<{
  source:S2Source;sourceId:string;tokens:number;
  reason:'ELIGIBLE_PREVIEW'|'BACKEND_NOT_LIVE'|'UNVERIFIED'|'SOURCE_INVALID'|
    'WRONG_SCOPE'|'DUPLICATE_SOURCE'|'SOURCE_CAP'|'DAY_CAP'|'NO_TOKEN_RULE';
}>;
function ordinal(day:string):number{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw Error('Invalid Manila calendar day');
  const time=Date.parse(day+'T00:00:00Z');
  if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==day) {
    throw Error('Invalid Manila calendar day');
  }
  return time/86400000;
}
export function addManilaDays(day:string,delta:number):string {
  if(!Number.isSafeInteger(delta)||Math.abs(delta)>366) throw Error('Invalid offset');
  return new Date((ordinal(day)+delta)*86400000).toISOString().slice(0,10);
}
/** Preview only. Even a backendVerified boolean supplied by a client is NOT
 * proof; production grants require separate SQL-verifiable event ownership. */
export function simulateS2TokenReceipts(
  receipts:readonly S2Receipt[],path:S2Path,day:string,userId:string,
  backendAdapterReady=false,
):Readonly<{live:false;balanceMinted:0;potential:number;lines:readonly S2ReceiptResult[]}>{
  ordinal(day);
  if(!userId) throw Error('User required');
  if(path!=='show_faith'&&path!=='non_show_faith') throw Error('Invalid path');
  const seen=new Set<string>(),counts=new Map<S2Source,number>();
  let potential=0;
  const lines:S2ReceiptResult[]=[];
  for(const receipt of receipts){
    const rule=S2_RULES[receipt.source];
    if(!rule) throw Error('Unknown source');
    let reason:S2ReceiptResult['reason']='ELIGIBLE_PREVIEW';
    const key=receipt.source+':'+receipt.sourceId;
    if(!receipt.sourceId.trim()||receipt.userId!==userId||receipt.manilaDay!==day||!receipt.mainApp)
      reason='SOURCE_INVALID';
    else if(!receipt.backendVerified||!receipt.accepted) reason='UNVERIFIED';
    else if(rule.mode!=='both'&&rule.mode!==path) reason='WRONG_SCOPE';
    else if(seen.has(key)) reason='DUPLICATE_SOURCE';
    else if(rule.tokens===0) reason='NO_TOKEN_RULE';
    else if((counts.get(receipt.source)||0)>=rule.dailyLimit) reason='SOURCE_CAP';
    else if(!backendAdapterReady||!rule.candidateServerVerifier) reason='BACKEND_NOT_LIVE';
    let tokens=0;
    if(reason==='ELIGIBLE_PREVIEW'){
      tokens=Math.min(rule.tokens,Math.max(0,S2_WEEKLY_POLICY.dailyTokenCeiling-potential));
      if(tokens<rule.tokens) reason='DAY_CAP';
      seen.add(key);counts.set(receipt.source,(counts.get(receipt.source)||0)+1);
      potential+=tokens;
    }
    lines.push({source:receipt.source,sourceId:receipt.sourceId,tokens,reason});
  }
  return {live:false,balanceMinted:0,potential,lines};
}
export type S2WeeklyEvidence=Readonly<{
  weekStartManilaDay:string;path:S2Path;
  receipts:readonly Pick<S2Receipt,'source'|'backendVerified'|'accepted'|'mainApp'>[];
  todayManilaDay:string;flexCreditsUsed:number;
  flexCreditsForThisWeek:number;flexOptedBeforeDeadline:boolean;
  pendingOffline:boolean;sourceUnavailable:boolean;
}>;
export type S2Gate='COMPLETE'|'NORMAL'|'GRACE'|'FLEX'|'PENDING_SYNC'|'UNAVAILABLE'|'CLOSED';
export type S2WeeklyDecision=Readonly<{
  gate:S2Gate;completedLearning:boolean;completedCommunity:boolean;
  finalEligibleDay:string;season2Bonus:'CLAIMABLE_PREVIEW'|'PENDING_FOUNDATION'|'CLOSED_NO_BONUS';
  season1BpAffected:false;qmpOrCashAffected:false;
}>;
/** P0 never locks social, Connect, prayer, learning or verified ordinary BP/QMP.
 * It limits only OPTIONAL Season 2 bonuses and seasonal cosmetics. */
export function evaluateS2WeeklyPriority(input:S2WeeklyEvidence):S2WeeklyDecision{
  const start=ordinal(input.weekStartManilaDay),now=ordinal(input.todayManilaDay);
  if(input.path!=='show_faith'&&input.path!=='non_show_faith')throw Error('Invalid path');
  if(input.flexCreditsUsed<0||input.flexCreditsUsed>S2_WEEKLY_POLICY.flexCreditsPerSeason||
    input.flexCreditsForThisWeek<0||input.flexCreditsForThisWeek>2||
    input.flexCreditsUsed<input.flexCreditsForThisWeek||
    !Number.isInteger(input.flexCreditsUsed)||!Number.isInteger(input.flexCreditsForThisWeek))
    throw Error('Invalid flex allocation');
  const flex=input.flexOptedBeforeDeadline?input.flexCreditsForThisWeek:0;
  const normalLast=start+S2_WEEKLY_POLICY.normalDays-1;
  const graceLast=normalLast+S2_WEEKLY_POLICY.automaticGraceDays;
  const finalLast=graceLast+flex*S2_WEEKLY_POLICY.daysPerFlexCredit;
  let learning=false,community=false;
  for(const r of input.receipts){
    const rule=S2_RULES[r.source];
    if(!rule)throw Error('Unknown source');
    if(!r.backendVerified||!r.accepted||!r.mainApp||!rule.candidateServerVerifier)continue;
    if(rule.mode!=='both'&&rule.mode!==input.path)continue;
    if(rule.priority==='learning')learning=true;
    if(rule.priority==='community')community=true;
  }
  let gate:S2Gate;
  if(input.sourceUnavailable)gate='UNAVAILABLE';
  else if(input.pendingOffline)gate='PENDING_SYNC';
  else if(learning&&community)gate='COMPLETE';
  else if(now<=normalLast)gate='NORMAL';
  else if(now<=graceLast)gate='GRACE';
  else if(flex>0&&now<=finalLast)gate='FLEX';
  else gate='CLOSED';
  const claimable=gate==='COMPLETE';
  return {
    gate,completedLearning:learning,completedCommunity:community,
    finalEligibleDay:addManilaDays(input.weekStartManilaDay,finalLast-start),
    season2Bonus:claimable?'CLAIMABLE_PREVIEW':gate==='CLOSED'?'CLOSED_NO_BONUS':'PENDING_FOUNDATION',
    season1BpAffected:false,qmpOrCashAffected:false,
  };
}
export type S2MomentumAttestation=Readonly<{
  enrolledBeforeDay:boolean;serverCertified:boolean;dayClosedAfterGrace:boolean;
  pendingOffline:boolean;sourceAccessible:boolean;excused:boolean;
  verifiedActivity:boolean;readingDue:boolean;readingCompleted:boolean;
  creatorDue:boolean;creatorCompleted:boolean;missedDaysBeyondGrace:boolean;
}>;
/** No real deduction. Only optional Momentum can be simulated and only after
 * server-complete day attestation; historical earned assets never change. */
export function previewS2MomentumMinus(a:S2MomentumAttestation):Readonly<{
  live:false;minus:number;reason:string;
}>{
  if(!a.enrolledBeforeDay)return {live:false,minus:0,reason:'NOT_OPTED_IN'};
  if(!a.serverCertified||!a.dayClosedAfterGrace||a.pendingOffline)
    return {live:false,minus:0,reason:'AWAITING_SERVER_RECONCILIATION'};
  if(!a.sourceAccessible||a.excused)return {live:false,minus:0,reason:'EXCUSED_OR_UNAVAILABLE'};
  const minus=(a.missedDaysBeyondGrace&&!a.verifiedActivity?5:0)+
    (a.readingDue&&!a.readingCompleted?2:0)+
    (a.creatorDue&&!a.creatorCompleted?2:0);
  return {live:false,minus:Math.min(S2_WEEKLY_POLICY.optionalMomentumDailyMinusLimit,minus),
    reason:minus>0?'OPTIONAL_SEASONAL_MOMENTUM_ONLY':'NONE'};
}
export function canS2TokenGate(feature:string):boolean{
  return new Set(['character_cosmetic_skin','optional_profile_frame','optional_visual_effect',
    'gallery_theme','optional_emote_pack','kingdom_cosmetic','bonus_practice_mode']).has(feature);
}
