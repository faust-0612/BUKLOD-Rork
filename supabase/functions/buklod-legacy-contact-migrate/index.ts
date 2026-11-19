// BUKLOD MAIN only. Opt-in legacy username login migration.
// Verify password + fresh destination OTP before changing the EXISTING Auth user.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,x-client-info,apikey,content-type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Cache-Control': 'no-store',
};
const json = (value: unknown, status=200) => new Response(JSON.stringify(value), {
  status, headers: {...cors,'Content-Type':'application/json'},
});
const clean = (v: unknown) => String(v ?? '').trim();
const validEmail = (v: string) =>
  v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) &&
  !v.toLowerCase().endsWith('@buklod.invalid');
const mobile = (v: string) => {
  const s = v.replace(/[^\d+]/g,'');
  if (/^\+639\d{9}$/.test(s)) return s;
  if (/^639\d{9}$/.test(s)) return '+' + s;
  if (/^09\d{9}$/.test(s)) return '+63' + s.slice(1);
  return null;
};
function sixDigit() {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return String(b[0] % 1_000_000).padStart(6,'0');
}
async function digest(v: string) {
  const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));
  return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
}
const after = (s: string) => Number.isFinite(Date.parse(s)) && Date.parse(s)>Date.now();
function masked(v: string, channel: 'email'|'mobile') {
  if (channel==='email') return v.replace(/^(.{1,2}).*(@[^@]+)$/,'$1•••$2');
  return '+63 ••• ••• ' + v.slice(-4);
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  if(req.method!=='POST') return json({ok:false,message:'POST only'},405);
  const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim();
  if(!token||token.length>5000) return json({ok:false,message:'Sign in required'},401);
  const url=Deno.env.get('SUPABASE_URL')||'';
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  const anon=Deno.env.get('SUPABASE_ANON_KEY')||Deno.env.get('SUPABASE_PUBLISHABLE_KEY')||'';
  if(!url||!key||!anon) return json({ok:false,message:'Migration service unavailable'},503);
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:who,error:authError}=await admin.auth.getUser(token);
  const user=who?.user;
  if(authError||!user) return json({ok:false,message:'Session expired; please sign in again'},401);
  let body: Record<string,unknown>={};
  try {body=await req.json();}catch{return json({ok:false,message:'Invalid request'},400);}
  const action=clean(body.action);
  const {data:profile,error:profileError}=await admin.from('profiles')
    .select('id,login_method,login_identifier,is_active')
    .eq('id',user.id).maybeSingle();
  if(profileError||!profile) return json({ok:false,message:'Account profile unavailable'},503);
  if(profile.is_active===false) return json({ok:false,message:'Account inactive; contact BUKLOD support'},403);
  const needsMigration=profile.login_method==='username';
  const mailReady=!!(Deno.env.get('RESEND_API_KEY')&&Deno.env.get('RECOVERY_FROM_EMAIL'));
  const smsReady=!!(Deno.env.get('TWILIO_ACCOUNT_SID')&&Deno.env.get('TWILIO_AUTH_TOKEN')
    &&Deno.env.get('TWILIO_VERIFY_SERVICE_SID'));
  if(action==='status') return json({ok:true,needsMigration,emailReady:mailReady,smsReady,
    verificationRequired:true,unchangedUserId:true});
  if(!needsMigration) return json({ok:true,alreadyMigrated:true,message:'Email/mobile login already active'});
  if(!['request','verify','finalize'].includes(action))
    return json({ok:false,message:'Unknown action'},400);

  const query=admin.from('buklod_login_contact_challenges_v1');
  async function currentClaim() {
    const {data,error}=await admin.from('buklod_login_contact_challenges_v1')
      .select('id,channel,destination,otp_hash,attempts,status,expires_at,created_at')
      .eq('user_id',user!.id).in('status',['PENDING','VERIFIED'])
      .order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(error) throw error;
    return data;
  }
  async function sendEmail(to:string,code:string) {
    const response=await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{Authorization:'Bearer '+Deno.env.get('RESEND_API_KEY'),'Content-Type':'application/json'},
      body:JSON.stringify({
        from:Deno.env.get('RECOVERY_FROM_EMAIL'),to:[to],
        subject:'BUKLOD — verify your new login email',
        text:'Your BUKLOD login migration verification code is '+code+
          '. It expires in 10 minutes. Never share this code. Ignore if you did not request it.',
      }),
      signal:AbortSignal.timeout(9000),
    });
    // A 2xx means provider acceptance, NOT recipient delivery.
    return response.ok;
  }
  async function twilio(to:string,code?:string) {
    const sid=Deno.env.get('TWILIO_ACCOUNT_SID')!;
    const secret=Deno.env.get('TWILIO_AUTH_TOKEN')!;
    const service=Deno.env.get('TWILIO_VERIFY_SERVICE_SID')!;
    const check=typeof code==='string';
    const endpoint=check?'VerificationCheck':'Verifications';
    const args=check?{To:to,Code:code}:{To:to,Channel:'sms'};
    const response=await fetch('https://verify.twilio.com/v2/Services/'+encodeURIComponent(service)+'/'+endpoint,{
      method:'POST',
      headers:{Authorization:'Basic '+btoa(sid+':'+secret),
        'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams(args),
      signal:AbortSignal.timeout(9000),
    });
    if(!response.ok)return false;
    if(!check)return true;
    const data=await response.json().catch(()=>({}));
    return data?.status==='approved';
  }
  async function finalize(claim: any) {
    if(!claim||claim.status!=='VERIFIED')return json({ok:false,message:'Verify the code first'},403);
    const channel=claim.channel as 'email'|'mobile';
    const targetEmail=channel==='email'
      ?claim.destination
      :'m.'+claim.destination.replace(/\D/g,'')+'@buklod.invalid';
    if(!after(claim.expires_at))return json({ok:false,message:'Code expired; request a new code'},410);
    try {
      const {data:latest,error:latestError}=await admin.auth.admin.getUserById(user!.id);
      if(latestError||!latest?.user)return json({ok:false,message:'Account unavailable'},503);
      if(latest.user.email?.toLowerCase()!==targetEmail.toLowerCase()) {
        // Auth enforces uniqueness of real and internal login email.
        // The fresh OTP was verified by the destination provider above.
        const {error:changeError}=await admin.auth.admin.updateUserById(user!.id,{
          email:targetEmail,email_confirm:true,
        });
        if(changeError) return json({ok:false,message:'Could not link this contact. It may already be used by another account.'},409);
      }
      const {data:result,error:commitError}=await admin.rpc('buklod_complete_legacy_login_contact_v1',{
        p_user_id:user!.id,p_channel:channel,p_destination:claim.destination,p_challenge_id:claim.id,
      });
      if(commitError||!result?.ok) {
        // Verified state remains retryable, never create a replacement account.
        return json({ok:false,code:'RECONCILIATION_NEEDED',
          message:'Contact verified but login linking needs support or a retry. Your account has not been deleted.'},503);
      }
      return json({ok:true,completed:true,loginMethod:channel,
        newLogin:masked(claim.destination,channel),sameAccount:true});
    }catch{
      return json({ok:false,message:'Temporary migration error. Do not register another account.'},503);
    }
  }

  if(action==='request') {
    const channel=clean(body.channel) as 'email'|'mobile';
    if(channel!=='email'&&channel!=='mobile')return json({ok:false,message:'Choose email or mobile'},400);
    const input=clean(body.destination);
    const destination=channel==='mobile'?mobile(input):input.toLowerCase();
    if(!destination||(channel==='email'&&!validEmail(destination)))
      return json({ok:false,message:'Enter a valid contact that belongs to you'},400);
    if(channel==='email'&&!mailReady || channel==='mobile'&&!smsReady)
      return json({ok:false,code:'PROVIDER_UNAVAILABLE',
        message:channel==='email'?'Email verification is not configured; try phone or contact support.'
          :'SMS provider is not configured; choose email or contact support.'},503);
    const password=clean(body.currentPassword);
    if(password.length<6||password.length>128)return json({ok:false,message:'Enter your current password'},400);
    // Sensitive destination changes require fresh password authentication.
    if(!user.email)return json({ok:false,message:'Existing login unavailable'},403);
    const caller=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:reauth,error:reauthError}=await caller.auth.signInWithPassword({
      email:user.email,password,
    });
    if(reauthError||reauth?.user?.id!==user.id)return json({ok:false,message:'Current password is incorrect'},403);
    const sinceHour=new Date(Date.now()-3600_000).toISOString();
    const {count,error:countError}=await admin.from('buklod_login_contact_challenges_v1')
      .select('id',{count:'exact',head:true}).eq('user_id',user.id)
      .gte('created_at',sinceHour);
    if(countError)return json({ok:false,message:'Cannot check verification limits'},503);
    if((count??0)>=3)return json({ok:false,code:'RATE_LIMITED',message:'Maximum 3 requests per hour; try later'},429);
    const prior=await currentClaim();
    if(prior?.status==='VERIFIED')return json({ok:false,
      message:'Finish your already verified login change first'},409);
    if(prior?.status==='PENDING') {
      if(after(prior.expires_at))
        return json({ok:false,code:'ALREADY_PENDING',message:'An existing code is pending. Verify it first.'},409);
      const {error}=await admin.from('buklod_login_contact_challenges_v1')
        .update({status:'FAILED'}).eq('id',prior.id).eq('status','PENDING');
      if(error)return json({ok:false,message:'Verification state unavailable'},503);
    }
    // Deny obvious cross-account conflict BEFORE sending a paid SMS/email.
    let duplicate=admin.from('profiles').select('id',{count:'exact',head:true})
      .neq('id',user.id);
    if(channel==='email')duplicate=duplicate.eq('login_method','email').ilike('login_identifier',destination);
    else duplicate=duplicate.or('mobile.eq.'+destination+',login_identifier.eq.'+destination);
    const {count:duplicateCount,error:duplicateError}=await duplicate;
    if(duplicateError)return json({ok:false,message:'Could not check contact availability'},503);
    if((duplicateCount??0)>0)return json({ok:false,message:'This contact is already linked to a BUKLOD account'},409);
    const id=crypto.randomUUID();
    const otp=channel==='email'?sixDigit():null;
    const otpHash=otp?await digest(id+':'+otp+':'+key):null;
    const {error:insertError}=await admin.from('buklod_login_contact_challenges_v1')
      .insert({id,user_id:user.id,channel,destination,otp_hash:otpHash,
        expires_at:new Date(Date.now()+10*60_000).toISOString()});
    if(insertError)return json({ok:false,message:'Could not start verification'},503);
    let accepted=false;
    try {accepted=channel==='email'?await sendEmail(destination,otp!):await twilio(destination);}
    catch {accepted=false;}
    if(!accepted) {
      await admin.from('buklod_login_contact_challenges_v1').update({status:'FAILED'})
        .eq('id',id).eq('status','PENDING');
      return json({ok:false,code:'DELIVERY_FAILED',
        message:'Verification could not be sent. No login was changed.'},503);
    }
    return json({ok:true,challengeId:id,channel,destinationHint:masked(destination,channel),
      expiresInMinutes:10,message:'Verification accepted by delivery service. Enter the code sent to your contact.'});
  }

  const claim=await currentClaim();
  if(!claim||claim.id!==clean(body.challengeId))
    return json({ok:false,message:'Active verification request not found'},404);
  if(!after(claim.expires_at))
    return json({ok:false,message:'Verification has expired. Start again.'},410);
  if(action==='finalize')return await finalize(claim);
  if(claim.status==='VERIFIED')return await finalize(claim);
  if(claim.status!=='PENDING'||claim.attempts>=5)
    return json({ok:false,message:'Verification locked; request a new code'},429);
  const code=clean(body.code);
  if(!/^\d{6}$/.test(code))
    return json({ok:false,message:'Enter the six-digit code'},400);
  const {data:claimed,error:attemptError}=await admin.from('buklod_login_contact_challenges_v1')
    .update({attempts:claim.attempts+1})
    .eq('id',claim.id).eq('status','PENDING').eq('attempts',claim.attempts)
    .select('id').maybeSingle();
  if(attemptError||!claimed)
    return json({ok:false,message:'Verification attempt already in progress; retry'},409);
  let verified=false;
  if(claim.channel==='email') {
    verified=claim.otp_hash===await digest(claim.id+':'+code+':'+key);
  } else if(smsReady) {
    try {verified=await twilio(claim.destination,code);}catch{verified=false;}
  }
  if(!verified) {
    if(claim.attempts+1>=5)
      await admin.from('buklod_login_contact_challenges_v1')
        .update({status:'FAILED'}).eq('id',claim.id).eq('status','PENDING');
    return json({ok:false,message:'Invalid verification code'},403);
  }
  const {data:confirmed,error:confirmError}=await admin.from('buklod_login_contact_challenges_v1')
    .update({status:'VERIFIED',verified_at:new Date().toISOString()})
    .eq('id',claim.id).eq('status','PENDING').select('id').maybeSingle();
  if(confirmError||!confirmed)return json({ok:false,message:'Verification state could not be saved'},503);
  return await finalize({...claim,status:'VERIFIED'});
});
