import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// BUKLOD_SUPPORT_REQUIRES_VERIFY_JWT_FALSE
// Pre-login Help is public. This compatibility implementation writes into the
// existing user_feedback / BSOC operations pipeline instead of creating a
// competing support store.
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
  "APP_NOT_RESPONDING","OTHER_ACCOUNT","QUIZ","CLASSROOM",
  "ORGANIZATION","REPORTED_CONTENT","TECHNICAL","FINANCIAL","OTHER"
]);
const ERROR_CATEGORIES=new Set([
  "VALIDATION_ERROR","AUTH_ERROR","PERMISSION_ERROR","NETWORK_ERROR",
  "TIMEOUT_ERROR","CONFLICT_ERROR","NOT_FOUND","RATE_LIMIT",
  "SERVICE_UNAVAILABLE","RECOVERY_REQUIRED","KNOWN_INCIDENT","UNKNOWN_ERROR"
]);
const TELEMETRY_EVENT_MAP:Record<string,string|null>={
  error_shown:"error_shown",
  error_category:"error_shown",
  recovery_offered:"recovery_offered",
  recovery_attempted:"recovery_attempted",
  recovery_success:"recovery_success",
  support_opened_after_error:"support_opened_after_error",
  user_abandoned_after_error:"user_abandoned_after_error",
  action_processing:null,
  action_success:"safe_recovery_action",
  action_failed:"recovery_failed",
  self_heal_attempted:"recovery_attempted",
  self_heal_success:"recovery_success",
};

function queueFor(category:string,feature:string){
  const f=feature.toLowerCase();
  if(category==="QUIZ"||f.includes("quiz")) return "QUIZ_SUPPORT";
  if(category==="CLASSROOM"||f.includes("classroom")) return "CLASSROOM_SUPPORT";
  if(category==="ORGANIZATION"||/organization|cluster|sub-org|suborg/.test(f)) return "COMMUNITY_OPERATIONS";
  if(category==="REPORTED_CONTENT"||/moderation|report|content/.test(f)) return "MODERATION";
  if(category==="FINANCIAL"||/finance|payout|earning|withdraw/.test(f)) return "FINANCE_ESCALATION";
  if(["SIGN_IN","FORGOT_PASSWORD","ACCOUNT_LOCKED","RECOVERY_CODE","OTHER_ACCOUNT"].includes(category)) return "ACCOUNT_SUPPORT";
  if(category==="TECHNICAL"||category==="APP_NOT_RESPONDING") return "OPERATIONS_ENGINEERING";
  return "GENERAL_SUPPORT";
}
function feedbackCategoryFor(category:string){
  if(category==="REPORTED_CONTENT") return "content";
  if(category==="ORGANIZATION") return "usability";
  if(["APP_NOT_RESPONDING","QUIZ","CLASSROOM","TECHNICAL"].includes(category)) return "bug";
  return "other";
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
    CLASSROOM:"Classroom support",
    ORGANIZATION:"Organization / Cluster support",
    REPORTED_CONTENT:"Reported content",
    TECHNICAL:"Technical problem",
    FINANCIAL:"Financial inquiry",
    OTHER:"BUKLOD support request",
  };
  return labels[category]??labels.OTHER;
}
function publicStatus(status:string){
  const s=lower(status,40);
  if(s==="triaged"||s==="in_progress") return "BEING_REVIEWED";
  if(s==="resolved"||s==="closed") return "RESOLVED";
  return "OPEN";
}
function caseCodeFromId(id:string){
  return "BUK-"+id.replace(/-/g,"").slice(0,8).toUpperCase();
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
    return (a?.slice(0,2)||"")+(a&&a.length>2?"***":"")+"@"+(b||"");
  }
  const digits=s.replace(/\D/g,"");
  if(digits.length>=10) return "******"+digits.slice(-4);
  return s.slice(0,2)+(s.length>2?"****":"");
}
function safeClientDiagnostics(value:any){
  if(!value||typeof value!=="object"||Array.isArray(value)) return {};
  const out:Record<string,string|number|boolean|null>={};
  for(const [rawKey,rawValue] of Object.entries(value).slice(0,20)){
    const key=clean(rawKey,64);
    if(!key||/password|pin|otp|token|secret|credential|security.?answer|payment|title|body|text|note|image|asset|list|content|extract/i.test(key)) continue;
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
  if(!url||!serviceKey){
    return reply(503,{ok:false,error:"support_unavailable",message:"BUKLOD Help is temporarily unavailable."});
  }

  const adminFetch=(input:RequestInfo|URL,init?:RequestInit)=>{
    const headers=new Headers(init?.headers);
    const auth=headers.get("authorization")||"";
    if(serviceKey.startsWith("sb_secret_")&&auth===`Bearer ${serviceKey}`){
      headers.delete("authorization");
    }
    return fetch(input,{...init,headers});
  };
  const admin=createClient(url,serviceKey,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:adminFetch},
  });
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

  const rawIp=clean(
    req.headers.get("cf-connecting-ip")||
    req.headers.get("x-real-ip")||
    req.headers.get("x-forwarded-for")?.split(",")[0]||
    "unknown",
    160
  );
  const keyedHash=(scope:string,value:string)=>sha256("buklod-support-v1:"+scope+":"+value+":"+serviceKey);
  const ipHash=await keyedHash("ip",rawIp||"unknown");

  if(action==="telemetry"){
    const requested=clean(body?.event,64);
    const eventType=TELEMETRY_EVENT_MAP[requested];
    if(requested && !(requested in TELEMETRY_EVENT_MAP)){
      return reply(400,{ok:false,error:"invalid_telemetry_event"});
    }
    if(!eventType){
      return reply(200,{ok:true,dropped:true,reason:"non_blocking_telemetry_not_persisted"});
    }

    const rawCategory=clean(body?.category,64).toUpperCase();
    const errorCategory=ERROR_CATEGORIES.has(rawCategory)?rawCategory:null;
    const supportCode=clean(body?.support_code,40).toUpperCase()||null;

    const {error}=await admin.from("bsoc_feedback_events").insert({
      user_id:userId,
      support_code:supportCode,
      event_type:eventType,
      error_category:errorCategory,
      app_id:clean(body?.app,80)||"BUKLOD Main",
      app_version:clean(body?.app_version,80)||null,
      build:null,
      platform:clean(body?.platform,80)||null,
      route:clean(body?.route,240)||null,
      recovery_attempted:/attempted|processing/.test(requested)?true:null,
      recovery_success:/success/.test(requested)?true:null,
      support_case_id:null,
      incident_id:null,
    });

    if(error){
      console.error("buklod_support_telemetry_insert_failed",{code:(error as any)?.code??"unknown"});
      return reply(503,{ok:false,error:"telemetry_unavailable"});
    }
    return reply(200,{ok:true});
  }

  if(action==="health"){
    const [feedbackCheck,eventCheck]=await Promise.all([
      admin.from("user_feedback").select("id",{count:"exact",head:true}).limit(1),
      admin.from("bsoc_feedback_events").select("id",{count:"exact",head:true}).limit(1),
    ]);
    if(feedbackCheck.error||eventCheck.error){
      return reply(503,{
        ok:false,
        error:"support_backend_not_ready",
        service:"BUKLOD_SUPPORT_V1",
        schema:"BSOC_USER_FEEDBACK_COMPAT_V1",
      });
    }
    return reply(200,{
      ok:true,
      service:"BUKLOD_SUPPORT_V1",
      schema:"BSOC_USER_FEEDBACK_COMPAT_V1",
      prelogin:true,
      bsoc_queue:"buklod_bsoc_support_queue_v1",
    });
  }

  async function summaryFromRow(row:any){
    const diagnostics=row?.diagnostics&&typeof row.diagnostics==="object"?row.diagnostics:{};
    const resolution=clean(row?.resolution,1000);
    return {
      case_code:clean(diagnostics.support_case_code,32)||caseCodeFromId(String(row.id||"")),
      status:publicStatus(row.status),
      queue_code:clean(diagnostics.support_queue,80)||"GENERAL_SUPPORT",
      category:clean(diagnostics.support_category,80)||String(row.category||"other"),
      app:clean(diagnostics.app,80)||"BUKLOD Main",
      feature:clean(diagnostics.feature,120)||null,
      title:String(row.title||"BUKLOD support request"),
      created_at:row.created_at??null,
      updated_at:row.updated_at??null,
      resolved_at:row.resolved_at??null,
      incident:null,
      updates:resolution?[{message:resolution,update_type:"RESOLUTION",created_at:row.resolved_at??row.updated_at??null}]:[],
    };
  }

  async function caseStatus(caseCode:string,accessToken:string){
    const code=clean(caseCode,32).toUpperCase();
    if(!code) return reply(400,{ok:false,error:"case_code_required"});

    const {data,error}=await admin.from("user_feedback")
      .select("id,user_id,category,title,status,app_version,diagnostics,resolution,created_at,updated_at,resolved_at")
      .eq("diagnostics->>support_case_code",code)
      .maybeSingle();
    if(error||!data) return reply(404,{ok:false,error:"case_not_found"});

    let allowed=!!userId&&String(data.user_id||"")===userId;
    if(!allowed&&accessToken){
      const tokenHash=await keyedHash("case-token",accessToken);
      allowed=clean(data.diagnostics?.public_access_token_hash,128)===tokenHash;
    }
    if(!allowed) return reply(403,{ok:false,error:"case_access_denied"});

    return reply(200,{ok:true,case:await summaryFromRow(data)});
  }

  if(action==="case_status"){
    return caseStatus(clean(body?.case_code,32),clean(body?.access_token,128));
  }

  if(action==="list_my_cases"){
    if(!userId) return reply(401,{ok:false,error:"sign_in_required"});
    const {data,error}=await admin.from("user_feedback")
      .select("id,user_id,category,title,status,app_version,diagnostics,resolution,created_at,updated_at,resolved_at")
      .eq("user_id",userId)
      .eq("diagnostics->>support_source","BUKLOD_HELP_V1")
      .order("created_at",{ascending:false})
      .limit(100);
    if(error) return reply(500,{ok:false,error:"support_read_failed"});
    const cases=[];
    for(const row of data??[]) cases.push(await summaryFromRow(row));
    return reply(200,{ok:true,cases});
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
  const errorCode=clean(body?.error_code,120).toUpperCase();
  const languageCode=clean(body?.language_code,24)||"en";
  const message=clean(body?.message,4000);
  const requestId=clean(body?.request_id,120);
  const networkSummary=
    body?.network_summary&&typeof body.network_summary==="object"
      ? safeClientDiagnostics(body.network_summary)
      : {};

  if(category==="FORGOT_PASSWORD"){
    return reply(200,{
      ok:true,
      outcome:"SELF_SERVICE",
      next_route:"/(auth)/forgot-password",
      message:"Use BUKLOD password recovery. No support case is needed unless recovery itself fails.",
    });
  }

  let linkedUserId=userId;
  let accountState="UNKNOWN";
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

  if(errorCode){
    const {data:known}=await admin.from("bsoc_known_incidents_v1")
      .select("id,status,title,description,operator_message,support_code")
      .eq("support_code",errorCode)
      .neq("status","closed")
      .order("updated_at",{ascending:false})
      .limit(1)
      .maybeSingle();
    if(known){
      return reply(200,{
        ok:true,
        outcome:"KNOWN_INCIDENT",
        incident:{
          incident_code:String(known.id||""),
          status:String(known.status||"investigating").toUpperCase(),
          title:String(known.title||"Known BUKLOD incident"),
          message:String(known.operator_message||known.description||"BUKLOD is already working on this issue."),
        },
      });
    }
  }

  const since15=new Date(Date.now()-15*60_000).toISOString();
  const {count:ipCount}=await admin.from("user_feedback")
    .select("id",{count:"exact",head:true})
    .eq("diagnostics->>support_ip_hash",ipHash)
    .gte("created_at",since15);
  if(Number(ipCount??0)>=12){
    return reply(429,{ok:false,error:"too_many_support_requests",message:"Too many recent support requests. Please try again later."});
  }

  if(identifierHash){
    const {count:idCount}=await admin.from("user_feedback")
      .select("id",{count:"exact",head:true})
      .eq("diagnostics->>support_identifier_hash",identifierHash)
      .gte("created_at",since15);
    if(Number(idCount??0)>=4){
      return reply(429,{ok:false,error:"too_many_support_requests",message:"Too many recent support requests for this account. Please try again later."});
    }
  }

  const accessToken=randomToken();
  const accessTokenHash=await keyedHash("case-token",accessToken);
  const queueCode=queueFor(category,feature);

  if(requestId){
    const {data:existing}=await admin.from("user_feedback")
      .select("id,user_id,category,title,status,app_version,diagnostics,resolution,created_at,updated_at,resolved_at")
      .eq("diagnostics->>support_request_id",requestId)
      .maybeSingle();
    if(existing){
      const existingDiagnostics={
        ...(existing.diagnostics&&typeof existing.diagnostics==="object"?existing.diagnostics:{}),
        public_access_token_hash:accessTokenHash,
      };
      await admin.from("user_feedback")
        .update({diagnostics:existingDiagnostics,updated_at:new Date().toISOString()})
        .eq("id",existing.id);
      return reply(200,{
        ok:true,
        outcome:"CASE_CREATED",
        case:{...(await summaryFromRow({...existing,diagnostics:existingDiagnostics})),access_token:accessToken},
        recovered_idempotently:true,
      });
    }
  }

  const caseId=crypto.randomUUID();
  const caseCode=caseCodeFromId(caseId);
  const diagnostics={
    support_source:"BUKLOD_HELP_V1",
    support_case_code:caseCode,
    support_request_id:requestId||null,
    support_queue:queueCode,
    support_category:category,
    support_identifier_hash:identifierHash,
    support_identifier_hint:identifierHint,
    support_ip_hash:ipHash,
    public_access_token_hash:accessTokenHash,
    account_state:accountState,
    app,
    feature:feature||null,
    route:route||null,
    error_code:errorCode||null,
    platform:platform||null,
    os_version:osVersion||null,
    language_code:languageCode,
    network_summary:networkSummary,
    client:safeClientDiagnostics(body?.diagnostics),
  };

  const {data:created,error:createError}=await admin.from("user_feedback").insert({
    id:caseId,
    user_id:linkedUserId,
    church_id:null,
    group_id:null,
    category:feedbackCategoryFor(category),
    title:caseTitle(category),
    message:message||caseTitle(category),
    status:"new",
    app_version:appVersion||null,
    app_environment:"production",
    diagnostics,
  }).select("id,user_id,category,title,status,app_version,diagnostics,resolution,created_at,updated_at,resolved_at").single();

  if(createError||!created){
    console.error("buklod_support_case_create_failed",{code:(createError as any)?.code??"unknown"});
    return reply(500,{ok:false,error:"case_creation_failed",message:"Support case could not be created. Please try again."});
  }

  await admin.from("bsoc_feedback_events").insert({
    user_id:linkedUserId,
    support_code:errorCode||null,
    event_type:"error_to_ticket",
    error_category:null,
    app_id:app,
    app_version:appVersion||null,
    build:null,
    platform:platform||null,
    route:route||null,
    recovery_attempted:null,
    recovery_success:null,
    support_case_id:caseId,
    incident_id:null,
  }).then(()=>undefined).catch(()=>undefined);

  return reply(200,{
    ok:true,
    outcome:"CASE_CREATED",
    case:{...(await summaryFromRow(created)),access_token:accessToken},
    incident:null,
  });
});
