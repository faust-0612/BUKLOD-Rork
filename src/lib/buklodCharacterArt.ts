/* BUKLOD Character collection artwork. No server rewards are granted by art.
 * The publisher writes a tiny marker LAST after validating all 1,300 objects.
 * Until then clients use a local icon, never broken/guessed asset URLs.
 */
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storyItemAssetPath } from '@/lib/buklodCharacterCollectionLogic';
import type { BuklodCharacterWorldId } from '@/lib/buklodCharacterWorldCatalog';

export const CHARACTER_ART_BUCKET = 'buklod-character-art-v1';
export const CHARACTER_ART_PUBLICATION_MARKER = 'published-v1.json';
const EXPECTED_CATALOGUE = 'BUKLOD_CHARACTER_R31_R40_1300';
const EXPECTED_COUNT = 1300;
const REFRESH_AFTER_MS = 10 * 60 * 1000;
const RETRY_AFTER_FAILURE_MS = 60 * 1000;
const OFFLINE_ART_KEY='buklod:verified-character-art:v1';
const OFFLINE_TTL_MS=30*24*60*60*1000;

export type CharacterArtPublication = Readonly<{
  available:boolean; reason:'ready'|'missing'|'invalid'|'offline';
}>;
const MISSING:CharacterArtPublication={available:false,reason:'missing'};
let latest:CharacterArtPublication=MISSING;
let lastFetch=0;
let pending:Promise<CharacterArtPublication>|null=null;

function isValidMarker(input:unknown):boolean {
 if(!input||typeof input!=='object'||Array.isArray(input))return false;
 const x=input as Record<string,unknown>;
 return x.version===1 && x.total===EXPECTED_COUNT && x.catalogue_version===EXPECTED_CATALOGUE
  && typeof x.manifest_sha256==='string' && /^[a-f0-9]{64}$/i.test(x.manifest_sha256)
  && x.ready===true;
}
export function getCachedCharacterArtPublication() {return latest;}

/** Offline art reuses only a previously online-validated public marker.
 * This never grants inventory, badge, XP or economy entitlements.
 */
async function offlinePublication():Promise<CharacterArtPublication> {
 try{
  const raw=await AsyncStorage.getItem(OFFLINE_ART_KEY);
  if(!raw)return {available:false,reason:'offline'};
  const saved=JSON.parse(raw) as {checkedAt:number;marker:unknown};
  if(!Number.isFinite(saved.checkedAt)||saved.checkedAt>Date.now()||
     Date.now()-saved.checkedAt>OFFLINE_TTL_MS||!isValidMarker(saved.marker))
   return {available:false,reason:'offline'};
  return {available:true,reason:'ready'};
 }catch{return {available:false,reason:'offline'};}
}

/** One bounded network check per 10 minutes, failures retry after 60 sec.
 * No per-card existence queries, polling or required auth token.
 */
export async function loadCharacterArtPublication(force=false):Promise<CharacterArtPublication> {
 if(pending)return pending;
 const now=Date.now();
 const ttl=latest.available?REFRESH_AFTER_MS:RETRY_AFTER_FAILURE_MS;
 if(!force&&lastFetch&&now-lastFetch<ttl)return latest;
 lastFetch=now;
 const task=(async()=>{
  try{
   const {data}=supabase.storage.from(CHARACTER_ART_BUCKET)
    .getPublicUrl(CHARACTER_ART_PUBLICATION_MARKER);
   if(!data?.publicUrl||!/^https:\/\//i.test(data.publicUrl))return {available:false,reason:'invalid'} as CharacterArtPublication;
   const controller=new AbortController();
   const timer=setTimeout(()=>controller.abort(),4500);
   let response:Response;
   try {response=await fetch(data.publicUrl,{signal:controller.signal,headers:{Accept:'application/json'}});}
   finally {clearTimeout(timer);}
   if(!response.ok)return {available:false,reason:'missing'} as CharacterArtPublication;
   const payload=await response.json();
   if(!isValidMarker(payload))return {available:false,reason:'invalid'} as CharacterArtPublication;
   void AsyncStorage.setItem(OFFLINE_ART_KEY,JSON.stringify({checkedAt:Date.now(),marker:payload})).catch(()=>{});
   return {available:true,reason:'ready'} as CharacterArtPublication;
  }catch {return offlinePublication();}
 })();
 pending=task;
 try{latest=await task;return latest;}finally{if(pending===task)pending=null;}
}
export function verifiedCharacterArtUrl(
 character:BuklodCharacterWorldId,level:number,index:number,ready:boolean,
):string|null {
 if(!ready)return null;
 const objectPath=storyItemAssetPath(character,level,index);
 // An invariant, allowlisted bucket and canonical, validated path — never a
 // path or host supplied by untrusted content, user profile or task metadata.
 const {data}=supabase.storage.from(CHARACTER_ART_BUCKET).getPublicUrl(objectPath);
 return data?.publicUrl&&data.publicUrl.startsWith('https://')?data.publicUrl:null;
}
