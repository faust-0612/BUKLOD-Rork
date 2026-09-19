import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const reply=(status:number,body:any)=>new Response(JSON.stringify(body),{status,headers:cors});
const appFail=(error:string,message:string)=>reply(200,{ok:false,error,message});
const safe=(v:any,max=320)=>String(v??"").trim().slice(0,max);

type VerifyResult =
  | { kind:"success"; account:any; auth:any }
  | { kind:"invalid"; status:number }
  | { kind:"transient"; status?:number; reason:string };

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return reply(405,{ok:false,error:"method_not_allowed"});

  let body:any={};
  try{ body=await req.json(); }
  catch{ return appFail("invalid_request","Enter your BUKLOD login and password."); }

  const identifier=safe(body?.identifier,320);
  const password=String(body?.password??"");
  if(!identifier||!password||password.length>256){
    return appFail("invalid_credentials","Invalid username/mobile/email or password.");
  }

  const url=Deno.env.get("SUPABASE_URL")!;
  const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey=Deno.env.get("SUPABASE_ANON_KEY");
  if(!url||!serviceKey||!anonKey){
    console.error("central_auth_v4_config_missing");
    return reply(503,{ok:false,error:"auth_service_unavailable",message:"Login service is temporarily unavailable."});
  }

  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const {data,error}=await admin.rpc("buklod_auth_candidates_for_service_v2",{p_identifier:identifier});
  if(error){
    console.error("central_auth_v4_resolver_error",{code:(error as any)?.code??"unknown"});
    return appFail("login_temporarily_unavailable","Login service is temporarily unavailable. Please try again.");
  }
  if(!Array.isArray(data)||data.length===0){
    console.log("central_auth_v4_no_candidate");
    return appFail("invalid_credentials","Invalid username/mobile/email or password.");
  }

  const bestRank=Number(data[0]?.match_rank??99);
  const candidates=bestRank<=3?[data[0]]:data.filter((x:any)=>Number(x?.match_rank)===bestRank).slice(0,10);

  const verify=async(account:any):Promise<VerifyResult>=>{
    try{
      const r=await fetch(`${url}/auth/v1/token?grant_type=password`,{
        method:"POST",
        headers:{"Content-Type":"application/json",apikey:anonKey},
        body:JSON.stringify({email:account.auth_email,password}),
        signal:AbortSignal.timeout(12000),
      });

      if(r.ok){
        const j=await r.json().catch(()=>null);
        if(!j?.access_token||!j?.refresh_token||String(j?.user?.id??"")!==String(account.user_id)){
          return {kind:"transient",status:r.status,reason:"malformed_success"};
        }
        return {kind:"success",account,auth:j};
      }

      if(r.status===400||r.status===401){
        return {kind:"invalid",status:r.status};
      }

      if(r.status===429){
        return {kind:"transient",status:r.status,reason:"rate_limited"};
      }

      if(r.status>=500){
        return {kind:"transient",status:r.status,reason:"auth_5xx"};
      }

      return {kind:"transient",status:r.status,reason:"unexpected_auth_status"};
    }catch(err:any){
      const msg=String(err?.name??err?.message??"network_or_timeout");
      return {kind:"transient",reason:msg.slice(0,80)};
    }
  };

  const checks=await Promise.all(candidates.map(verify));
  const valid=checks.filter((x):x is Extract<VerifyResult,{kind:"success"}>=>x.kind==="success");
  const transient=checks.filter(x=>x.kind==="transient");

  if(valid.length>1){
    console.warn("central_auth_v4_ambiguous",{candidateCount:candidates.length,matchRank:bestRank});
    return appFail("ambiguous_shared_mobile","This mobile number is shared by more than one BUKLOD account with the same password. Please use your username or email.");
  }

  if(valid.length===0){
    if(transient.length>0){
      const rateLimited=transient.some(x=>x.kind==="transient"&&(x.status===429||x.reason==="rate_limited"));
      console.warn("central_auth_v4_transient_failure",{
        candidateCount:candidates.length,
        transientCount:transient.length,
        rateLimited,
        matchRank:bestRank
      });
      return rateLimited
        ? appFail("rate_limited","Login traffic is temporarily full. Please wait before trying again.")
        : appFail("login_temporarily_unavailable","Your BUKLOD account could not be verified because the login service was temporarily busy. Please try again once.");
    }
    console.log("central_auth_v4_invalid_credentials",{candidateCount:candidates.length,matchRank:bestRank});
    return appFail("invalid_credentials","Invalid username/mobile/email or password.");
  }

  const hit=valid[0];
  const a=hit.account;
  const j=hit.auth;
  console.log("central_auth_v4_success",{userId:String(a.user_id),candidateCount:candidates.length,matchRank:bestRank});

  return reply(200,{
    ok:true,
    authority:"buklod_connect",
    session:{
      access_token:j.access_token,
      refresh_token:j.refresh_token,
      expires_in:j.expires_in,
      expires_at:j.expires_at,
      token_type:j.token_type,
    },
    user:j.user,
    account:{
      id:a.user_id,
      auth_email:a.auth_email,
      login_method:a.login_method,
      username:a.username,
      full_name:a.full_name,
      first_name:a.first_name,
      middle_name:a.middle_name,
      surname:a.surname,
      suffix:a.suffix,
      mobile:a.mobile,
      role:a.role,
      is_active:true,
    },
  });
});