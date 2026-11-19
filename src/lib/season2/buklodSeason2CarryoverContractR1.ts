/**
 * Season 2 ONLY: pure, non-writing season rollover planning contract.
 * A READY plan is not authorization to credit, reset, or publish.
 * Server migrations / authoritative signed history must implement this.
 */
export const SEASON2_RESET_POLICY = Object.freeze({
  resettable: Object.freeze(['seasonal_competition_score','seasonal_competition_tier','seasonal_mission_progress']),
  preserved: Object.freeze(['overall_circle_rank','lifetime_progress','monthly_rank_independence',
    'per_character_xp','per_character_level','owned_items','earned_badges','collectibles',
    'membership','qmp','withdrawable_balance','withdrawal_history','token_entitlements']),
  seasonOneProductionUntouched:true,
  productionEmbargoUntil:'2026-12-06T00:00:00+08:00',
  sourceOnly:true,
} as const);
export type CharacterSnapshot = Readonly<{level:number; xp:number}>;
export type PreservationSnapshot = Readonly<{
  lifetimeScore:number;
  characters:Readonly<Record<string,CharacterSnapshot>>;
  items:readonly string[];
  badges:readonly string[];
  collectibles:readonly string[];
  qmp:number;
  withdrawable:number;
  withdrawn:number;
  memberships:readonly string[];
}>;
export type RolloverInput = Readonly<{
  fromSeason:number;
  toSeason:number;
  userId:string;
  currentSeasonScore:number;
  oldSeasonResultsSigned:boolean;
  pendingHistoryReconciled:boolean;
  serverInventoryReconciled:boolean;
  sourceRevision:string;
}>;
export type RolloverPlan = Readonly<{
  status:'BLOCKED'|'READY_FOR_STAGING_SERVER_REVIEW';
  blockers:readonly string[];
  idempotencyKey:string|null;
  archive:Readonly<{season:number;score:number}>|null;
  nextSeasonScore:0|null;
  productionAuthorized:false;
}>;
export function planSeason2Rollover(input:RolloverInput):RolloverPlan {
  const issues:string[]=[];
  if(!Number.isSafeInteger(input.fromSeason)||input.fromSeason<1||
     input.toSeason!==input.fromSeason+1)issues.push('INVALID_SEASON_TRANSITION');
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(input.userId.toLowerCase()))
    issues.push('INVALID_USER_ID');
  if(!Number.isSafeInteger(input.currentSeasonScore)||input.currentSeasonScore<0)
    issues.push('INVALID_SCORE');
  if(!/^[0-9a-f]{40}$/.test(input.sourceRevision))issues.push('UNVERIFIED_SOURCE_REVISION');
  if(input.oldSeasonResultsSigned!==true)issues.push('UNSIGNED_PREVIOUS_SEASON');
  if(input.pendingHistoryReconciled!==true)issues.push('PENDING_HISTORY_NOT_RECONCILED');
  if(input.serverInventoryReconciled!==true)issues.push('SERVER_INVENTORY_NOT_RECONCILED');
  if(issues.length)return Object.freeze({
    status:'BLOCKED' as const,blockers:Object.freeze(issues),idempotencyKey:null,
    archive:null,nextSeasonScore:null,productionAuthorized:false as const});
  return Object.freeze({
    status:'READY_FOR_STAGING_SERVER_REVIEW' as const,blockers:Object.freeze([]),
    idempotencyKey:`s2-rollover:v1:${input.fromSeason}:${input.toSeason}:${input.userId}`,
    archive:Object.freeze({season:input.fromSeason,score:input.currentSeasonScore}),
    nextSeasonScore:0 as const,productionAuthorized:false as const});
}
const missing=(oldItems:readonly string[],nextItems:readonly string[]) =>
  oldItems.filter(x=>!nextItems.includes(x));
/**
 * Evaluate snapshots taken within the SAME server transaction / isolation
 * barrier. Never compare arbitrary asynchronous client balance snapshots.
 */
export function verifySeasonCarryover(before:PreservationSnapshot,
  after:PreservationSnapshot):Readonly<{valid:boolean;violations:readonly string[]}> {
  const errors:string[]=[];
  if(!Number.isFinite(before.lifetimeScore)||
     !Number.isFinite(after.lifetimeScore)||
     after.lifetimeScore<before.lifetimeScore)errors.push('LIFETIME_SCORE_LOST');
  for(const [id,progress] of Object.entries(before.characters)){
    const next=after.characters[id];
    if(!next || next.level<progress.level || next.xp<progress.xp)
      errors.push('CHARACTER_PROGRESS_LOST:'+id);
  }
  for(const [name,field] of [
    ['ITEM', 'items'],['BADGE','badges'],['COLLECTIBLE','collectibles'],
    ['MEMBERSHIP','memberships']
  ] as const){
    for(const id of missing(before[field],after[field]))
      errors.push(name+'_LOST:'+id);
  }
  for(const key of ['qmp','withdrawable','withdrawn'] as const){
    if(!Number.isFinite(before[key])||!Number.isFinite(after[key])||
       before[key]!==after[key])errors.push('FINANCIAL_DRIFT:'+key);
  }
  return Object.freeze({valid:errors.length===0,violations:Object.freeze(errors)});
}
