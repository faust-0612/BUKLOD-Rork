// Pending cutover: replace MAIN buklod-quiz-entry-v1 only after R28 production web proof.
// Keep gateway JWT verification enabled. The v2 handler independently validates
// the same MAIN token, active profile, identity and rate limit.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const MAIN_V2="https://yhanxndaqbmuzbdqlblu.supabase.co/functions/v1/buklod-quiz-entry-v2";
const QUIZ_URL="https://buklod-quiz.expo.app/";
const headers={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Content-Type":"application/json",
  "Cache-Control":"no-store",
  "Referrer-Policy":"no-referrer",
};
const out=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers});
  if(req.method!=="POST")return out(405,{ok:false,error:"method_not_allowed"});
  const token=(req.headers.get("authorization")??"").match(/^Bearer\s+([^\s]+)$/i)?.[1];
  if(!token)return out(401,{ok:false,error:"main_session_required",message:"Valid BUKLOD Main session required."});
  const apiKey=Deno.env.get("SUPABASE_ANON_KEY");
  if(!apiKey)return out(503,{ok:false,error:"quiz_entry_unavailable"});
  try{
    const r=await fetch(MAIN_V2,{method:"POST",headers:{Authorization:"Bearer "+token,apikey:apiKey,"Content-Type":"application/json"},body:"{}",redirect:"error",signal:AbortSignal.timeout(15000)});
    const p=await r.json().catch(()=>null);
    if(!r.ok){
      const retry=Number(p?.retry_after_ms);
      const code=typeof p?.error==="string"&&/^[a-z0-9_]{1,80}$/.test(p.error)?p.error:"quiz_entry_failed";
      return out(r.status>=400&&r.status<=599?r.status:503,{ok:false,error:code,message:"BUKLOD Quiz entry is temporarily unavailable.",retry_after_ms:Number.isFinite(retry)&&retry>0&&retry<=300000?retry:null});
    }
    if(p?.ok!==true||typeof p.launch_url!=="string")return out(503,{ok:false,error:"invalid_quiz_launch"});
    const u=new URL(p.launch_url), h=new URLSearchParams(u.hash.slice(1)), hash=h.get("buklod_quiz_token_hash")??"";
    if(u.origin!==new URL(QUIZ_URL).origin||u.pathname!=="/"||u.search||u.username||u.password||[...h.keys()].length!==1||!/^[a-zA-Z0-9_-]{12,1024}$/.test(hash))return out(503,{ok:false,error:"invalid_quiz_launch"});
    return out(200,{ok:true,authority:"buklod_main",launch_url:u.href,session_launch_url:u.href,session_launch_ready:true,quiz_url:QUIZ_URL,expires_hint_seconds:300});
  }catch{
    return out(503,{ok:false,error:"quiz_entry_unavailable",message:"BUKLOD Quiz entry is temporarily unavailable. Please try again."});
  }
});
