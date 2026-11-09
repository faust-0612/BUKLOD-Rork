import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {router,useFocusEffect} from 'expo-router';
import {supabase} from '@/lib/supabase';
import {showBuklodAdOpportunity,warmBuklodAdOpportunity} from '@/lib/buklodAdOpportunities';

type Q={id:string;question:string;options:Record<string,string>;round:number};
type Event={id:string;kind:'flash'|'arena';title:string;difficulty:string;starts_at:string;ends_at:string;state:string;
 live:boolean;max_players:number;joined_count:number;ready_count:number;joined:boolean;ready:boolean;submitted:boolean;
 score?:number;rank?:number;points?:number;questions:Q[];winners?:{rank:number;points:number}[]};
export default function BibleEvents(){
 const [events,setEvents]=useState<Event[]>([]);
 const [answers,setAnswers]=useState<Record<string,string>>({});
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const load=useCallback(async()=>{
  const {data,error}=await (supabase as any).rpc('get_my_buklod_bible_events_v4');
  if(error)throw error;
  setEvents(Array.isArray(data?.events)?data.events:[]);
 },[]);
 useFocusEffect(useCallback(()=>{
  let alive=true;
  const tick=()=>void load().catch(()=>{if(alive)setMessage('Cannot load events right now.');}).finally(()=>{if(alive)setLoading(false);});
  tick();const timer=setInterval(tick,30000);
  return ()=>{alive=false;clearInterval(timer);};
 },[load]));
 useEffect(()=>warmBuklodAdOpportunity('bible_flash_submission_success'),[]);
 const run=async(f:()=>Promise<void>)=>{
  if(busy)return;setBusy(true);setMessage('');
  try{await f();await load();}catch(e){setMessage(e instanceof Error?e.message:'Please retry.');}
  finally{setBusy(false);}
 };
 const join=(id:string,ready:boolean)=>void run(async()=>{
  const {error}=await (supabase as any).rpc('join_my_buklod_bible_arena_v4',{p_event_id:id,p_ready:ready});
  if(error)throw error;
 });
 const submit=(event:Event)=>void run(async()=>{
  if(event.questions.length!==(event.kind==='flash'?1:10)||event.questions.some(q=>!answers[q.id]))return;
  const current:Record<string,string>={};
  for(const q of event.questions)current[q.id]=answers[q.id];
  const {data,error}=await (supabase as any).rpc('submit_my_buklod_bible_event_v4',{p_event_id:event.id,p_answers:current});
  if(error)throw error;
  if(data?.submitted){
   setMessage(data.points>0?'+'+String(data.points)+' verified BP!':
    event.kind==='arena'?'Submitted. Rankings appear after the event.':'Submitted. Winners appear after the event.');
   void showBuklodAdOpportunity(event.kind==='flash'?'bible_flash_submission_success':'bible_arena_round_complete');
  }
 });
 return <ScrollView contentContainerStyle={s.page}>
  <Pressable onPress={()=>router.back()}><Text style={s.heading}>← Back</Text></Pressable>
  <View style={s.hero}><Text style={s.title}>BUKLOD BIBLE CHALLENGES</Text>
   <Text style={s.heroText}>Surprise Flash • Monthly Bible Arena • Noncash bonus BP</Text></View>
  {loading?<ActivityIndicator/>:null}
  {message?<Text accessibilityRole="alert" style={s.note}>{message}</Text>:null}
  {!loading&&events.length===0?<View style={s.card}><Text style={s.heading}>No event scheduled yet.</Text></View>:null}
  {events.map(e=><View style={s.card} key={e.id}>
   <Text style={s.heading}>{e.kind==='flash'?'⚡ FLASH BIBLE CHALLENGE':'🏆 MONTHLY BIBLE ARENA'} · {e.difficulty.toUpperCase()}</Text>
   <Text style={s.note}>{new Date(e.starts_at).toLocaleString('en-PH',{timeZone:'Asia/Manila'})} · {e.live?'LIVE':e.state.toUpperCase()}</Text>
   <Text style={s.note}>{e.kind==='arena'?String(e.joined_count)+'/'+String(e.max_players)+' joined · '+String(e.ready_count)+' ready':'First 3 correct win: Easy +1 · Medium +3 · Hard +6 BP'}</Text>
   {e.kind==='arena'&&!e.joined&&e.state==='scheduled'&&Date.now()<new Date(e.starts_at).getTime()?<Pressable disabled={busy||e.joined_count>=e.max_players} style={s.action} onPress={()=>join(e.id,false)}>
    <Text style={s.actionText}>JOIN AS CONTESTANT</Text></Pressable>:null}
   {e.kind==='arena'&&e.joined&&!e.ready&&e.state==='scheduled'&&Date.now()<new Date(e.starts_at).getTime()?<Pressable disabled={busy} style={s.action} onPress={()=>join(e.id,true)}>
    <Text style={s.actionText}>READY CHECK (LAST 10 MINUTES)</Text></Pressable>:null}
   {e.live&&!e.submitted&&e.questions.map((q,i)=><View key={q.id} style={s.question}>
    <Text style={s.heading}>{e.kind==='arena'?'Round '+String(q.round)+' · ':''}{i+1}. {q.question}</Text>
    {(['A','B','C','D'] as const).map(letter=><Pressable key={letter} style={[s.choice,answers[q.id]===letter&&s.selected]}
     onPress={()=>setAnswers(x=>({...x,[q.id]:letter}))}><Text style={s.note}>{letter}. {q.options[letter]}</Text></Pressable>)}
   </View>)}
   {e.live&&!e.submitted&&e.questions.length>0?<Pressable disabled={busy||e.questions.some(q=>!answers[q.id])} style={s.action} onPress={()=>submit(e)}>
    <Text style={s.actionText}>SUBMIT VERIFIED ANSWERS</Text></Pressable>:null}
   {e.submitted?<Text style={s.heading}>Submitted · {e.score||0} {e.kind==='arena'?'/140':''} · +{e.points||0} BP</Text>:null}
   {e.rank?<Text style={s.note}>Rank #{e.rank}</Text>:null}
   {e.winners?.map(w=><Text key={w.rank} style={s.note}>Winner #{w.rank} · +{w.points} BP</Text>)}
  </View>)}
 </ScrollView>;
}
const s=StyleSheet.create({page:{padding:15,paddingBottom:55,gap:12,backgroundColor:'#F4F9F5'},
 hero:{padding:20,borderRadius:16,backgroundColor:'#174D38',gap:7},title:{fontSize:19,fontWeight:'900',color:'#FFDEA1',textAlign:'center'},
 heroText:{fontSize:12,color:'#F4F8F3',textAlign:'center'},card:{backgroundColor:'white',borderWidth:1,borderColor:'#D1E4D6',padding:13,borderRadius:13,gap:9},
 heading:{color:'#163F2A',fontSize:14,fontWeight:'900'},note:{color:'#5F7665',fontSize:12,lineHeight:18},
 question:{gap:7,padding:10,backgroundColor:'#F4F9F5',borderRadius:10},choice:{padding:10,borderWidth:1,borderColor:'#D0E1D3',borderRadius:9},
 selected:{backgroundColor:'#D6F3DE',borderColor:'#228A52'},action:{backgroundColor:'#157847',padding:13,borderRadius:10,alignItems:'center'},
 actionText:{color:'white',fontSize:12,fontWeight:'900'}});
