import React, { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, StyleSheet, Text, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { useBuklodReduceMotion } from '@/components/HomeMotion';

type Notice={id:string;uc:number;source:string};
const SAFE_READING_ROUTE=/^\/(learn|academy|faith|bible|word|kl|children|devotional|kabihasnang-ligaw)(\/|$)/i;
const LABELS:Record<string,string>={
 daily_reading:'Daily Reading',word:'Word',bible_reading:'Bible Reading',
 abaka:'ABaKa',children_story:"Children's Story",kl:'Kingdom Library',
 formation:'BUKLOD Formation',saliksik_research:'SALIKSIK Research',
};

/** One lightweight, event-driven nonblocking UC receipt, only on reading screens.
 * Never runs a poll, changes BP claiming, opens a modal, or paints over Wall ads.
 */
export default function BuklodAcademyUCToastHost(){
 const {user}=useAuth();
 const path=usePathname()||'';
 const insets=useSafeAreaInsets();
 const reduceMotion=useBuklodReduceMotion();
 const [notice,setNotice]=useState<Notice|null>(null);
 const [active,setActive]=useState(AppState.currentState==='active');
 const seen=useRef(new Set<string>());
 const opacity=useRef(new Animated.Value(0)).current;
 const y=useRef(new Animated.Value(0)).current;
 const lastUser=useRef<string|null>(null);
 useEffect(()=>{
  const s=AppState.addEventListener('change',v=>setActive(v==='active'));
  return()=>s.remove();
 },[]);
 useEffect(()=>{
  if(lastUser.current!==user?.id){
   seen.current.clear();setNotice(null);lastUser.current=user?.id||null;
  }
  if(!user?.id)return;
  let disposed=false;
  let channel:ReturnType<typeof supabase.channel>|null=null;
  void (async()=>{
   // Academy feature starts OFF; subscription is not installed before explicit staging activation.
   const {data}=await (supabase as any).from('buklod_university_config')
    .select('enabled').eq('singleton',true).maybeSingle();
   if(disposed||data?.enabled!==true)return;
   channel=supabase.channel('academy-uc-'+user.id)
    .on('postgres_changes',{
     event:'INSERT',schema:'public',table:'buklod_university_uc_ledger',filter:'user_id=eq.'+user.id,
    },(event:any)=>{
     const row=event.new||{};
     if(row.user_id!==user.id||typeof row.id!=='string'||seen.current.has(row.id))return;
     const uc=Number(row.uc);
     if(!Number.isInteger(uc)||uc<=0||uc>200)return;
     seen.current.add(row.id);
     if(seen.current.size>120)seen.current.clear();
     setNotice({id:row.id,uc,source:LABELS[String(row.source_module)]||'Verified learning'});
    }).subscribe();
  })();
  return()=>{disposed=true;if(channel)void supabase.removeChannel(channel);};
 },[user?.id]);
 useEffect(()=>{
  if(!notice||!active||!SAFE_READING_ROUTE.test(path))return;
  opacity.stopAnimation();y.stopAnimation();
  opacity.setValue(1);y.setValue(reduceMotion?0:14);
  if(!reduceMotion)Animated.timing(y,{toValue:0,duration:240,easing:Easing.out(Easing.cubic),useNativeDriver:true}).start();
  const timer=setTimeout(()=>{
   Animated.timing(opacity,{toValue:0,duration:reduceMotion?0:230,useNativeDriver:true}).start(({finished})=>{
    if(finished)setNotice(current=>current?.id===notice.id?null:current);
   });
  },1900);
  return()=>clearTimeout(timer);
 },[notice,active,path,reduceMotion,opacity,y]);
 if(!notice||!active||!SAFE_READING_ROUTE.test(path))return null;
 return <View pointerEvents="none" accessible={false}
   accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
   style={[styles.host,{top:insets.top+10}]}>
  <Animated.View style={[styles.toast,{opacity,transform:[{translateY:y}]}]}>
   <Text style={styles.star}>✦</Text>
   <View>
    <Text style={styles.amount}>You earned +{notice.uc} UC!</Text>
    <Text style={styles.source}>{notice.source} • Verified completion</Text>
   </View>
  </Animated.View>
 </View>;
}
const styles=StyleSheet.create({
 host:{position:'absolute',left:12,right:12,zIndex:25,alignItems:'center'},
 toast:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'#F6FFF7',
  borderWidth:1,borderColor:'#8EC9A1',paddingHorizontal:16,paddingVertical:10,
  borderRadius:22,elevation:4,maxWidth:350},
 star:{fontSize:25,color:'#D49C21',fontWeight:'900'},
 amount:{fontSize:15,color:'#19593C',fontWeight:'900'},
 source:{fontSize:10,color:'#5B8168',marginTop:2},
});
