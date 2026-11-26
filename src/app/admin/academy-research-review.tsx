import {useAuth} from '@/providers/AuthProvider';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AdminGate } from '@/components/AdminGate';
import { supabase } from '@/lib/supabase';

type QualitySnapshot={
 observed_at:string;academy_enabled:boolean;source_adapters_ready:number;
 source_adapters_pending:number;source_adapters_blocked:number;
 research_submitted:number;research_reviewing:number;research_rework:number;
 research_verified_30d:number;research_stale_reviewing:number;
 uc_events_30d:number;awards_issued_30d:number
};
const GREEN='#275D45';
const metrics=(s:QualitySnapshot)=>[
 {label:'Verified research (30 days)',value:s.research_verified_30d},
 {label:'Verified UC events (30 days)',value:s.uc_events_30d},
 {label:'Completion records issued (30 days)',value:s.awards_issued_30d},
 {label:'Research awaiting automated check',value:s.research_submitted},
 {label:'Research currently checking',value:s.research_reviewing},
 {label:'Learner revisions needed',value:s.research_rework},
 {label:'Stale AI checks',value:s.research_stale_reviewing},
 {label:'Source adapters ready',value:s.source_adapters_ready},
 {label:'Source adapters pending',value:s.source_adapters_pending},
 {label:'Source adapters blocked by missing content',value:s.source_adapters_blocked}
];
export default function AcademyAutomatedResearchOversight(){
 const {user}=useAuth();
 if(!(process.env.EXPO_PUBLIC_BUKLOD_ACADEMY_ENABLED==='true')||!user?.id)return <View style={{padding:24}}><Text>Academy is not available in this release.</Text></View>;
 return <AccountScopedAcademyScreen key={user.id}/>;
}
function AccountScopedAcademyScreen(){
 const [snapshot,setSnapshot]=useState<QualitySnapshot|null>(null);
 const [busy,setBusy]=useState(true),[error,setError]=useState('');
 const reload=useCallback(async()=>{
  setBusy(true);setError('');
  const {data,error:failure}=await (supabase as any).rpc('buklod_academy_quality_overview_v1');
  if(failure){setError('Academy quality monitoring is unavailable until the isolated staging migration passes verification.');}
  else {setSnapshot(data as QualitySnapshot);}
  setBusy(false);
 },[]);
 useEffect(()=>{void reload();},[reload]);
 return <AdminGate><ScrollView contentContainerStyle={s.container}>
  <Text style={s.kicker}>MZB MINISTRY INC. • ACADEMY QUALITY</Text>
  <Text style={s.title}>Research & Quality Oversight</Text>
  <Text style={s.info}>The Founder/Director controls learning standards, curriculum and rubrics. Assessment, eligibility, UC, feedback and completions are automatic; there is no manual learner approval.</Text>
  <Pressable accessibilityRole="button" style={s.refresh} onPress={()=>void reload()}>
   <Text style={s.buttonText}>Refresh quality dashboard</Text>
  </Pressable>
  {busy?<ActivityIndicator color={GREEN}/>:null}
  {!!error?<Text style={s.error}>{error}</Text>:null}
  {!!snapshot&&!busy?<View style={s.grid}>
   <Text style={s.info}>Academy source feature: {snapshot.academy_enabled?'Enabled':'Disabled / not released'}</Text>
   {metrics(snapshot).map(item=><View key={item.label} style={s.cell}>
    <Text style={s.value}>{item.value}</Text>
    <Text style={s.label}>{item.label}</Text>
   </View>)}
   <Text style={s.info}>Snapshot: {new Date(snapshot.observed_at).toLocaleString('en-PH')}</Text>
   {snapshot.research_stale_reviewing>0||snapshot.source_adapters_blocked>0?
    <Text style={s.notice}>Quality warning: source or automated review blockers need systemic correction; no student award may bypass evidence checks.</Text>:null}
  </View>:null}
  <Text style={s.info}>This admin view contains aggregate statistics only, not private papers or children's evidence. It provides no learner approval, scoring override, or credit-award actions.</Text>
  <Text style={s.info}>ISO quality conformity still requires real operational evidence, impartial internal auditing and an accountable management review. None are approvals of individual students.</Text>
 </ScrollView></AdminGate>;
}
const s=StyleSheet.create({
 container:{backgroundColor:'#F8FBF8',padding:14,paddingBottom:44,gap:12},
 kicker:{fontSize:11,fontWeight:'900',color:GREEN},title:{fontSize:22,fontWeight:'900',color:'#173A27'},
 info:{fontSize:12,color:'#657768',lineHeight:19},
 refresh:{backgroundColor:GREEN,alignItems:'center',padding:12,borderRadius:12},
 buttonText:{color:'white',fontWeight:'800'},
 grid:{padding:10,backgroundColor:'#EFF6F1',borderRadius:12,gap:9,flexDirection:'row',flexWrap:'wrap'},
 cell:{width:'47%',backgroundColor:'white',padding:12,borderRadius:10,gap:4},
 label:{fontSize:11,color:'#61796A'},value:{fontSize:21,fontWeight:'900',color:GREEN},
 notice:{fontSize:12,color:'#8D4A20',fontWeight:'700',lineHeight:18},
 error:{fontSize:12,color:'#A52C2C'}
});