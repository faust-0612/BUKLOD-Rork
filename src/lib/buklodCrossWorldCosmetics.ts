/**
 * Verified cross-world showcase receipt client (non-tradable, display-only).
 * No local result, preview level, Android cache or gameplay score may grant
 * an item; only the authenticated Supabase RPC may confirm a receipt.
 * This is not the canonical Character inventory or Arena reward wallet.
 */
import {supabase} from '@/lib/supabase';

export type BuklodCrossWorldDestination='kingdom'|'arena'|'house';
export type BuklodCrossWorldCosmeticKey =
  'house_artisan_planter'|'arena_apprentice_banner'|'kingdom_prospect_lantern'|
  'house_heritage_pergola'|'arena_kingdom_banner'|'kingdom_honor_beacon'|
  'house_verified_fountain'|'arena_verified_veteran_emblem'|'kingdom_masterwork_arch';
export type BuklodCrossWorldReceipt={
  key:BuklodCrossWorldCosmeticKey;
  destination:BuklodCrossWorldDestination;
  source_key:string;
  unlocked_at:string;
};
export type BuklodCrossWorldSnapshot={
  status:'verified'|'unavailable';
  verifiedChecks:number;
  items:ReadonlyArray<BuklodCrossWorldReceipt>;
  displayOnly:true;
};

export const CROSS_WORLD_COSMETIC_CATALOG:Readonly<Record<
  BuklodCrossWorldCosmeticKey,{name:string;destination:BuklodCrossWorldDestination;requiredChecks:1|10|25}
>>={
  house_artisan_planter:{name:'Artisan Planter',destination:'house',requiredChecks:1},
  arena_apprentice_banner:{name:'Apprentice Banner',destination:'arena',requiredChecks:1},
  kingdom_prospect_lantern:{name:'Prospect Lantern',destination:'kingdom',requiredChecks:1},
  house_heritage_pergola:{name:'Heritage Pergola',destination:'house',requiredChecks:10},
  arena_kingdom_banner:{name:'Kingdom Banner',destination:'arena',requiredChecks:10},
  kingdom_honor_beacon:{name:'Honor Beacon',destination:'kingdom',requiredChecks:10},
  house_verified_fountain:{name:'Kingdom Fountain',destination:'house',requiredChecks:25},
  arena_verified_veteran_emblem:{name:'Veteran Emblem',destination:'arena',requiredChecks:25},
  kingdom_masterwork_arch:{name:'Masterwork Arch',destination:'kingdom',requiredChecks:25},
};
const KEYS=Object.keys(CROSS_WORLD_COSMETIC_CATALOG) as BuklodCrossWorldCosmeticKey[];
const allowed=new Set(KEYS);
const empty=():BuklodCrossWorldSnapshot=>({
  status:'unavailable',verifiedChecks:0,items:[],displayOnly:true,
});

function asObj(value:unknown):Record<string,unknown>|null {
  return value&&typeof value==='object'&&!Array.isArray(value)
    ?value as Record<string,unknown>:null;
}
export function normalizeCrossWorldCosmeticSnapshot(raw:unknown):BuklodCrossWorldSnapshot|null {
  const v=asObj(raw);
  if(!v||v.ok!==true||v.version!==1||v.source!=='server'||
    v.display_only!==true||v.tradeable!==false||v.bp_awarded!==0||
    v.arena_stat_bonus!==0||!Array.isArray(v.items)||
    (typeof v.verified_checks!=='number'||!Number.isSafeInteger(v.verified_checks)||v.verified_checks<0))return null;

  const unique=new Set<string>();
  const items:BuklodCrossWorldReceipt[]=[];
  for(const rawItem of v.items){
    const item=asObj(rawItem);
    if(!item||typeof item.key!=='string'||!allowed.has(item.key as BuklodCrossWorldCosmeticKey)||
      typeof item.unlocked_at!=='string'||!Number.isFinite(Date.parse(item.unlocked_at))||
      typeof item.source_key!=='string')return null;
    const key=item.key as BuklodCrossWorldCosmeticKey;
    const target=CROSS_WORLD_COSMETIC_CATALOG[key];
    if(item.destination!==target.destination||
      item.source_key!=='kingdom:verified_checks:'+target.requiredChecks||
      Number(v.verified_checks)<target.requiredChecks||
      unique.has(key))return null;
    unique.add(key);
    items.push({key,destination:target.destination,
      source_key:item.source_key,unlocked_at:item.unlocked_at});
  }
  return {status:'verified',verifiedChecks:Number(v.verified_checks),items,displayOnly:true};
}

async function sameAccount(userId:string){
  if(!userId)throw new Error('Sign in to view your verified achievements.');
  const {data,error}=await supabase.auth.getSession();
  if(error||data.session?.user.id!==userId)
    throw new Error('BUKLOD account has changed. Please sign in again.');
}
async function rpc<T>(method:string):Promise<T>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
    const value=await Promise.race([
      (supabase as any).rpc(method),
      new Promise<never>((_,reject)=>{
        timer=setTimeout(()=>reject(new Error('Verification timed out.')),8000);
      }),
    ]);
    if(value?.error)throw new Error('Verification endpoint unavailable.');
    return value?.data as T;
  } finally {if(timer)clearTimeout(timer);}
}

export async function getMyBuklodCrossWorldCosmetics(userId:string):Promise<BuklodCrossWorldSnapshot>{
  try{
    await sameAccount(userId);
    const data=await rpc<unknown>('get_my_buklod_crossworld_cosmetics_v1');
    await sameAccount(userId);
    return normalizeCrossWorldCosmeticSnapshot(data)??empty();
  }catch{return empty();}
}

/** Explicit user action; server ignores client claims and derives source events. */
export async function claimMyBuklodCrossWorldCosmetics(userId:string):Promise<BuklodCrossWorldSnapshot>{
  await sameAccount(userId);
  const data=await rpc<unknown>('claim_my_buklod_crossworld_cosmetics_v1');
  await sameAccount(userId);
  const parsed=normalizeCrossWorldCosmeticSnapshot(data);
  if(!parsed)throw new Error('Unable to confirm achievement receipts. No items were applied locally.');
  return parsed;
}
