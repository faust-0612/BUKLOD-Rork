import React, {useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {supabase} from '@/lib/supabase';

type Question={id:string;question:string;options:Record<'A'|'B'|'C'|'D',string>};
type Quiz={attempt_id:string;date:string;completed:boolean;score:number|null;awarded_points:number;questions:Question[]};
const letters=['A','B','C','D'] as const;
export default function BuklodDailyBibleQuiz(){
 const [quiz,setQuiz]=useState<Quiz|null>(null);
 const [answers,setAnswers]=useState<Record<string,string>>({});
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const load=useCallback(async()=>{
  setLoading(true);setMessage('');
  try {
   const {data,error}=await (supabase as any).rpc('get_my_buklod_bible_quiz_r2');
   if(error)throw error;
   setQuiz(data as Quiz);setAnswers({});
  }catch(e){setMessage('Bible Quiz is not available right now. Please try again.');}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load()},[load]);
 const submit=async()=>{
  if(!quiz||busy||quiz.completed||quiz.questions.some(q=>!answers[q.id]))return;
  setBusy(true);setMessage('');
  try {
   const {data,error}=await (supabase as any).rpc('submit_my_buklod_bible_quiz_r2',{
     p_attempt_id:quiz.attempt_id,p_answers:answers,
   });
   if(error)throw error;
   setQuiz({...quiz,completed:true,questions:[],score:Number(data.score||0),
     awarded_points:Number(data.points||0)});
   setMessage('Quiz submitted. Your score was checked by the BUKLOD server.');
  }catch{setMessage('Submission failed. Answers are still here; try again.');}
  finally{setBusy(false);}
 };
 const ready=quiz&&!quiz.completed&&quiz.questions.length===5&&quiz.questions.every(q=>answers[q.id]);
 return <SafeAreaView style={s.root}>
 <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
 <Pressable accessibilityRole="button" onPress={()=>router.back()} style={s.back}><MaterialCommunityIcons name="arrow-left" size={20} color="#294331"/><Text style={s.backText}>Back to Show Faith</Text></Pressable>
 <View style={s.hero}><MaterialCommunityIcons name="book-open-variant" size={29} color="#F5C767"/>
  <Text style={s.title}>Daily Bible Quiz</Text>
  <Text style={s.intro}>5 questions • 1 attempt per day • server-verified answers</Text>
  <Text style={s.intro}>3 correct = +3 BP · 4 = +6 BP · 5 = +12 BP</Text>
 </View>
 {loading&&<ActivityIndicator size="large" color="#0A7436"/>}
 {!!message&&<Text accessibilityRole="alert" style={s.message}>{message}</Text>}
 {quiz?.completed?<View style={s.finish}>
  <MaterialCommunityIcons name="check-decagram" size={42} color="#177A45"/>
  <Text style={s.title}>Today's quiz completed</Text>
  <Text style={s.score}>{quiz.score}/5 correct</Text>
  <Text style={s.score}>+{quiz.awarded_points} BUKLOD Points</Text>
  <Text style={s.intro}>Return tomorrow for a new set. Any earned points appear in your regular Points claim flow.</Text>
 </View>:quiz?.questions.map((q,i)=><View key={q.id} style={s.card}>
  <Text style={s.question}>{i+1}. {q.question}</Text>
  {letters.map(letter=><Pressable key={letter} accessibilityRole="button"
    accessibilityState={{selected:answers[q.id]===letter}}
    onPress={()=>setAnswers(old=>({...old,[q.id]:letter}))}
    style={[s.choice,answers[q.id]===letter&&s.chosen]}>
   <Text style={s.option}>{letter}. {q.options[letter]}</Text>
  </Pressable>)}
 </View>)}
 {!loading&&!quiz&&<Pressable onPress={()=>void load()} style={s.submit}><Text style={s.submitText}>Retry</Text></Pressable>}
 {quiz&&!quiz.completed&&<Pressable disabled={!ready||busy} style={[s.submit,(!ready||busy)&&s.disabled]}
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
 message:{color:'#7D431A',backgroundColor:'#FFF3DD',padding:10,borderRadius:10}
});
