// DEV ONLY until R27 production Expo marker and authenticated smoke are verified.
// Preserve the legacy endpoint for installed MAIN clients; MAIN owns identity.
// Never mint a Dedicated token, create a shadow user, retry token issuance or follow redirects.
const ENTRY = "https://yhanxndaqbmuzbdqlblu.supabase.co/functions/v1/buklod-quiz-entry-v2";
const QUIZ = "https://buklod-quiz.expo.app/";
const headers = {
 "Content-Type":"application/json",
 "Cache-Control":"no-store",
 "Referrer-Policy":"no-referrer",
 "Access-Control-Allow-Origin":"*",
 "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
 "Access-Control-Allow-Methods":"POST, OPTIONS",
};
const out=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return out(405,{ok:false,error:"method_not_allowed"});
 const auth=req.headers.get("authorization")??"";
 const token=auth.match(/^Bearer\s+([^\s]+)$/i)?.[1];
 if(!token||token.length>16384)return out(401,{ok:false,error:"main_session_required"});
 try {
  const r=await fetch(ENTRY,{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({source:"legacy-main-quiz-launcher"}),redirect:"error",signal:AbortSignal.timeout(13000)});
  const raw=await r.text();
  if(raw.length>16384)return out(502,{ok:false,error:"invalid_main_entry_response"});
  const data=JSON.parse(raw);
  if(!r.ok||data?.ok!==true){
   const code=typeof data?.error==="string"&&/^[a-z_]{1,80}$/.test(data.error)?data.error:"quiz_entry_unavailable";
   return out(r.status>=400&&r.status<=599?r.status:502,{ok:false,error:code,...(code==="entry_already_in_progress"?{retry_after_ms:6000,message:"Sign-in link already requested. Try again shortly."}:{})});
  }
  const launch=String(data.session_launch_url??"");
  if(data.authority!=="buklod_connect"||data.session_launch_ready!==true||data.launch_url!==launch||!launch.startsWith(QUIZ+"#buklod_quiz_token_hash="))return out(502,{ok:false,error:"invalid_main_entry_response"});
  const hash=launch.slice((QUIZ+"#buklod_quiz_token_hash=").length);
  if(!/^[A-Za-z0-9_-]{16,512}$/.test(hash))return out(502,{ok:false,error:"invalid_main_entry_response"});
  return out(200,{ok:true,authority:"buklod_connect",launch_url:launch,session_launch_url:launch,session_launch_ready:true,quiz_url:QUIZ,expires_hint_seconds:300});
 } catch {return out(503,{ok:false,error:"quiz_entry_unavailable"});}
});
