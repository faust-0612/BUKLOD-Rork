/**
 * BUKLOD Season 2 endless world contract. Pure projections ONLY:
 * server-receipt stage changes are the authority, not this UI module.
 * This module never touches a wallet, rank, QMP, Diamond or item ledger.
 */
export const KINGDOM_WORLD_TRACKS=Object.freeze(['lot','house','cluster','business']);
export const KINGDOM_MAJOR_LEVELS=10;
export const KINGDOM_BUILD_SCENES=5;
export const KINGDOM_STAGES_TOTAL=KINGDOM_MAJOR_LEVELS*KINGDOM_BUILD_SCENES;
export const KINGDOM_SAFE_LEVEL_MAX=Number.MAX_SAFE_INTEGER-1;
const PRACTICE_BIOMES=Object.freeze(['Tropical Coast','Forest Valley','Classic Village','Highland Ridge','Winter Summit']);
function safeCount(n){
  return Number.isSafeInteger(n)&&n>=0&&n<=KINGDOM_SAFE_LEVEL_MAX;
}
/**
 * A world building stage can be displayed only from authenticated receipts,
 * not local practice. Active construction prices/materials must be quoted by
 * the server; requirements below are indicative *work units* only.
 */
export function getKingdomWorldPosition(track,verifiedStages,source='untrusted'){
  if(!KINGDOM_WORLD_TRACKS.includes(track)||!safeCount(verifiedStages)||source!=='server_receipts')
    return null;
  const completed=Math.min(KINGDOM_STAGES_TOTAL,verifiedStages);
  if(completed<KINGDOM_STAGES_TOTAL){
    return Object.freeze({
      track,majorLevel:Math.floor(completed/KINGDOM_BUILD_SCENES)+1,
      nextScene:completed%KINGDOM_BUILD_SCENES+1,completedScenes:completed,
      masteryLevel:0,kind:'construction',serverVerified:true,
    });
  }
  return Object.freeze({
    track,majorLevel:KINGDOM_MAJOR_LEVELS,nextScene:null,
    completedScenes:KINGDOM_STAGES_TOTAL,
    masteryLevel:verifiedStages-KINGDOM_STAGES_TOTAL+1,
    kind:'mastery',serverVerified:true,
  });
}
/** Work difficulty grows early and tapers to feasible modular mastery.
 * Never treat as a BP quote, entitlement or build-time promise. */
export function getKingdomPreviewWorkUnits(verifiedStages){
  if(!safeCount(verifiedStages))return null;
  if(verifiedStages<KINGDOM_STAGES_TOTAL){
    const level=Math.floor(verifiedStages/KINGDOM_BUILD_SCENES)+1;
    const scene=verifiedStages%KINGDOM_BUILD_SCENES+1;
    return Math.ceil((14+level*level*3)*(1+(scene-1)*.29));
  }
  const mastery=verifiedStages-KINGDOM_STAGES_TOTAL+1;
  return Math.min(45000,Math.ceil(450+52*Math.sqrt(mastery)+35*Math.log2(mastery+1)));
}
/** Local practice chapters intentionally have zero authority over world stages. */
export function getKingdomPracticePosition(completed){
  const count=safeCount(completed)?completed:0;
  const chapter=Math.floor(count/5)+1;
  const scene=count%5+1;
  const index=(chapter-1)%PRACTICE_BIOMES.length;
  return {chapter,scene,regionName:PRACTICE_BIOMES[index],
    localOnly:true,rewardEligible:false,worldLevelEligible:false};
}
/** Strict destination of each proven *source*, no currency conversion. */
export const KINGDOM_REWARD_ROUTES=Object.freeze({
  game_preview: {ledger:'none',mintBP:false,changesCircleRank:false},
  kingdom_practice: {ledger:'none',mintBP:false,changesCircleRank:false},
  verified_participation_bp: {ledger:'bp_earned',mintBP:true,changesCircleRank:true},
  bp_trade_transfer: {ledger:'bp_available_transfer',mintBP:false,changesCircleRank:false},
  world_construction: {ledger:'world_materials_and_available_bp',mintBP:false,changesCircleRank:false},
  character_item_acquisition: {ledger:'character_inventory',mintBP:false,changesCircleRank:false},
  character_evolution: {ledger:'character_verified_state',mintBP:false,changesCircleRank:false},
  community_monthly_qmp: {ledger:'qmp',mintBP:false,changesCircleRank:false},
  kingdom_shards: {ledger:'game_only_shards',mintBP:false,changesCircleRank:false},
  arena_ranked_result: {ledger:'character_diamonds',mintBP:false,changesCircleRank:false},
  arena_match_flux: {ledger:'match_ephemeral',mintBP:false,changesCircleRank:false},
  cash_payout: {ledger:'finance_settlement',mintBP:false,changesCircleRank:false},
});
/**
 * Fail closed on all local/provisional events. Classification is for audit
 * and server integration review, NOT authorization to award from the client.
 * The backend must validate auth, source/version, anti-farm and idempotency.
 */
export function classifyKingdomRewardEvent(input){
  if(!input||typeof input!=='object')return null;
  const route=KINGDOM_REWARD_ROUTES[input.kind];
  if(!route)return null;
  const requiresServer=input.kind!=='game_preview'&&input.kind!=='kingdom_practice'
    &&input.kind!=='arena_match_flux';
  if(requiresServer && (
    input.authority!=='server' ||
    typeof input.sourceId!=='string' || input.sourceId.length<8 ||
    typeof input.idempotencyKey!=='string' || input.idempotencyKey.length<8
  ))return null;
  if(input.kind==='verified_participation_bp' &&
    (input.ruleActive!==true||input.antiFarmVerified!==true))return null;
  if(input.kind==='character_evolution'&&
    (input.bpEligibilityVerified!==true||input.requiredItemsVerified!==true||
     input.equalNonFaithPathVerified!==true))return null;
  if(input.kind==='arena_ranked_result'&&
    (input.matchSettledByServer!==true||input.rankedEnabled!==true))return null;
  if(input.kind==='bp_trade_transfer'&&input.conservedAvailableBP!==true)return null;
  return Object.freeze({...route,kind:input.kind,serverOnly:requiresServer});
}
