/**
 * Season 2 weekly performance — staging-only server reads.
 * Fail closed on production and on backend absence, never guess a class.
 * One batched request for up to 32 avatar users; no per-avatar SQL calls.
 */
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { createBuklodAvatarBatchLookup } from '@/lib/buklodAvatarBatch';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import {
  manilaWeekStart, normalizeVerifiedWeeklyEvidence, parseVerifiedWeeklyClass,
  type BuklodWeeklyClass, type BuklodWeeklyEvidence,
} from './buklodWeeklyPerformanceRulesR1';

const config=Constants.expoConfig;
export const S2_WEEKLY_PERFORMANCE_STAGING_ONLY =
  config?.extra?.appEnvironment === 'staging' &&
  config?.extra?.appTarget === 'main' &&
  config?.android?.package === 'org.mzbministry.buklod.staging';

let missingUntil=0;
const blocked=()=>Date.now()<missingUntil;
const deferFailure=(error:any)=>{
  const msg=String(error?.message??error??'');
  const isAbsent=error?.code==='PGRST202'||/could not find.*function|does not exist/i.test(msg);
  missingUntil=Date.now()+(isAbsent?15*60_000:25_000);
};
const avatarClassLookup=createBuklodAvatarBatchLookup(async (_viewerId,ids)=>{
  if(!S2_WEEKLY_PERFORMANCE_STAGING_ONLY||blocked())throw Error('Not enabled');
  const {data,error}=await withBuklodTimeout<any>(
    (supabase as any).rpc('buklod_weekly_performance_batch_s2',{p_user_ids:ids}),
    6_000,'S2 weekly performance batch');
  if(error){deferFailure(error);throw error;}
  return (Array.isArray(data)?data:[]).map((r:any)=>({
    user_id:String(r.user_id||''),
    avatar_url:r.week_start&&r.class_code
      ? String(r.week_start)+'|'+String(r.class_code):null,
  }));
},{batchSize:32,delayMs:35,positiveTtlMs:70_000,negativeTtlMs:45_000});

function parseClassBadge(value:string|null|undefined):BuklodWeeklyClass|null{
  if(!value)return null;
  const [week,rawClass,...rest]=value.split('|');
  if(rest.length||week!==manilaWeekStart())return null;
  const c=parseVerifiedWeeklyClass(rawClass);
  return c&&c!=='unrated'?c:null;
}

export function peekAvatarWeeklyClass(viewerId:string,targetId:string):BuklodWeeklyClass|null{
  if(!S2_WEEKLY_PERFORMANCE_STAGING_ONLY||!viewerId||!targetId)return null;
  const cached=avatarClassLookup.peek(viewerId+':'+manilaWeekStart(),targetId);
  return cached.found?parseClassBadge(cached.value):null;
}

export async function loadAvatarWeeklyClass(viewerId:string,targetId:string):Promise<BuklodWeeklyClass|null>{
  if(!S2_WEEKLY_PERFORMANCE_STAGING_ONLY||!viewerId||!targetId||blocked())return null;
  const week=manilaWeekStart();
  const value=await avatarClassLookup.resolve(viewerId+':'+week,targetId);
  // A request crossing the Manila Monday rollover cannot show last week's badge.
  return week===manilaWeekStart()?parseClassBadge(value):null;
}

const ownerCache=new Map<string,{at:number,evidence:BuklodWeeklyEvidence}>();
const ownerPending=new Map<string,Promise<BuklodWeeklyEvidence|null>>();

export async function loadMyWeeklyPerformance(userId:string,force=false):Promise<BuklodWeeklyEvidence|null>{
  if(!S2_WEEKLY_PERFORMANCE_STAGING_ONLY||!userId)return null;
  const key=userId.toLowerCase()+':'+manilaWeekStart();
  const cached=ownerCache.get(key);
  if(cached&&!force&&Date.now()-cached.at<75_000)return cached.evidence;
  const pending=ownerPending.get(key);
  if(pending)return pending;
  if(blocked())return cached?.evidence??null;
  const request=(async()=>{
    const {data,error}=await withBuklodTimeout<any>(
      (supabase as any).rpc('get_my_buklod_weekly_performance_s2'),
      6_000,'S2 personal weekly classification');
    if(error){deferFailure(error);return cached?.evidence??null;}
    const row=Array.isArray(data)?data[0]:null;
    const verified=normalizeVerifiedWeeklyEvidence(row,userId);
    if(verified){
      ownerCache.set(key,{evidence:verified,at:Date.now()});
      while(ownerCache.size>24){
        const oldest=ownerCache.keys().next().value;
        if(oldest)ownerCache.delete(oldest);else break;
      }
    }
    return verified;
  })().catch(()=>cached?.evidence??null).finally(()=>{ownerPending.delete(key);});
  ownerPending.set(key,request);
  return request;
}
