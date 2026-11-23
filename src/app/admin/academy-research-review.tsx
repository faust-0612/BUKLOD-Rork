import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AdminGate } from '@/components/AdminGate';
import { supabase } from '@/lib/supabase';

type ResearchState='SUBMITTED'|'REVIEWING'|'REWORK'|'VERIFIED'|'REJECTED';
type Entry={id:string;member_name:string;research_type:string;title:string;bible_references:string;submitted_at:string};
const GREEN='#275D45';
const STATES:ResearchState[]=['SUBMITTED','REVIEWING','REWORK','VERIFIED','REJECTED'];
const LABEL:Record<ResearchState,string>={
 SUBMITTED:'Saved / pending AI',REVIEWING:'AI checking',REWORK:'Learner revision',
 VERIFIED:'Verified automatically',REJECTED:'Rejected'
};
export default function AcademyAutomatedResearchOversight(){
 const [state,setState]=useState<ResearchState>('SUBMITTED');
 const [items,setItems]=useState<Entry[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const reload=useCallback(async()=>{
  setBusy(true);setError('');
  try{
   const {data,error:dbError}=await (supabase as any).rpc('buklod_academy_admin_research_queue_v1',
    {p_status:state,p_limit:25});
   if(dbError)throw dbError;
   setItems((data||[]) as Entry[]);
  }catch(e:any){setError(String(e?.message||'Cannot load research status'));}
  finally{setBusy(false);}
 },[state]);
 useEffect(()=>{void reload();},[reload]);
 return <AdminGate><ScrollView contentContainerStyle={s.container}>
  <Text style={s.kicker}>MZB MINISTRY INC. • BUKLOD ACADEMY</Text>
  <Text style={s.title}>Automatic Research Quality Monitor</Text>
  <Text style={s.note}>You control the learning system, curriculum and assessment rubrics. Learner verification and UC use the automatic evidence checker; this monitor has no manual approval or grade editing.</Text>
  <View style={s.filters}>{STATES.map(v=><Pressable key={v} accessibilityRole="button" onPress={()=>setState(v)}
   style={[s.chip,v===state&&s.active]}><Text style={[s.chipLabel,v===state&&s.activeLabel]}>{LABEL[v]}</Text></Pressable>)}</View>
  <Pressable accessibilityRole="button" style={s.refresh} onPress={()=>void reload()}><Text style={s.refreshText}>Refresh quality status</Text></Pressable>
  {busy?<ActivityIndicator color={GREEN}/>:null}
  {!!error?<Text style={s.error}>{error}</Text>:null}
  {!busy&&!error&&items.length===0?<Text style={s.note}>No records in this state.</Text>:null}
  {items.map(item=><View key={item.id} style={s.card}>
   <Text style={s.person}>{item.member_name||'Learner'}</Text>
   <Text style={s.paper}>{item.title}</Text>
   <Text style={s.note}>{item.research_type} • {LABEL[state]} • {new Date(item.submitted_at).toLocaleDateString('en-PH')}</Text>
   <Text style={s.sources} selectable>{item.bible_references}</Text>
  </View>)}
  <Text style={s.note}>Unverifiable work returns for learner revision or safe retry. An independent ISO audit and management review remain separate from automatic learner grading.</Text>
 </ScrollView></AdminGate>;
}
const s=StyleSheet.create({
 container:{backgroundColor:'#F8FBF8',padding:14,paddingBottom:44,gap:12},kicker:{fontSize:11,fontWeight:'900',color:GREEN},
 title:{fontSize:22,fontWeight:'900',color:'#173A27'},note:{fontSize:12,color:'#66796E',lineHeight:18},
 filters:{flexDirection:'row',flexWrap:'wrap',gap:6},chip:{padding:9,borderRadius:10,backgroundColor:'#E6EEE9'},
 active:{backgroundColor:GREEN},chipLabel:{fontSize:11,color:GREEN,fontWeight:'800'},activeLabel:{color:'white'},
 refresh:{backgroundColor:GREEN,alignItems:'center',padding:12,borderRadius:12},refreshText:{color:'white',fontWeight:'800'},
 error:{color:'#A52C2C'},card:{padding:12,borderRadius:12,backgroundColor:'white',gap:7,borderWidth:1,borderColor:'#DFEADF'},
 person:{fontWeight:'900',fontSize:14,color:'#23432E'},paper:{fontWeight:'800',fontSize:16,color:'#1D3828'},
 sources:{fontSize:12,color:'#324739',lineHeight:18}
});