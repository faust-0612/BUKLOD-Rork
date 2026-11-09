import React,{useCallback,useEffect,useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {router,useFocusEffect} from 'expo-router';
import {supabase} from '@/lib/supabase';
import {useAuth} from '@/providers/AuthProvider';
import {showBuklodAdOpportunity,warmBuklodAdOpportunity} from '@/lib/buklodAdOpportunities';
import {playBuklodGameFeedback} from '@/features/games/runtime/BuklodGameFeedback';

type Level='easy'|'medium'|'hard';
type Question={id:string;kind:'mcq'|'identification'|'enumeration'|'essay';question:string;options?:Record<string,string>;reference?:string};
type Review={id:string;kind:string;earned_units:number|null;reference:string;rationale:string;correct_answer?:any};
type Quiz={attempt_id?:string;date:string;selection_required?:boolean;legacy_attempt?:boolean;difficulty?:Level;state?:string;score_units?:number|null;awarded_points?:number;questions?:Question[];review?:Review[];review_note?:string};
const levels=[{id:'easy' as const,points:3,desc:'Stories and identification'},
{id:'medium' as const,points:6,desc:'Understanding and enumeration'},
{id:'hard' as const,points:12,desc:'Situational reasoning, cross-passages and essays'}];
function fallbackError(error:any){return ['PGRST202','42883'].includes(String(error?.code||''))||
 /Could not find the function|function public\.get_my_buklod_bible_quiz_v4.*does not exist/i.test(String(error?.message||''));}
function expected(a:any):string{
 if(typeof a==='string')return a;
 if(a?.answers)return a.answers.join(' / ');
 if(a?.groups)return a.groups.map((g:string[])=>g.join(' / ')).join(' | ');
 return '';
}
export default function BuklodBibleQuizV4({onLegacy}:{onLegacy:()=>void}){
 const {user}=useAuth();
 const [quiz,setQuiz]=useState<Quiz|null>(null);
 const [answers,setAnswers]=useState<Record<string,string|string[]>>({});
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const key=quiz?.attempt_id&&user?.id?'@buklod-bible-v4:'+user.id+':'+quiz.attempt_id:null;
 const load=useCallback(async(d?:Level)=>{
  setLoading(true);setMessage('');
  try{
   const {data,error}=await (supabase as any).rpc('get_my_buklod_bible_quiz_v4',{p_difficulty:d||null});
   if(error){if(fallbackError(error)){onLegacy();return;}throw error;}
   if(data?.legacy_attempt){onLegacy();return;}
   setQuiz(data);
   if(data?.attempt_id&&data.state==='started'&&user?.id){
    const stored=await AsyncStorage.getItem('@buklod-bible-v4:'+user.id+':'+data.attempt_id);
    setAnswers(stored?JSON.parse(stored):{});
   }else setAnswers({});
  }catch{setMessage('Quiz unavailable. Check the connection and retry.');}
  finally{setLoading(false);}
 },[onLegacy,user?.id]);
 useFocusEffect(useCallback(()=>{void load();},[load]));
 useEffect(()=>{warmBuklodAdOpportunity('points_submission_success');},[]);
 useEffect(()=>{
  if(!key||quiz?.state!=='started')return;
  const handle=setTimeout(()=>{void AsyncStorage.setItem(key,JSON.stringify(answers)).catch(()=>{});},350);
  return ()=>clearTimeout(handle);
 },[key,answers,quiz?.state]);
 const setAnswer=(id:string,a:string|string[])=>setAnswers(old=>({...old,[id]:a}));
 const setEnum=(id:string,pos:number,v:string)=>{
  const arr=Array.isArray(answers[id])?[...(answers[id] as string[])]:['',''];
  arr[pos]=v;setAnswer(id,arr);
 };
 const valid=(q:Question)=>{
  const a=answers[q.id];
  if(q.kind==='enumeration')return Array.isArray(a)&&a.length===2&&a.every(x=>x.trim().length>0);
  if(q.kind==='essay')return typeof a==='string'&&a.trim().length>=30;
  return typeof a==='string'&&a.trim().length>0;
 };
 const submit=async()=>{
  if(!quiz?.attempt_id||quiz.state!=='started'||busy||quiz.questions?.length!==5||!quiz.questions.every(valid))return;
  setBusy(true);setMessage('');
  try{
   const {data,error}=await (supabase as any).rpc('submit_my_buklod_bible_quiz_v4',{p_attempt_id:quiz.attempt_id,p_answers:answers});
   if(error)throw error;
   setQuiz(old=>({...old!,state:data.status,score_units:Number(data.score_units||0),
     awarded_points:Number(data.points||0),review:Array.isArray(data.review)?data.review:old?.review}));
   if(key)await AsyncStorage.removeItem(key);
   setMessage(data.status==='pending_review'
     ?'Essay received. Final score and BP await a rubric review.'
     :data.points>0?'+'+String(data.points)+' BP verified. Claim on Points.':'Quiz completed — see the rationale below.');
   void playBuklodGameFeedback(data.status==='completed'?'success':'collect');
   if(data.status==='completed')void showBuklodAdOpportunity('points_submission_success');
  }catch{setMessage('Submit failed. Your draft remains saved. Try again.');}
  finally{setBusy(false);}
 };
 return <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
  <Pressable onPress={()=>router.back()} style={s.back}><MaterialCommunityIcons name="arrow-left" size={20} color="#154D30"/><Text style={s.dark}>Back</Text></Pressable>
  <View style={s.hero}><Text style={s.heroTitle}>BUKLOD DAILY BIBLE QUIZ V4</Text>
   <Text style={s.light}>5 questions · Manila day · One attempt · Earn up to 3 / 6 / 12 BP</Text>
   <Text style={s.light}>Reasoning, Scripture context and learning feedback, not just memorization.</Text>
  </View>
  <Pressable style={s.link} accessibilityRole="button" onPress={()=>router.push('/faith/bible-events' as any)}>
   <MaterialCommunityIcons name="trophy" size={20} color="#075E38"/><Text style={s.dark}>Flash Challenge & Monthly Bible Arena</Text>
  </Pressable>
  {loading?<ActivityIndicator color="#075E38"/>:null}
  {message?<Text accessibilityRole="alert" style={s.notice}>{message}</Text>:null}
  {quiz?.selection_required?<View style={s.card}>
   <Text style={s.heading}>Choose today's difficulty</Text>
   {levels.map(x=><Pressable key={x.id} style={s.level} onPress={()=>void load(x.id)}>
    <Text style={s.dark}>{x.id.toUpperCase()} · Up to +{x.points} BP</Text>
    <Text style={s.muted}>{x.desc}</Text>
   </Pressable>)}
  </View>:null}
  {quiz?.state==='completed'||quiz?.state==='pending_review'?<View style={s.card}>
   <Text style={s.heading}>{quiz.state==='pending_review'?'Essay review pending':'Quiz completed'}</Text>
   <Text style={s.score}>{quiz.score_units==null?'Pending':String(quiz.score_units/2)+'/5'}</Text>
   <Text style={s.dark}>{quiz.state==='pending_review'?'BP will be decided after review':'+'+String(quiz.awarded_points||0)+' BUKLOD Points'}</Text>
   {quiz.review_note?<Text style={s.muted}>{quiz.review_note}</Text>:null}
   <Pressable style={s.link} onPress={()=>void load()}><Text style={s.dark}>Refresh assessment</Text></Pressable>
  </View>:null}
  {quiz?.state==='started'&&quiz.questions?.map((q,i)=><View key={q.id} style={s.card}>
   <Text style={s.heading}>{i+1}. {q.question}</Text>
   {q.reference?<Text style={s.muted}>Reference: {q.reference}</Text>:null}
   {q.kind==='mcq'?(['A','B','C','D'] as const).map(a=><Pressable key={a}
    style={[s.choice,answers[q.id]===a&&s.selected]} onPress={()=>{setAnswer(q.id,a);void playBuklodGameFeedback('move');}}>
    <Text style={s.dark}>{a}. {q.options?.[a]}</Text>
   </Pressable>):null}
   {q.kind==='identification'?<TextInput style={s.input} placeholder="Type your answer" maxLength={120}
    value={typeof answers[q.id]==='string'?answers[q.id] as string:''} onChangeText={v=>setAnswer(q.id,v)}/>:null}
   {q.kind==='enumeration'?[0,1].map(pos=><TextInput key={pos} style={s.input}
    placeholder={'Answer '+(pos+1)} maxLength={120}
    value={Array.isArray(answers[q.id])?(answers[q.id] as string[])[pos]||'':''}
    onChangeText={v=>setEnum(q.id,pos,v)}/>):null}
   {q.kind==='essay'?<View>
    <Text style={s.muted}>3–5 sentences. Manual rubric review is required for fair scoring.</Text>
    <TextInput multiline maxLength={2400} style={[s.input,s.essay]}
     value={typeof answers[q.id]==='string'?answers[q.id] as string:''}
     onChangeText={v=>setAnswer(q.id,v)} placeholder="Explain your analysis..."/>
   </View>:null}
  </View>)}
  {quiz?.state==='started'?<Pressable style={[s.submit,!(quiz.questions?.length===5&&quiz.questions.every(valid))&&s.disabled]}
   disabled={busy||!(quiz.questions?.length===5&&quiz.questions.every(valid))} onPress={()=>void submit()}>
    <Text style={s.submitText}>{busy?'Checking...':'Submit 5 answers'}</Text></Pressable>:null}
  {quiz?.review?.map((r,i)=><View key={r.id} style={s.card}>
   <Text style={s.heading}>Answer {i+1} · {r.earned_units==null?'Pending review':String(r.earned_units)+'/2'}</Text>
   <Text style={s.muted}>{r.reference}</Text><Text style={s.dark}>{r.rationale}</Text>
   {r.correct_answer&&r.kind!=='essay'?<Text style={s.answer}>Expected: {expected(r.correct_answer)}</Text>:null}
  </View>)}
  {!loading&&!quiz?<Pressable style={s.submit} onPress={()=>void load()}><Text style={s.submitText}>Retry</Text></Pressable>:null}
 </ScrollView>;
}
const s=StyleSheet.create({
 content:{padding:16,paddingBottom:48,gap:12,backgroundColor:'#F5FAF7'},
 back:{flexDirection:'row',alignItems:'center',gap:8},dark:{color:'#173E29',fontSize:13,fontWeight:'700'},
 hero:{backgroundColor:'#0D573B',padding:18,borderRadius:18,gap:8},heroTitle:{fontSize:19,color:'#FCE5A8',fontWeight:'900',textAlign:'center'},
 light:{color:'#F0F9EF',fontSize:12,textAlign:'center'},card:{backgroundColor:'#FFF',padding:14,borderWidth:1,borderColor:'#D9E8DC',borderRadius:14,gap:10},
 heading:{color:'#173E29',fontSize:15,fontWeight:'800'},muted:{color:'#64796A',fontSize:12,lineHeight:19},
 choice:{borderWidth:1,borderColor:'#DDE8DE',padding:12,borderRadius:10},selected:{borderColor:'#1C995A',backgroundColor:'#E6F7ED'},
 level:{backgroundColor:'#EFF7EF',padding:12,borderRadius:10,gap:3},
 input:{borderColor:'#CEE1D2',borderWidth:1,borderRadius:10,padding:12,minHeight:47,fontSize:14,color:'#173E29'},
 essay:{minHeight:125,textAlignVertical:'top'},score:{fontSize:23,color:'#146B40',fontWeight:'900'},
 submit:{padding:16,backgroundColor:'#126D3F',borderRadius:12,alignItems:'center'},
 disabled:{opacity:0.5},submitText:{color:'white',fontWeight:'900'},
 notice:{backgroundColor:'#FFF0D9',padding:12,borderRadius:12,color:'#855016'},
 link:{backgroundColor:'#E6F5EB',borderRadius:11,padding:12,flexDirection:'row',alignItems:'center',gap:8},
 answer:{color:'#146B40',fontSize:12,fontWeight:'800'}
});
