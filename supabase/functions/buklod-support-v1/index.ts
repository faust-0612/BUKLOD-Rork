import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// BUKLOD_SUPPORT_REQUIRES_VERIFY_JWT_FALSE
// Pre-login Help is a required public path. Deploy this function with verify_jwt=false;
// the handler validates optional user JWTs itself and never exposes the service key.
const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Content-Type":"application/json",
  "Cache-Control":"no-store",
};
const reply=(status:number,body:any)=>new Response(JSON.stringify(body),{status,headers:cors});
const clean=(v:any,max=240)=>String(v??"").trim().slice(0,max);
const lower=(v:any,max=240)=>clean(v,max).toLowerCase();

const CATEGORIES=new Set([
  "SIGN_IN","FORGOT_PASSWORD","ACCOUNT_LOCKED","RECOVERY_CODE",
  "APP_NOT_RESPONDING","OTHER_ACCOUNT","QUIZ","REPORT","CLASSROOM",
  "ORGANIZATION","REPORTED_CONTENT","TECHNICAL","FINANCIAL","OTHER"
]);

function queueFor(category:string,feature:string){
  const f=feature.toLowerCase();
  if(category==="QUIZ"||f.includes("quiz")) return "QUIZ_SUPPORT";
  if(category==="REPORT"||f.includes("report")) return "REPORT_SUPPORT";
  if(category==="CLASSROOM"||f.includes("classroom")) return "CLASSROOM_SUPPORT";
  if(category==="ORGANIZATION"||/organization|cluster|sub-org|suborg/.test(f)) return "COMMUNITY_OPERATIONS";
  if(category==="REPORTED_CONTENT"||/moderation|report|content/.test(f)) return "MODERATION";
  if(category==="FINANCIAL"||/finance|payout|earning|withdraw/.test(f)) return "FINANCE_ESCALATION";
  if(["SIGN_IN","FORGOT_PASSWORD","ACCOUNT_LOCKED","RECOVERY_CODE","OTHER_ACCOUNT"].includes(category)) return "ACCOUNT_SUPPORT";
  if(category==="TECHNICAL"||category==="APP_NOT_RESPONDING") return "OPERATIONS_ENGINEERING";
  return "GENERAL_SUPPORT";
}

function caseTitle(category:string){
  const labels:Record<string,string>={
    SIGN_IN:"Cannot sign in",
    FORGOT_PASSWORD:"Forgot password",
    ACCOUNT_LOCKED:"Account locked",
    RECOVERY_CODE:"Recovery code problem",
    APP_NOT_RESPONDING:"App does not respond",
    OTHER_ACCOUNT:"Other account problem",
    QUIZ:"Quiz support",
    REPORT:"BUKLOD Report support",
    CLASSROOM:"Classroom support",
    ORGANIZATION:"Organization / Cluster support",
    REPORTED_CONTENT:"Reported content",
    TECHNICAL:"Technical problem",
    FINANCIAL:"Financial inquiry",
    OTHER:"BUKLOD support request",
  };
  return labels[category]??labels.OTHER;
}

async function sha256(v:string){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));
  return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
function randomToken(){
  const bytes=new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b=>b.toString(16).padStart(2,"0")).join("");
}
function maskIdentifier(v:string){
  const s=v.trim();
  if(!s) return null;
  if(s.includes("@")){
    const [a,b]=s.split("@");
    return (a?.slice(0,2)||"")+(a&&a.length>2?"•••":"")+"@"+(b||"");
  }
  const digits=s.replace(/\D/g,"");
  if(digits.length>=10) return "••••••"+digits.slice(-4);
  return s.slice(0,2)+(s.length>2?"••••":"");
}

const TELEMETRY_EVENTS=new Set([
  "error_shown","error_category","recovery_offered","recovery_attempted",
  "recovery_success","support_opened_after_error","user_abandoned_after_error",
  "action_processing","action_success","action_failed",
  "self_heal_attempted","self_heal_success"
]);

function safeTelemetryMetadata(value:any){
  if(!value||typeof value!=="object"||Array.isArray(value)) return {};
  const out:Record<string,string|number|boolean|null>={};
  for(const [rawKey,rawValue] of Object.entries(value).slice(0,20)){
    const key=clean(rawKey,64);
    if(!key||/password|pin|otp|token|secret|credential|security.?answer|payment/i.test(key)) continue;
    if(rawValue===null||typeof rawValue==="number"||typeof rawValue==="boolean"){
      out[key]=rawValue as number|boolean|null;
    }else if(typeof rawValue==="string"){
      out[key]=clean(rawValue,240);
    }
  }
  return out;
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return reply(405,{ok:false,error:"method_not_allowed"});

  const url=Deno.env.get("SUPABASE_URL");
  const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!serviceKey) return reply(503,{ok:false,error:"support_unavailable",message:"BUKLOD Help is temporarily unavailable."});

  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  let body:any={};
  try{body=await req.json();}catch{return reply(400,{ok:false,error:"invalid_request"});}
  const action=clean(body?.action,40)||"resolve_or_case";

  const authHeader=clean(req.headers.get("authorization"),4096);
  let userId:string|null=null;
  if(authHeader.toLowerCase().startsWith("bearer ")){
    const token=authHeader.slice(7).trim();
    if(token){
      const {data}=await admin.auth.getUser(token).catch(()=>({data:{user:null}} as any));
      userId=data?.user?.id??null;
    }
  }

  const rawIp=clean(req.headers.get("cf-connecting-ip")||req.headers.get("x-real-ip")||req.headers.get("x-forwarded-for")?.split(",")[0]||"unknown",160);
  const keyedHash=(scope:string,value:string)=>sha256("buklod-support-v1:"+scope+":"+value+":"+serviceKey);
  const ipHash=await keyedHash("ip",rawIp||"unknown");

  if(action==="telemetry"){
    const event=clean(body?.event,64);
    if(!TELEMETRY_EVENTS.has(event)){
      return reply(400,{ok:false,error:"invalid_telemetry_event"});
    }

    const sinceMinute=new Date(Date.now()-60_000).toISOString();
    const {count:recentCount}=await admin.from("buklod_support_feedback_events")
      .select("id",{count:"exact",head:true})
      .eq("ip_hash",ipHash)
      .gte("occurred_at",sinceMinute);

    if(Number(recentCount??0)>=120){
      return reply(200,{ok:true,dropped:true,reason:"telemetry_rate_limited"});
    }

    const {error}=await admin.from("buklod_support_feedback_events").insert({
      user_id:userId,
      event_name:event,
      category:clean(body?.category,64)||null,
      support_code:clean(body?.support_code,40)||null,
      app:clean(body?.app,80)||"BUKLOD Main",
      app_version:clean(body?.app_version,40)||null,
      platform:clean(body?.platform,40)||null,
      route:clean(body?.route,240)||null,
      feature:clean(body?.feature,120)||null,
      outcome:clean(body?.outcome,80)||null,
      metadata:safeTelemetryMetadata(body?.metadata),
      ip_hash:ipHash,
    });

    if(error){
      console.error("buklod_support_telemetry_insert_failed",{code:(error as any)?.code??"unknown"});
      return reply(503,{ok:false,error:"telemetry_unavailable"});
    }

    return reply(200,{ok:true});
  }

  if(action==="health"){
    const [casesCheck,incidentsCheck]=await Promise.all([
      admin.from("buklod_support_cases").select("id",{count:"exact",head:true}).limit(1),
      admin.from("buklod_support_incidents").select("id",{count:"exact",head:true}).limit(1),
    ]);
    if(casesCheck.error||incidentsCheck.error){
      return reply(503,{
        ok:false,
        error:"support_backend_not_ready",
        service:"BUKLOD_SUPPORT_V1",
        schema:"BUKLOD_CENTRAL_SUPPORT_V1",
      });
    }
    return reply(200,{
      ok:true,
      service:"BUKLOD_SUPPORT_V1",
      schema:"BUKLOD_CENTRAL_SUPPORT_V1",
      prelogin:true,
    });
  }

  async function caseStatus(caseCode:string,accessToken:string){
    const code=clean(caseCode,32).toUpperCase();
    const {data,error}=await admin.from("buklod_support_cases")
      .select("id,case_code,user_id,status,queue_code,category,app,feature,title,incident_id,created_at,updated_at,resolved_at")
      .eq("case_code",code).maybeSingle();
    if(error||!data) return reply(404,{ok:false,error:"case_not_found"});

    let allowed=!!userId&&String(data.user_id||"")===userId;
    if(!allowed&&accessToken){
      const tokenHash=await keyedHash("case-token",accessToken);
      const {data:tokenRow}=await admin.from("buklod_support_cases")
        .select("id").eq("id",data.id).eq("public_access_token_hash",tokenHash).maybeSingle();
      allowed=!!tokenRow;
    }
    if(!allowed) return reply(403,{ok:false,error:"case_access_denied"});

    let incident:any=null;
    if(data.incident_id){
      const {data:i}=await admin.from("buklod_support_incidents")
        .select("incident_code,status,title,public_message").eq("id",data.incident_id).maybeSingle();
      incident=i??null;
    }
    const {data:updates}=await admin.from("buklod_support_case_updates")
      .select("message,update_type,created_at")
      .eq("case_id",data.id).eq("visibility","USER")
      .order("created_at",{ascending:false}).limit(10);

    return reply(200,{ok:true,case:{
      case_code:data.case_code,status:data.status,queue_code:data.queue_code,
      category:data.category,app:data.app,feature:data.feature,title:data.title,
      created_at:data.created_at,updated_at:data.updated_at,resolved_at:data.resolved_at,
      incident,updates:updates??[]
    }});
  }

  if(action==="case_status"){
    return caseStatus(clean(body?.case_code,32),clean(body?.access_token,128));
  }

  if(action==="list_my_cases"){
    if(!userId) return reply(401,{ok:false,error:"sign_in_required"});
    const {data,error}=await admin.from("buklod_support_cases")
      .select("case_code,status,queue_code,category,app,feature,title,created_at,updated_at,resolved_at")
      .eq("user_id",userId).order("created_at",{ascending:false}).limit(100);
    if(error) return reply(500,{ok:false,error:"support_read_failed"});
    return reply(200,{ok:true,cases:data??[]});
  }

  if(action!=="resolve_or_case"){
    return reply(400,{ok:false,error:"unknown_action"});
  }

  const category=clean(body?.category,40).toUpperCase();
  if(!CATEGORIES.has(category)) return reply(400,{ok:false,error:"invalid_category"});

  const identifier=clean(body?.identifier,320);
  const app=clean(body?.app,80)||"BUKLOD Main";
  const feature=clean(body?.feature,120);
  const platform=clean(body?.platform,40);
  const osVersion=clean(body?.os_version,80);
  const appVersion=clean(body?.app_version,40);
  const route=clean(body?.route,240);
  const errorCode=clean(body?.error_code,120);
  const languageCode=clean(body?.language_code,24)||"en";
  const message=clean(body?.message,4000);
  const requestId=clean(body?.request_id,120);
  const networkSummary=
    body?.network_summary&&typeof body.network_summary==="object"
      ? body.network_summary
      : {};

  if(category==="FORGOT_PASSWORD"){
    return reply(200,{
      ok:true,
      outcome:"SELF_SERVICE",
      next_route:"/(auth)/forgot-password",
      message:"Use BUKLOD password recovery. No support case is needed unless recovery itself fails."
    });
  }

  let linkedUserId=userId;
  let accountState="UNKNOWN";
  let lastSuccessfulLogin:string|null=null;
  let recentRecoveryAttempts=0;
  let identifierHash:string|null=null;
  let identifierHint:string|null=null;

  if(identifier){
    identifierHash=await keyedHash("identifier",lower(identifier,320));
    identifierHint=maskIdentifier(identifier);
  }

  if(!linkedUserId&&identifier){
    const {data:candidates}=await admin.rpc("buklod_auth_candidates_for_service_v2",{p_identifier:identifier});
    if(Array.isArray(candidates)&&candidates.length===1&&candidates[0]?.user_id){
      linkedUserId=String(candidates[0].user_id);
      accountState="MATCHED";
    }else if(Array.isArray(candidates)&&candidates.length>1){
      accountState="AMBIGUOUS";
    }else{
      accountState="NO_ACTIVE_MATCH";
    }
  }else if(linkedUserId){
    accountState="AUTHENTICATED";
  }

  if(linkedUserId){
    try{
      const {data:authUser}=await admin.auth.admin.getUserById(linkedUserId);
      lastSuccessfulLogin=authUser?.user?.last_sign_in_at??null;
    }catch{}
    const since24=new Date(Date.now()-24*60*60_000).toISOString();
    const {count}=await admin.from("buklod_account_recovery_events")
      .select("id",{count:"exact",head:true})
      .eq("user_id",linkedUserId).gte("created_at",since24);
    recentRecoveryAttempts=Number(count??0);
  }

  const fingerprint=await sha256([
    app.toLowerCase(),feature.toLowerCase(),category,platform.toLowerCase(),errorCode.toLowerCase()
  ].join("|"));

  const {data:incidentRows}=await admin.from("buklod_support_incidents")
    .select("id,incident_code,status,title,public_message,affected_users")
    .eq("fingerprint",fingerprint)
    .neq("status","RESOLVED")
    .order("opened_at",{ascending:false}).limit(1);
  const knownIncident=incidentRows?.[0]??null;

  async function subscribeIncident(incident:any){
    const subject=linkedUserId
      ? await keyedHash("user",linkedUserId)
      : identifierHash||ipHash;
    await admin.from("buklod_support_incident_subscribers").upsert({
      incident_id:incident.id,user_id:linkedUserId,subject_hash:subject,
      language_code:languageCode,notify_when_resolved:true
    },{onConflict:"incident_id,subject_hash"});
    const [{count:subCount},{count:caseCount}]=await Promise.all([
      admin.from("buklod_support_incident_subscribers").select("id",{count:"exact",head:true}).eq("incident_id",incident.id),
      admin.from("buklod_support_cases").select("id",{count:"exact",head:true}).eq("incident_id",incident.id),
    ]);
    await admin.from("buklod_support_incidents").update({
      affected_users:Number(subCount??0)+Number(caseCount??0),updated_at:new Date().toISOString()
    }).eq("id",incident.id);
  }

  if(knownIncident){
    await subscribeIncident(knownIncident);
    return reply(200,{
      ok:true,outcome:"KNOWN_INCIDENT",
      incident:{
        incident_code:knownIncident.incident_code,
        status:knownIncident.status,
        title:knownIncident.title,
        message:knownIncident.public_message,
      },
      notify_when_fixed:true
    });
  }

  const since15=new Date(Date.now()-15*60_000).toISOString();
  const {count:ipCount}=await admin.from("buklod_support_cases")
    .select("id",{count:"exact",head:true}).eq("ip_hash",ipHash).gte("created_at",since15);
  if(Number(ipCount??0)>=12) return reply(429,{ok:false,error:"too_many_support_requests",message:"Too many recent support requests. Please try again later."});
  if(identifierHash){
    const {count:idCount}=await admin.from("buklod_support_cases")
      .select("id",{count:"exact",head:true}).eq("identifier_hash",identifierHash).gte("created_at",since15);
    if(Number(idCount??0)>=4) return reply(429,{ok:false,error:"too_many_support_requests",message:"Too many recent support requests for this account. Please try again later."});
  }

  const accessToken=randomToken();
  const accessTokenHash=await keyedHash("case-token",accessToken);
  const queueCode=queueFor(category,feature);

  if(requestId){
    const {data:existing}=await admin.from("buklod_support_cases")
      .select("id,case_code,status,queue_code,created_at,incident_id")
      .eq("request_id",requestId).maybeSingle();
    if(existing){
      await admin.from("buklod_support_cases")
        .update({public_access_token_hash:accessTokenHash,updated_at:new Date().toISOString()})
        .eq("id",existing.id);
      return reply(200,{
        ok:true,
        outcome:"CASE_CREATED",
        case:{
          case_code:existing.case_code,
          status:existing.status,
          queue_code:existing.queue_code,
          created_at:existing.created_at,
          access_token:accessToken,
        },
        recovered_idempotently:true
      });
    }
  }
  const diagnostics={
    source:"BUKLOD_HELP_V1",
    account_state:accountState,
    last_successful_login:lastSuccessfulLogin,
    recent_recovery_attempts_24h:recentRecoveryAttempts,
    known_incident_match:false,
    client:body?.diagnostics&&typeof body.diagnostics==="object"?body.diagnostics:{},
  };

  const {data:created,error:createError}=await admin.from("buklod_support_cases").insert({
    source_type:"BUKLOD_HELP",
    request_id:requestId||null,
    user_id:linkedUserId,
    identifier_hash:identifierHash,
    identifier_hint:identifierHint,
    public_access_token_hash:accessTokenHash,
    status:"OPEN",
    queue_code:queueCode,
    category,
    app,
    feature:feature||null,
    title:caseTitle(category),
    message,
    platform:platform||null,
    os_version:osVersion||null,
    app_version:appVersion||null,
    route:route||null,
    error_code:errorCode||null,
    language_code:languageCode,
    network_summary:networkSummary,
    diagnostics,
    fingerprint,
    ip_hash:ipHash,
  }).select("id,case_code,status,queue_code,created_at").single();

  if(createError||!created){
    console.error("buklod_support_case_create_failed",{code:(createError as any)?.code??"unknown"});
    return reply(500,{ok:false,error:"case_creation_failed",message:"Support case could not be created. Please try again."});
  }

  const since30=new Date(Date.now()-30*60_000).toISOString();
  const {count:similarCount}=await admin.from("buklod_support_cases")
    .select("id",{count:"exact",head:true})
    .eq("fingerprint",fingerprint).neq("status","RESOLVED").gte("created_at",since30);

  let linkedIncident:any=null;
  if(Number(similarCount??0)>=5){
    const incidentInsert=await admin.from("buklod_support_incidents").insert({
      fingerprint,app,feature:feature||null,category,
      platform_scope:platform||null,error_code:errorCode||null,
      status:"POSSIBLE_SHARED_INCIDENT",severity:"P2",
      title:"Possible shared incident: "+caseTitle(category),
      public_message:"BUKLOD detected several similar reports. The issue is being investigated.",
      internal_summary:"Automatically correlated from repeated support case fingerprint."
    }).select("id,incident_code,status,title,public_message").maybeSingle();

    if(incidentInsert.data){
      linkedIncident=incidentInsert.data;
    }else{
      const {data:existing}=await admin.from("buklod_support_incidents")
        .select("id,incident_code,status,title,public_message")
        .eq("fingerprint",fingerprint).neq("status","RESOLVED").maybeSingle();
      linkedIncident=existing??null;
    }

    if(linkedIncident){
      await admin.from("buklod_support_cases")
        .update({incident_id:linkedIncident.id,updated_at:new Date().toISOString()})
        .eq("fingerprint",fingerprint).is("incident_id",null).neq("status","RESOLVED");
      await subscribeIncident(linkedIncident);
    }
  }

  return reply(200,{
    ok:true,
    outcome:"CASE_CREATED",
    case:{
      case_code:created.case_code,
      status:created.status,
      queue_code:created.queue_code,
      created_at:created.created_at,
      access_token:accessToken,
    },
    incident:linkedIncident?{
      incident_code:linkedIncident.incident_code,
      status:linkedIncident.status,
      title:linkedIncident.title,
      message:linkedIncident.public_message,
    }:null
  });
});
