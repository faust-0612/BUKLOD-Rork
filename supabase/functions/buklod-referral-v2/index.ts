import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type',
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});

function norm(value:unknown){
  return String(value??'').trim().toLowerCase().replace(/\s+/g,' ');
}
function digits(value:unknown){
  return String(value??'').replace(/\D/g,'');
}
async function hmac(secret:string,value:string){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const sig=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value));
  return [...new Uint8Array(sig)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function signal(secret:string,type:string,value:string,confidence:'STRONG'|'SUPPORTING'|'RISK_ONLY'){
  return {type,hash:await hmac(secret,`${type}:${value}`),confidence};
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'POST required'},405);

  const url=Deno.env.get('SUPABASE_URL')??'';
  const serviceRole=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
  const pepper=Deno.env.get('REFERRAL_IDENTITY_PEPPER')??'';
  const authHeader=req.headers.get('Authorization')??'';
  if(!url||!serviceRole||!pepper)return json({error:'Referral identity service is not configured.'},503);
  if(!authHeader.toLowerCase().startsWith('bearer '))return json({error:'Authentication required.'},401);

  const admin=createClient(url,serviceRole,{auth:{persistSession:false}});
  const token=authHeader.replace(/^Bearer\s+/i,'').trim();
  const {data:authData,error:authError}=await admin.auth.getUser(token);
  if(authError||!authData?.user)return json({error:'Invalid or expired session.'},401);
  const user=authData.user;

  let body:any={}; try{body=await req.json()}catch{}
  const action=String(body?.action??'ensure_identity').trim().toLowerCase();

  const {data:profile}=await admin.from('profiles')
    .select('id,first_name,surname,full_name,birth_date,mobile,username,login_identifier')
    .eq('id',user.id).maybeSingle();

  const signals:any[]=[];
  const email=norm(user.email);
  if(email)signals.push(await signal(pepper,'AUTH_EMAIL',email,'STRONG'));
  const login=norm(profile?.login_identifier);
  if(login)signals.push(await signal(pepper,'LOGIN_IDENTIFIER',login,'STRONG'));
  const mobile=digits(profile?.mobile);
  if(mobile.length>=10)signals.push(await signal(pepper,'MOBILE',mobile,'STRONG'));
  const username=norm(profile?.username);
  if(username)signals.push(await signal(pepper,'USERNAME',username,'STRONG'));
  const first=norm(profile?.first_name||String(profile?.full_name??'').split(' ')[0]);
  const surname=norm(profile?.surname);
  const birth=String(profile?.birth_date??'').trim();
  if(first&&surname&&birth)signals.push(await signal(pepper,'NAME_BIRTH',`${first}|${surname}|${birth}`,'SUPPORTING'));

  const linked=await admin.rpc('buklod_pf_link_identity_service_v2',{
    p_user_id:user.id,p_signals:signals,
  });
  if(linked.error)return json({error:linked.error.message},409);
  if(linked.data?.ok===false)return json(linked.data,409);

  if(action==='ensure_identity'){
    return json(linked.data);
  }

  if(action==='attach_referral'){
    const code=String(body?.referral_code??'').trim().toUpperCase();
    const attached=await admin.rpc('buklod_pf_attach_referral_service_v2',{
      p_referred_person:linked.data?.person_id,p_referral_code:code,
    });
    if(attached.error){
      const message=String(attached.error.message??'Referral could not be recorded.');
      if(/not found/i.test(message))return json({error:'Referral not found',code:'REFERRAL_NOT_FOUND'},404);
      if(/self-referral/i.test(message))return json({error:'You cannot refer yourself.',code:'SELF_REFERRAL'},409);
      if(/already locked/i.test(message))return json({error:'Your first-line referrer is already locked.',code:'REFERRER_LOCKED'},409);
      if(/entry period has ended/i.test(message))return json({error:'Referral entry period has ended.',code:'REFERRAL_WINDOW_ENDED'},409);
      if(/circular/i.test(message))return json({error:'This referral relationship is not allowed.',code:'CIRCULAR_REFERRAL'},409);
      return json({error:message,code:'REFERRAL_FAILED'},409);
    }
    return json({...attached.data,identity:linked.data});
  }

  return json({error:'Unsupported action.'},400);
});
