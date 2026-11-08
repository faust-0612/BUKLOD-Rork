import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';

const PENDING_KEY='@buklod/referral/pending-v2';
const IDENTITY_KEY='@buklod/referral/identity-user-v2';
const MAX_PENDING_AGE_MS=7*24*60*60*1000;

export type BuklodReferralSummaryV2={
  identity_ready:boolean;
  policy_version?:string;
  referral_code?:string;
  share_url?:string;
  one_time_reward_php?:number;
  referred_qualification_php?:number;
  no_referrer_qualification_php?:number;
  user_share_pct?:number;
  first_line_share_pct?:number;
  referral_months?:number;
  economics_enabled?:boolean;
  withdrawal_enabled?:boolean;
  was_referred?:boolean;
  my_qualification_value_php?:number;
  my_qualification_threshold_php?:number;
  my_qualification_pct?:number;
  my_user_share_active?:boolean;
  available_cash_php?:number;
  reserved_cash_php?:number;
  paid_cash_php?:number;
  invited_count?:number;
  qualified_count?:number;
  referrals?:Array<{
    referral_id:string;
    status:string;
    pending_reward_php:number;
    reward_withdrawable_php:number;
    qualification_value_php:number;
    qualification_threshold_php:number;
    qualification_pct:number;
    share_started_at:string|null;
    share_ends_at:string|null;
    referred_label:string;
  }>;
};

export function normalizeBuklodReferralCode(value:unknown){
  return String(value??'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,16);
}

export async function captureBuklodReferralCode(code:unknown,source='LINK'){
  const clean=normalizeBuklodReferralCode(code);
  if(clean.length<8)return null;
  await AsyncStorage.setItem(PENDING_KEY,JSON.stringify({code:clean,source,capturedAt:Date.now()}));
  void recordBuklodReferralFunnel('LINK_OPEN',source);
  return clean;
}

export async function readPendingBuklodReferralCode(){
  try{
    const raw=await AsyncStorage.getItem(PENDING_KEY);
    if(!raw)return null;
    const parsed=JSON.parse(raw);
    const code=normalizeBuklodReferralCode(parsed?.code);
    const capturedAt=Number(parsed?.capturedAt??0);
    if(!code||!capturedAt||Date.now()-capturedAt>MAX_PENDING_AGE_MS){
      await AsyncStorage.removeItem(PENDING_KEY);
      return null;
    }
    return code;
  }catch{return null}
}

export async function clearPendingBuklodReferralCode(){
  await AsyncStorage.removeItem(PENDING_KEY);
}

export function buildBuklodReferralShareUrl(code:string){
  return `https://buklod.expo.app/register?ref=${encodeURIComponent(normalizeBuklodReferralCode(code))}`;
}

export async function resolveBuklodReferralCode(code:string){
  const clean=normalizeBuklodReferralCode(code);
  if(!clean)return {found:false,message:'Referral not found'};
  const result=await withBuklodTimeout<{data:any;error:any}>(
    (supabase as any).rpc('resolve_buklod_referral_code_v2',{p_code:clean}),
    5000,'Referral lookup'
  );
  if(result.error)throw result.error;
  return result.data as {found:boolean;code?:string;referrer_label?:string;message?:string};
}

export async function ensureBuklodProfitFirstIdentity(force=false){
  const session=await supabase.auth.getSession();
  const userId=session.data.session?.user?.id;
  if(!userId)return null;
  if(!force && await AsyncStorage.getItem(IDENTITY_KEY)===userId)return {ok:true,cached:true};
  const result=await withBuklodTimeout<{data:any;error:any}>(
    (supabase as any).functions.invoke('buklod-referral-v2',{body:{action:'ensure_identity'}}),
    10000,'Referral identity'
  );
  if(result.error)throw result.error;
  if(result.data?.ok===false)throw new Error(String(result.data?.reason??'Referral identity requires review.'));
  await AsyncStorage.setItem(IDENTITY_KEY,userId);
  return result.data;
}

export async function attachBuklodReferral(code:string){
  const clean=normalizeBuklodReferralCode(code);
  if(!clean)throw new Error('Referral not found');
  await ensureBuklodProfitFirstIdentity();
  const result=await withBuklodTimeout<{data:any;error:any}>(
    (supabase as any).functions.invoke('buklod-referral-v2',{
      body:{action:'attach_referral',referral_code:clean},
    }),
    10000,'Referral attribution'
  );
  if(result.error){
    const message=String((result.data as any)?.error??result.error.message??'Referral could not be recorded.');
    throw new Error(message);
  }
  if(result.data?.ok===false || result.data?.error){
    throw new Error(String(result.data?.reason??result.data?.error??'Referral attribution failed.'));
  }
  await clearPendingBuklodReferralCode();
  void recordBuklodReferralFunnel('ATTRIBUTED','APP');
  return result.data;
}

export async function attachPendingBuklodReferral(){
  const code=await readPendingBuklodReferralCode();
  if(!code)return null;
  return attachBuklodReferral(code);
}

export async function loadBuklodReferralSummaryV2(){
  const result=await withBuklodTimeout<{data:any;error:any}>(
    (supabase as any).rpc('get_my_buklod_referral_summary_v2'),
    6000,'Referral dashboard'
  );
  if(result.error)throw result.error;
  return result.data as BuklodReferralSummaryV2|null;
}

export async function recordBuklodReferralFunnel(eventType:string,source='APP'){
  try{
    await (supabase as any).rpc('record_buklod_referral_funnel_event_v2',{
      p_event_type:eventType,p_source:source,
    });
  }catch{}
}

export function extractBuklodReferralCodeFromPath(value:unknown){
  const raw=String(value??'').trim();
  if(!raw)return null;
  try{
    const url=new URL(raw,'https://buklod.expo.app');
    return normalizeBuklodReferralCode(
      url.searchParams.get('ref')??url.searchParams.get('referral')??''
    )||null;
  }catch{
    const match=raw.match(/[?&](?:ref|referral)=([A-Za-z0-9]+)/i);
    return match?normalizeBuklodReferralCode(match[1])||null:null;
  }
}

export async function captureBuklodReferralCodeFromPath(value:unknown,source='DEEPLINK'){
  const code=extractBuklodReferralCodeFromPath(value);
  if(!code)return null;
  await captureBuklodReferralCode(code,source);
  return code;
}

export type BuklodReferralReconciliationV1 = {
  identity_ready: boolean;
  referral_code: string;
  share_url: string | null;
  legacy_code: string | null;
  invited_count: number;
  qualified_count: number;
  legacy_invited_count: number;
  legacy_qualified_count: number;
  legacy_unreconciled_count: number;
  financial_invited_count: number;
  financial_qualified_count: number;
  historical_invitations_do_not_create_cash: true;
};
export async function loadMyBuklodReferralReconciliationV1(): Promise<BuklodReferralReconciliationV1> {
  await ensureBuklodProfitFirstIdentity();
  const { data, error } = await withBuklodTimeout<{ data:any; error:any }>(
    (supabase as any).rpc('get_my_buklod_referral_reconciliation_v1'),
    6000,
    'BUKLOD referral reconciliation',
  );
  if (error || !data || data.identity_ready !== true) {
    throw new Error(String(error?.message ?? 'Could not reconcile your referral totals.'));
  }
  return data as BuklodReferralReconciliationV1;
}
