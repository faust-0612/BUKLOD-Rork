/**
 * BUKLOD WORLD progression presentation contract (DEV only).
 *
 * Never confuse a drawn preview, uploaded photo, unverified approval or client
 * progress tap with a persisted structure. A verified server receipt must
 * authorize every asset-stage change. This module NEVER mints BP or QMP.
 */
export const WORLD_PROGRESS_RELEASE_ENABLED = false as const;
export type WorldProgressScope = 'personal' | 'cluster' | 'organization' | 'global';
export type WorldBuildStage =
  | 'vacant' | 'planned' | 'foundation' | 'structure' | 'finished' | 'inhabited';
export type WorldMilestoneState = 'planned' | 'in_progress' | 'awaiting_verification' | 'verified' | 'rejected';

export type WorldVisualChange = {
  id:string;
  stage:WorldBuildStage;
  assetId:string;
  assetManifestVersion:string;
  /** Server-verified receipt that created this exact building/appearance revision. */
  receiptId:string | null;
  assetApproved:boolean;
  position:{x:number;y:number};
  /** Room cosmetics are editable only after a valid property scene revision. */
  roomSceneRevision:number | null;
};
export type WorldMilestone = {
  id:string;
  label:string;
  weight:number;
  state:WorldMilestoneState;
  receiptId:string | null;
};
export type WorldProgressSnapshot = {
  worldId:string;
  ownerScope:WorldProgressScope;
  ownerId:string;
  sceneRevision:number;
  asOf:string;
  /** Only server-authoritative snapshots may be described as confirmed progress. */
  origin:'authoritative_server'|'local_design_preview';
  milestoneVersion:string;
  milestones: readonly WorldMilestone[];
  visuals: readonly WorldVisualChange[];
};

export type WorldProgressSummary={
  status:'verified'|'preview'|'unavailable';
  completedMilestones:number;
  totalMilestones:number;
  percent:number|null;
  currentStage:WorldBuildStage|null;
  visibleAssetIds:readonly string[];
  sceneRevision:number|null;
};
const STAGE_ORDER:Readonly<Record<WorldBuildStage,number>>={
  vacant:0,planned:1,foundation:2,structure:3,finished:4,inhabited:5,
};
const ALLOWED_STAGES=new Set(Object.keys(STAGE_ORDER));
const VALID_STATES=new Set<WorldMilestoneState>(['planned','in_progress','awaiting_verification','verified','rejected']);
const MAX_WORLD_MILESTONES=2000;
const MAX_WORLD_VISUALS=10000;

function uniqueIds(items:readonly {id:string}[]):boolean{
  const ids=new Set<string>();
  for(const i of items){
    if(typeof i.id!=='string'||!i.id.trim()||ids.has(i.id))return false;
    ids.add(i.id);
  }
  return true;
}
export function validateWorldProgressSnapshot(s:WorldProgressSnapshot):string|null{
  if(!s||!s.worldId?.trim()||!s.ownerId?.trim()||!s.milestoneVersion?.trim()||
      !['personal','cluster','organization','global'].includes(s.ownerScope) ||
      !['authoritative_server','local_design_preview'].includes(s.origin))
    return 'Invalid world/owner identity.';
  if(!Number.isSafeInteger(s.sceneRevision)||s.sceneRevision<0||!Number.isFinite(Date.parse(s.asOf)))
    return 'Invalid scene revision or timestamp.';
  if(!Array.isArray(s.milestones)||!Array.isArray(s.visuals)||
      s.milestones.length>MAX_WORLD_MILESTONES||s.visuals.length>MAX_WORLD_VISUALS||
      !uniqueIds(s.milestones)||!uniqueIds(s.visuals))
    return 'Invalid or duplicate scene entries.';
  for(const m of s.milestones){
    if(!m.label?.trim()||!VALID_STATES.has(m.state)||!Number.isSafeInteger(m.weight)||m.weight<=0)
      return 'Invalid milestone.';
    if(m.state==='verified' && !m.receiptId?.trim())return 'Verified milestone missing receipt.';
    if(m.receiptId!==null && (typeof m.receiptId!=='string'||m.receiptId.length>160))
      return 'Invalid milestone receipt.';
  }
  for(const v of s.visuals){
    if(!ALLOWED_STAGES.has(v.stage)||!v.assetId?.trim()||!v.assetManifestVersion?.trim()||
      !Number.isFinite(v.position?.x)||!Number.isFinite(v.position?.y)||
      v.position.x<0||v.position.x>1||v.position.y<0||v.position.y>1)
      return 'Invalid visual placement.';
    if(v.receiptId!==null&&(typeof v.receiptId!=='string'||!v.receiptId.trim()))
      return 'Invalid visual receipt.';
    if(v.roomSceneRevision!==null && (!Number.isSafeInteger(v.roomSceneRevision)||v.roomSceneRevision<0))
      return 'Invalid room scene revision.';
  }
  return null;
}
export function summarizeWorldProgress(snapshot:WorldProgressSnapshot | null | undefined):WorldProgressSummary{
  const unavailable:WorldProgressSummary={
    status:'unavailable',completedMilestones:0,totalMilestones:0,percent:null,
    currentStage:null,visibleAssetIds:[],sceneRevision:null,
  };
  if(!snapshot||validateWorldProgressSnapshot(snapshot))return unavailable;
  // Do not call local customizations 'verified community progress'.
  if(snapshot.origin!=='authoritative_server')return {...unavailable,status:'preview'};
  const total=snapshot.milestones.reduce((n,m)=>n+m.weight,0);
  const done=snapshot.milestones.filter(m=>m.state==='verified'&&Boolean(m.receiptId))
    .reduce((n,m)=>n+m.weight,0);
  const visuals=snapshot.visuals.filter(v=>v.assetApproved&&Boolean(v.receiptId));
  const highest=visuals.reduce<WorldBuildStage|null>(
    (best,v)=>best===null||STAGE_ORDER[v.stage]>STAGE_ORDER[best]?v.stage:best,null);
  return {
    status:'verified',
    completedMilestones:snapshot.milestones.filter(m=>m.state==='verified').length,
    totalMilestones:snapshot.milestones.length,
    percent:total>0?Math.min(100,Math.round(done/total*100)):0,
    currentStage:highest,
    visibleAssetIds:visuals.map(v=>v.assetId),
    sceneRevision:snapshot.sceneRevision,
  };
}
export type WorldProgressDelta={
  status:'ready'|'stale'|'incompatible';
  newlyVerifiedMilestones:readonly string[];
  newVisibleAssetIds:readonly string[];
  previousRevision:number | null;
  nextRevision:number | null;
};
export function diffWorldProgress(before:WorldProgressSnapshot,after:WorldProgressSnapshot):WorldProgressDelta{
  const invalid=validateWorldProgressSnapshot(before)||validateWorldProgressSnapshot(after);
  if(invalid||before.origin!=='authoritative_server'||after.origin!=='authoritative_server'||
    before.worldId!==after.worldId||before.ownerScope!==after.ownerScope||
    before.ownerId!==after.ownerId||before.milestoneVersion!==after.milestoneVersion){
    return {status:'incompatible',newlyVerifiedMilestones:[],newVisibleAssetIds:[],previousRevision:null,nextRevision:null};
  }
  if(after.sceneRevision<=before.sceneRevision||Date.parse(after.asOf)<Date.parse(before.asOf)){
    return {status:'stale',newlyVerifiedMilestones:[],newVisibleAssetIds:[],
      previousRevision:before.sceneRevision,nextRevision:after.sceneRevision};
  }
  const oldMilestones=new Set(before.milestones.filter(m=>m.state==='verified'&&m.receiptId).map(m=>m.id));
  const oldAssets=new Set(before.visuals.filter(v=>v.assetApproved&&v.receiptId).map(v=>v.id+'|'+v.assetId));
  return {
    status:'ready',
    newlyVerifiedMilestones:after.milestones.filter(m=>m.state==='verified'&&m.receiptId&&!oldMilestones.has(m.id)).map(m=>m.id),
    newVisibleAssetIds:after.visuals.filter(v=>v.assetApproved&&v.receiptId&&!oldAssets.has(v.id+'|'+v.assetId)).map(v=>v.assetId),
    previousRevision:before.sceneRevision,nextRevision:after.sceneRevision,
  };
}
