import React,{useCallback,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {router,useFocusEffect} from 'expo-router';
import {supabase} from '@/lib/supabase';

export default function AdminBibleV4(){
 const [kind,setKind]=useState<'flash'|'arena'>('flash');
 const [level,setLevel]=useState<'easy'|'medium'|'hard'>('medium');
 const [slots,setSlots]=useState(5),[schedule,setSchedule]=useState('');
 const [events,setEvents]=useState<any[]>([]);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{
  const {data,error}=await (supabase as any).rpc('get_my_buklod_bible_events_v4');
  if(error)throw error;
  setEvents(Array.isArray(data?.events)?data.events:[]);
 },[]);
 useFocusEffect(useCallback(()=>{void load().catch(()=>setNotice('Admin Bible services unavailable.')).finally(()=>setLoading(false));},[load]));
 const act=async(fn:()=>Promise<void>)=>{
  if(busy)return;
  setBusy(true);setNotice('');
  try{await fn();await load();}catch(e){setNotice(e instanceof Error?e.message:'Action failed');}
  finally{setBusy(false);}
 };
 const create=()=>void act(async()=>{
  const input=schedule.trim();
  if(!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(input))throw Error('Use YYYY-MM-DD HH:mm Philippine time.');
  const start=new Date(input.replace(' ','T')+':00+08:00');
  if(!Number.isFinite(start.getTime()))throw Error('Invalid date.');
  const {error}=await (supabase as any).rpc('admin_create_buklod_bible_event_v4',{
   p_kind:kind,p_difficulty:level,p_start_at:start.toISOString(),
   p_duration_minutes:kind==='flash'?10:20,p_slots:slots});
  if(error)throw error;
  setNotice('Event scheduled successfully.');
 });
 return <ScrollView contentContainerStyle={s.root} keyboardShouldPersistTaps="handled">
  <Pressable onPress={()=>router.back()}><Text style={s.bold}>← Back to Admin</Text></Pressable>
  <Text style={s.title}>Bible Challenge Administration</Text>
  <Text style={s.note}>System Admin only · Live event scheduler · Manila time. Bible essays are graded automatically.</Text>
  {loading?<ActivityIndicator/>:null}
  {notice?<Text style={s.notice}>{notice}</Text>:null}
  <View style={s.card}>
   <Text style={s.bold}>Create event</Text>
   <View style={s.row}>{(['flash','arena'] as const).map(k=><Pressable key={k} style={[s.choice,kind===k&&s.selected]} onPress={()=>setKind(k)}>
    <Text style={s.bold}>{k.toUpperCase()}</Text></Pressable>)}</View>
   <View style={s.row}>{(['easy','medium','hard'] as const).map(k=><Pressable key={k} style={[s.choice,level===k&&s.selected]} onPress={()=>setLevel(k)}>
    <Text style={s.bold}>{k.toUpperCase()}</Text></Pressable>)}</View>
   {kind==='arena'?<View style={s.row}><Text style={s.note}>Contestants:</Text>{[3,4,5].map(n=><Pressable key={n} style={[s.choice,slots===n&&s.selected]} onPress={()=>setSlots(n)}>
    <Text style={s.bold}>{n}</Text></Pressable>)}</View>:null}
   <TextInput style={s.input} placeholder="2026-11-30 19:00" value={schedule} onChangeText={setSchedule}/>
   <Text style={s.note}>Flash: 10 minutes. Arena: 20 minutes. Future events only, one Arena per month.</Text>
   <Pressable style={s.action} disabled={busy} onPress={create}><Text style={s.white}>SCHEDULE EVENT</Text></Pressable>
  </View>
  <View style={s.card}><Text style={s.bold}>Upcoming events</Text>
   {events.map(ev=><View key={ev.id} style={s.row}>
    <Text style={s.note}>{ev.kind} · {ev.difficulty} · {new Date(ev.starts_at).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}</Text>
    {ev.state==='scheduled'&&Date.now()<new Date(ev.starts_at).getTime()?<Pressable onPress={()=>void act(async()=>{
     const {error}=await (supabase as any).rpc('admin_cancel_buklod_bible_event_v4',{p_event_id:ev.id});
     if(error)throw error;})}><Text style={s.danger}>Cancel</Text></Pressable>:null}
   </View>)}
  </View>
  <View style={s.card}>
   <Text style={s.bold}>Automated Bible Quiz grading</Text>
   <Text style={s.note}>Rubric-based scoring is automatic and final. Learners see their criteria and results directly in Bible Quiz; no manual review queue or approval button.</Text>
  </View>
 </ScrollView>;
}
const s=StyleSheet.create({root:{padding:15,gap:14,paddingBottom:60,backgroundColor:'#F6FAF7'},
 title:{color:'#194B34',fontSize:20,fontWeight:'900'},bold:{color:'#17462E',fontSize:13,fontWeight:'900'},
 note:{color:'#597364',fontSize:12,lineHeight:18,flexShrink:1},
 card:{backgroundColor:'white',padding:13,gap:11,borderRadius:14,borderWidth:1,borderColor:'#D7E5D9'},
 row:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:9},
 choice:{padding:10,borderRadius:9,borderWidth:1,borderColor:'#D6E5D9'},
 selected:{borderColor:'#27814F',backgroundColor:'#DDF2E1'},
 action:{backgroundColor:'#137648',padding:14,alignItems:'center',borderRadius:10},
 white:{color:'white',fontWeight:'900'},input:{backgroundColor:'#FAFEFB',borderRadius:9,borderWidth:1,borderColor:'#CBDDCD',padding:11,color:'#17462E'},
 review:{backgroundColor:'#F5F9F5',padding:12,borderRadius:10,gap:10},
 answer:{fontSize:14,color:'#183D2D',lineHeight:21},danger:{color:'#AC392D',fontWeight:'800'},
 notice:{backgroundColor:'#FFF1D9',padding:11,borderRadius:10,color:'#815121'}});
