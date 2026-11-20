/**
 * BUKLOD World permanent ten-level development catalog.
 *
 * Independent from Circle Rank, Character level, and seasons. These are sample
 * PREVIEW requirements, not purchasable production assets or BP pricing.
 * Levels have five ordered construction phases from the owner's V2 House catalog.
 */
export const WORLD_DEVELOPMENT_ENABLED = false as const;
export type WorldDevelopmentTrack = 'personal_lot'|'house'|'farm'|'cluster'|'organization';
export type WorldDevelopmentPhase = 1|2|3|4|5;
export type WorldDevelopmentTier = {
  level:number;
  label:string;
  /** Visual renderer must have separate authored art for each step. */
  stages:readonly [string,string,string,string,string];
  minimumLandM2:number;
  sampleBpForFullTier:number;
  requiredWorldImpact?:string;
};
const lotLabels:readonly [string,string,string,string,string,string,string,string,string,string] = [
  'Boundary stakes','Cleared parcel','Simple fencing','Plot divisions',
  'Garden paths','Drainage & access','Terraced landscaping','Expanded grounds',
  'Formal estate layout','Landmark property',
];
const houseLabels:readonly [string,string,string,string,string,string,string,string,string,string] = [
  'Site preparation','Basic foundation','First shelter','Enclosed starter house',
  'Essential utilities','Liveable rooms','Family extension','Two-storey residence',
  'Premium villa','Estate mansion',
];
const farmLabels:readonly [string,string,string,string,string,string,string,string,string,string] = [
  'Bare farmland','First soil beds','Irrigated field','Working garden','Tool storage',
  'Multi-crop farm','Greenhouse','Shared production','Commercial farmstead','Agricultural estate',
];
const clusterLabels:readonly [string,string,string,string,string,string,string,string,string,string] = [
  'Vacant communal area','Marked common plots','Shared shelter','Paths & gardens',
  'Community meeting hall','Functional workshops','Cooperative housing','Neighbourhood services',
  'Integrated village','Thriving compound',
];
const orgLabels:readonly [string,string,string,string,string,string,string,string,string,string] = [
  'Reserved grounds','Community markers','Basic office','Multipurpose shelter',
  'Service center','Training rooms','Public plaza','Partner facilities','Civic campus',
  'Connected community estate',
];
const tracks:Readonly<Record<WorldDevelopmentTrack,typeof houseLabels>>={
  personal_lot:lotLabels,house:houseLabels,farm:farmLabels,cluster:clusterLabels,organization:orgLabels,
};
const landMin:Readonly<Record<WorldDevelopmentTrack,number>>={
  personal_lot:30,house:50,farm:60,cluster:400,organization:500,
};
const baseBp:Readonly<Record<WorldDevelopmentTrack,number>>={
  personal_lot:80,house:180,farm:120,cluster:300,organization:400,
};
/** V2 canonical construction phases, pending final art and server receipts. */
export const WORLD_CONSTRUCTION_PHASE_NAMES = ['Materials','Posts/Foundation','Frame','Structure','Finishing'] as const;
const stepContent:Readonly<Record<WorldDevelopmentTrack,readonly [string,string,string,string,string]>>={
  personal_lot:['Survey and bring materials','Mark parcel posts','Install path and fence frame','Build fencing and services','Landscape and inspect'],
  house:['Deliver verified materials','Set posts and foundation','Raise structural frame','Walls, roof and utilities','Interior finishing and handover'],
  farm:['Prepare soil and supplies','Set irrigation posts','Plant beds and frame','Install sheds and services','Crops and productive handover'],
  cluster:['Verify project materials','Set markers and foundations','Raise cooperative facilities','Build shared services','Independent usage verification'],
  organization:['Approve service materials','Mark project foundations','Frame public facilities','Build accessible services','Public handover verification'],
};
const MAX_LEVEL=10;
export function worldTier(track:WorldDevelopmentTrack,level:number):WorldDevelopmentTier|null{
  const labels=tracks[track]; if(!labels || !Number.isInteger(level)||level<1||level>MAX_LEVEL)return null;
  const delta=level-1;
  return {
    level,
    label:labels[delta],
    stages:[
      labels[delta]+' — '+stepContent[track][0],
      labels[delta]+' — '+stepContent[track][1],
      labels[delta]+' — '+stepContent[track][2],
      labels[delta]+' — '+stepContent[track][3],
      labels[delta]+' — '+stepContent[track][4],
    ],
    minimumLandM2:landMin[track]+delta*delta*(track==='house'?12:track==='personal_lot'?14:track==='farm'?30:track==='cluster'?100:125),
    sampleBpForFullTier:baseBp[track]*(level*level)+Math.floor(baseBp[track]*level/2),
    requiredWorldImpact:track==='cluster'||track==='organization'
      ?'Verified collective use / project completion receipt before upgrade handover'
      :undefined,
  };
}
export type WorldDevelopmentState={
  track:WorldDevelopmentTrack;
  level:number; // 0 = not started; 1–10 are permanently completed tiers
  stage:number; // 0 when completed, 1–4 while constructing the NEXT tier; phase 5 completes it
  revision:number; // server CAS revision
};
export type WorldAdvanceIntent={
  nextLevel:number;
  nextStage:number;
  minimumLandM2:number;
  sampleBpForCurrentStage:number;
  sampleArtStageId:string;
  requiresCommunityProof:boolean;
};
export function nextWorldAdvance(state:WorldDevelopmentState):WorldAdvanceIntent|null{
  if(!state || !tracks[state.track] || !Number.isInteger(state.level)||
      state.level<0||state.level>MAX_LEVEL||
      !Number.isInteger(state.stage)||state.stage<0||state.stage>4||
      !Number.isSafeInteger(state.revision)||state.revision<0)return null;
  if(state.level===MAX_LEVEL)return null;
  const nextLevel=state.level+1;
  const nextStage=state.stage+1;
  const tier=worldTier(state.track,nextLevel);
  if(!tier)return null;
  return {
    nextLevel,nextStage,
    minimumLandM2:tier.minimumLandM2,
    // Exact integer allocation across five preview stages; no phantom extra BP.
    sampleBpForCurrentStage:Math.floor(tier.sampleBpForFullTier*nextStage/5)-
      Math.floor(tier.sampleBpForFullTier*(nextStage-1)/5),
    sampleArtStageId:state.track+'-level-'+nextLevel+'-stage-'+nextStage,
    requiresCommunityProof:state.track==='cluster'||state.track==='organization',
  };
}
export function applyPreviewWorldAdvance(
  state:WorldDevelopmentState,
  receipt:{worldId:string;approvedArtId:string;level:number;stage:number;revision:number;serverVerified:boolean},
  landM2:number,
):{ok:true;next:WorldDevelopmentState}|{ok:false;reason:string}{
  const target=nextWorldAdvance(state);
  if(!target)return {ok:false,reason:'Invalid or completed development track.'};
  if(!receipt.serverVerified||!receipt.worldId?.trim()||
      receipt.approvedArtId!==target.sampleArtStageId||
      receipt.level!==target.nextLevel||receipt.stage!==target.nextStage||
      receipt.revision!==state.revision+1)
    return {ok:false,reason:'Unverified or out-of-order construction receipt.'};
  if(!Number.isFinite(landM2)||landM2<target.minimumLandM2)
    return {ok:false,reason:'Insufficient owned or approved shared land area.'};
  if(target.nextStage===5)return {ok:true,next:{...state,level:target.nextLevel,stage:0,revision:receipt.revision}};
  return {ok:true,next:{...state,stage:target.nextStage,revision:receipt.revision}};
}
