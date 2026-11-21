/** BUKLOD continuous Level 1–10 asset growth, simulated, no production persistence.
 * A project donation is not itself a permanent-level unlock: audited effort,
 * elapsed verified builder time and escalating material requirements also apply.
 */
const TYPES=Object.freeze(['house','lot','cluster_map']);
export const PERMANENT_ASSET_LEVEL_CAP=10;
const fail=(test,msg)=>{if(!test)throw Error(msg)};
const validPositive=n=>Number.isSafeInteger(n)&&n>0;
export function assetRequirements(level){
 fail(validPositive(level)&&level<=10,'invalid asset level');
 if(level===10)return Object.freeze({materials:0,xp:0,buildMs:0});
 return Object.freeze({materials:Math.ceil(24*Math.pow(1.8,level-1)),xp:Math.ceil(16*Math.pow(1.7,level-1)),buildMs:Math.ceil(12000*Math.pow(1.65,level-1))});
}
export function assetStage(materialProgress){
 return materialProgress<.20?'ground_markers':materialProgress<.45?'foundation':materialProgress<.75?'frame':materialProgress<1?'roof_and_walls':'finishing';
}
export function startAssetTrack(world,{scopeId,assetType,requestedBy}){
 const scope=world.scopes[scopeId];fail(scope&&scope.managerIds.includes(requestedBy),'only verified property owner/scope manager');
 fail(TYPES.includes(assetType),'invalid permanent asset type');
 scope.assets??=Object.create(null);
 fail(!scope.assets[assetType],'asset track already exists');
 scope.assets[assetType]={kind:assetType,scopeId,level:1,materials:0,xp:0,workMs:0,stage:'ground_markers',usedProjectReceipts:[],usedXpEvidence:[],history:[],rankGate:false};
 return structuredClone(scope.assets[assetType]);
}
export function contributeAssetMaterials(world,{scopeId,assetType,projectReceiptId}){
 const scope=world.scopes[scopeId],a=scope?.assets?.[assetType],receipt=world.projectUses[projectReceiptId];
 fail(a&&a.level<PERMANENT_ASSET_LEVEL_CAP,'asset cannot grow');
 if(a.usedProjectReceipts.includes(projectReceiptId))return structuredClone(a);
 fail(receipt&&receipt.scopeId===scopeId,'invalid donated material receipt');
 const p=scope.projects[receipt.projectId];fail(p&&p.kind===assetType,'project purpose mismatch');
 a.usedProjectReceipts.push(projectReceiptId);a.materials+=receipt.applied;
 a.stage=assetStage(Math.min(1,a.materials/assetRequirements(a.level).materials));
 return structuredClone(a);
}
export function recordAssetDevelopmentXp(world,{scopeId,assetType,eventId}){
 const a=world.scopes[scopeId]?.assets?.[assetType],e=world.events[eventId];
 fail(a&&a.level<PERMANENT_ASSET_LEVEL_CAP,'asset at cap or missing');
 if(a.usedXpEvidence.includes(eventId))return structuredClone(a);
 fail(e&&e.qualified&&e.purpose===`development:${assetType}`&&['cluster','wall','kingdom','bayanihan','learning'].includes(e.source),'unverified development XP');
 fail(!world.issuedEvidence.has(eventId),'evidence already assigned to other reward');
 a.usedXpEvidence.push(eventId);world.issuedEvidence.add(eventId);
 a.xp+=8;
 return structuredClone(a);
}
export function simulateVerifiedAssetWork(world,{scopeId,assetType,requestedBy,workMs}){
 const scope=world.scopes[scopeId],a=scope?.assets?.[assetType];fail(a&&a.level<PERMANENT_ASSET_LEVEL_CAP&&scope.managerIds.includes(requestedBy),'building role denied');
 fail(validPositive(workMs)&&workMs<=10000,'bounded work tick required');
 // Offline simulation of separately server-verified builder activity/time.
 // Never accept submitted client time in the live system.
 a.workMs+=workMs;return structuredClone(a);
}
export function completeAssetLevel(world,{scopeId,assetType,requestedBy}){
 const scope=world.scopes[scopeId],a=scope?.assets?.[assetType];fail(a&&a.level<PERMANENT_ASSET_LEVEL_CAP&&scope.managerIds.includes(requestedBy),'asset cannot be upgraded');
 const req=assetRequirements(a.level);fail(a.materials>=req.materials&&a.xp>=req.xp&&a.workMs>=req.buildMs,'materials, verified XP or build time missing');
 const prior=a.level;a.materials-=req.materials;a.xp-=req.xp;a.workMs-=req.buildMs;a.level++;
 a.history.push({level:prior+1,from:prior,materials:req.materials,xp:req.xp,buildMs:req.buildMs});
 a.stage=a.level===10?'complete':assetStage(Math.min(1,a.materials/assetRequirements(a.level).materials));
 return structuredClone(a);
}