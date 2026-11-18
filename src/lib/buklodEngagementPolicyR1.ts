/**
 * BUKLOD premium engagement R1: PURE, preview-only, and disabled.
 * This code NEVER writes BP, QMP, cash, Character XP, item ownership or tokens.
 */
export const ENGAGEMENT_POLICY_VERSION = 'premium-social-r1-off-20261118' as const;
export const ENGAGEMENT_ROLLOUT = Object.freeze({
  journeyTokenMinting: false,
  journeyTokenSpending: false,
  seasonalMomentum: false,
  featureGating: false,
  rewardBackfill: false,
});
export type FaithMode = 'show_faith' | 'non_show_faith';
export type EngagementSource =
  | 'today_dugtong' | 'kl_verified_chapter' | 'wall_original_post'
  | 'wall_meaningful_comment' | 'formation_verified_unit'
  | 'main_bible_qualified_quiz' | 'general_learning_verified_unit'
  | 'community_verified_challenge' | 'kingdom_verified_mastery'
  | 'children_story_milestone' | 'private_prayer';
type Rule = Readonly<{ mode: FaithMode | 'all'; proposedTokens: number; maxPerDay: number }>;
/** All rates are illustrative; actual source availability and backend validation are unverified. */
export const ENGAGEMENT_RULES: Readonly<Record<EngagementSource,Rule>> = Object.freeze({
  today_dugtong: { mode:'all', proposedTokens:2, maxPerDay:1 },
  kl_verified_chapter: { mode:'all', proposedTokens:3, maxPerDay:1 },
  wall_original_post: { mode:'all', proposedTokens:2, maxPerDay:1 },
  wall_meaningful_comment: { mode:'all', proposedTokens:1, maxPerDay:2 },
  formation_verified_unit: { mode:'show_faith', proposedTokens:4, maxPerDay:1 },
  main_bible_qualified_quiz: { mode:'show_faith', proposedTokens:3, maxPerDay:1 },
  general_learning_verified_unit: { mode:'non_show_faith', proposedTokens:4, maxPerDay:1 },
  community_verified_challenge: { mode:'non_show_faith', proposedTokens:3, maxPerDay:1 },
  kingdom_verified_mastery: { mode:'all', proposedTokens:0, maxPerDay:1 },
  children_story_milestone: { mode:'all', proposedTokens:0, maxPerDay:1 },
  private_prayer: { mode:'show_faith', proposedTokens:0, maxPerDay:1 },
});
export const PROPOSED_GLOBAL_TOKEN_CAP_PER_MANILA_DAY=12;
export const OPTIONAL_ITEM_CATALOG_PREVIEW=Object.freeze({
  accessory_finish:30,gallery_theme:60,skin_variant:80,premium_visual_effect:150,
});
const OPTIONAL_GATES=new Set([
  'character_cosmetic_skin','optional_profile_frame','optional_visual_effect',
  'gallery_theme','optional_emote_pack','kingdom_cosmetic','bonus_practice_mode',
]);
/** Core social, Bible, education, prayer, child safety, reporting remain free. */
export function canRequireJourneyToken(feature:string):boolean {
  return OPTIONAL_GATES.has(feature);
}
export type VerifiedSourceReceipt=Readonly<{
  source:EngagementSource;sourceId:string;manilaDay:string;serverVerified:boolean;accepted:boolean;
}>;
export type PreviewLine={source:EngagementSource;sourceId:string;proposed:number;granted:number;reason:string};
function assertDay(day:string):void {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day) throw new Error('Invalid Manila day');
}
/** This never mints. Client claims cannot serve as trusted server receipts. */
export function simulateJourneyTokenDay(
  receipts:readonly VerifiedSourceReceipt[],mode:FaithMode,manilaDay:string,
  cap:number=PROPOSED_GLOBAL_TOKEN_CAP_PER_MANILA_DAY,
):{proposed:number;capped:number;remaining:number;lines:PreviewLine[];live:false}{
  assertDay(manilaDay);
  if(!Number.isInteger(cap)||cap<0||cap>1000) throw new Error('Invalid preview cap');
  const seen=new Set<string>();
  const counts=new Map<EngagementSource,number>();
  let proposed=0,capped=0;
  const lines:PreviewLine[]=[];
  for(const receipt of receipts){
    const rule=ENGAGEMENT_RULES[receipt.source];
    if(!rule) throw new Error('Unknown source');
    const id=receipt.sourceId.trim(),key=receipt.source+':'+id;
    let reason='PREVIEW_ELIGIBLE';
    if(!id) reason='SOURCE_ID_REQUIRED';
    else if(seen.has(key)) reason='DUPLICATE_SOURCE';
    else if(!receipt.serverVerified||!receipt.accepted) reason='SERVER_CONFIRMATION_REQUIRED';
    else if(receipt.manilaDay!==manilaDay) reason='OUTSIDE_MANILA_DAY';
    else if(rule.mode!=='all'&&rule.mode!==mode) reason='SCOPE_NOT_ELIGIBLE';
    else if(rule.proposedTokens===0) reason='NO_SPENDABLE_TOKEN';
    else if((counts.get(receipt.source)||0)>=rule.maxPerDay) reason='SOURCE_DAILY_CAP';
    const tokens=reason==='PREVIEW_ELIGIBLE'?rule.proposedTokens:0;
    const allowed=Math.min(tokens,Math.max(0,cap-capped));
    if(tokens>0){seen.add(key);counts.set(receipt.source,(counts.get(receipt.source)||0)+1);}
    proposed+=tokens;capped+=allowed;
    lines.push({source:receipt.source,sourceId:receipt.sourceId,proposed:tokens,granted:allowed,
      reason:tokens>0&&allowed<tokens?'GLOBAL_DAILY_CAP':reason});
  }
  return {proposed,capped,remaining:cap-capped,lines,live:false};
}
export type MomentumSnapshot=Readonly<{
  lastSettledManilaDay:string|null;
  consecutiveMissedDays:number;
  activeStreakDays:number;
  seasonalMomentumPoints:number;
}>;
export const EMPTY_MOMENTUM:MomentumSnapshot=Object.freeze({
  lastSettledManilaDay:null,consecutiveMissedDays:0,activeStreakDays:0,seasonalMomentumPoints:0,
});
export const MOMENTUM_PREVIEW_RULE=Object.freeze({
  pointsPerVerifiedActiveDay:5,inactivityGraceDays:2,
  seasonalPointsLostPerExcessMissedDay:5,maxSeasonalPoints:300,
});
function ordinal(day:string):number { assertDay(day);return Date.parse(day+'T00:00:00Z')/86400000; }
/** Only after server settlement; pending offline operations postpone ALL penalties. */
export function previewMomentumSettlement(
  previous:MomentumSnapshot,serverManilaDay:string,verifiedActivityToday:boolean,
  pendingOfflineOperations:boolean,
):{state:MomentumSnapshot;outcome:'DEFERRED_OFFLINE'|'UNCHANGED'|'SETTLED';lost:number}{
  const today=ordinal(serverManilaDay);
  if(pendingOfflineOperations) return {state:previous,outcome:'DEFERRED_OFFLINE',lost:0};
  const last=previous.lastSettledManilaDay===null?today-1:ordinal(previous.lastSettledManilaDay);
  if(today<last) throw new Error('Cannot settle a previous season day');
  if(today===last) return {state:previous,outcome:'UNCHANGED',lost:0};
  let missed=Math.max(0,previous.consecutiveMissedDays),
    streak=Math.max(0,previous.activeStreakDays),
    score=Math.max(0,previous.seasonalMomentumPoints),lost=0;
  for(let date=last+1;date<=today;date++){
    if(date===today&&verifiedActivityToday){
      streak=missed>0?1:streak+1;missed=0;
      score=Math.min(MOMENTUM_PREVIEW_RULE.maxSeasonalPoints,
        score+MOMENTUM_PREVIEW_RULE.pointsPerVerifiedActiveDay);
    }else{
      missed++;streak=0;
      if(missed>MOMENTUM_PREVIEW_RULE.inactivityGraceDays){
        const debit=Math.min(score,MOMENTUM_PREVIEW_RULE.seasonalPointsLostPerExcessMissedDay);
        score-=debit;lost+=debit;
      }
    }
  }
  return {state:{lastSettledManilaDay:serverManilaDay,consecutiveMissedDays:missed,
    activeStreakDays:streak,seasonalMomentumPoints:score},outcome:'SETTLED',lost};
}
/** Only independently audited invalid-source reversal can affect original credits. */
export function isAllowablePersistentRewardReversal(
  reason:'VERIFIED_FRAUD'|'SOURCE_REVOKED'|'INACTIVITY'|'MISSING_PRAYER'|'MISSION_TIMEOUT',
  evidenceId?:string,
):boolean{
  return Boolean(evidenceId&&evidenceId.trim())&&
    (reason==='VERIFIED_FRAUD'||reason==='SOURCE_REVOKED');
}
