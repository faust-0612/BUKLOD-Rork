import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
import {router} from 'expo-router';
import {supabase} from '@/lib/supabase';

type Mix={participation:number;learning:number;impact:number;other:number};
type Nomination={type:string;status:string;submitted_at:string};
type Focus={total:number;pending:number;period:string;actual_points:Mix;actual_percent:Mix;target:Omit<Mix,'other'>;my_milestones:Nomination[]};
type Milestones={
 bible_scholar:{completed:number;target:number;basis:string};
 faithful_mentor:{completed:number;target:number;basis:string};
 kingdom_champion:{completed:number;target:number;basis:string};
 community_builder:{recorded_contributions:number;cluster_attendance_events:number;basis:string};
};
const achievements=[
 ['achievement_bible_scholar','Bible Scholar — +100 BP'],
 ['achievement_community_builder','Community Builder — +150 BP'],
 ['achievement_faithful_mentor','Faithful Mentor — +200 BP'],
 ['achievement_kingdom_champion','Kingdom Champion — +250 BP'],
 ['verified_volunteer_service','Verified Volunteer Service — +20 BP'],
 ['ministry_major_milestone','Major Ministry Milestone — +100 BP'],
 ['game_tournament_champion','Verified Tournament Champion — +100 BP']
] as const;
const buckets=[['participation','Participation'],['learning','Learning & Skills'],['impact','Verified Community Impact']] as const;
export default function BuklodR2FocusMonitor(){
 const [report,setReport]=useState<Focus|null>(null);
 const [progress,setProgress]=useState<Milestones|null>(null);
 const [expanded,setExpanded]=useState(false);
 const [selected,setSelected]=useState<string>(achievements[0][0]);
 const [evidence,setEvidence]=useState(''); const [busy,setBusy]=useState(false);
 const [err,setErr]=useState('');
 const load=useCallback(async()=>{
  setErr('');
  try{
   const [reportResult,milestoneResult]=await Promise.all([
    (supabase as any).rpc('get_my_buklod_r2_focus_monitor_v1'),
    (supabase as any).rpc('get_my_buklod_r2_milestone_progress_v1')
   ]);
   if(reportResult.error)throw reportResult.error;
   if(milestoneResult.error)throw milestoneResult.error;
   setReport(reportResult.data as Focus);
   setProgress(milestoneResult.data as Milestones);
  }catch{setErr('Live reward monitoring is unavailable. Existing points are unchanged.');}
 },[]);
 useEffect(()=>{if(expanded)void load()},[expanded,load]);
 const send=async()=>{
  if(busy||evidence.trim().length<60)return;
  setBusy(true);setErr('');
  try{
   const{error}=await(supabase as any).rpc('submit_my_buklod_r2_achievement_v1',{
    p_activity_type:selected,p_evidence_note:evidence.trim()});
   if(error)throw error;
   setEvidence('');await load();
  }catch(e){setErr(e instanceof Error?e.message:'Could not submit milestone.');}
  finally{setBusy(false)}
 };
 const own=report?.my_milestones.find(m=>m.type===selected);
 return <View style={s.wrap}>
 <Pressable accessibilityRole="button" accessibilityState={{expanded}} onPress={()=>setExpanded(v=>!v)} style={s.head}>
  <Text style={s.title}>Live Reward Focus & Milestones</Text>
  <Text style={s.arrow}>{expanded?'−':'+'}</Text>
 </Pressable>
 {expanded&&<View style={s.body}>
  <Text style={s.desc}>Actual points credited during the last 30 days. The 40/35/25 proportions are planning targets, not fabricated performance measurements.</Text>
  {!report&&!err&&<ActivityIndicator color="#0A7436"/>}
  {!!err&&<Text accessibilityRole="alert" style={s.err}>{err}</Text>}
  {report&&<>
   <Text style={s.total}>{report.total.toLocaleString('en-PH')} BP earned in 30 days</Text>
   <Text style={s.desc}>{report.pending} BP pending claim</Text>
   {buckets.map(([key,label])=>{
    const percent=Number(report.actual_percent[key]||0);
    const target=Number(report.target[key]||0);
    return <View key={key}>
      <Text style={s.metric}>{label}: {report.actual_points[key]} BP · {percent}% actual / {target}% target</Text>
      <View style={s.track}><View style={[s.fill,{width:`${Math.max(0,Math.min(100,percent))}%`}]}/></View>
    </View>
   })}
   <Text style={s.desc}>Other/unclassified: {report.actual_points.other} BP. These are not silently assigned to a category.</Text>
   <Text style={s.section}>Milestone progress — actual records</Text>
   {progress&&<>
    <Text style={s.metric}>Bible Scholar: {progress.bible_scholar.completed}/{progress.bible_scholar.target} ABC lessons completed</Text>
    <Text style={s.metric}>Faithful Mentor: {progress.faithful_mentor.completed}/{progress.faithful_mentor.target} admin-approved teaching sessions</Text>
    <Text style={s.metric}>Kingdom Champion: {progress.kingdom_champion.completed}/{progress.kingdom_champion.target} Kingdom levels recorded as cleared</Text>
    <Text style={s.metric}>Community Builder: {progress.community_builder.recorded_contributions} credited contributions and {progress.community_builder.cluster_attendance_events} Cluster attendances (indicative only)</Text>
    <Text style={s.desc}>Milestone progress is not automatic approval. The completed course, mentoring cycle, real service project, or verified tournament must still be reviewed.</Text>
   </>}
   <Text style={s.section}>Major Achievement Applications</Text>
   {achievements.map(([key,label])=><Pressable key={key} onPress={()=>setSelected(key)} style={[s.choice,selected===key&&s.selected]}>
      <Text style={s.choiceText}>{label}</Text><Text style={s.status}>{report.my_milestones.find(n=>n.type===key)?.status||'Not submitted'}</Text>
   </Pressable>)}
   {!own&&<>
    <Text style={s.desc}>Describe the completed course, ministry project, mentoring cycle, volunteer service or tournament challenge. Include dates, scope and verifiable references. Submission does not automatically earn points.</Text>
    <TextInput multiline textAlignVertical="top" accessibilityLabel="Achievement supporting evidence"
       placeholder="Evidence details (60–2000 characters)" placeholderTextColor="#879A8A"
       style={s.input} value={evidence} onChangeText={setEvidence} maxLength={2000}/>
    <Pressable style={[s.submit,(busy||evidence.trim().length<60)&&s.disabled]}
      disabled={busy||evidence.trim().length<60} onPress={()=>void send()}>
      <Text style={s.submitText}>{busy?'Submitting...':'Submit for verification'}</Text>
    </Pressable>
   </>}
   {own&&<Text style={s.desc}>Current milestone status: {own.status}. An authorized reviewer must validate evidence before any award is credited.</Text>}
  </>}
  <View style={s.links}>
   <Pressable onPress={()=>router.push('/faith/bible-quiz' as any)} style={s.link}><Text style={s.linkText}>Play Daily Bible Quiz</Text></Pressable>
   <Pressable onPress={()=>router.push('/faith/mentor-evidence' as any)} style={s.link}><Text style={s.linkText}>Mentoring photo evidence</Text></Pressable>
   <Pressable onPress={()=>router.push('/scope' as any)} style={s.link}><Text style={s.linkText}>Cluster attendance</Text></Pressable>
  </View>
  <Pressable onPress={()=>void load()} style={s.refresh}><Text style={s.refreshText}>Refresh live results</Text></Pressable>
 </View>}
 </View>;
}
const s=StyleSheet.create({
 wrap:{marginHorizontal:14,marginVertical:8,backgroundColor:'#FFFFFF',borderColor:'#D7E5DB',
 borderWidth:1,borderRadius:16,overflow:'hidden'},
 head:{padding:15,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
 title:{fontSize:14,color:'#214E34',fontWeight:'900'},
 arrow:{fontSize:21,color:'#18653C',fontWeight:'800'},
 body:{paddingHorizontal:14,paddingBottom:16,gap:10},
 desc:{fontSize:11,lineHeight:17,color:'#65796B'},
 total:{fontSize:17,fontWeight:'900',color:'#1A6B3C'},
 metric:{fontSize:11,fontWeight:'700',color:'#2C4F38'},
 track:{height:9,borderRadius:9,overflow:'hidden',backgroundColor:'#E9EFE9',marginTop:4},
 fill:{height:9,backgroundColor:'#2A9361'},
 section:{fontSize:13,fontWeight:'900',color:'#234B33',marginTop:8},
 choice:{padding:10,backgroundColor:'#F5F8F5',borderRadius:10,gap:4},
 selected:{borderColor:'#168346',borderWidth:1,backgroundColor:'#EAF7EC'},
 choiceText:{fontSize:11,color:'#234B33',fontWeight:'800'},
 status:{fontSize:10,color:'#718071'},
 input:{minHeight:90,borderColor:'#C8DCC9',borderWidth:1,borderRadius:10,
 padding:12,fontSize:12,color:'#294331'},
 submit:{padding:13,backgroundColor:'#0A7436',borderRadius:11,alignItems:'center'},
 submitText:{color:'#FFFFFF',fontWeight:'800'},
 disabled:{opacity:0.5},links:{gap:7,marginTop:7},
 link:{padding:11,backgroundColor:'#EDF7F0',borderRadius:10},
 linkText:{color:'#0D6F39',fontWeight:'800',fontSize:11},
 refresh:{padding:10,alignItems:'center'},refreshText:{color:'#0C7B41',fontWeight:'800',fontSize:11},
 err:{color:'#A63B27',fontSize:11}
});
