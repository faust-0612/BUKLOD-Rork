import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {router} from 'expo-router';
import {supabase} from '@/lib/supabase';
type Activity={type:string;label:string;configured_points:number;active:boolean;earned_count:number;earned_points:number};
type Nom={id:string;user_id:string;type:string;status:string;evidence_note:string;submitted_at:string};
type Report={as_of:string;activities:Activity[];nominations:{pending:number;approved:number;rejected:number};recent_nominations:Nom[];
 mentor_photos:number;pending_mentoring_photos:number};
export default function R2AdminMonitor(){
 const[report,setReport]=useState<Report|null>(null);const[loading,setLoading]=useState(true);
 const[error,setError]=useState('');const[busy,setBusy]=useState<string|null>(null);
 const[notes,setNotes]=useState<Record<string,string>>({});
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{const{data,error:e}=await(supabase as any).rpc('admin_get_buklod_r2_rewards_monitor_v1');
   if(e)throw e;setReport(data as Report);
  }catch{setError('System Admin access or live monitor unavailable.');}
  finally{setLoading(false)}
 },[]);
 useEffect(()=>{void load()},[load]);
 const review=async(item:Nom,approved:boolean)=>{
  if(busy||!notes[item.id]||notes[item.id].trim().length<12)return;
  setBusy(item.id);setError('');
  try{const{error:e}=await(supabase as any).rpc('admin_review_buklod_r2_achievement_v1',{
   p_nomination_id:item.id,p_approve:approved,p_note:notes[item.id].trim()});
   if(e)throw e;await load();
  }catch(e){setError(e instanceof Error?e.message:'Review failed');}
  finally{setBusy(null)}
 };
 return <SafeAreaView style={s.root}><ScrollView contentContainerStyle={s.content}
 keyboardShouldPersistTaps="handled">
 <Pressable onPress={()=>router.back()}><Text style={s.back}>‹ Back</Text></Pressable>
 <Text style={s.title}>R2 Points — Live Admin Monitor</Text>
 <Text style={s.subtitle}>Server-authoritative rules and 30-day ledger totals. Review milestone evidence before awarding.</Text>
 {loading&&<ActivityIndicator color="#0A7436"/>}
 {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
 {report&&<>
 <Text style={s.info}>Updated {new Date(report.as_of).toLocaleString('en-PH')}</Text>
 <View style={s.card}>
 <Text style={s.heading}>Major Achievement Requests</Text>
 <Text style={s.stat}>Pending {report.nominations.pending} · Approved {report.nominations.approved} · Rejected {report.nominations.rejected}</Text>
 <Text style={s.stat}>Mentor photos submitted: {report.mentor_photos}</Text>
 <Text style={s.stat}>New sessions still missing photo: {report.pending_mentoring_photos}</Text>
 </View>
 <Text style={s.heading}>Pending verification</Text>
 {report.recent_nominations.filter(n=>n.status==='pending').length===0&&<Text style={s.info}>No pending milestones.</Text>}
 {report.recent_nominations.filter(n=>n.status==='pending').map(item=><View style={s.card} key={item.id}>
  <Text style={s.heading}>{item.type.replace(/_/g,' ')}</Text>
  <Text style={s.info}>Member reference: {item.user_id.slice(0,8)} · {new Date(item.submitted_at).toLocaleDateString('en-PH')}</Text>
  <Text style={s.evidence}>{item.evidence_note}</Text>
  <TextInput style={s.note} multiline placeholder="Verification decision and reason (12+ characters)"
   placeholderTextColor="#79887D" value={notes[item.id]||''}
   onChangeText={v=>setNotes(old=>({...old,[item.id]:v}))}/>
  <View style={s.actions}>
  <Pressable disabled={busy!==null||(notes[item.id]||'').trim().length<12}
   style={[s.btn,busy!==null&&s.disabled]} onPress={()=>void review(item,true)}>
   <Text style={s.btnText}>Approve verified</Text>
  </Pressable>
  <Pressable disabled={busy!==null||(notes[item.id]||'').trim().length<12}
   style={[s.btn,s.reject,busy!==null&&s.disabled]} onPress={()=>void review(item,false)}>
   <Text style={s.btnText}>Reject</Text>
  </Pressable></View>
 </View>)}
 <Text style={s.heading}>Live Reward Rules & Credits (30 days)</Text>
 {report.activities.map(a=><View style={s.row} key={a.type}>
  <Text style={s.name}>{a.label}</Text>
  <Text style={s.info}>{a.active?'Active':'Disabled'} · rule +{a.configured_points} BP</Text>
  <Text style={s.stat}>{a.earned_count} credits · {a.earned_points} BP issued</Text>
 </View>)}
 </>}
 <Pressable onPress={()=>void load()} style={s.reload}><Text style={s.btnText}>Refresh live monitor</Text></Pressable>
 </ScrollView></SafeAreaView>
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:'#F7FAF8'},content:{padding:16,paddingBottom:44,gap:11},
 back:{color:'#16743E',fontWeight:'800',fontSize:14},
 title:{color:'#1C5030',fontSize:22,fontWeight:'900'},subtitle:{color:'#617B69',fontSize:12,lineHeight:18},
 heading:{color:'#244B32',fontWeight:'900',fontSize:14},stat:{color:'#186A3B',fontSize:12,fontWeight:'800'},
 card:{backgroundColor:'white',padding:15,borderRadius:14,borderColor:'#DCE9DC',borderWidth:1,gap:8},
 info:{fontSize:11,color:'#647668'},evidence:{fontSize:12,color:'#364C3A',lineHeight:19},
 note:{borderWidth:1,borderRadius:10,borderColor:'#CADDCF',padding:11,minHeight:75,color:'#213C2A'},
 actions:{flexDirection:'row',gap:10},btn:{backgroundColor:'#0A7436',borderRadius:9,padding:11,flex:1,alignItems:'center'},
 btnText:{fontSize:11,color:'white',fontWeight:'900'},reject:{backgroundColor:'#AD4B39'},disabled:{opacity:0.45},
 row:{backgroundColor:'white',borderRadius:11,padding:12,gap:4},
 name:{fontSize:12,fontWeight:'800',color:'#254B35'},
 error:{backgroundColor:'#FFE9E2',color:'#A73525',padding:12,borderRadius:10},
 reload:{backgroundColor:'#155B35',padding:13,alignItems:'center',borderRadius:10}
});
