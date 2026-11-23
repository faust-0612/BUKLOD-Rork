import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import BuklodAcademicCompletionCelebration from '@/components/university/BuklodAcademicCompletionCelebration';
import type { BuklodUniversityAwardReceipt, BuklodUniversityCredentialTier } from '@/lib/buklodUniversityCompletionMotion';
import catalog from '@/data/university/buklodUniversityCatalog.json';

type StoredAward = {
 id:string; credential_code:string; status:string; qualifying_uc:number;
 paper_status:string; issued_at:string;
};
type Acknowledged = { award_id: string };
type Tab = 'all'|'certificate'|'diploma'|'bachelors'|'masters';
const GREEN='#275D45';
const TIERS:Tab[]=['all','certificate','diploma','bachelors','masters'];
const TIER_NAMES:Record<Tab,string>={all:'All',certificate:'Certificate',diploma:'Diploma',bachelors:"Bachelor's-level",masters:"Master's-level"};
const typedCatalog=catalog.credentials.map(c=>({
 ...c,
 tier:({certificate:'certificate',diploma:'diploma',bachelors_completion:'bachelors',masters_completion:'masters'} as Record<string,BuklodUniversityCredentialTier>)[c.award_type],
}));
export default function BuklodAcademyDashboard(){
 const [summary,setSummary]=useState<{total_uc:number;awards:number;enabled:boolean}|null>(null);
 const [awards,setAwards]=useState<StoredAward[]>([]);
 const [ack,setAck]=useState<ReadonlySet<string>>(new Set());
 const [uid,setUid]=useState('');
 const [selected,setSelected]=useState<Tab>('all');
 const [activeAward,setActiveAward]=useState<BuklodUniversityAwardReceipt|null>(null);
 const [busy,setBusy]=useState(true),[refreshing,setRefreshing]=useState(false),[error,setError]=useState('');
 const epoch=useRef(0);
 const fetchData=useCallback(async()=>{
  const ticket=++epoch.current;
  setError('');
  try{
   const {data:auth,error:authError}=await supabase.auth.getUser();
   if(authError||!auth.user)throw new Error('Sign in to view your academic record');
   const user=auth.user.id;
   const sync=await (supabase as any).rpc('buklod_university_sync_my_uc_v1',{p_limit:100});
   if(sync.error)throw sync.error;
   const evaluation=await (supabase as any).rpc('buklod_university_evaluate_my_awards_v1');
   if(evaluation.error)throw evaluation.error;
   const [summaryResult,awardResult,ackResult]=await Promise.all([
    (supabase as any).rpc('buklod_university_my_summary_v1'),
    (supabase as any).from('buklod_university_awards').select('id,credential_code,status,qualifying_uc,paper_status,issued_at').order('issued_at',{ascending:false}).limit(100),
    (supabase as any).from('buklod_university_notification_ack').select('award_id').limit(200),
   ]);
   if(summaryResult.error)throw summaryResult.error;
   if(awardResult.error)throw awardResult.error;
   if(ackResult.error)throw ackResult.error;
   // A credit refresh never qualifies as a graduate. Server evaluation applies exact prerequisites.
   if(ticket!==epoch.current)return;
   setUid(user);
   const next=(awardResult.data||[]) as StoredAward[];
   const known=new Set<string>((ackResult.data||[] as Acknowledged[]).map((row:Acknowledged)=>row.award_id));
   setAck(known);setAwards(next);setSummary(summaryResult.data);
   // Show only an already issued + ready paper and never replay an acknowledged ceremony.
   const first=next.find(a=>a.status==='ISSUED'&&!known.has(a.id));
   const record=first&&typedCatalog.find(c=>c.code===first.credential_code);
   if(first&&record)setActiveAward({
    awardId:first.id,credentialCode:first.credential_code,title:record.title,
    status:'ISSUED',paperReady:first.paper_status==='READY',issuedAt:first.issued_at,tier:record.tier,
   });
  }catch(e:any){if(ticket===epoch.current)setError(String(e?.message||'Unable to load Academy'));}
  finally{if(ticket===epoch.current){setBusy(false);setRefreshing(false);}}
 },[]);
 useEffect(()=>{void fetchData();return()=>{epoch.current++;};},[fetchData]);
 const byCode=useMemo(()=>new Map(awards.map(a=>[a.credential_code,a])),[awards]);
 const filtered=useMemo(()=>typedCatalog.filter(x=>selected==='all'||x.tier===selected),[selected]);
 const dismiss=async(id:string)=>{
  setActiveAward(null);
  setAck(a=>new Set([...a,id]));
  if(!uid)return;
  const {error:saveError}=await (supabase as any).from('buklod_university_notification_ack').insert({user_id:uid,award_id:id});
  if(saveError&&saveError.code!=='23505')console.warn('Academy celebration acknowledgement failed');
 };
 const paper=async(id:string)=>{
  try{
   const {data,error:rpcError}=await supabase.functions.invoke('buklod-academy-paper-v1',{body:{award_id:id}});
   if(rpcError)throw rpcError;
   if(!data?.url||typeof data.url!=='string'||!/^https:\/\//.test(data.url))throw new Error('Academic paper not available yet');
   await Linking.openURL(data.url);
  }catch(e:any){Alert.alert('Academic Paper',String(e?.message||'Download is unavailable'));}
 };
 return <View style={s.screen}>
  <ScrollView contentContainerStyle={s.content}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);void fetchData();}}/>}>
   <View style={s.header}>
    <MaterialCommunityIcons name="school-outline" size={30} color={GREEN}/>
    <View style={{flex:1}}>
     <Text style={s.kicker}>MZB MINISTRY INC.</Text>
     <Text style={s.title}>BUKLOD Academy of Higher Learning</Text>
     <Text style={s.subtitle}>Independent non-formal learning and formation</Text>
    </View>
   </View>
   {busy?<ActivityIndicator color={GREEN} style={s.loading}/>:null}
   {!!error?<View style={s.notice}><Text style={s.error}>{error}</Text>
    <Pressable onPress={()=>void fetchData()} accessibilityRole="button"><Text style={s.action}>Retry</Text></Pressable></View>:null}
   {!busy&&!error&&summary?<View style={s.stats}>
    <View><Text style={s.number}>{summary.total_uc||0}</Text><Text style={s.subtitle}>Academy Credits (UC)</Text></View>
    <View><Text style={s.number}>{summary.awards||0}</Text><Text style={s.subtitle}>Verified completions</Text></View>
   </View>:null}
   {!summary?.enabled&&!busy?<Text style={s.notice}>Academic recognition is in preparation; no credits or credentials will be fabricated.</Text>:null}
   <Pressable accessibilityRole="button" onPress={()=>router.push('/academy/research' as any)}
     style={{backgroundColor:'#E1EFE6',borderRadius:12,padding:12}}>
    <Text style={{fontWeight:'900',color:'#275D45'}}>SALIKSIK — Theological Research</Text>
    <Text style={{fontSize:11,color:'#607565',marginTop:3}}>Use Scripture to write original papers. Verified research contributes UC without adding lessons.</Text>
   </Pressable>
   <Text style={s.section}>Academic completion pathways</Text>
   <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
    {TIERS.map(t=><Pressable key={t} accessibilityRole="button" onPress={()=>setSelected(t)} style={[s.pill,t===selected&&s.selected]}>
     <Text style={[s.pillText,t===selected&&s.selectedText]}>{TIER_NAMES[t]}</Text>
    </Pressable>)}
   </ScrollView>
   {filtered.map(item=>{
    const award=byCode.get(item.code);
    const done=award?.status==='ISSUED';
    return <View style={s.card} key={item.code}>
     <View style={s.cardHead}><Text style={s.cardTitle}>{item.title}</Text><Text style={s.uc}>{item.min_uc} UC</Text></View>
     <Text style={s.meta}>{item.code} • {TIER_NAMES[item.tier]}</Text>
     <Text style={s.details}>{item.existing_evidence_gate}</Text>
     <Text style={s.meta}>{item.prerequisite_credentials.length?'Prerequisites: '+item.prerequisite_credentials.join(', '):'Foundation pathway'}</Text>
     <View style={s.footer}><Text style={[s.status,done&&s.done]}>{done?'COMPLETED':'NOT YET COMPLETED'}</Text>
     {done?<Pressable accessibilityRole="button" disabled={false} onPress={()=>void paper(award.id)}>
      <Text style={[s.action,award?.paper_status!=='READY'&&s.disabled]}>{award?.paper_status==='READY'?'Download PDF':'Prepare & Download'}</Text>
     </Pressable>:null}</View>
    </View>;
   })}
   <Text style={s.disclaimer}>MZB Ministry Inc. internal non-formal completion credentials; not government-recognized academic degrees, transferable college credits, or ordination.</Text>
  </ScrollView>
  <BuklodAcademicCompletionCelebration award={activeAward} visible={Boolean(activeAward)} onDismiss={dismiss} onOpenAcademicPaper={id=>{void dismiss(id);void paper(id);}}/>
 </View>;
}
const s=StyleSheet.create({
 screen:{flex:1,backgroundColor:'#F8FBF8'},content:{padding:14,paddingBottom:48,gap:12},
 header:{flexDirection:'row',alignItems:'center',gap:11},kicker:{fontSize:10,color:GREEN,fontWeight:'900',letterSpacing:1},
 title:{fontSize:21,lineHeight:27,fontWeight:'900',color:'#173A27'},subtitle:{fontSize:11,color:'#607266',lineHeight:16},
 loading:{padding:26},stats:{backgroundColor:'#E9F4EC',borderRadius:15,padding:14,flexDirection:'row',justifyContent:'space-between'},
 number:{fontSize:28,fontWeight:'900',color:GREEN},section:{fontSize:17,fontWeight:'800',color:'#173A27'},
 filters:{gap:6},pill:{paddingVertical:8,paddingHorizontal:11,borderRadius:18,backgroundColor:'#E8EEE9'},
 selected:{backgroundColor:GREEN},pillText:{color:GREEN,fontWeight:'700',fontSize:11},selectedText:{color:'white'},
 card:{backgroundColor:'white',borderColor:'#E2EAE2',borderWidth:1,borderRadius:12,padding:12,gap:5},
 cardHead:{flexDirection:'row',justifyContent:'space-between',gap:10},cardTitle:{fontWeight:'800',color:'#1E3B29',flex:1,fontSize:14},
 uc:{fontWeight:'900',color:GREEN},meta:{color:'#7E897E',fontSize:11},details:{color:'#475C4D',fontSize:12},
 footer:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},status:{fontSize:10,fontWeight:'900',color:'#788B7B'},
 done:{color:GREEN},action:{color:GREEN,fontWeight:'900',fontSize:12},disabled:{opacity:0.5},
 notice:{padding:13,backgroundColor:'#FFF6E8',borderRadius:8,fontSize:12,color:'#87592D'},error:{color:'#99533B'},
 disclaimer:{fontSize:11,color:'#748176',lineHeight:16,marginTop:8},
});
