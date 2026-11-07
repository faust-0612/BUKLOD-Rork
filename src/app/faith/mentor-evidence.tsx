import React,{useCallback,useEffect,useState} from 'react';
import * as Crypto from 'expo-crypto';
import {ActivityIndicator,Alert,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import {decode} from 'base64-arraybuffer';
import {router} from 'expo-router';
import {supabase} from '@/lib/supabase';
import {showBuklodAdOpportunity,warmBuklodAdOpportunity} from '@/lib/buklodAdOpportunities';

type Task={session_id:string;session_date:string;status:string;lesson:string;has_photo:boolean};
type Lesson={id:string;title:string};
type Disciple={disciple_id:string;disciple_name:string};
export default function MentorTeachingPhotoEvidence(){
 const [tasks,setTasks]=useState<Task[]>([]);
 const [lessons,setLessons]=useState<Lesson[]>([]);
 const [selectedLesson,setSelectedLesson]=useState('');
 const [lessonSearch,setLessonSearch]=useState('');
 const [disciples,setDisciples]=useState<Disciple[]>([]);
 const [selectedDisciples,setSelectedDisciples]=useState<string[]>([]);
 const [requestKey,setRequestKey]=useState(()=>Crypto.randomUUID());
 const [notes,setNotes]=useState('');
 const [location,setLocation]=useState('');
 const [busy,setBusy]=useState<string|null>(null);
 const[loading,setLoading]=useState(true);const [err,setErr]=useState('');
 const load=useCallback(async()=>{
  setLoading(true);setErr('');
  try{const [taskResponse,lessonResponse,menteeResponse]=await Promise.all([
   (supabase as any).rpc('get_my_mentor_photo_tasks_r2'),
   (supabase as any).rpc('get_my_mentor_reportable_lessons_r2'),
   (supabase as any).rpc('mentor_disciple_progress'),
 ]);
 if(taskResponse.error)throw taskResponse.error;
 if(lessonResponse.error)throw lessonResponse.error;
 if(menteeResponse.error)throw menteeResponse.error;
 setTasks(Array.isArray(taskResponse.data)?taskResponse.data:[]);
 setLessons(Array.isArray(lessonResponse.data)?lessonResponse.data:[]);
 setDisciples(Array.isArray(menteeResponse.data)?menteeResponse.data:[]);
  }catch{setErr('Mentoring sessions are unavailable. Try again.');}
  finally{setLoading(false)}
 },[]);
 useEffect(()=>{void load();warmBuklodAdOpportunity('points_submission_success')},[load]);


 const createSession=async()=>{
  if(busy||!selectedLesson||selectedDisciples.length<1||selectedDisciples.length>50||
     notes.trim().length<20||location.trim().length<4)return;
  setBusy('creating');setErr('');
  try {
   const {error}=await (supabase as any).rpc('report_my_mentor_teaching_with_details_r3',{
     p_lesson_id:selectedLesson,p_attendee_ids:selectedDisciples,
     p_notes:notes.trim(),p_location:location.trim(),p_request_key:requestKey
   });
   if(error)throw error;
   setRequestKey(Crypto.randomUUID());
   setNotes('');setLocation('');setSelectedLesson('');setSelectedDisciples([]);setLessonSearch('');
   await load();
   Alert.alert('Teaching session recorded','Learners are linked. Attach your mentoring photo and complete the Admin review. +15 BP after verified approval.');
   showBuklodAdOpportunity('points_submission_success');
  }catch(e){setErr(e instanceof Error?e.message:'Could not record session.');}
  finally{setBusy(null);}
 };
 const attach=async(task:Task)=>{
  if(busy||task.status==='approved'||task.status==='rejected')return;
  setBusy(task.session_id);setErr('');
  let uploadedPath:string|null=null;
  try{
   const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
   if(!permission.granted)throw new Error('Please allow photo access.');
   const picked=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:false,
     allowsMultipleSelection:false,quality:1});
   if(picked.canceled||!picked.assets?.[0])return;
   const manipulation=ImageManipulator.ImageManipulator.manipulate(picked.assets[0].uri);
   manipulation.resize({width:1280});
   const rendered=await manipulation.renderAsync();
   const image=await rendered.saveAsync({format:ImageManipulator.SaveFormat.JPEG,compress:0.7,base64:true});
   if(!image.base64)throw new Error('Image preparation failed.');
   const {data:{user}}=await supabase.auth.getUser();
   if(!user)throw new Error('Please sign in.');
   const path=`${user.id}/${task.session_id}/${Date.now()}.jpg`;
   const {error:uploadError}=await supabase.storage.from('buklod-mentoring-evidence').upload(
     path,decode(image.base64),{contentType:'image/jpeg',upsert:false});
   if(uploadError)throw uploadError;uploadedPath=path;
   const {error:attachError}=await (supabase as any).rpc('attach_my_mentor_session_photo_r2',{
      p_session_id:task.session_id,p_photo_path:path});
   if(attachError)throw attachError;
   Alert.alert('Photo submitted','Evidence photo attached. System Admin verification is required before +15 BP.');
   showBuklodAdOpportunity('points_submission_success');
   await load();
  }catch(e){
   if(uploadedPath)await supabase.storage.from('buklod-mentoring-evidence').remove([uploadedPath]).catch(()=>{});
   setErr(e instanceof Error?e.message:'Photo submission failed.');
  }finally{setBusy(null)}
 };
 return <SafeAreaView style={s.root}><ScrollView contentContainerStyle={s.content}>
 <Pressable onPress={()=>router.back()} style={s.back}><Text style={s.backText}>‹ Back</Text></Pressable>
 <Text style={s.heading}>Mentoring Lesson Evidence</Text>
 <Text style={s.sub}>Complete a real BUKLOD teaching session connected to a learning lesson.
 Record the learners, attach a genuine photo of your mentoring session, then wait for System Admin verification.
 Once approved, the existing +15 BP mentor-session reward becomes claimable.</Text>
 <Text style={s.privacy}>Get consent before taking or uploading photos. Avoid posting images of children or participants without appropriate permission. Photos are stored privately for authorized review.</Text>
 {loading&&<ActivityIndicator color="#0A7436" size="large"/>}
 {!!err&&<Text accessibilityRole="alert" style={s.err}>{err}</Text>}
 {!loading&&tasks.length===0&&<Text style={s.empty}>No lesson mentoring sessions to verify. Ask your Pastor about mentor assignments and BUKLOD learning lessons.</Text>}

 <View style={s.card}>
  <Text style={s.lesson}>Report a mentoring lesson session</Text>
  <Text style={s.meta}>Choose a BUKLOD formation lesson you actually taught.</Text>
  <TextInput placeholder="Search CCP or discipleship lessons" placeholderTextColor="#859688"
    style={s.field} value={lessonSearch} onChangeText={setLessonSearch}/>
  {lessons.filter(l=>l.title.toLowerCase().includes(lessonSearch.trim().toLowerCase())).slice(0,12).map(l=>
    <Pressable accessibilityRole="button" accessibilityState={{selected:selectedLesson===l.id}}
      style={[s.lessonChoice,selectedLesson===l.id&&s.lessonChoiceOn]} key={l.id}
      onPress={()=>setSelectedLesson(l.id)}>
     <Text style={s.lessonLabel}>{l.title}</Text>
    </Pressable>
  )}
  {!!selectedLesson&&<Text style={s.meta}>Selected: {lessons.find(l=>l.id===selectedLesson)?.title}</Text>}
  <Text style={s.meta}>Select registered assigned mentees who attended ({selectedDisciples.length} selected).</Text>
  {disciples.map(d=><Pressable key={d.disciple_id} accessibilityRole="checkbox"
   accessibilityState={{checked:selectedDisciples.includes(d.disciple_id)}}
   style={[s.lessonChoice,selectedDisciples.includes(d.disciple_id)&&s.lessonChoiceOn]}
   onPress={()=>setSelectedDisciples(current=>current.includes(d.disciple_id)?
      current.filter(id=>id!==d.disciple_id):[...current,d.disciple_id])}>
   <Text style={s.lessonLabel}>{selectedDisciples.includes(d.disciple_id)?'☑':'☐'} {d.disciple_name}</Text>
  </Pressable>)}
  {disciples.length===0&&<Text style={s.meta}>No assigned mentees. Ask your Cluster administrator to assign learners before reporting a new session.</Text>}
  <TextInput style={s.field} value={location} onChangeText={setLocation}
    placeholder="Where did mentoring take place? (required)" placeholderTextColor="#859688" maxLength={180}/>
  <TextInput style={[s.field,{minHeight:88}]} multiline textAlignVertical="top"
    placeholder="Teaching summary and location (20+ characters)"
    placeholderTextColor="#859688" value={notes} onChangeText={setNotes} maxLength={2000}/>
  <Pressable accessibilityRole="button" disabled={busy!==null||!selectedLesson||
   selectedDisciples.length<1||selectedDisciples.length>50||
   (notes.trim().length<20||location.trim().length<4)} style={[s.button,busy!==null&&s.disabled]} onPress={()=>void createSession()}>
   <Text style={s.btnText}>{busy==='creating'?'Recording...':'Record teaching session'}</Text>
  </Pressable>
 </View>
 {tasks.map(task=><View style={s.card} key={task.session_id}>
 <Text style={s.lesson}>{task.lesson}</Text>
 <Text style={s.meta}>{task.session_date} · {task.status.replace(/_/g,' ')}</Text>
 <Text style={s.meta}>{task.has_photo?'Photo received':'Photo required for new sessions'}</Text>
 {task.status!=='approved'&&task.status!=='rejected'&&<Pressable disabled={busy!==null}
   onPress={()=>void attach(task)} style={[s.button,busy!==null&&s.disabled]}>
  <Text style={s.btnText}>{busy===task.session_id?'Uploading...':task.has_photo?'Replace evidence photo':'Attach mentoring photo'}</Text>
 </Pressable>}
 </View>)}
 <Pressable onPress={()=>void load()} style={s.reload}><Text style={s.reloadText}>Refresh sessions</Text></Pressable>
 </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:'#F5FAF7'},content:{padding:17,gap:12,paddingBottom:45},
 back:{paddingVertical:9},backText:{fontSize:14,color:'#236843',fontWeight:'700'},
 heading:{fontSize:23,fontWeight:'900',color:'#1E4C32'},
 sub:{fontSize:13,lineHeight:19,color:'#425E4B'},
 privacy:{fontSize:11,lineHeight:16,color:'#74603C',backgroundColor:'#FFF8E8',
   borderRadius:12,padding:12},
 field:{padding:11,borderColor:'#CFE1D2',borderWidth:1,borderRadius:9,color:'#214832',fontSize:12},
 lessonChoice:{padding:10,borderRadius:9,backgroundColor:'#F0F5F1'},
 lessonChoiceOn:{borderColor:'#137944',borderWidth:1,backgroundColor:'#E4F4E9'},
 lessonLabel:{fontSize:12,color:'#294B34'},
 card:{padding:15,backgroundColor:'white',borderColor:'#DDEADB',borderWidth:1,
   borderRadius:15,gap:8},
 lesson:{fontSize:15,color:'#20442E',fontWeight:'800'},
 meta:{fontSize:11,color:'#6A7C6F'},
 button:{backgroundColor:'#0A7436',padding:13,borderRadius:11,alignItems:'center'},
 disabled:{opacity:0.55},btnText:{color:'white',fontWeight:'800'},
 reload:{padding:14,alignItems:'center'},reloadText:{color:'#0A7436',fontWeight:'800'},
 empty:{padding:20,backgroundColor:'white',color:'#62746A',borderRadius:14},
 err:{padding:12,backgroundColor:'#FFE8E2',color:'#A53626',borderRadius:9}
});
