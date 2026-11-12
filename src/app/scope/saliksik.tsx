import React,{useCallback,useEffect,useRef,useState} from 'react';
import {
 ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,View,
} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {router,useLocalSearchParams} from 'expo-router';
import {
 saliksikCatalog,saliksikDetail,saliksikBegin,saliksikSubmit,
 type SaliksikInvestigation,type SaliksikDetail,
 type SaliksikSession,type SaliksikResult,
} from '@/lib/saliksikClient';

const green='#19593C';
const errorText=(e:unknown)=>e instanceof Error?e.message:String(e);
const nameOf=(s:string)=>({
 understanding:'Understanding',evidence:'Biblical Evidence',
 context:'Context & Interpretation',reasoning:'Critical Reasoning',transfer:'Knowledge Transfer',
} as Record<string,string>)[s]??s;
export default function SaliksikInvestigationScreen(){
 const params=useLocalSearchParams<{scopeId?:string|string[]}>();
 const scopeId=typeof params.scopeId==='string'?params.scopeId:'';
 const [catalog,setCatalog]=useState<SaliksikInvestigation[]>([]);
 const [detail,setDetail]=useState<SaliksikDetail|null>(null);
 const [session,setSession]=useState<SaliksikSession|null>(null);
 const [answers,setAnswers]=useState<number[]>([]);
 const [result,setResult]=useState<SaliksikResult|null>(null);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const active=useRef(true),submitLock=useRef(false),epoch=useRef(0);
 const load=useCallback(async()=>{
  const current=++epoch.current;
  if(!scopeId){setLoading(false);setError('Open SALIKSIK from an active Cluster Home.');return;}
  setLoading(true);setError('');
  try{
   const items=await saliksikCatalog(scopeId);
   if(active.current&&current===epoch.current)setCatalog(items);
  }catch(e){if(active.current&&current===epoch.current)setError(errorText(e));}
  finally{if(active.current&&current===epoch.current)setLoading(false);}
 },[scopeId]);
 useEffect(()=>{active.current=true;void load();return()=>{active.current=false;epoch.current++;};},[load]);
 const open=async(item:SaliksikInvestigation)=>{
  if(busy)return;
  setBusy(true);setError('');setSession(null);setResult(null);
  try{
   const next=await saliksikDetail(scopeId,item.id);
   if(next?.id)setDetail(next);
   else throw new Error('Investigation is not available yet.');
  }catch(e){setError(errorText(e));}finally{setBusy(false);}
 };
 const start=async()=>{
  if(!detail?.id||busy)return;
  setBusy(true);setError('');setResult(null);
  try{
   const data=await saliksikBegin(scopeId,detail.id);
   if(data.completed){setResult({ok:true,passed:true,score:100,points:0,competencies:{},reason:'already_completed'});setSession(null);}
   else if(data.attempt_id && data.questions?.length){
    setSession(data);setAnswers(Array(data.questions.length).fill(-1));
   }else throw new Error('Question bank is not available.');
  }catch(e){setError(errorText(e));}finally{setBusy(false);}
 };
 const submit=async()=>{
  if(!session?.attempt_id||busy||submitLock.current)return;
  if(answers.length!==session.questions?.length||answers.some(a=>a<0)){
   setError('Sagutan muna ang lahat ng tanong.');return;
  }
  submitLock.current=true;setBusy(true);setError('');
  try{
   const graded=await saliksikSubmit(session.attempt_id,answers);
   if(!graded?.ok)throw new Error('Assessment was not confirmed by the server.');
   setResult(graded);
   setSession(null);
   await load();
  }catch(e){setError(errorText(e));}
  finally{setBusy(false);submitLock.current=false;}
 };
 const close=()=>{setDetail(null);setSession(null);setResult(null);setAnswers([]);setError('');};
 const current=catalog.find(x=>x.id===detail?.id);
 const pending=session?.questions??[];
 return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
  <Pressable accessibilityRole="button" onPress={()=>{if(detail)close();else router.back();}} style={styles.back}>
   <MaterialCommunityIcons name="chevron-left" color={green} size={22}/>
   <Text style={styles.backText}>{detail?'All investigations':'Cluster Home'}</Text>
  </Pressable>
  <Text style={styles.kicker}>BUKLOD • SALIKSIK</Text>
  <Text style={styles.title}>{detail?.title??'Tuklasin. Suriin. Unawain.'}</Text>
  <Text style={styles.sub}>{detail?.summary??'Interactive Biblical investigations with evidence-based, adaptive comprehension.'}</Text>
  {error?<View style={styles.error}><Text style={styles.errorText}>{error}</Text>
    <Pressable onPress={()=>void load()}><Text style={styles.link}>RETRY</Text></Pressable></View>:null}
  {loading?<ActivityIndicator color={green}/>:null}
  {!detail?<View style={styles.stack}>
   {!loading&&catalog.length===0?<View style={styles.card}>
     <MaterialCommunityIcons name="book-clock-outline" size={27} color={green}/>
     <Text style={styles.cardTitle}>Wala pang available na investigation.</Text>
     <Text style={styles.small}>Hindi pa nailalathala o na-activate ang SALIKSIK. Ipapakita ang mga verified investigations kapag ready na.</Text>
   </View>:null}
   {catalog.map(item=><Pressable key={item.id} style={styles.card}
     accessibilityRole="button" onPress={()=>void open(item)}>
     <View style={styles.cardTop}>
      <Text style={styles.tier}>{item.tier.toUpperCase()} • +{item.points} points</Text>
      <MaterialCommunityIcons name={item.completed?'check-decagram':'arrow-right'} size={23} color={green}/>
     </View>
     <Text style={styles.cardTitle}>{item.title}</Text>
     <Text style={styles.small}>{item.summary}</Text>
     <Text style={styles.hint}>{item.completed?'Completed • Points already verified':'Open investigation • '+item.collection_title}</Text>
    </Pressable>)}
  </View>:null}
  {detail&&!session&&!result?<View style={styles.card}>
   <Text style={styles.tier}>STUDY BEFORE ASSESSMENT</Text>
   <Text selectable style={styles.lesson}>{detail.lesson_text}</Text>
   <Text style={styles.small}>Bible references: {(detail.scripture_refs??[]).join(' • ')||'Consult the cited source'}</Text>
   <View style={styles.note}><Text style={styles.noteText}>{detail.author_disclosure}</Text></View>
   <Text style={styles.small}>Learn at your own pace. No points for merely viewing this page. Master +35 requires a separate written mastery assessment and is not currently available.</Text>
   <Pressable style={styles.primary} disabled={busy||current?.completed} onPress={()=>void start()}>
    <Text style={styles.primaryText}>{current?.completed?'ALREADY COMPLETED':'START INDEPENDENT ASSESSMENT'}</Text>
   </Pressable>
  </View>:null}
  {detail&&session?<View style={styles.card}>
   <Text style={styles.tier}>INDEPENDENT COMPREHENSION CHECK</Text>
   <Text style={styles.small}>Fixed mastery requirement: at least 80% weighted score; Investigate additionally requires 70% in each core competency. One reward per investigation.</Text>
   {pending.map((q,i)=><View key={q.id} style={styles.question}>
    <Text style={styles.questionTitle}>{i+1}. {q.prompt}</Text>
    <Text style={styles.skill}>{nameOf(q.competency)}</Text>
    {q.options.map((answer,j)=><Pressable key={j} accessibilityRole="radio"
     accessibilityState={{checked:answers[i]===j}} style={[styles.choice,answers[i]===j&&styles.selected]}
     onPress={()=>setAnswers(previous=>previous.map((x,k)=>k===i?j:x))}>
     <Text style={[styles.choiceText,answers[i]===j&&styles.choiceOn]}>{String.fromCharCode(65+j)}. {answer}</Text>
    </Pressable>)}
   </View>)}
   <Pressable disabled={busy||answers.some(x=>x<0)} style={[styles.primary,(busy||answers.some(x=>x<0))&&styles.disabled]}
    onPress={()=>void submit()}><Text style={styles.primaryText}>{busy?'VERIFYING…':'SUBMIT FOR VERIFIED MASTERY'}</Text></Pressable>
  </View>:null}
  {detail&&result?<View style={styles.card}>
   <MaterialCommunityIcons name={result.passed?'check-decagram':'book-open-page-variant'} color={green} size={30}/>
   <Text style={styles.cardTitle}>{result.passed?'Comprehension verified':'More practice recommended'}</Text>
   {result.reason==='already_completed'?<Text style={styles.small}>You've already completed this investigation. No duplicate points will be awarded.</Text>:
    <><Text style={styles.score}>{result.score}/100</Text>
     {Object.entries(result.competencies??{}).map(([key,value])=><Text key={key} style={styles.small}>{nameOf(key)}: {value}%</Text>)}
     <Text style={styles.hint}>{result.passed
      ?'Credited points: '+(result.points??0)+' • Series bonus: '+(result.series_points??0)
      :'Review weaker evidence, context or reasoning, then take a fresh independent attempt.'}</Text></>}
   {!result.passed?<Pressable style={styles.primary} onPress={()=>{setResult(null);void start();}}>
     <Text style={styles.primaryText}>REVIEW AND TRY AGAIN</Text></Pressable>:null}
   <Pressable style={styles.secondary} onPress={close}><Text style={styles.secondaryText}>BACK TO INVESTIGATIONS</Text></Pressable>
  </View>:null}
  <Text style={styles.footer}>Learning progress is personal. Exam keys are never returned to the app. Reward confirmation comes only from the BUKLOD server.</Text>
 </ScrollView>;
}
const styles=StyleSheet.create({
 screen:{backgroundColor:'#F6FAF7',flex:1},content:{maxWidth:820,alignSelf:'center',width:'100%',gap:14,padding:16,paddingBottom:88},
 back:{flexDirection:'row',alignItems:'center',alignSelf:'flex-start'},backText:{color:green,fontSize:12,fontWeight:'700'},
 kicker:{fontSize:11,fontWeight:'900',color:green,letterSpacing:1.5},title:{fontSize:24,fontWeight:'900',color:'#163627'},
 sub:{fontSize:13,color:'#65766A',lineHeight:20},stack:{gap:12},card:{backgroundColor:'#fff',borderWidth:1,borderColor:'#DFEAE2',
 borderRadius:17,padding:16,gap:12},cardTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 tier:{fontSize:10,fontWeight:'900',color:green,letterSpacing:1},
 cardTitle:{fontSize:17,fontWeight:'800',color:'#193C29'},small:{fontSize:12,color:'#728076',lineHeight:20},
 hint:{fontSize:12,fontWeight:'700',color:green},lesson:{fontSize:14,lineHeight:23,color:'#2C4535'},
 note:{padding:12,borderRadius:12,backgroundColor:'#EDF5EF'},noteText:{color:'#466854',fontSize:12,lineHeight:19},
 primary:{padding:15,borderRadius:12,backgroundColor:green,alignItems:'center'},
 primaryText:{color:'#fff',fontWeight:'900',fontSize:12},disabled:{opacity:.55},
 question:{borderTopWidth:1,borderTopColor:'#E2EAE4',paddingTop:12,gap:7},
 questionTitle:{fontSize:14,fontWeight:'800',color:'#243C2E',lineHeight:20},
 skill:{fontSize:11,color:'#72897B'},choice:{borderWidth:1,borderColor:'#DCE8DE',borderRadius:11,padding:12},
 choiceText:{color:'#365343',fontSize:13,lineHeight:19},selected:{backgroundColor:'#1D6547',borderColor:'#1D6547'},
 choiceOn:{color:'#fff',fontWeight:'700'},score:{fontSize:30,fontWeight:'900',color:green},
 secondary:{padding:13,borderWidth:1,borderColor:green,borderRadius:10,alignItems:'center'},
 secondaryText:{fontWeight:'800',fontSize:12,color:green},error:{backgroundColor:'#FFF0F0',padding:12,borderRadius:9,gap:5},
 errorText:{color:'#9B2828',fontSize:12},link:{color:'#9B2828',fontWeight:'800',fontSize:12},
 footer:{fontSize:11,color:'#89958B',lineHeight:17}
});
