import React, {useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {supabase} from '@/lib/supabase';
import {showBuklodAdOpportunity,warmBuklodAdOpportunity} from '@/lib/buklodAdOpportunities';

type Question={id:string;question:string;options:Record<'A'|'B'|'C'|'D',string>};
type Level='easy'|'medium'|'hard';
type Quiz={attempt_id?:string;date:string;selection_required?:boolean;difficulty?:Level;completed:boolean;score:number|null;awarded_points:number;questions:Question[]};
const LEVELS=[{id:'easy',title:'EASY',points:3,subtitle:'Familiar Bible stories'},
{id:'medium',title:'MEDIUM',points:6,subtitle:'People and Bible teachings'},
{id:'hard',title:'HARD',points:12,subtitle:'Deeper Scripture knowledge'}] as const;
const letters=['A','B','C','D'] as const;
export default function BuklodDailyBibleQuiz(){
 const [quiz,setQuiz]=useState<Quiz|null>(null);
 const [answers,setAnswers]=useState<Record<string,string>>({});
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const load=useCallback(async(difficulty?:Level)=>{
  setLoading(true);setMessage('');
  try {
   const {data,error}=await (supabase as any).rpc('get_my_buklod_bible_quiz_r3',{p_difficulty:difficulty??null});
   if(error)throw error;
   setQuiz(data as Quiz);setAnswers({});
  }catch(e){setMessage('Bible Quiz is not available right now. Please try again.');}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();warmBuklodAdOpportunity('points_submission_success');},[load]);
 const submit=async()=>{
  if(!quiz||busy||quiz.completed||!quiz.attempt_id||quiz.questions.some(q=>!answers[q.id]))return;
  setBusy(true);setMessage('');
  try {
   const {data,error}=await (supabase as any).rpc('submit_my_buklod_bible_quiz_r3',{
     p_attempt_id:quiz.attempt_id,p_answers:answers,
   });
   if(error)throw error;
   setQuiz({...quiz,completed:true,questions:[],score:Number(data.score||0),
     awarded_points:Number(data.points||0)});
   setMessage(Number(data.points||0)>0?`+${Number(data.points)} BP earned — available in Points claim!`:'Quiz completed. You need at least 4 correct answers to earn BP.');
   showBuklodAdOpportunity('points_submission_success');
  }catch{setMessage('Submission failed. Answers are still here; try again.');}
  finally{setBusy(false);}
 };
 const ready=quiz&&!quiz.selection_required&&!quiz.completed&&quiz.questions.length===5&&quiz.questions.every(q=>answers[q.id]);
 return <SafeAreaView style={s.root}>
 <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
 <Pressable accessibilityRole="button" onPress={()=>router.back()} style={s.back}><MaterialCommunityIcons name="arrow-left" size={20} color="#294331"/><Text style={s.backText}>Back to Home</Text></Pressable>
 <View style={s.hero}><MaterialCommunityIcons name="book-open-variant" size={29} color="#F5C767"/>
  <Text style={s.title}>Daily Bible Quiz</Text>
  <Text style={s.intro}>5 automatic questions daily • Choose a difficulty • One attempt per day</Text>
  <Text style={s.intro}>Earn points with at least 4/5 correct answers. Easy +3 · Medium +6 · Hard +12 BP</Text>
 </View>
 {loading&&<ActivityIndicator size="large" color="#0A7436"/>}
 {!!message&&<Text accessibilityRole="alert" style={s.message}>{message}</Text>}
 {quiz?.selection_required&&<View style={s.card}>
   <Text style={s.question}>Choose today's difficulty</Text>
   <Text style={s.help}>You can choose only once today. Your five questions will be generated automatically from that difficulty's Bible question bank. Answer at least 4 correctly to earn points.</Text>
   {LEVELS.map(level=><Pressable key={level.id} accessibilityRole="button"
     onPress={()=>void load(level.id)} style={s.level}>
     <Text style={s.levelTitle}>{level.title} · +{level.points} BP</Text>
     <Text style={s.help}>{level.subtitle} · 4 of 5 correct required</Text>
   </Pressable>)}
  </View>}
 {quiz?.completed?<View style={s.finish}>
  <MaterialCommunityIcons name="check-decagram" size={42} color="#177A45"/>
  <Text style={s.title}>Today's quiz completed</Text>
  <Text style={s.score}>{(quiz.difficulty||'easy').toUpperCase()} · {quiz.score}/5 correct</Text>
  <Text style={s.score}>+{quiz.awarded_points} BUKLOD Points</Text>
  <Text style={s.intro}>Return tomorrow for a new set. Any earned points appear in your regular Points claim flow.</Text>
 </View>:quiz?.questions?.map((q,i)=><View key={q.id} style={s.card}>
  <Text style={s.question}>{i+1}. {q.question}</Text>
  {letters.map(letter=><Pressable key={letter} accessibilityRole="button"
    accessibilityState={{selected:answers[q.id]===letter}}
    onPress={()=>setAnswers(old=>({...old,[q.id]:letter}))}
    style={[s.choice,answers[q.id]===letter&&s.chosen]}>
   <Text style={s.option}>{letter}. {q.options[letter]}</Text>
  </Pressable>)}
 </View>)}
 {!loading&&!quiz&&<Pressable onPress={()=>void load()} style={s.submit}><Text style={s.submitText}>Retry</Text></Pressable>}
 {quiz&&!quiz.selection_required&&!quiz.completed&&<Pressable disabled={!ready||busy} style={[s.submit,(!ready||busy)&&s.disabled]}
 onPress={()=>void submit()}><Text style={s.submitText}>{busy?'Checking answers...':'Submit 5 Answers'}</Text></Pressable>}
 </ScrollView>
 </SafeAreaView>
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:'#F5FAF7'},content:{padding:16,gap:13,paddingBottom:45},
 back:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:7},
 backText:{fontSize:13,color:'#294331',fontWeight:'700'},
 hero:{alignItems:'center',backgroundColor:'#0D573B',borderRadius:19,padding:21,gap:7},
 title:{fontSize:21,fontWeight:'900',color:'#F5C767',textAlign:'center'},
 intro:{fontSize:12,lineHeight:18,color:'#ECF7EF',textAlign:'center'},
 card:{padding:16,borderRadius:16,backgroundColor:'white',borderWidth:1,borderColor:'#D9E8DC',gap:10},
 question:{fontSize:15,fontWeight:'800',color:'#26422E',marginBottom:6},
 choice:{borderWidth:1,borderColor:'#DEE8DC',backgroundColor:'#FAFCFA',borderRadius:11,padding:12,minHeight:46},
 chosen:{borderColor:'#0F824A',backgroundColor:'#E2F7E8'},
 option:{fontSize:13,color:'#294331'},
 submit:{backgroundColor:'#0A7436',borderRadius:14,padding:16,alignItems:'center'},
 disabled:{backgroundColor:'#81968A'},
 submitText:{fontSize:14,color:'white',fontWeight:'900'},
 score:{fontSize:20,fontWeight:'900',color:'#0A7436'},
 finish:{padding:20,alignItems:'center',backgroundColor:'white',borderRadius:17,gap:12},
 level:{borderRadius:13,borderWidth:1,borderColor:'#9EC8AA',backgroundColor:'#EDF9F0',padding:15,gap:4},
 levelTitle:{fontSize:16,fontWeight:'900',color:'#125D37'},
 help:{fontSize:12,color:'#506A57',lineHeight:18},
 message:{color:'#7D431A',backgroundColor:'#FFF3DD',padding:10,borderRadius:10}
});
