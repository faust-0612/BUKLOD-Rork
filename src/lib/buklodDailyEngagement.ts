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
const USED_KEY='buklod:daily-engagement:used-bodies:v1';
const ANSWERED_KEY='buklod:daily-engagement:answered:v1';

type UsedHistory = Record<string, string[]>; // date -> body keys
type AnsweredMap = Record<string, string[]>; // date -> item ids

const TANONG_NG_BAYAN: Array<{ body: string; category: string }> = [
  { body: 'Ano ang simpleng bagay na nagpapagaan ng araw mo?', category: 'practical_life' },
  { body: 'Anong maliit na habit ang gusto mong mapanatili ngayong buwan?', category: 'wellness' },
  { body: 'Kanino ka last nagpasalamat nang totoo, at bakit?', category: 'relationships' },
  { body: 'Anong lokal na pagkain ang hindi mo mawawala sa linggo mo?', category: 'food' },
  { body: 'Paano mo ginagawang mas magaan ang umaga mo?', category: 'practical_life' },
  { body: 'Anong kanta o sound ang bagay sa mood mo ngayon?', category: 'entertainment' },
  { body: 'Anong lugar sa inyong bayan ang gusto mong ipakita sa bisita?', category: 'local_life' },
  { body: 'Anong simpleng tulong ang pwede mong ibigay sa kapwa ngayong linggo?', category: 'community' },
  { body: 'Anong bagong bagay ang natutunan mo kamakailan?', category: 'learning' },
  { body: 'Paano ka nagpapahinga nang hindi gumagastos ng malaki?', category: 'wellness' },
  { body: 'Anong pamilyang tradisyon ang gusto mong ipasa?', category: 'family' },
  { body: 'Anong work/school challenge ang kaya mong harapin nang mas kalmado ngayon?', category: 'work' },
  { body: 'Anong hobby ang gusto mong balikan o subukan?', category: 'hobbies' },
  { body: 'Anong magandang balita sa paligid mo ang gusto mong i-share?', category: 'community' },
  { body: 'Paano mo pinaparamdam sa mga mananampalataya/kaibigan na sila ay welcome?', category: 'relationships' },
  { body: 'Anong practical tip ang nakatulong sa budget mo?', category: 'practical_life' },
  { body: 'Anong panahon ng araw ang paborito mo, at bakit?', category: 'wellness' },
  { body: 'Anong libro, video, o lesson ang nagbukas ng isip mo lately?', category: 'learning' },
  { body: 'Paano kayo nagkukwentuhan sa bahay pagkatapos ng mahabang araw?', category: 'family' },
  { body: 'Anong maliit na win ang gusto mong i-celebrate ngayon?', category: 'aspirations' },
  { body: 'Anong local business o vendor ang sulit suportahan?', category: 'local_life' },
  { body: 'Paano mo ginagawa ang boring na chore na mas magaan?', category: 'practical_life' },
  { body: 'Anong payo ang gusto mong marinig noong mas bata ka?', category: 'aspirations' },
  { body: 'Anong pet o hayop sa barangay ang nagpapasaya sa inyo?', category: 'pets' },
  { body: 'Anong weekend plan ang simple pero memorable?', category: 'entertainment' },
  { body: 'Paano ka nagiging mas present sa usapan nang walang phone?', category: 'relationships' },
  { body: 'Anong school/work routine ang tumutulong sa focus mo?', category: 'school' },
  { body: 'Anong ulam ang “comfort food” ng pamilya ninyo?', category: 'food' },
  { body: 'Anong community activity ang gusto mong sumalian?', category: 'community' },
  { body: 'Paano mo pinapalakas ang loob mo kapag pagod?', category: 'wellness' },
  { body: 'Anong skill ang gusto mong matutunan nang libre o mura?', category: 'learning' },
  { body: 'Anong magandang alaala sa kapitbahayan ang hindi mo makakalimutan?', category: 'local_life' },
  { body: 'Paano kayo nagpapasalamat sa isa’t isa sa bahay?', category: 'family' },
  { body: 'Anong light joke o kwento ang nagpatawa sa iyo ngayong linggo?', category: 'light_humor' },
  { body: 'Anong goal for the week ang realistic para sa iyo?', category: 'aspirations' },
  { body: 'Paano mo ginagawang mas maayos ang commute o lakad mo?', category: 'practical_life' },
  { body: 'Anong music/playlist ang bagay sa gawain mo ngayon?', category: 'hobbies' },
  { body: 'Anong simpleng act of kindness ang nakita mo kamakailan?', category: 'community' },
  { body: 'Paano mo tinutulungan ang sarili mong matulog nang mas maaga?', category: 'wellness' },
  { body: 'Anong tanong ang gusto mong itanong sa kapwa BUKLOD member ngayon?', category: 'relationships' },
];

const DAILY_PULSE: Array<{ body: string; options: string[]; category: string }> = [
  { body: 'Kapag may libreng oras, alin ang mas gusto mo?', options: ['Pahinga', 'Lakad sa labas', 'Music', 'Kwentuhan'], category: 'hobbies' },
  { body: 'Mas pipiliin mo ba ngayong gabi?', options: ['Maagang tulog', 'Kwentuhan', 'Movie night', 'Tahimik na me-time'], category: 'entertainment' },
  { body: 'Alin ang mas nakakapagpasaya sa umaga mo?', options: ['Kape/tsaa', 'Mabilis na lakad', 'Magandang music', 'Tahimik na dasal/reflection'], category: 'wellness' },
  { body: 'Para sa weekend, alin ang mas bagay sa’yo?', options: ['Staycation sa bahay', 'Visit family', 'Community activity', 'Solo reset'], category: 'family' },
  { body: 'Kapag stressed, alin ang una mong ginagawa?', options: ['Hinga muna', 'Kausapin ang trusted person', 'Maglinis/ayos', 'Magpahinga sandali'], category: 'wellness' },
  { body: 'Alin ang mas prefer mo sa pagkain ngayon?', options: ['Mainit na ulam', 'Merienda', 'Healthy plate', 'Shared meal with others'], category: 'food' },
  { body: 'Sa trabaho/school, alin ang mas kailangan mo ngayon?', options: ['Focus time', 'Tulong ng iba', 'Clear plan', 'Short break'], category: 'work' },
  { body: 'Alin ang mas gusto mong i-share sa wall?', options: ['Encouragement', 'Practical tip', 'Fun poll', 'Grateful moment'], category: 'community' },
  { body: 'Para sa gabi, alin ang mas helpful?', options: ['No-phone hour', 'Early dinner', 'Light stretch', 'Journal/reflection'], category: 'practical_life' },
  { body: 'Alin ang mas exciting subukan?', options: ['Bagong recipe', 'Bagong route', 'Bagong hobby', 'Bagong friendship habit'], category: 'aspirations' },
  { body: 'Kapag may bisita, alin ang una mong inaalok?', options: ['Tubig/inumin', 'Merienda', 'Upuan at kwentuhan', 'Tulong sa bagay nila'], category: 'local_life' },
  { body: 'Alin ang mas gusto mong marinig ngayon?', options: ['Encouraging word', 'Practical advice', 'Funny story', 'Quiet presence'], category: 'relationships' },
  { body: 'Sa budget week, alin ang priority?', options: ['Needs first', 'Small treat', 'Save a bit', 'Share/help someone'], category: 'practical_life' },
  { body: 'Alin ang mas bagay sa mood mo ngayon?', options: ['Upbeat', 'Calm', 'Focused', 'Grateful'], category: 'entertainment' },
  { body: 'Para sa learning, alin ang mas effective sa’yo?', options: ['Short lesson', 'Discussion', 'Practice task', 'Watch/listen then apply'], category: 'learning' },
  { body: 'Alin ang mas gusto mong gawin with family?', options: ['Kumain together', 'Magkwentuhan', 'Maglinis/ayos together', 'Magdasal/reflect together'], category: 'family' },
  { body: 'Kapag umuulan, alin ang plan mo?', options: ['Stay in + rest', 'Hot drink + music', 'Catch up messages', 'Home project'], category: 'local_life' },
  { body: 'Alin ang mas gusto mong i-improve this week?', options: ['Sleep', 'Kindness', 'Focus', 'Gratitude'], category: 'aspirations' },
  { body: 'Sa community, alin ang mas handy ngayon?', options: ['Helping hand', 'Listening ear', 'Shared tip', 'Simple invitation'], category: 'community' },
  { body: 'Alin ang mas prefer mong commute vibe?', options: ['Podcast/audio', 'Quiet mind', 'Plan the day', 'Light chat'], category: 'practical_life' },
  { body: 'Para sa pets/hayop lovers, alin ang love language?', options: ['Food treat', 'Play time', 'Gentle care', 'Clean space'], category: 'pets' },
  { body: 'Alin ang mas gusto mong weekend soundtrack?', options: ['Worship/reflective', 'OPM chill', 'Upbeat playlist', 'Nature sounds'], category: 'hobbies' },
  { body: 'Kapag may free 30 minutes, alin ang unang choice?', options: ['Stretch/rest', 'Tidy one corner', 'Message someone', 'Learn something small'], category: 'wellness' },
  { body: 'Alin ang mas helpful sa group chat ninyo?', options: ['Clear updates', 'Encouragement', 'Sched reminders', 'Fun check-ins'], category: 'community' },
  { body: 'Sa pagkain ng pamilya, alin ang mas important?', options: ['Lasang home', 'Sapat para sa lahat', 'Simple at mabilis', 'Shared table time'], category: 'food' },
  { body: 'Alin ang mas gusto mong “small win” today?', options: ['Natapos ang task', 'Nakapagpahinga', 'Nakasagot ng mabuti', 'Nakapagpasalamat'], category: 'aspirations' },
  { body: 'Para sa school/work night, alin ang better?', options: ['Finish early', 'Prepare tomorrow', 'Light review', 'Rest on time'], category: 'school' },
  { body: 'Alin ang mas gusto mong neighborhood moment?', options: ['Friendly hello', 'Shared tip', 'Cleaner street', 'Safe walk home'], category: 'local_life' },
  { body: 'Kapag low battery ang energy mo, alin ang rescue?', options: ['Water + rest', 'Short walk', 'Talk to someone', 'Quiet prayer/pause'], category: 'wellness' },
  { body: 'Alin ang mas gusto mong i-post after answering?', options: ['Short reflection', 'Poll choice reason', 'Grateful note', 'Question for others'], category: 'community' },
  { body: 'Sa friendships, alin ang mas meaningful ngayon?', options: ['Honest check-in', 'Practical help', 'Shared laugh', 'Quiet support'], category: 'relationships' },
  { body: 'Alin ang mas prefer mong Sunday reset?', options: ['Clean space', 'Plan week', 'Family time', 'Rest + reflect'], category: 'practical_life' },
  { body: 'Para sa hobbies, alin ang mas doable this week?', options: ['15-min practice', 'One creative output', 'Join a buddy', 'Just enjoy, no pressure'], category: 'hobbies' },
  { body: 'Alin ang mas gusto mong marinig sa umaga?', options: ['Encouragement', 'Clear to-do', 'Good news', 'Calm silence'], category: 'wellness' },
  { body: 'Kapag may celebration, alin ang vibe mo?', options: ['Simple gathering', 'Home-cooked share', 'Music + stories', 'Quiet gratitude'], category: 'entertainment' },
  { body: 'Alin ang mas helpful sa focus mo?', options: ['One task at a time', 'Timer method', 'Clean desk', 'No notifications'], category: 'work' },
  { body: 'Sa bayan ninyo, alin ang mas ipagmamalaki mo?', options: ['People', 'Food', 'Places', 'Bayanihan spirit'], category: 'local_life' },
  { body: 'Alin ang mas gusto mong iwanan ngayong linggo?', options: ['Negative self-talk', 'Delaying rest', 'Phone overload', 'Comparing too much'], category: 'aspirations' },
  { body: 'Para sa kindness challenge, alin ang unang move?', options: ['Thank someone', 'Help with a task', 'Share a tip', 'Invite someone in'], category: 'community' },
  { body: 'Alin ang mas bagay bilang closing ng araw?', options: ['Gratitude list', 'Light stretch', 'Family chat', 'Early lights out'], category: 'wellness' },
];

/** Legacy export kept for admin/tools that still import the short curated set. */
export const CURATED_BUKLOD_TODAY: Omit<BuklodTodayItem,'id'|'publish_date'|'slot'>[] = [
  {item_type:'QUESTION',title:'Tanong ng Bayan',body:TANONG_NG_BAYAN[0].body,options:[],category:TANONG_NG_BAYAN[0].category,source_kind:'CURATED_FALLBACK'},
  {item_type:'POLL',title:'Daily Pulse',body:DAILY_PULSE[0].body,options:DAILY_PULSE[0].options,category:DAILY_PULSE[0].category,source_kind:'CURATED_FALLBACK'},
];

function localDateKey(){
  return new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Manila',
    year:'numeric',
    month:'2-digit',
    day:'2-digit',
  }).format(new Date());
}

function bodyKey(value: string){
  return value.toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
}

function daySeed(dateKey: string){
  return Number(dateKey.replace(/-/g,'')) || 1;
}

function pickUniqueIndex(
  length: number,
  seed: number,
  used: Set<string>,
  bodies: string[],
){
  if(length<=0) return 0;
  for(let offset=0; offset<length; offset+=1){
    const index=(seed+offset)%length;
    const key=bodyKey(bodies[index] ?? '');
    if(!used.has(key)) return index;
  }
  return seed%length;
}

async function loadUsedBodies(){
  try{
    const raw=await AsyncStorage.getItem(USED_KEY);
    return raw? (JSON.parse(raw) as UsedHistory) : {};
  }catch{
    return {} as UsedHistory;
  }
}

async function rememberUsedBodies(dateKey: string, bodies: string[]){
  try{
    const history=await loadUsedBodies();
    history[dateKey]=bodies.map(bodyKey);
    const keys=Object.keys(history).sort();
    while(keys.length>60){
      const old=keys.shift();
      if(old) delete history[old];
    }
    await AsyncStorage.setItem(USED_KEY, JSON.stringify(history));
  }catch{}
}

function recentUsedSet(history: UsedHistory, exceptDate: string){
  const used=new Set<string>();
  for(const [date, bodies] of Object.entries(history)){
    if(date===exceptDate) continue;
    for(const body of bodies ?? []) used.add(body);
  }
  return used;
}

async function fallbackItems():Promise<BuklodTodayItem[]>{
  const dateKey=localDateKey();
  const seed=daySeed(dateKey);
  const history=await loadUsedBodies();
  const used=recentUsedSet(history, dateKey);

  const tanongBodies=TANONG_NG_BAYAN.map(x=>x.body);
  const pulseBodies=DAILY_PULSE.map(x=>x.body);
  const tanongIndex=pickUniqueIndex(TANONG_NG_BAYAN.length, seed*3+1, used, tanongBodies);
  const pulseIndex=pickUniqueIndex(DAILY_PULSE.length, seed*5+2, used, pulseBodies);
  const tanong=TANONG_NG_BAYAN[tanongIndex];
  const pulse=DAILY_PULSE[pulseIndex];

  const items: BuklodTodayItem[]=[
    {
      id:`fallback-tanong-${dateKey}`,
      publish_date:dateKey,
      slot:1,
      item_type:'QUESTION',
      title:'Tanong ng Bayan',
      body:tanong.body,
      options:[],
      category:tanong.category,
      source_kind:'CURATED_FALLBACK',
    },
    {
      id:`fallback-pulse-${dateKey}`,
      publish_date:dateKey,
      slot:2,
      item_type:'POLL',
      title:'Daily Pulse',
      body:pulse.body,
      options:pulse.options,
      category:pulse.category,
      source_kind:'CURATED_FALLBACK',
    },
  ];

  await rememberUsedBodies(dateKey, items.map(item=>item.body));
  return items;
}

function preferNamedDailyPair(items: BuklodTodayItem[]){
  const tanong=items.find(item=>
    item.item_type==='QUESTION' ||
    /tanong ng bayan/i.test(item.title)
  );
  const pulse=items.find(item=>
    item.item_type==='POLL' ||
    /daily pulse/i.test(item.title)
  );
  if(tanong && pulse){
    const rest=items.filter(item=>item.id!==tanong.id && item.id!==pulse.id);
    return [tanong, pulse, ...rest];
  }
  return items;
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
    const items=Array.isArray(data.items)?data.items as BuklodTodayItem:[];
    const normalizedItems: BuklodTodayItem[] = Array.isArray(items)
      ? (items as BuklodTodayItem[])
      : items
        ? [items as BuklodTodayItem]
        : [];
    if(normalizedItems.length){
      const ordered=preferNamedDailyPair(normalizedItems);
      await rememberUsedBodies(
        localDateKey(),
        ordered.map(item=>String(item.body??'')),
      );
      return {
        items:ordered,
        generationNeeded:Boolean(data.generation_needed),
        fallback:Boolean(data.is_fallback),
      };
    }
    return {
      items:await fallbackItems(),
      generationNeeded:Boolean(data.generation_needed),
      fallback:true,
    };
  }catch{
    return {items:await fallbackItems(),generationNeeded:false,fallback:true};
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

export async function loadAnsweredBuklodTodayIds(){
  const today=localDateKey();
  try{
    const raw=await AsyncStorage.getItem(ANSWERED_KEY);
    const map=raw? (JSON.parse(raw) as AnsweredMap) : {};
    return new Set(map[today] ?? []);
  }catch{
    return new Set<string>();
  }
}

export async function markBuklodTodayAnswered(itemId:string){
  const today=localDateKey();
  try{
    const raw=await AsyncStorage.getItem(ANSWERED_KEY);
    const map=raw? (JSON.parse(raw) as AnsweredMap) : {};
    const current=new Set(map[today] ?? []);
    current.add(itemId);
    map[today]=[...current];
    const keys=Object.keys(map).sort();
    while(keys.length>14){
      const old=keys.shift();
      if(old) delete map[old];
    }
    await AsyncStorage.setItem(ANSWERED_KEY, JSON.stringify(map));
  }catch{}
}

function buildAnswerPostBody(item: BuklodTodayItem, answer: string){
  const title=String(item.title||'BUKLOD TODAY').trim();
  const question=String(item.body||'').trim();
  const response=answer.trim();
  if(item.item_type==='POLL'){
    return `${title}\n${question}\n\nPumili ako: ${response}`;
  }
  return `${title}\n${question}\n\nSagot ko: ${response}`;
}

export async function publishBuklodTodayAnswer(
  item: BuklodTodayItem,
  answer: string,
){
  const response=answer.trim();
  if(!response){
    throw new Error('Maglagay muna ng sagot bago i-post.');
  }

  const { data, error }=await (supabase as any).rpc('create_buklod_community_post_v3',{
    p_audience:'public',
    p_group_id:null,
    p_category:'discussion',
    p_body:buildAnswerPostBody(item, response),
    p_media_path:null,
    p_media_mime_type:null,
    p_media_size_bytes:null,
    p_media_duration_seconds:null,
    p_is_reel:false,
    p_mentioned_user_ids:[],
  });

  if(error) throw error;

  await recordBuklodTodayEngagement(item.id,'ENGAGE');
  await markBuklodTodayAnswered(item.id);

  const row=Array.isArray(data)? data[0] : data;
  return String(
    row?.create_buklod_community_post_v3 ??
    row?.id ??
    row?.post_id ??
    '',
  );
}
