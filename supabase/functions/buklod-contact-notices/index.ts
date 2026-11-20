// Privacy-safe BUKLOD Main notice sender; NEVER marks notices as delivered.
// No Trello dependency. Resend email or an explicitly configured Twilio SMS
// Messaging provider; Twilio Verify alone is for OTP, NOT arbitrary SMS.
// Opt-in feature flag and a separate privileged scheduler/admin caller required.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.2';
const cors={
 'Access-Control-Allow-Origin':'*',
 'Access-Control-Allow-Headers':'authorization,x-buklod-scheduler-key,x-client-info,apikey,content-type',
 'Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store',
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
 status,headers:{...cors,'Content-Type':'application/json'},
});
const get=(name:string)=>Deno.env.get(name)||'';

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({ok:false,message:'POST only'},405);
 if(get('BUKLOD_CONTACT_NOTICE_DELIVERY_ENABLED')!=='true')
  return json({ok:false,enabled:false,message:'External notices are disabled'},503);
 const url=get('SUPABASE_URL'),service=get('SUPABASE_SERVICE_ROLE_KEY');
 const anon=get('SUPABASE_ANON_KEY')||get('SUPABASE_PUBLISHABLE_KEY');
 if(!url||!service||!anon)return json({ok:false,message:'Service configuration unavailable'},503);
 const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const jobSecret=get('BUKLOD_CONTACT_NOTICE_SCHEDULER_SECRET');
 const suppliedSecret=req.headers.get('x-buklod-scheduler-key')||'';
 let authorized=!!jobSecret&&jobSecret.length>=32&&suppliedSecret===jobSecret;
 if(!authorized){
  const bearer=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim();
  if(!bearer)return json({ok:false,message:'System Admin session required'},401);
  const {data:auth,error:authError}=await admin.auth.getUser(bearer);
  if(authError||!auth?.user)return json({ok:false,message:'Invalid session'},401);
  const caller=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false},
    global:{headers:{Authorization:'Bearer '+bearer}}});
  const {data:isAdmin,error:gateError}=await caller.rpc('is_system_admin');
  if(gateError||isAdmin!==true)return json({ok:false,message:'System Admin required'},403);
  authorized=true;
 }
 if(!authorized)return json({ok:false,message:'Unauthorized'},403);

 const emailReady=!!(get('RESEND_API_KEY')&&get('RECOVERY_FROM_EMAIL'));
 const smsReady=!!(get('TWILIO_ACCOUNT_SID')&&get('TWILIO_AUTH_TOKEN')&&
   (get('TWILIO_MESSAGING_SERVICE_SID')||get('TWILIO_FROM_NUMBER')));
 if(!emailReady&&!smsReady)return json({
  ok:false,message:'Neither email nor SMS notice delivery is configured'},503);

 let body:any={};
 try{body=await req.json();}catch{body={};}
 const limit=Math.min(25,Math.max(1,Math.trunc(Number(body.limit)||25)));
 const {data:batch,error:batchError}=await admin.rpc('buklod_claim_external_contact_notices_v1',{
  p_limit:limit,p_allow_email:emailReady,p_allow_sms:smsReady,
 });
 if(batchError)return json({ok:false,message:'Could not claim notification queue'},503);
 if(!batch?.enabled)return json({ok:true,enabled:false,claimed:0,accepted:0,failed:0});

 const rows=Array.isArray(batch.rows)?batch.rows:[];
 let accepted=0,failed=0;
 // Serial sends keep provider bursts and costs bounded.
 for(const row of rows){
  let sent=false;
  let providerId:string|null=null;
  try{
   if(row.channel==='email'){
    const subject=row.campaign==='DORMANCY_REVIEW'
     ?'BUKLOD account protection notice'
     :'BUKLOD login update — action needed';
    const message=row.campaign==='DORMANCY_REVIEW'
     ?'BUKLOD is reviewing accounts that may be inactive. Sign in or contact official BUKLOD Support to protect access. A new login method and verified contact may be required. No account is deleted just because this notice was sent.'
     :'BUKLOD now supports mobile-number or email login for new accounts. If you have an older username-only login, sign in through Legacy Username Recovery and verify your email or mobile in Account Security. Your records, posts and points are not deleted.';
    const response=await fetch('https://api.resend.com/emails',{
     method:'POST',
     headers:{Authorization:'Bearer '+get('RESEND_API_KEY'),'Content-Type':'application/json'},
     body:JSON.stringify({from:get('RECOVERY_FROM_EMAIL'),to:[row.recipient],
       subject,text:message}),
     signal:AbortSignal.timeout(9000),
    });
    sent=response.ok;
    if(sent){
     const result=await response.json().catch(()=>({}));
     providerId=typeof result?.id==='string'?result.id:null;
    }
   }else if(row.channel==='sms'){
    const sid=get('TWILIO_ACCOUNT_SID');
    const message=row.campaign==='DORMANCY_REVIEW'
     ?'BUKLOD account security: please sign in or contact official support regarding an inactive-account review. No deletion has occurred.'
     :'BUKLOD: Username login is being retired. Sign in via Legacy Username Recovery and update to verified mobile/email in Account Security. Your account is preserved.';
    const params=new URLSearchParams({To:row.recipient,Body:message});
    if(get('TWILIO_MESSAGING_SERVICE_SID'))params.set('MessagingServiceSid',get('TWILIO_MESSAGING_SERVICE_SID'));
    else params.set('From',get('TWILIO_FROM_NUMBER'));
    const response=await fetch('https://api.twilio.com/2010-04-01/Accounts/'+encodeURIComponent(sid)+'/Messages.json',{
     method:'POST',
     headers:{Authorization:'Basic '+btoa(sid+':'+get('TWILIO_AUTH_TOKEN')),
       'Content-Type':'application/x-www-form-urlencoded'},
     body:params,signal:AbortSignal.timeout(9000),
    });
    sent=response.ok;
    if(sent){
     const result=await response.json().catch(()=>({}));
     providerId=typeof result?.sid==='string'?result.sid:null;
    }
   }
  }catch{sent=false;}
  const {error:markError}=await admin.rpc('buklod_finish_external_contact_notice_v1',{
   p_id:row.id,p_accepted:sent,p_provider_id:providerId,
  });
  if(markError){
   // Fail closed for this run: do not issue more sends without durable audit.
   return json({ok:false,claimed:rows.length,accepted,failed,
     message:'Provider request finished but the audit write failed. Manual reconciliation required.'},503);
  }
  if(sent)accepted++;else failed++;
 }
 return json({ok:true,enabled:true,claimed:rows.length,providerAccepted:accepted,failed,
   deliveryVerified:0,noticeClockStarted:0});
});
