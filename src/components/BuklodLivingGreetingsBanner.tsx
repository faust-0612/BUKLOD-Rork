import React,{useEffect,useMemo,useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {supabase} from '@/lib/supabase';

type Snapshot={
  new_member_count:number;
  latest_kl_title:string|null;
  holiday_title:string|null;
  my_birthday:boolean;
  share_birthday:boolean;
};

const cleanCount=(value:unknown)=>Number.isFinite(Number(value))?Math.min(9999,Math.max(0,Math.trunc(Number(value)))):0;

/**
 * Compact, optional public Wall banner. Server supplies only aggregate
 * verified-new-member counts; birth dates and membership identities are never
 * fetched by this component. All personal greetings stay in Notifications.
 */
export default function BuklodLivingGreetingsBanner(){
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const [expanded,setExpanded]=useState(false);
  useEffect(()=>{
    let active=true;
    void (async()=>{
      try{
        const {data,error}=await (supabase as any).rpc('buklod_my_living_greetings_v1');
        if(error||!data||!active)return;
        setSnapshot({
          new_member_count:cleanCount(data.new_member_count),
          latest_kl_title:typeof data.latest_kl_title==='string'?data.latest_kl_title:null,
          holiday_title:typeof data.holiday_title==='string'?data.holiday_title:null,
          my_birthday:data.my_birthday===true,
          share_birthday:data.share_birthday===true,
        });
      }catch{
        // Legacy/offline clients keep Wall usable, without invented greetings.
      }
    })();
    return ()=>{active=false;};
  },[]);
  const summary=useMemo(()=>{
    if(!snapshot)return '';
    if(snapshot.my_birthday)return 'Maligayang kaarawan mula sa buong BUKLOD! 🎉';
    if(snapshot.holiday_title)return snapshot.holiday_title+' 🎉';
    if(snapshot.new_member_count>0)return 'May '+snapshot.new_member_count+' bagong ka-BUKLOD. Batiin natin sila! 🎉';
    if(snapshot.latest_kl_title)return 'Bagong kabanata ng Kabihasnang Ligaw!';
    return 'BUKLOD: pagbati at mahahalagang balita sa komunidad';
  },[snapshot]);
  if(!snapshot||!summary)return null;
  return <View style={s.frame}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Expand BUKLOD community greetings"
      accessibilityState={{expanded}}
      onPress={()=>setExpanded(value=>!value)}
      style={s.top}
    >
      <MaterialCommunityIcons name="party-popper" size={18} color="#135D43"/>
      <Text numberOfLines={expanded?3:1} style={s.title}>{summary}</Text>
      <MaterialCommunityIcons name={expanded?'chevron-up':'chevron-down'} size={18} color="#135D43"/>
    </Pressable>
    {expanded&&<View style={s.details}>
      {snapshot.new_member_count>0&&<Text style={s.detail}>Welcome sa mga bagong kasama! Maaari silang batiin sa sariling Cluster o Organization.</Text>}
      {snapshot.latest_kl_title&&<Text numberOfLines={2} style={s.detail}>Kabihasnang Ligaw: {snapshot.latest_kl_title}</Text>}
      <View style={s.actions}>
        <Pressable onPress={()=>router.push('/notifications' as any)} style={s.action} accessibilityRole="button">
          <Text style={s.actionText}>Mga pagbati at updates</Text>
        </Pressable>
        {snapshot.latest_kl_title&&<Pressable onPress={()=>router.push('/kabihasnang-ligaw' as any)} style={s.action} accessibilityRole="button">
          <Text style={s.actionText}>Basahin ang KL</Text>
        </Pressable>}
        <Pressable onPress={()=>router.push('/settings/buklod-greetings' as any)} style={s.action} accessibilityRole="button">
          <Text style={s.actionText}>Birthday privacy</Text>
        </Pressable>
      </View>
    </View>}
  </View>;
}
const s=StyleSheet.create({
 frame:{marginBottom:8,borderRadius:13,borderWidth:1,borderColor:'#C4E5CF',backgroundColor:'#F2FAF4',overflow:'hidden'},
 top:{minHeight:46,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:8},
 title:{flex:1,color:'#135D43',fontWeight:'800',fontSize:12},
 details:{paddingHorizontal:12,paddingBottom:12,gap:8},
 detail:{color:'#335E4C',fontSize:11,lineHeight:16},
 actions:{flexDirection:'row',flexWrap:'wrap',gap:8},
 action:{borderRadius:10,borderWidth:1,borderColor:'#94CDAE',paddingVertical:7,paddingHorizontal:10},
 actionText:{color:'#135D43',fontSize:10,fontWeight:'800'}
});
