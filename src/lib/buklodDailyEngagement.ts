import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';

export type BuklodTodayItem = {
  id: string;
  publish_date: string;
  slot: number;
  item_type: 'QUESTION'|'POLL'|'CHALLENGE'|'CONVERSATION_STARTER'|'TRIVIA'|'WOULD_YOU_RATHER'|'TRENDING_SUMMARY'|'MANUAL';
  title: string;
  body: string;
  options: string[];
  category: string;
  source_kind: 'AI_GENERIC'|'REAL_TRENDING'|'CURATED_FALLBACK'|'MANUAL';
};

const TRIGGER_KEY='buklod:daily-engagement:last-trigger-date';

export const CURATED_BUKLOD_TODAY: Omit<BuklodTodayItem,'id'|'publish_date'|'slot'>[] = [
  {item_type:'QUESTION',title:'Tanong ng Bayan',body:'Ano ang simpleng bagay na nagpapagaan ng araw mo?',options:[],category:'practical_life',source_kind:'CURATED_FALLBACK'},
  {item_type:'POLL',title:'Daily Pulse',body:'Kapag may libreng oras, alin ang mas gusto mo?',options:['Pahinga','Lakad sa labas','Music','Kwentuhan'],category:'hobbies',source_kind:'CURATED_FALLBACK'},
  {item_type:'CHALLENGE',title:'Daily Challenge',body:'Magpasalamat sa isang taong nakatulong sa iyo ngayong linggo.',options:[],category:'relationships',source_kind:'CURATED_FALLBACK'},
  {item_type:'WOULD_YOU_RATHER',title:'Would You Rather?',body:'Mas pipiliin mo ba ang tahimik na weekend o spontaneous na lakad?',options:['Tahimik na weekend','Spontaneous na lakad'],category:'entertainment',source_kind:'CURATED_FALLBACK'},
];

function localDateKey(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  return parts;
}
function fallbackItems():BuklodTodayItem[]{
  const day=Number(localDateKey().replace(/-/g,''))||1;
  const first=CURATED_BUKLOD_TODAY[day%CURATED_BUKLOD_TODAY.length];
  const second=CURATED_BUKLOD_TODAY[(day+1)%CURATED_BUKLOD_TODAY.length];
  return [first,second].map((x,index)=>({...x,id:`fallback-${index}`,publish_date:localDateKey(),slot:index+1}));
}

export async function loadBuklodToday():Promise<{items:BuklodTodayItem[];generationNeeded:boolean;fallback:boolean}>{
  try{
    const result=await withBuklodTimeout<{data:any;error:any}>(
      (supabase as any).rpc('get_buklod_today_v1'),
      3500,
      'BUKLOD TODAY'
    );
    if(result.error) throw result.error;
    const data=result.data??{};
    const items=Array.isArray(data.items)?data.items:[];
    return {
      items:items.length?items:fallbackItems(),
      generationNeeded:Boolean(data.generation_needed),
      fallback:Boolean(data.is_fallback)||!items.length,
    };
  }catch{
    return {items:fallbackItems(),generationNeeded:false,fallback:true};
  }
}

export async function triggerBuklodTodayGenerationIfNeeded(){
  const today=localDateKey();
  try{
    if(await AsyncStorage.getItem(TRIGGER_KEY)===today) return false;
    await AsyncStorage.setItem(TRIGGER_KEY,today);
    const claim=await withBuklodTimeout<{data:any;error:any}>(
      (supabase as any).rpc('claim_buklod_today_generation_v1'),
      3000,
      'BUKLOD TODAY claim'
    );
    const token=String(claim.data?.claim_token??'');
    if(claim.error||!claim.data?.claimed||!token) return false;
    const invoked=await withBuklodTimeout<{data:any;error:any}>(
      (supabase as any).functions.invoke('buklod-community-daily-engagement',{body:{claim_token:token}}),
      9000,
      'BUKLOD TODAY generate'
    );
    return !invoked.error;
  }catch{
    return false;
  }
}

export async function recordBuklodTodayEngagement(itemId:string,event:'VIEW'|'ENGAGE'){
  if(itemId.startsWith('fallback-')) return;
  try{
    await (supabase as any).rpc('record_buklod_daily_engagement_v1',{p_item_id:itemId,p_event_type:event});
  }catch{}
}
