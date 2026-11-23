import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { AdminGate } from '@/components/AdminGate';
import { supabase } from '@/lib/supabase';

type Submission={id:string;member_name:string;research_type:string;title:string;method:string;bible_references:string;paper_text:string;submitted_at:string};
const GREEN='#275D45';
export default function AcademyResearchReview(){
 const [items,setItems]=useState<Submission[]>([]),[active,setActive]=useState<string|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [score,setScore]=useState(''),[feedback,setFeedback]=useState('');
 const [citations,setCitations]=useState(false),[originality,setOriginality]=useState(false);
 const reload=useCallback(async()=>{
  setBusy(true);setError('');
  const {data,error:dbError}=await (supabase as any).rpc('buklod_academy_admin_research_queue_v1',{p_status:'SUBMITTED',p_limit:25});
  if(dbError)setError(String(dbError.message));else setItems((data||[]) as Submission[]);
  setBusy(false);
 },[]);
 useEffect(()=>{void reload();},[reload]);
 const submit=async(id:string,approved:boolean)=>{
  const mark=Number(score);
  if(!Number.isInteger(mark)||mark<0||mark>100||feedback.trim().length<50){
   Alert.alert('Reviewer requirements','Score 0–100 and substantive feedback of at least 50 characters are required.');return;
  }
  if(approved&&(!citations||!originality||mark<80)){
   Alert.alert('Cannot approve','Verify citations and originality with a passing score before awarding UC.');return;
  }
  setBusy(true);setError('');
  try{
   const {error:dbError}=await (supabase as any).rpc('buklod_academy_review_research_v1',{
    p_submission:id,p_approved:approved,p_score:mark,p_citations_verified:citations,
    p_originality_checked:originality,p_feedback:feedback.trim(),
   });
   if(dbError)throw dbError;
   setActive(null);setScore('');setFeedback('');setCitations(false);setOriginality(false);
   await reload();
  }catch(e:any){setError(String(e?.message||'Review failed'));}
  finally{setBusy(false);}
 };
 return <AdminGate><ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
  <Text style={s.kicker}>MZB MINISTRY INC. — SALIKSIK</Text>
  <Text style={s.title}>Research Evidence Review</Text>
  <Text style={s.helper}>Only approved, original, source-verifiable research receives Academy UC. Research reviews cannot be self-approved.</Text>
  <Pressable accessibilityRole="button" style={s.refresh} onPress={()=>void reload()}><Text style={s.buttonText}>Refresh pending queue</Text></Pressable>
  {busy?<ActivityIndicator color={GREEN}/>:null}
  {!!error?<Text style={s.error}>{error}</Text>:null}
  {!busy&&items.length===0?<Text style={s.helper}>No pending research submissions.</Text>:null}
  {items.map(i=><View key={i.id} style={s.card}>
   <Text style={s.name}>{i.member_name}</Text>
   <Text style={s.paperTitle}>{i.title}</Text>
   <Text style={s.helper}>{i.research_type} • {new Date(i.submitted_at).toLocaleDateString('en-PH')}</Text>
   <Text style={s.label}>Research design / method</Text><Text selectable style={s.paragraph}>{i.method}</Text>
   <Text style={s.label}>Biblical sources</Text><Text selectable style={s.paragraph}>{i.bible_references}</Text>
   <Text style={s.label}>Original paper</Text><Text selectable style={s.paragraph}>{i.paper_text}</Text>
   {active===i.id?<View style={s.review}>
    <TextInput style={s.input} value={score} onChangeText={setScore} keyboardType="number-pad" maxLength={3} placeholder="Rubric score 0–100"/>
    <TextInput style={[s.input,s.multiline]} multiline value={feedback} onChangeText={setFeedback} maxLength={2000}
     placeholder="Reviewer feedback (min 50 characters)"/>
    <View style={s.toggle}><Text>Citations checked against verified sources</Text><Switch value={citations} onValueChange={setCitations}/></View>
    <View style={s.toggle}><Text>Originality evaluated</Text><Switch value={originality} onValueChange={setOriginality}/></View>
    <View style={s.actions}>
     <Pressable accessibilityRole="button" disabled={busy} style={s.gray} onPress={()=>void submit(i.id,false)}><Text style={s.grayText}>Return for revision</Text></Pressable>
     <Pressable accessibilityRole="button" disabled={busy} style={s.green} onPress={()=>void submit(i.id,true)}><Text style={s.buttonText}>Verify & grant UC</Text></Pressable>
    </View>
   </View>:<Pressable accessibilityRole="button" style={s.refresh} onPress={()=>{setActive(i.id);setScore('');setFeedback('');setCitations(false);setOriginality(false);}}><Text style={s.buttonText}>Review evidence</Text></Pressable>}
  </View>)}
 </ScrollView></AdminGate>;
}
const s=StyleSheet.create({
 container:{backgroundColor:'#F8FBF8',padding:14,paddingBottom:40,gap:12},kicker:{fontSize:11,fontWeight:'900',color:GREEN},
 title:{fontSize:22,fontWeight:'900',color:'#173A27'},helper:{fontSize:12,color:'#728277',lineHeight:18},
 refresh:{backgroundColor:GREEN,alignItems:'center',padding:12,borderRadius:12},buttonText:{color:'white',fontWeight:'800',fontSize:12},
 error:{color:'#A52C2C'},card:{backgroundColor:'white',borderRadius:12,borderWidth:1,borderColor:'#DFEADF',padding:12,gap:7},
 name:{fontWeight:'900',fontSize:14,color:'#23432E'},paperTitle:{fontSize:16,fontWeight:'800',color:'#1D3828'},
 label:{fontWeight:'700',fontSize:12,color:GREEN},paragraph:{fontSize:12,lineHeight:18,color:'#324739'},
 review:{gap:9,backgroundColor:'#F1F6F2',padding:10,borderRadius:10},
 input:{borderRadius:10,padding:10,backgroundColor:'white',borderWidth:1,borderColor:'#DAE5DD',color:'#203D27'},
 multiline:{minHeight:90,textAlignVertical:'top'},toggle:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:14},
 actions:{flexDirection:'row',gap:8},gray:{backgroundColor:'#E7EDE9',padding:11,flex:1,alignItems:'center',borderRadius:8},
 grayText:{color:'#385441',fontWeight:'700',fontSize:11},
 green:{backgroundColor:GREEN,padding:11,flex:1,alignItems:'center',borderRadius:8},
});
