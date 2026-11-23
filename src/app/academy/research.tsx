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
 const [enabled,setEnabled]=useState(false);
 const [type,setType]=useState<ResearchType>('design');
 const [title,setTitle]=useState(''),[method,setMethod]=useState('');
 const [references,setReferences]=useState(''),[paper,setPaper]=useState('');
 const [busy,setBusy]=useState(false);
 const [status,setStatus]=useState('');
 const key=useRef('research:'+Crypto.randomUUID());
 const load=useCallback(async()=>{
  const {data}=await (supabase as any).from('buklod_university_config').select('enabled').eq('singleton',true).maybeSingle();
  setEnabled(data?.enabled===true);
 },[]);
 useEffect(()=>{void load();},[load]);
 const send=async()=>{
  if(!enabled){Alert.alert('SALIKSIK','Academic research is not yet enabled for members.');return;}
  if(title.trim().length<10||method.trim().length<10||references.trim().length<10||paper.trim().length<300){
   Alert.alert('Research requirements','Enter a title, research method, Bible references and at least 300 characters of original writing.');return;
  }
  setBusy(true);setStatus('');
  try{
   const {error}=await (supabase as any).rpc('buklod_academy_submit_research_v1',{
    p_key:key.current,p_type:type,p_title:title.trim(),p_method:method.trim(),
    p_references:references.trim(),p_paper:paper.trim(),
   });
   if(error)throw error;
   setStatus('Submitted for citation, originality and methodology verification. UC will be earned only after approval.');
   key.current='research:'+Crypto.randomUUID();
   setTitle('');setMethod('');setReferences('');setPaper('');
  }catch(e:any){setStatus(String(e?.message||'Research submission failed. You can retry without losing this draft.'));}
  finally{setBusy(false);}
 };
 return <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
  <Text style={s.eyebrow}>BUKLOD ACADEMY • SALIKSIK</Text>
  <Text style={s.title}>Biblical & Theological Research</Text>
  <Text style={s.info}>Write an original research paper using existing verified Bible sources. This is a research workflow, not a new lesson or automatic exam.</Text>
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
  <Text style={s.info}>{paper.length} characters • Passing review requires verified citations, originality and 80% rubric score.</Text>
  {!!status?<Text style={s.notice}>{status}</Text>:null}
  <Pressable accessibilityRole="button" disabled={busy||!enabled} style={[s.button,(busy||!enabled)&&s.disabled]} onPress={()=>void send()}>
   <Text style={s.buttonText}>{busy?'Submitting…':enabled?'SUBMIT ORIGINAL RESEARCH':'RESEARCH NOT YET ENABLED'}</Text>
  </Pressable>
  <Text style={s.info}>No uploaded manuscript is required. Scripture references are starting points, not automatic proof of an interpretation. Research reviews are handled within MZB Ministry Inc.'s internal non-formal program.</Text>
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
