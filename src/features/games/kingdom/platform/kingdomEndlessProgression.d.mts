export const KINGDOM_WORLD_TRACKS: readonly ['lot','house','cluster','business'];
export const KINGDOM_MAJOR_LEVELS: 10;
export const KINGDOM_BUILD_SCENES: 5;
export const KINGDOM_STAGES_TOTAL: 50;
export const KINGDOM_SAFE_LEVEL_MAX: number;
export type KingdomWorldTrack = 'lot'|'house'|'cluster'|'business';
export type KingdomWorldPosition = Readonly<{
  track: KingdomWorldTrack; majorLevel: number; nextScene: number | null;
  completedScenes: number; masteryLevel: number;
  kind: 'construction'|'mastery'; serverVerified:true;
}>;
export type KingdomPracticePosition = {
  chapter:number;scene:number;regionName:string;localOnly:true;
  rewardEligible:false;worldLevelEligible:false;
};
export function getKingdomWorldPosition(
  track: KingdomWorldTrack, verifiedStages:number, source?:string,
): KingdomWorldPosition|null;
export function getKingdomPreviewWorkUnits(verifiedStages:number): number|null;
export function getKingdomPracticePosition(completed:number): KingdomPracticePosition;
export type KingdomRewardKind =
  'game_preview'|'kingdom_practice'|'verified_participation_bp'|'bp_trade_transfer'
  |'world_construction'|'character_item_acquisition'|'character_evolution'
  |'community_monthly_qmp'|'kingdom_shards'|'arena_ranked_result'
  |'arena_match_flux'|'cash_payout';
export type KingdomRewardInput = {
  kind:KingdomRewardKind; authority?:string;sourceId?:string;idempotencyKey?:string;
  ruleActive?:boolean;antiFarmVerified?:boolean;bpEligibilityVerified?:boolean;
  requiredItemsVerified?:boolean;equalNonFaithPathVerified?:boolean;
  rankedEnabled?:boolean;matchSettledByServer?:boolean;conservedAvailableBP?:boolean;
};
export const KINGDOM_REWARD_ROUTES: Readonly<Record<KingdomRewardKind,{
  ledger:string;mintBP:boolean;changesCircleRank:boolean;
}>>;
export function classifyKingdomRewardEvent(input:KingdomRewardInput):ReadOnlyKingdomRewardRoute|null;
export type ReadOnlyKingdomRewardRoute=Readonly<{
  ledger:string;mintBP:boolean;changesCircleRank:boolean;kind:KingdomRewardKind;serverOnly:boolean;
}>;
