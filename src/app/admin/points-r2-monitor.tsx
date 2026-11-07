import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Image,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {router} from 'expo-router';
import {supabase} from '@/lib/supabase';
import {showBuklodAdOpportunity} from '@/lib/buklodAdOpportunities';
type Activity={type:string;label:string;configured_points:number|null;active:boolean|null;source?:string;earned_count:number;earned_points:number};
type Nom={id:string;user_id:string;type:string;status:string;evidence_note:string;submitted_at:string};
type Pipeline={
 bible_quiz:{daily_attempts:number;completed:number;rewarded:number};
 attendance:{cluster_present_or_late_records:number;scope_points_credits:number};
 mentoring:{reported:number;approved:number;pending_pastor:number;pending_admin:number};
};
type Report={as_of:string;activities:Activity[];nominations:{pending:number;approved:number;rejected:number};recent_nominations:Nom[];
 mentor_photos:number;pending_mentoring_photos:number;focus:{total:number;participation:number;learning:number;impact:number;unclassified:number}};
type Checkin={id:string;event_id:string;member_id:string;event:string;place:string;starts_at:string;cluster:string;checked_in_at:string;status:string};
type Evidence={session_id:string;lesson:string;status:string;mentor_id:string;
 session_date:string;participant_count:number;photo_path:string|null};
export default function R2AdminMonitor(){
 const[report,setReport]=useState<Report|null>(null);const [pipeline,setPipeline]=useState<Pipeline|null>(null);
 const[loading,setLoading]=useState(true);
 const[error,setError]=useState('');const[busy,setBusy]=useState<string|null>(null);
 const[notes,setNotes]=useState<Record<string,string>>({});
 const[checkins,setCheckins]=useState<Checkin[]>([]);
 const[photos,setPhotos]=useState<Evidence[]>([]);
 const[photoUrls,setPhotoUrls]=useState<Record<string,string>>({});
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{const [overview,evidence,pipelineResult,checkinResult]=await Promise.all([
    (supabase as any).rpc('admin_get_buklod_r2_rewards_monitor_v1'),
    (supabase as any).rpc('admin_get_buklod_r2_mentor_evidence_v1'),
    (supabase as any).rpc('admin_get_buklod_r2_pipeline_monitor_v1'),
    (supabase as any).rpc('admin_get_buklod_home_checkin_queue_r3')
   ]);
   if(overview.error)throw overview.error;
   if(evidence.error)throw evidence.error;
   if(pipelineResult.error)throw pipelineResult.error;
   if(checkinResult.error)throw checkinResult.error;
   setCheckins(Array.isArray(checkinResult.data)?checkinResult.data:[]);
   setPipeline(pipelineResult.data as Pipeline);
   setReport(overview.data as Report);
   setPhotos(Array.isArray(evidence.data)?evidence.data:[]);
  }catch{setError('System Admin access or live monitor unavailable.');}
  finally{setLoading(false)}
 },[]);
 useEffect(()=>{void load()},[load]);


 const reviewCheckin=async(item:Checkin,approve:boolean)=>{
  if(busy||(notes[item.id]||'').trim().length<8)return;
  setBusy(item.id);setError('');
  try{
   const{error}=await(supabase as any).rpc('admin_review_buklod_home_checkin_r3',{
    p_checkin_id:item.id,p_approve:approve,p_reason:notes[item.id].trim()
   });
   if(error)throw error;await load();
   if(approve)showBuklodAdOpportunity('points_submission_success');
  }catch(e){setError(e instanceof Error?e.message:'Check-in review failed.');}
  finally{setBusy(null)}
 };
 const viewPhoto=async(e:Evidence)=>{
  if(!e.photo_path)return;
  setError('');
  try{
   const{data,error}=await supabase.storage.from('buklod-mentoring-evidence')
     .createSignedUrl(e.photo_path,120);
   if(error)throw error;
   if(data?.signedUrl)setPhotoUrls(old=>({...old,[e.session_id]:data.signedUrl}));
  }catch{setError('Could not open private mentoring photo.')}
 };
 const reviewMentor=async(e:Evidence,approve:boolean)=>{
  if(busy||!photoUrls[e.session_id]||(notes[e.session_id]||'').trim().length<12)return;
  setBusy(e.session_id);setError('');
  try{
   const{error}=await(supabase as any).rpc('admin_review_mentor_session_r3',{
    p_session_id:e.session_id,p_approve:approve,p_admin_note:notes[e.session_id].trim()
   });
   if(error)throw error;await load();
  }catch(err){setError(err instanceof Error?err.message:'Mentor review failed');}
  finally{setBusy(null)}
 };
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

 {pipeline&&<View style={s.card}>
   <Text style={s.heading}>Live earning pipeline (30 days)</Text>
   <Text style={s.stat}>Bible Quiz: {pipeline.bible_quiz.daily_attempts} started, {pipeline.bible_quiz.completed} completed, {pipeline.bible_quiz.rewarded} rewarded</Text>
   <Text style={s.stat}>Cluster attendance: {pipeline.attendance.cluster_present_or_late_records} recorded present/late, {pipeline.attendance.scope_points_credits} scope attendance credits</Text>
   <Text style={s.stat}>Mentoring: {pipeline.mentoring.reported} reported, {pipeline.mentoring.approved} approved, {pipeline.mentoring.pending_pastor} awaiting Pastor, {pipeline.mentoring.pending_admin} awaiting Admin</Text>
   <Text style={s.info}>Attendance record counts and rewarded counts are separate audit measures; late corrections and non-Cluster scope awards can differ.</Text>
 </View>}
 <Text style={s.heading}>Home Check-In Today — Verification Queue</Text>
 {checkins.length===0&&<Text style={s.info}>No pending Home Check-ins.</Text>}
 {checkins.map(item=><View style={s.card} key={item.id}>
  <Text style={s.heading}>{item.event} · {item.cluster}</Text>
  <Text style={s.info}>Venue: {item.place||'Not provided'} · Event: {new Date(item.starts_at).toLocaleString('en-PH')}</Text>
  <Text style={s.info}>Member reference: {item.member_id.slice(0,8)} · Checked in: {new Date(item.checked_in_at).toLocaleString('en-PH')}</Text>
  <TextInput style={s.note} placeholder="Verification notes, 8+ characters" multiline
   placeholderTextColor="#79887D" value={notes[item.id]||''}
   onChangeText={v=>setNotes(old=>({...old,[item.id]:v}))}/>
  <View style={s.actions}>
   <Pressable style={[s.btn,(notes[item.id]||'').trim().length<8&&s.disabled]}
    disabled={!!busy||(notes[item.id]||'').trim().length<8}
    onPress={()=>void reviewCheckin(item,true)}><Text style={s.btnText}>Verify +10 BP</Text></Pressable>
   <Pressable style={[s.btn,s.reject,(notes[item.id]||'').trim().length<8&&s.disabled]}
    disabled={!!busy||(notes[item.id]||'').trim().length<8}
    onPress={()=>void reviewCheckin(item,false)}><Text style={s.btnText}>Reject</Text></Pressable>
  </View>
 </View>)}
 <Text style={s.heading}>Mentoring Photo Evidence</Text>
 {photos.filter(p=>p.status==='reported'||p.status==='pending_admin').length===0&&
   <Text style={s.info}>No mentor sessions awaiting final approval.</Text>}
 {photos.filter(p=>p.status==='pending_admin').map(item=><View style={s.card} key={item.session_id}>
  <Text style={s.heading}>{item.lesson}</Text>
  <Text style={s.info}>{item.session_date} · {item.participant_count} reported learners · Awaiting Admin</Text>
  <Text style={s.info}>{item.photo_path?'Evidence uploaded':'Evidence photo missing'}</Text>
  {item.photo_path&&<Pressable style={s.btn} onPress={()=>void viewPhoto(item)}>
   <Text style={s.btnText}>View private mentoring photo</Text>
  </Pressable>}
  {!!photoUrls[item.session_id]&&<Image source={{uri:photoUrls[item.session_id]}}
    style={{width:'100%',height:190,borderRadius:12}} resizeMode="contain"/>}
  <TextInput style={s.note} placeholder="Verification note (12+ characters)" multiline
    placeholderTextColor="#79887D" value={notes[item.session_id]||''}
    onChangeText={v=>setNotes(old=>({...old,[item.session_id]:v}))}/>
  <View style={s.actions}>
   <Pressable style={[s.btn,(!photoUrls[item.session_id]||(notes[item.session_id]||'').trim().length<12)&&s.disabled]}
    disabled={busy!==null||!photoUrls[item.session_id]||(notes[item.session_id]||'').trim().length<12}
    onPress={()=>void reviewMentor(item,true)}><Text style={s.btnText}>Approve session</Text></Pressable>
   <Pressable style={[s.btn,s.reject,(notes[item.session_id]||'').trim().length<12&&s.disabled]}
    disabled={busy!==null||(notes[item.session_id]||'').trim().length<12}
    onPress={()=>void reviewMentor(item,false)}><Text style={s.btnText}>Reject</Text></Pressable>
  </View>
 </View>)}
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
 <View style={s.card}>
  <Text style={s.heading}>Reward Focus — Actual 30-day basis</Text>
  <Text style={s.stat}>Total: {report.focus.total} credited BP</Text>
  <Text style={s.info}>Participation: {report.focus.participation} BP · target 40%</Text>
  <Text style={s.info}>Learning & Skills: {report.focus.learning} BP · target 35%</Text>
  <Text style={s.info}>Community Impact: {report.focus.impact} BP · target 25%</Text>
  <Text style={s.info}>Other/unclassified: {report.focus.unclassified} BP (not concealed)</Text>
 </View>
 <Text style={s.heading}>Live Reward Rules & Credits (30 days)</Text>
 {report.activities.map(a=><View style={s.row} key={a.type}>
  <Text style={s.name}>{a.label}</Text>
  <Text style={s.info}>{a.source==='ledger_without_current_rule'?'Legacy ledger event without active catalog mapping':a.active?'Active':'Disabled'} · {a.configured_points===null?'Legacy amount':`rule +${a.configured_points} BP`}</Text>
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
