import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

// Dedicated -> Main. Private object bytes flow only over HTTPS to a temporary
// authenticated receiver, from exact short-lived allowlisted paths.
// No keys or object identifiers are committed into this source code.
const GATE = "buklod_quiz_transfer_gate_r2_20261107";
const ALLOW = "buklod_quiz_transfer_allow_r2_20261107";
const BUCKET = "buklod-quiz-source-docs";
const DEST = "https://yhanxndaqbmuzbdqlblu.supabase.co/functions/v1/buklod-quiz-storage-sync-import-r2";
const MAX_BYTES = 1048576;
const reply = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type":"application/json", "Cache-Control":"no-store" },
});
const digest = async (input) => Array.from(new Uint8Array(
  await crypto.subtle.digest("SHA-256", input instanceof Uint8Array ? input : new TextEncoder().encode(input))
)).map(b => b.toString(16).padStart(2,"0")).join("");
const b64 = (bytes) => {
  let s="";
  for (let i=0;i<bytes.length;i+=16384) s+=String.fromCharCode(...bytes.subarray(i,i+16384));
  return btoa(s);
};
const client = () => createClient(
  Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  { auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false} },
);
Deno.serve(async (req) => {
  if(req.method!=="POST") return reply(405,{ok:false,error:"method_not_allowed"});
  try {
    const raw = /^Bearer ([0-9a-f]{64})$/i.exec(req.headers.get("Authorization")||"")?.[1];
    if(!raw) return reply(401,{ok:false,error:"migration_unauthorized"});
    const admin=client(), tokenHash=await digest(raw);
    const {data:gate,error:gateErr}=await admin.from(GATE).select("token_sha256")
      .eq("token_sha256",tokenHash).eq("active",true)
      .gt("expires_at",new Date().toISOString()).maybeSingle();
    if(gateErr||!gate) return reply(401,{ok:false,error:"migration_unauthorized"});
    const payload=await req.json().catch(()=>null);
    const paths=payload?.paths;
    if(!Array.isArray(paths)||paths.length<1||paths.length>4||
       paths.some(p=>typeof p!=="string"||p.length<1||p.length>600)||
       new Set(paths).size!==paths.length)
      return reply(422,{ok:false,error:"invalid_allowlist_batch"});
    const results=[];
    for(const path of paths){
      try {
        const {data:allowed,error:allowErr}=await admin.from(ALLOW)
          .select("expected_size,mime_type").eq("object_path",path).maybeSingle();
        if(allowErr||!allowed) throw Error("path_not_allowlisted");
        const {data:blob,error:readErr}=await admin.storage.from(BUCKET).download(path);
        if(readErr||!blob) throw Error("source_download_failed");
        const bytes=new Uint8Array(await blob.arrayBuffer());
        if(bytes.length!==Number(allowed.expected_size)||bytes.length>MAX_BYTES)
          throw Error("source_size_conflict");
        const sha256=await digest(bytes);
        const resp=await fetch(DEST,{
          method:"POST",headers:{"Authorization":"Bearer "+raw,"Content-Type":"application/json"},
          body:JSON.stringify({path,base64:b64(bytes),sha256,size:bytes.length}),
          signal:AbortSignal.timeout(28000),
        });
        const done=await resp.json().catch(()=>null);
        if(!resp.ok||done?.ok!==true||done?.sha256!==sha256||Number(done?.size)!==bytes.length)
          throw Error("target_verification_failed");
        const {error:writeErr}=await admin.from(ALLOW)
          .update({status:"VERIFIED",sha256,verified_at:new Date().toISOString()})
          .eq("object_path",path);
        if(writeErr) throw Error("source_status_write_failed");
        results.push({path,ok:true,size:bytes.length,sha256});
      } catch(e) {
        results.push({path,ok:false,error:String(e?.message||"transfer_failed").slice(0,80)});
      }
    }
    return reply(results.every(x=>x.ok)?200:207,{
      ok:results.every(x=>x.ok),total:results.length,
      passed:results.filter(x=>x.ok).length,results,
    });
  }catch {return reply(500,{ok:false,error:"migration_worker_failed"});}
});
