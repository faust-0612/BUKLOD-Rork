// RELEASE CANDIDATE ONLY. Move to supabase/functions/buklod-rank-bonus-ssv
// after isolated tests. Gateway must allow GET without JWT for Google; POST
// independently validates the caller against Supabase Auth. Never log URLs.
import { parseRankBonusCallback, verifyRankBonusSignature } from './verify.mjs';

const GOOGLE_KEYS='https://www.gstatic.com/admob/reward/verifier-keys.json';
let keys=new Map<string,string>(), keysFetchedAt=0, lastKeyAttempt=0;
let keyFetch:Promise<void>|null=null;
async function refreshKeys(){
  if(keyFetch)return keyFetch;
  lastKeyAttempt=Date.now();
  keyFetch=(async()=>{
    const r=await fetch(GOOGLE_KEYS,{signal:AbortSignal.timeout(5000),redirect:'error'});
    if(!r.ok)throw Error('key service unavailable');
    const data=await r.json();
    const next=new Map<string,string>();
    if(!Array.isArray(data.keys)||data.keys.length>32)throw Error('invalid key set');
    for(const k of data.keys){
      if(/^\d{1,12}$/.test(String(k.keyId))&&typeof k.base64==='string'&&k.base64.length<=1024)
        next.set(String(k.keyId),k.base64);
    }
    if(!next.size)throw Error('empty key set');
    keys=next;keysFetchedAt=Date.now();
  })();
  try{await keyFetch;}finally{keyFetch=null;}
}
async function findKey(id:string){
  const now=Date.now();
  if(!keys.size||now-keysFetchedAt>=6*60*60*1000){
    if(now-lastKeyAttempt<15000&&!keyFetch)throw Error('key refresh cooling down');
    await refreshKeys();
  }else if(!keys.has(id)&&now-lastKeyAttempt>=15000)await refreshKeys();
  return keys.get(id)??null;
}
function json(body:unknown,status=200){
 return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
}
async function rpc(base:string,service:string,name:string,body:unknown){
 const r=await fetch(base+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:service,authorization:'Bearer '+service,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw Error('database request failed');
 return await r.json();
}
Deno.serve(async req=>{
 const base=Deno.env.get('SUPABASE_URL')??'';
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
 const anon=Deno.env.get('SUPABASE_ANON_KEY')??'';
 const unit=Deno.env.get('BUKLOD_RANK_BONUS_AD_UNIT_NUMBER')??'';
 if(Deno.env.get('BUKLOD_RANK_BONUS_SSV_ENABLED')!=='true'||!base||!service||!anon||!/^\d{1,24}$/.test(unit))
  return json({error:'unavailable'},503);
 if(req.method==='POST'){
   const auth=req.headers.get('authorization')??'';
   if(!/^Bearer [^\s]+$/.test(auth))return json({error:'unauthorized'},401);
   try{
     const r=await fetch(base+'/auth/v1/user',{headers:{apikey:anon,authorization:auth},signal:AbortSignal.timeout(5000)});
     if(!r.ok)return json({error:'unauthorized'},401);
     const actor=await r.json();
     if(typeof actor.id!=='string')return json({error:'unauthorized'},401);
     if(Number(req.headers.get('content-length')??0)>2048)return json({error:'invalid_request'},400);
     const raw=await req.text();
     if(raw.length>2048)return json({error:'invalid_request'},400);
     let body;
     try{body=JSON.parse(raw);}catch{return json({error:'invalid_request'},400);}
     if(!/^rank-frame-(0[1-9]|[1-3][0-9]|40)$/.test(String(body?.bonusKey??'')))return json({error:'invalid_bonus'},400);
     const sessionId=await rpc(base,service,'buklod_begin_rank_bonus_ad_v1',{p_user_id:actor.id,p_bonus_key:body.bonusKey});
     if(typeof sessionId!=='string')return json({error:'unavailable'},503);
     return json({sessionId,adUnitNumber:unit});
   }catch{return json({error:'bonus_unavailable_or_retry_later'},409);}
 }
 if(req.method!=='GET')return json({error:'method_not_allowed'},405);
 const callback=parseRankBonusCallback(req.url,unit);
 if(!callback)return json({error:'invalid_callback'},400);
 try{
   const key=await findKey(callback.keyId);
   if(!key||!verifyRankBonusSignature(callback,key))return json({error:'invalid_signature'},400);
   const granted=await rpc(base,service,'buklod_redeem_rank_bonus_verified_v1',{
    p_session_id:callback.sessionId,p_transaction_id:callback.transactionId,p_signed_reward_at:callback.rewardAt,
   });
   return granted===true?json({ok:true}):json({error:'invalid_reward_session'},400);
 }catch{return json({error:'retry_later'},503);}
});
