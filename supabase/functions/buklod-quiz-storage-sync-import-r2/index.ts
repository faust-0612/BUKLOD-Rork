import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

// Accept ONLY scoped, short-lived and checksum-verified private Quiz source docs.
// No overwrite: an existing target object must match source SHA-256.
const GATE = "buklod_quiz_transfer_gate_r2_20261107";
const ALLOW = "buklod_quiz_transfer_allow_r2_20261107";
const BUCKET = "buklod-quiz-source-docs";
const MAX_BYTES = 1048576;
const reply = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type":"application/json", "Cache-Control":"no-store" },
});
const digest = async (input) => Array.from(new Uint8Array(
  await crypto.subtle.digest("SHA-256", input instanceof Uint8Array ? input : new TextEncoder().encode(input))
)).map(b=>b.toString(16).padStart(2,"0")).join("");
const admin = () => createClient(
  Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  { auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false} },
);
Deno.serve(async (req) => {
  if(req.method!=="POST") return reply(405,{ok:false,error:"method_not_allowed"});
  try {
    const raw=/^Bearer ([0-9a-f]{64})$/i.exec(req.headers.get("Authorization")||"")?.[1];
    if(!raw) return reply(401,{ok:false,error:"migration_unauthorized"});
    const sb=admin();
    const {data:gate,error:gateErr}=await sb.from(GATE).select("token_sha256")
      .eq("token_sha256",await digest(raw)).eq("active",true)
      .gt("expires_at",new Date().toISOString()).maybeSingle();
    if(gateErr||!gate) return reply(401,{ok:false,error:"migration_unauthorized"});
    const input=await req.json().catch(()=>null);
    const path=input?.path, enc=input?.base64, sha=input?.sha256;
    if(typeof path!=="string"||path.length<1||path.length>600||
      typeof enc!=="string"||enc.length<1||enc.length>1450000||
      typeof sha!=="string"||!/^[0-9a-f]{64}$/.test(sha))
      return reply(422,{ok:false,error:"invalid_upload_payload"});
    const {data:allowed,error:allowErr}=await sb.from(ALLOW)
      .select("expected_size,mime_type").eq("object_path",path).maybeSingle();
    if(allowErr||!allowed) return reply(403,{ok:false,error:"path_not_allowlisted"});
    let bytes;
    try {bytes=Uint8Array.from(atob(enc),c=>c.charCodeAt(0));}
    catch {return reply(422,{ok:false,error:"invalid_encoded_bytes"});}
    if(bytes.length>MAX_BYTES||bytes.length!==Number(allowed.expected_size)||
      bytes.length!==Number(input?.size)||await digest(bytes)!==sha)
      return reply(409,{ok:false,error:"source_integrity_conflict"});
    const storage=sb.storage.from(BUCKET);
    const {error:uploadErr}=await storage.upload(path,bytes,{
      upsert:false,contentType:allowed.mime_type||"application/octet-stream",
      cacheControl:"3600",
    });
    const duplicate=uploadErr&&(String(uploadErr.statusCode)==="409"||
      /already exists|duplicate/i.test(uploadErr.message||""));
    if(uploadErr&&!duplicate) return reply(503,{ok:false,error:"target_upload_failed"});
    // A successful upload or a safe duplicate must be re-downloaded and
    // checked against the source hash; metadata/size checks alone are insufficient.
    let verified=false;
    for(let i=0;i<3;i++){
      const {data:blob,error:downloadErr}=await storage.download(path);
      if(!downloadErr&&blob){
        const check=new Uint8Array(await blob.arrayBuffer());
        if(check.length===bytes.length&&await digest(check)===sha){verified=true;break;}
        if(duplicate) return reply(409,{ok:false,error:"existing_content_conflict"});
      }
      await new Promise(resolve=>setTimeout(resolve,180*(i+1)));
    }
    if(!verified) return reply(503,{ok:false,error:"target_readback_not_verified"});
    const {error:statusErr}=await sb.from(ALLOW)
      .update({status:"VERIFIED",sha256:sha,verified_at:new Date().toISOString()})
      .eq("object_path",path);
    if(statusErr) return reply(503,{ok:false,error:"target_status_write_failed"});
    return reply(200,{ok:true,size:bytes.length,sha256:sha,existing:!!duplicate});
  }catch{return reply(500,{ok:false,error:"migration_receiver_failed"});}
});
