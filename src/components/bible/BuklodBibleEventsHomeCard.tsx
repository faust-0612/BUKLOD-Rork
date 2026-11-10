import React,{useCallback,useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {router,useFocusEffect} from 'expo-router';
import {supabase} from '@/lib/supabase';
type Event={kind:'flash'|'arena';live:boolean;state:string;starts_at:string};
export default function BuklodBibleEventsHomeCard(){
 const [event,setEvent]=useState<Event|null>(null);
 useFocusEffect(useCallback(()=>{
  let mounted=true;
  void (async()=>{
   const {data,error}=await (supabase as any).rpc('get_my_buklod_bible_events_v4');
   if(!mounted||error)return;
   const upcoming=(data?.events||[] as Event[]).filter((e:Event)=>e.state==='scheduled')
    .sort((a:Event,b:Event)=>Number(b.live)-Number(a.live)||
      new Date(a.starts_at).getTime()-new Date(b.starts_at).getTime());
   setEvent(upcoming[0]||null);
  })();
  return ()=>{mounted=false;};
 },[]));
 return <Pressable accessibilityRole="button" accessibilityLabel="Open Flash and Monthly Bible Arena"
   style={s.card} onPress={()=>router.push('/faith/bible-events' as any)}>
  <MaterialCommunityIcons name={event?.live?'lightning-bolt':'trophy-award'} size={25} color="#F6D98A"/>
  <View style={s.text}><Text style={s.heading}>{event?.live?'LIVE BIBLE CHALLENGE':event?'UPCOMING BIBLE CHALLENGE':'BIBLE CHALLENGES'}</Text>
   <Text style={s.note}>{event?'Join or follow this event':'Flash Bible Challenge & Monthly Bible Arena · Bonus BP'}</Text>
  </View>
  <MaterialCommunityIcons name="chevron-right" size={20} color="#F6D98A"/>
 </Pressable>;
}
const s=StyleSheet.create({card:{backgroundColor:'#234B68',padding:12,borderRadius:13,flexDirection:'row',alignItems:'center',gap:9},
 text:{flex:1,gap:3},heading:{color:'#FFEEB3',fontWeight:'900',fontSize:13},note:{color:'#E3EDF4',fontSize:11}});
