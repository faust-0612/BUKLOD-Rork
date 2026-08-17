import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

type Row={progress_id:string;user_id:string;member_name:string;church_id:string;church_name:string;enrollment_id:string;lesson_id:string;lesson_number:number;lesson_title:string;track_title:string;studied_at:string};
const date=(v?:string|null)=>{if(!v)return'';const d=new Date(v);return Number.isNaN(d.getTime())?v:d.toLocaleString()};

export default function PastorFormationValidationScreen(){
  const {hasRole}=useAuth(); const allowed=hasRole('pastor')||hasRole('system_admin');
  const [rows,setRows]=useState<Row[]>([]),[notes,setNotes]=useState<Record<string,string>>({}),[search,setSearch]=useState('');
  const [loading,setLoading]=useState(true),[busyId,setBusyId]=useState<string|null>(null);
  const load=useCallback(async()=>{if(!allowed){setLoading(false);return}setLoading(true);const{data,error}=await(supabase as any).rpc('pastor_get_learning_validation_queue_v2');if(error){Alert.alert('Learning Progress Validation',error.message);setRows([])}else setRows((data??[]) as Row[]);setLoading(false)},[allowed]);
  useEffect(()=>{void load()},[load]);
  const q=search.trim().toLowerCase(); const visible=useMemo(()=>!q?rows:rows.filter(r=>[r.member_name,r.church_name,r.lesson_title,r.track_title].some(x=>x.toLowerCase().includes(q))),[rows,q]);
  const validate=(r:Row)=>Alert.alert('Pastor Validation',`Confirm that ${r.member_name} studied "${r.lesson_title}"? This sends it to System Admin for final approval.`,[{text:'CANCEL',style:'cancel'},{text:'VALIDATE',onPress:async()=>{setBusyId(r.progress_id);const{error}=await(supabase as any).rpc('pastor_validate_learning_progress_v2',{p_progress_id:r.progress_id,p_pastor_note:notes[r.progress_id]?.trim()||null});setBusyId(null);if(error)return Alert.alert('Validation failed',error.message);Alert.alert('Pastor Validated','Waiting for System Admin final approval.');await load()}}]);
  if(!allowed)return<View style={[shared.screen,shared.content]}><Text style={shared.h1}>Learning Progress Validation</Text><Card><Text>Pastor or System Admin access is required.</Text></Card></View>;
  return<ScrollView style={shared.screen} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={load}/>}>
    <Text style={s.eyebrow}>PASTOR REVIEW</Text><Text style={shared.h1}>Learning Progress Validation</Text><Text style={shared.muted}>Pastor validates first. System Admin gives final approval. Private reflection text is not shown on this queue.</Text>
    <View style={s.rule}><Text style={s.ruleTitle}>TWO-STEP APPROVAL</Text><Text style={s.ruleText}>1. Pastor validates member study progress.{'\n'}2. System Admin approves or rejects the validated lesson.</Text></View>
    <TextInput style={s.search} placeholder="Search member, Local, track, or lesson..." value={search} onChangeText={setSearch}/><SectionTitle>WAITING FOR PASTOR VALIDATION</SectionTitle>{loading&&<ActivityIndicator color={colors.green}/>} 
    {!loading&&visible.length===0&&<Card><Text style={shared.muted}>No studied lesson is waiting for Pastor validation.</Text></Card>}
    {visible.map(r=><Card key={r.progress_id}><Text style={s.member}>{r.member_name}</Text><Text style={s.local}>{r.church_name}</Text><Text style={s.track}>{r.track_title}</Text><Text style={s.lesson}>Lesson {r.lesson_number}: {r.lesson_title}</Text><Text style={s.meta}>Study saved: {date(r.studied_at)}</Text><TextInput style={s.note} multiline placeholder="Pastor note (optional)" value={notes[r.progress_id]??''} onChangeText={v=>setNotes(x=>({...x,[r.progress_id]:v}))}/><Button title={busyId===r.progress_id?'VALIDATING...':'VALIDATE LEARNING PROGRESS'} onPress={()=>validate(r)}/></Card>)}
  </ScrollView>
}
const s=StyleSheet.create({content:{padding:18,paddingBottom:40},eyebrow:{fontSize:10,fontWeight:'900',letterSpacing:.8,color:colors.greenDark,marginBottom:4},rule:{marginTop:12,padding:12,borderRadius:12,borderWidth:1,borderColor:colors.line,backgroundColor:'#F2F6F3'},ruleTitle:{fontSize:10,fontWeight:'900',color:colors.greenDark},ruleText:{marginTop:5,fontSize:12,lineHeight:19,color:colors.text},search:{marginTop:14,borderWidth:1,borderColor:colors.line,borderRadius:12,padding:12,backgroundColor:colors.white},member:{fontSize:17,fontWeight:'900',color:colors.text},local:{marginTop:3,fontSize:12,fontWeight:'900',color:colors.greenDark},track:{marginTop:10,fontSize:12,fontWeight:'800',color:colors.muted},lesson:{marginTop:3,fontSize:14,fontWeight:'900',color:colors.text},meta:{marginTop:6,fontSize:11,color:colors.muted},note:{marginTop:10,marginBottom:8,minHeight:64,borderWidth:1,borderColor:colors.line,borderRadius:12,padding:11,textAlignVertical:'top',backgroundColor:colors.white}});