import {useAuth} from '@/providers/AuthProvider';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { supabase } from '@/lib/supabase';

type ResearchType='design'|'exegesis'|'comparative'|'bachelors_capstone'|'masters_capstone';
const OPTIONS: {type:ResearchType;label:string;uc:number}[]=[
 {type:'design',label:'Research Design',uc:40},
 {type:'exegesis',label:'Exegetical Paper',uc:60},
 {type:'comparative',label:'Comparative Theology',uc:80},
 {type:'bachelors_capstone',label:"Bachelor's-level Integrative Paper",uc:100},
 {type:'masters_capstone',label:"Master's-level Thesis-style Capstone",uc:150},
];
const GREEN='#275D45';
const ANCHORS=[
 'Scripture: 2 Timothy 3:16–17; 2 Peter 1:20–21',
 'Christology: John 1:1–14; Colossians 1:15–20',
 'Salvation: Romans 3:21–26; Ephesians 2:8–10',
 'Church: Acts 2:41–47; 1 Corinthians 12',
 'Mission: Matthew 28:18–20; Acts 1:8',
];
export default function BuklodAcademySaliksik(){
 const {user}=useAuth();
 if(!(process.env.EXPO_PUBLIC_BUKLOD_ACADEMY_ENABLED==='true')||!user?.id)return <View style={{padding:24}}><Text>Academy is not available in this release.</Text></View>;
 return <AccountScopedAcademyScreen key={user.id}/>;
}
function AccountScopedAcademyScreen(){
 const [enabled,setEnabled]=useState(false);
 const [type,setType]=useState<ResearchType>('design');
 const [title,setTitle]=useState(''),[method,setMethod]=useState('');
 const [references,setReferences]=useState(''),[paper,setPaper]=useState('');
 const [busy,setBusy]=useState(false);
 const [status,setStatus]=useState('');
 const key=useRef('research:'+Crypto.randomUUID());
 const [pendingId,setPendingId]=useState<string|null>(null);
 const [reviewing,setReviewing]=useState(false);
 const [feedback,setFeedback]=useState<{headline?:string;improvements?:string[];next_steps?:string[]}|null>(null);
 const reviewSaved=useCallback(async(id:string)=>{
  setReviewing(true);
  setStatus('Automatic research verification is checking the original Bible sources and your published rubric…');
  try{
   const {data,error}=await supabase.functions.invoke('buklod-academy-research-ai-v2',
    {body:{action:'review',submission_id:id}});
   if(error||data?.ok===false)throw Error(data?.error||'Automatic verification unavailable; your work is saved.');
   setFeedback(data?.feedback||null);
   if(data?.status==='VERIFIED'){
    setStatus('Automatically verified'+(Number.isFinite(data.score)?(' • '+data.score+'%'):'')+
     (data.new_uc?(' • +'+data.new_uc+' UC'):'')+'. No manual approval required.');
    setPendingId(null);
    key.current='research:'+Crypto.randomUUID();
    setTitle('');setMethod('');setReferences('');setPaper('');
   }else if(data?.status==='REWORK'){
    setStatus('Revision needed. Use the automatic feedback below, edit and submit the improved version.');
    setPendingId(null);
    // Keep the same idempotency key and learner draft for server-side REWORK replacement.
   }else{
    setPendingId(id);
    setStatus('Your research is saved and automatic verification is processing. Retry later or reopen this screen.');
   }
  }catch(e:any){
   setPendingId(id);
   setStatus(String(e?.message||'Connection interrupted. Your paper is saved for automatic retry.'));
  }finally{setReviewing(false);}
 },[]);

 const load=useCallback(async()=>{
  const {data}=await (supabase as any).from('buklod_university_config').select('enabled').eq('singleton',true).maybeSingle();
  setEnabled(data?.enabled===true);
  if(data?.enabled!==true)return;
  // Recover saved work on app reopen; never create another record or manual queue.
  const pending=await (supabase as any).rpc('buklod_academy_my_research_v2',{p_limit:10});
  if(!pending.error){
   const latest=(pending.data||[]).find((r:any)=>r.status==='SUBMITTED'||r.status==='REVIEWING');
   if(latest?.id){setPendingId(latest.id);void reviewSaved(latest.id);return;}
  }
  // A REWORK submission is the learner's own saved editable draft, not an admin queue.
  // Restore its original idempotency key so revision updates the same private record.
  const {data:drafts,error:draftError}=await (supabase as any)
   .from('buklod_academy_research_submissions')
   .select('research_key,research_type,title,method,bible_references,paper_text,feedback_json')
   .eq('status','REWORK')
   .order('updated_at',{ascending:false}).limit(1);
  if(!draftError&&drafts?.[0]){
   const draft=drafts[0];
   if(OPTIONS.some(option=>option.type===draft.research_type)){
    key.current=draft.research_key;
    setType(draft.research_type as ResearchType);
    setTitle(draft.title||'');
    setMethod(draft.method||'');
    setReferences(draft.bible_references||'');
    setPaper(draft.paper_text||'');
    setFeedback(draft.feedback_json||null);
    setStatus('Your last research draft was restored. Revise it and submit for automatic rechecking.');
   }
  }
 },[reviewSaved]);
 useEffect(()=>{void load();},[load]);
 const send=async()=>{
  if(!enabled){Alert.alert('SALIKSIK','Academic research is not yet enabled for members.');return;}
  if(pendingId){void reviewSaved(pendingId);return;}
  if(title.trim().length<10||method.trim().length<10||references.trim().length<10||paper.trim().length<300){
   Alert.alert('Research requirements','Enter a title, research method, Bible references and at least 300 characters of original writing.');return;
  }
  setBusy(true);setStatus('Saving research for automatic verification…');setFeedback(null);
  try{
   const {data,error}=await (supabase as any).rpc('buklod_academy_submit_research_v1',{
    p_key:key.current,p_type:type,p_title:title.trim(),p_method:method.trim(),
    p_references:references.trim(),p_paper:paper.trim(),
   });
   if(error)throw error;
   const id=String(data||'');
   if(!/^[a-f0-9-]{36}$/i.test(id))throw Error('Saved research has no returned review ID. Reopen the Academy to resume.');
   setPendingId(id);
   await reviewSaved(id);
  }catch(e:any){setStatus(String(e?.message||'Research submission failed. You can retry without losing this draft.'));}
  finally{setBusy(false);}
 };
 return <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
  <Text style={s.eyebrow}>BUKLOD ACADEMY • SALIKSIK</Text>
  <Text style={s.title}>Biblical & Theological Research</Text>
  <Text style={s.info}>Write original research using existing verified Bible sources. Every submission receives automatic source/rubric verification and feedback; no manual approval.</Text>
  <Text style={s.section}>Choose research output</Text>
  <View style={s.options}>{OPTIONS.map(x=><Pressable accessibilityRole="button" key={x.type} onPress={()=>setType(x.type)}
   style={[s.chip,type===x.type&&s.selected]}><Text style={[s.chipText,type===x.type&&s.chipSelected]}>{x.label} • +{x.uc} UC</Text></Pressable>)}</View>
  <Text style={s.section}>Suggested Biblical research anchors</Text>
  {ANCHORS.map(a=><Pressable accessibilityRole="button" style={s.anchor} key={a} onPress={()=>setReferences(value=>value?value+'; '+a:a)}>
   <Text style={s.info}>{a}</Text></Pressable>)}
  <Text style={s.section}>Your research</Text>
  <TextInput style={s.input} placeholder="Research title" placeholderTextColor="#88968C" value={title} maxLength={180} onChangeText={setTitle}/>
  <TextInput style={[s.input,s.long]} multiline placeholder="Research design, question, approach and limitations" placeholderTextColor="#88968C" value={method} maxLength={1500} onChangeText={setMethod}/>
  <TextInput style={[s.input,s.long]} multiline placeholder="Biblical references and context (verify citations)" placeholderTextColor="#88968C" value={references} maxLength={1500} onChangeText={setReferences}/>
  <TextInput style={[s.input,s.paper]} multiline placeholder="Original research paper, argument, evidence and counterarguments" placeholderTextColor="#88968C" value={paper} maxLength={30000} onChangeText={setPaper}/>
  <Text style={s.info}>{paper.length} characters • Published evidence-based rubrics determine whether research passes. Higher-level capstones receive a second automatic check.</Text>
  {!!status?<Text style={s.notice}>{status}</Text>:null}
  {!!feedback?.headline?<View style={s.notice}>
   <Text style={s.section}>{feedback.headline}</Text>
   {(feedback.improvements||[]).map((x,i)=><Text style={s.info} key={'a'+i}>• {x}</Text>)}
   {(feedback.next_steps||[]).map((x,i)=><Text style={s.info} key={'n'+i}>Next: {x}</Text>)}
  </View>:null}
  <Pressable accessibilityRole="button" disabled={busy||reviewing||!enabled} style={[s.button,(busy||reviewing||!enabled)&&s.disabled]} onPress={()=>void send()}>
   <Text style={s.buttonText}>{busy?'Saving…':reviewing?'AUTO-VERIFYING…':pendingId?'RESUME AUTOMATIC REVIEW':enabled?'SAVE & AUTO-VERIFY':'RESEARCH NOT YET ENABLED'}</Text>
  </Pressable>
  <Text style={s.info}>No uploaded manuscript is required. Scripture references are starting points, not automatic proof of an interpretation. All outcomes are checked by automated research faculty under the founder's published quality policy. Interrupted checks can resume without an approval queue.</Text>
 </ScrollView>;
}
const s=StyleSheet.create({
 content:{backgroundColor:'#F8FBF8',padding:16,paddingBottom:60,gap:12},
 eyebrow:{fontSize:11,fontWeight:'900',color:'#275D45'},title:{fontSize:22,fontWeight:'900',color:'#183D28'},
 info:{fontSize:12,lineHeight:19,color:'#5E7362'},section:{fontSize:15,fontWeight:'800',color:'#23452F'},
 options:{flexDirection:'row',flexWrap:'wrap',gap:7},chip:{paddingHorizontal:12,paddingVertical:8,borderRadius:16,backgroundColor:'#E6EEE8'},
 selected:{backgroundColor:'#275D45'},chipText:{fontSize:11,color:'#275D45',fontWeight:'700'},chipSelected:{color:'#fff'},
 anchor:{padding:8,borderRadius:8,backgroundColor:'#EFF6F0'},input:{backgroundColor:'#fff',borderWidth:1,borderColor:'#CFE1D3',padding:12,borderRadius:10,fontSize:13,color:'#243D2B'},
 long:{minHeight:80,textAlignVertical:'top'},paper:{minHeight:220,textAlignVertical:'top'},
 button:{backgroundColor:'#275D45',padding:15,alignItems:'center',borderRadius:12},buttonText:{fontSize:12,color:'white',fontWeight:'900'},
 disabled:{opacity:0.5},notice:{padding:11,backgroundColor:'#E3F3E6',borderRadius:9,color:'#235734'},
});
