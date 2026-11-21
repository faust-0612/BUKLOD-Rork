/** Server-authoritative estate access. No local storage is treated as an earned unlock.
 * RPCs are transactional and reject writes when the staging migration is absent.
 */
import {supabase} from '@/lib/supabase';
import {constructionPlan} from './constructionPlan.mjs';
export type EstateTrack='lot'|'house'|'cluster';
export type EstateOwnerKind='USER'|'SCOPE';
export type EstateCosmetics={
 finish:'stone'|'timber'|'garden'|'slate'|'clay'|'light';
 roof:'gable'|'hip'|'terrace'; ground:'grass'|'flower'|'stone';
 fence:'wood'|'iron'|'hedge'; windows:'classic'|'panorama'|'arched';
 lights:'warm'|'starlight'|'garden';
 door:'wood'|'glass'|'arched';path:'gravel'|'pavers'|'brick';yard:'bench'|'pond'|'pergola';
};
export const DEFAULT_ESTATE_COSMETICS:EstateCosmetics={
 finish:'stone',roof:'gable',ground:'grass',fence:'wood',windows:'classic',lights:'warm',door:'wood',path:'gravel',yard:'bench',
};
export type EstateWallet={development_xp:number;timber:number;stone:number;metal:number};
export type EstateSnapshot={
 server_verified:true; can_build:boolean; owner_kind:EstateOwnerKind;owner_id:string;
 track:EstateTrack;level:number;stage:number;mastery:number;
 build_finish_at:string|null;pending_key:string|null;
 cosmetics:EstateCosmetics;wallet:EstateWallet;next_cost:ReturnType<typeof estateCost>;updated_at:string|null;
};
type EstateIdentity={kind:EstateOwnerKind;ownerId:string;track:EstateTrack};
const asNonnegative=(value:unknown)=>Number.isSafeInteger(Number(value))&&Number(value)>=0?Number(value):0;
function isChoice<T extends string>(value:unknown,options:readonly T[]):value is T{
 return typeof value==='string'&&options.includes(value as T);
}
export function normalizedEstateCosmetics(value:unknown):EstateCosmetics {
 const v=value&&typeof value==='object'?value as Record<string,unknown>:{};
 const a=DEFAULT_ESTATE_COSMETICS;
 return {
 finish:isChoice(v.finish,['stone','timber','garden','slate','clay','light'])?v.finish:a.finish,
 roof:isChoice(v.roof,['gable','hip','terrace'])?v.roof:a.roof,
 ground:isChoice(v.ground,['grass','flower','stone'])?v.ground:a.ground,
 fence:isChoice(v.fence,['wood','iron','hedge'])?v.fence:a.fence,
 windows:isChoice(v.windows,['classic','panorama','arched'])?v.windows:a.windows,
 lights:isChoice(v.lights,['warm','starlight','garden'])?v.lights:a.lights,
 door:isChoice(v.door,['wood','glass','arched'])?v.door:a.door,
 path:isChoice(v.path,['gravel','pavers','brick'])?v.path:a.path,
 yard:isChoice(v.yard,['bench','pond','pergola'])?v.yard:a.yard,
 };
}
function normalizeSnapshot(raw:any,id:EstateIdentity):EstateSnapshot {
 if(!raw||raw.server_verified!==true||raw.owner_kind!==id.kind||raw.owner_id!==id.ownerId||raw.track!==id.track)
   throw new Error('Estate server response did not match this account or scope.');
 return {
  server_verified:true,can_build:raw.can_build===true,
  owner_kind:id.kind,owner_id:id.ownerId,track:id.track,
  level:Math.max(1,Math.min(10,Math.floor(asNonnegative(raw.level)||1))),
  stage:Math.max(0,Math.min(4,Math.floor(asNonnegative(raw.stage)))),
  mastery:asNonnegative(raw.mastery),build_finish_at:typeof raw.build_finish_at==='string'?raw.build_finish_at:null,
  pending_key:typeof raw.pending_key==='string'?raw.pending_key:null,
  cosmetics:normalizedEstateCosmetics(raw.cosmetics),
  wallet:{development_xp:asNonnegative(raw.wallet?.development_xp),
    timber:asNonnegative(raw.wallet?.timber),stone:asNonnegative(raw.wallet?.stone),metal:asNonnegative(raw.wallet?.metal)},
  next_cost:raw.next_cost?{
   development_xp:asNonnegative(raw.next_cost.development_xp),timber:asNonnegative(raw.next_cost.timber),
   stone:asNonnegative(raw.next_cost.stone),metal:asNonnegative(raw.next_cost.metal),
   build_minutes:asNonnegative(raw.next_cost.build_minutes),
  }:estateCost(id.track,raw.level,raw.stage,raw.mastery),
  updated_at:typeof raw.updated_at==='string'?raw.updated_at:null,
 };
}
export function estateCost(track:EstateTrack,level:number,stage:number,mastery=0){
 const p=constructionPlan(track,level,stage,mastery);
 return {development_xp:p.estimatedDevelopmentXp,timber:p.estimatedTimber,
   stone:p.estimatedStone,metal:p.estimatedMetal,build_minutes:p.estimatedBuildMinutes};
}
export function enoughEstateMaterials(wallet:EstateWallet,cost:ReturnType<typeof estateCost>) {
 return wallet.development_xp>=cost.development_xp&&wallet.timber>=cost.timber
   &&wallet.stone>=cost.stone&&wallet.metal>=cost.metal;
}
async function rpcEstate<T>(method:string,args:Record<string,unknown>):Promise<T> {
 const {data,error}=await (supabase as any).rpc(method,args);
 if(error) {
   const unavailable=error.code==='42883'||error.code==='PGRST202';
   throw new Error(unavailable?'Estate construction server is not enabled on this build. Your progress is unchanged.':
     String(error.message||'Could not verify estate update.'));
 }
 return data as T;
}
const params=(id:EstateIdentity)=>({p_owner_kind:id.kind,p_owner_id:id.ownerId,p_track:id.track});
export async function fetchVerifiedEstate(id:EstateIdentity){
 const raw=await rpcEstate<any>('get_buklod_estate_snapshot_v1',params(id));
 return normalizeSnapshot(raw,id);
}
export async function startVerifiedEstateBuild(id:EstateIdentity,operationKey:string){
 const raw=await rpcEstate<any>('start_buklod_estate_construction_v1',{...params(id),p_operation_key:operationKey});
 return normalizeSnapshot(raw,id);
}
export async function completeVerifiedEstateBuild(id:EstateIdentity){
 const raw=await rpcEstate<any>('complete_buklod_estate_construction_v1',params(id));
 return normalizeSnapshot(raw,id);
}
export async function saveVerifiedEstateDesign(id:EstateIdentity,design:EstateCosmetics){
 const raw=await rpcEstate<any>('save_buklod_estate_design_v1',{...params(id),p_design:normalizedEstateCosmetics(design)});
 return normalizeSnapshot(raw,id);
}
export async function contributeVerifiedEstate(scopeId:string,operationKey:string,amount:EstateWallet){
 const raw=await rpcEstate<any>('contribute_buklod_estate_resources_v1',{
  p_scope_id:scopeId,p_operation_key:operationKey,p_xp:amount.development_xp,
  p_timber:amount.timber,p_stone:amount.stone,p_metal:amount.metal,
 });
 return normalizeSnapshot(raw,{kind:'SCOPE',ownerId:scopeId,track:'cluster'});
}
export function newEstateOperationKey(){
 return 'estate:'+Date.now().toString(36)+':'+Math.random().toString(36).slice(2)+':'+Math.random().toString(36).slice(2);
}
