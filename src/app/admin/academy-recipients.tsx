import {useAuth} from '@/providers/AuthProvider';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AdminGate } from '@/components/AdminGate';
import { supabase } from '@/lib/supabase';

type Tier = 'all' | 'certificate' | 'diploma' | 'bachelors' | 'masters';
type Award = {
 award_id: string; user_id: string; member_name: string; credential_code: string;
 credential_title: string; credential_tier: string; qualifying_uc: number;
 issued_at: string; paper_status: string;
};
const TABS: Tier[]=['all','certificate','diploma','bachelors','masters'];
const GREEN='#275D45';
const PAGE_SIZE=30;
const label=(tier:Tier)=>tier==='all'?'All':tier==='bachelors'?"Bachelor's-level":tier==='masters'?"Master's-level":tier.charAt(0).toUpperCase()+tier.slice(1);
const formatDate=(v:string)=>{const d=new Date(v);return Number.isNaN(d.valueOf())?'Pending':d.toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'});};

export default function BuklodAcademyRecipients(){
 const {user}=useAuth();
 if(!(process.env.EXPO_PUBLIC_BUKLOD_ACADEMY_ENABLED==='true')||!user?.id)return <View style={{padding:24}}><Text>Academy is not available in this release.</Text></View>;
 return <AccountScopedAcademyScreen key={user.id}/>;
}
function AccountScopedAcademyScreen(){
 const [tier,setTier]=useState<Tier>('all');
 const [text,setText]=useState('');
 const [query,setQuery]=useState('');
 const [rows,setRows]=useState<Award[]>([]);
 const [busy,setBusy]=useState(false),[refreshing,setRefreshing]=useState(false),[loadingMore,setLoadingMore]=useState(false);
 const [hasMore,setHasMore]=useState(false),[error,setError]=useState('');
 const epoch=useRef(0);
 const load=useCallback(async (offset:number)=>{
  const ticket=++epoch.current;
  if(offset===0)setBusy(true);else setLoadingMore(true);
  setError('');
  try {
   const {data,error:dbError}=await (supabase as any).rpc('buklod_university_admin_recipients_v1',{
    p_query:query.slice(0,80),p_tier:tier==='all'?null:tier,
    p_limit:PAGE_SIZE,p_offset:offset,
   });
   if(dbError)throw dbError;
   if(ticket!==epoch.current)return;
   const next=(data||[]) as Award[];
   setRows(old=>offset===0?next:[...old,...next.filter(x=>!old.some(y=>y.award_id===x.award_id))]);
   setHasMore(next.length===PAGE_SIZE);
  }catch(e:any){if(ticket===epoch.current)setError(String(e?.message||'Could not load recipients'));}
  finally {if(ticket===epoch.current){setBusy(false);setRefreshing(false);setLoadingMore(false);}}
 },[query,tier]);
 useEffect(()=>{void load(0);return()=>{epoch.current+=1;};},[load]);
 const refresh=()=>{setRefreshing(true);void load(0);};
 return <AdminGate>
  <ScrollView style={s.screen} contentContainerStyle={s.content}
   keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh}/>}>
   <View style={s.header}>
    <MaterialCommunityIcons name="school-outline" size={30} color={GREEN}/>
    <View style={{flex:1}}>
     <Text style={s.issuer}>MZB MINISTRY INC.</Text>
     <Text style={s.title}>Academy Award Recipients</Text>
     <Text style={s.subtitle}>BUKLOD Academy of Higher Learning — internal verified completions</Text>
    </View>
   </View>
   <View style={s.search}>
    <TextInput style={s.field} placeholder="Search member or award" value={text} onChangeText={setText}
     placeholderTextColor="#78847E" onSubmitEditing={()=>setQuery(text.trim())} returnKeyType="search" maxLength={80}/>
    <Pressable accessibilityRole="button" accessibilityLabel="Search recipients" style={s.searchButton} onPress={()=>setQuery(text.trim())}>
     <MaterialCommunityIcons name="magnify" size={20} color="white"/>
    </Pressable>
   </View>
   <ScrollView horizontal contentContainerStyle={s.filters} showsHorizontalScrollIndicator={false}>
    {TABS.map(t=><Pressable accessibilityRole="button" key={t} onPress={()=>setTier(t)}
      style={[s.filter,t===tier&&s.active]}>
      <Text style={[s.filterText,t===tier&&s.activeText]}>{label(t)}</Text>
    </Pressable>)}
   </ScrollView>
   {busy && !refreshing?<ActivityIndicator color={GREEN} style={s.center}/>:null}
   {!!error?<View style={s.center}><Text style={s.error}>{error}</Text>
     <Pressable accessibilityRole="button" onPress={()=>void load(0)}><Text style={s.retry}>Retry</Text></Pressable></View>:null}
   {!busy&&!error&&rows.length===0?<View style={s.center}>
    <MaterialCommunityIcons name="certificate-outline" size={35} color="#8BA99B"/>
    <Text style={s.empty}>No issued academic completions yet.</Text>
    <Text style={s.subtitle}>Only verified awards appear here. No fabricated recipients.</Text>
   </View>:null}
   {!error&&rows.map(a=><View style={s.card} key={a.award_id}>
    <View style={s.row}><Text style={s.member}>{a.member_name||'Member'}</Text>
    <Text style={s.uc}>{a.qualifying_uc} UC</Text></View>
    <Text style={s.credential}>{a.credential_title}</Text>
    <Text style={s.meta}>{a.credential_code} • {label(a.credential_tier as Tier)} • {formatDate(a.issued_at)}</Text>
    <Text style={s.meta}>Completion paper: {a.paper_status==='READY'?'Ready':'Preparing / pending verification'}</Text>
   </View>)}
   {!busy&&!error&&hasMore?<Pressable accessibilityRole="button" disabled={loadingMore} style={s.load} onPress={()=>void load(rows.length)}>
    <Text style={s.loadText}>{loadingMore?'Loading…':'LOAD MORE'}</Text></Pressable>:null}
  </ScrollView>
 </AdminGate>;
}
const s=StyleSheet.create({
 screen:{flex:1,backgroundColor:'#F7FAF7'},content:{paddingHorizontal:14,paddingTop:18,paddingBottom:50,gap:12},
 header:{flexDirection:'row',gap:12,alignItems:'center'},issuer:{fontSize:10,color:GREEN,letterSpacing:1,fontWeight:'800'},
 title:{fontSize:22,fontWeight:'900',color:'#1B3226'},subtitle:{fontSize:12,color:'#657468',lineHeight:17},
 search:{flexDirection:'row',gap:6},field:{flex:1,backgroundColor:'#fff',borderWidth:1,borderColor:'#D8E6DC',borderRadius:10,padding:11,color:'#223A2C'},
 searchButton:{width:48,backgroundColor:GREEN,borderRadius:10,alignItems:'center',justifyContent:'center'},
 filters:{gap:6,paddingVertical:4},filter:{paddingHorizontal:13,paddingVertical:8,borderRadius:20,backgroundColor:'#E6EEE9'},
 active:{backgroundColor:GREEN},filterText:{fontSize:12,color:GREEN,fontWeight:'700'},activeText:{color:'#fff'},
 center:{padding:22,alignItems:'center',gap:9},empty:{fontWeight:'700',fontSize:14,color:'#315A40'},error:{color:'#9C3A24',textAlign:'center'},
 retry:{color:GREEN,fontWeight:'800'},card:{padding:12,borderRadius:12,backgroundColor:'#fff',gap:5,borderWidth:1,borderColor:'#E0EBE3'},
 row:{flexDirection:'row',justifyContent:'space-between',gap:8},member:{color:'#183326',fontWeight:'800',flex:1,fontSize:15},
 uc:{color:GREEN,fontWeight:'900'},credential:{color:'#223B2B',fontWeight:'700'},meta:{color:'#758076',fontSize:11},
 load:{backgroundColor:'#E6EEE9',padding:12,alignItems:'center',borderRadius:10},loadText:{color:GREEN,fontWeight:'800'},
});
