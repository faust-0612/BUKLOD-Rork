import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import BuklodDugtongAction from '@/components/BuklodDugtongAction';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';
import { supabase } from '@/lib/supabase';
import { resolveCommunityMediaUrl } from '@/lib/buklodMediaUrl';
import { BUKLOD_COMMUNITY_KIND_LABELS, type BuklodCommunityKind } from '@/lib/buklodCommunityLiving';

type Mode='for_you'|'needs_dugtong'|'growing'|'challenges'|'polls'|'resolved'|'resources'|'moments';
type Row={post_id:string;body:string;kind:string;privacy:string;chain_status:string;quiet_mode:boolean;dugtong_count:number;branch_count:number;created_at:string};
const MODES:{key:Mode;label:string}[]=[
  {key:'for_you',label:'For You'},{key:'needs_dugtong',label:'Needs a Dugtong'},{key:'growing',label:'Growing'},
  {key:'challenges',label:'Challenges'},{key:'polls',label:'Polls'},{key:'resources',label:'Resources'},
  {key:'moments',label:'Moments'},{key:'resolved',label:'Resolved'},
];

function LivingExtra({row}:{row:Row}){
  const {theme}=useBuklodTheme();
  const [data,setData]=useState<any>(null);
  const [busy,setBusy]=useState(false);
  const load=useCallback(async()=>{
    const rpc=row.kind==='resource'?'get_buklod_community_resource_v1':row.kind==='poll'||row.kind==='decision'?'get_buklod_community_poll_v1':row.kind==='challenge'?'get_buklod_community_challenge_v1':null;
    if(!rpc)return;
    const result=await (supabase as any).rpc(rpc,{p_post_id:row.post_id});
    if(!result.error)setData(result.data??null);
  },[row.kind,row.post_id]);
  useEffect(()=>{void load();},[load]);

  if(row.kind==='poll'||row.kind==='decision'){
    const options=Array.isArray(data?.options)?data.options:[];
    const counts=Array.isArray(data?.counts)?data.counts:[];
    return <View style={styles.extra}>{options.map((option:any,index:number)=>{
      const selected=Number(data?.my_vote)===index;
      return <Pressable key={`${String(option)}-${index}`} disabled={busy} onPress={async()=>{
        setBusy(true);const result=await (supabase as any).rpc('vote_buklod_community_poll_v1',{p_post_id:row.post_id,p_option_index:index});setBusy(false);
        if(result.error)return Alert.alert('Poll',result.error.message);await load();
      }} style={[styles.pollChoice,{borderColor:selected?theme.accent:theme.border,backgroundColor:selected?theme.accentSoft:theme.surface}]}>
        <Text style={[styles.pollText,{color:theme.textPrimary}]}>{String(option)}</Text><Text style={[styles.pollCount,{color:theme.textMuted}]}>{Number(counts[index]??0)}</Text>
      </Pressable>;
    })}</View>;
  }

  if(row.kind==='challenge'){
    const status=String(data?.my_status??'');
    return <View style={styles.challengeRow}>
      <Text style={[styles.softText,{color:theme.textMuted}]}>{Number(data?.joined_count??0)} joined · {Number(data?.completed_count??0)} completed</Text>
      <Pressable disabled={busy} onPress={async()=>{
        setBusy(true);const result=await (supabase as any).rpc('set_buklod_community_challenge_status_v1',{p_post_id:row.post_id,p_status:status==='joined'?'completed':'joined'});setBusy(false);
        if(result.error)return Alert.alert('Challenge',result.error.message);await load();
      }} style={[styles.smallPill,{backgroundColor:theme.accentSoft}]}><Text style={[styles.smallPillText,{color:theme.accent}]}>{status==='completed'?'Completed ✓':status==='joined'?'Mark complete':'Join'}</Text></Pressable>
    </View>;
  }

  if(row.kind==='resource'&&data){
    const size=Math.max(.01,Number(data.size_bytes??0)/1024/1024).toFixed(2);
    return <View style={[styles.resourceBox,{backgroundColor:theme.surfaceMuted}]}>
      <View style={styles.resourceHead}><MaterialCommunityIcons name="file-document-outline" size={24} color={theme.accent}/><View style={{flex:1}}>
        <Text style={[styles.resourceTitle,{color:theme.textPrimary}]}>{String(data.title??data.original_name??'Resource')}</Text>
        <Text style={[styles.softText,{color:theme.textMuted}]}>{String(data.original_name??'File')} · {size} MB</Text>
      </View></View>
      <View style={styles.resourceActions}>
        <Pressable onPress={async()=>{await (supabase as any).rpc('signal_buklod_community_resource_v1',{p_resource_id:data.resource_id,p_signal:'open'});const url=await resolveCommunityMediaUrl(data.storage_path);if(url)await WebBrowser.openBrowserAsync(url);}}><Text style={[styles.actionText,{color:theme.accent}]}>Open</Text></Pressable>
        <Pressable onPress={async()=>{await (supabase as any).rpc('signal_buklod_community_resource_v1',{p_resource_id:data.resource_id,p_signal:'save'});await load();}}><Text style={[styles.actionText,{color:theme.textMuted}]}>{data.my_saved?'Saved ✓':'Save'}</Text></Pressable>
        <Pressable onPress={async()=>{await (supabase as any).rpc('signal_buklod_community_resource_v1',{p_resource_id:data.resource_id,p_signal:'used'});await load();}}><Text style={[styles.actionText,{color:theme.textMuted}]}>{data.my_used?'Used ✓':'Used this'}</Text></Pressable>
      </View>
    </View>;
  }
  return null;
}

export default function CommunityDiscoverScreen(){
  const {theme}=useBuklodTheme();
  const params=useLocalSearchParams<{mode?:string}>();
  const initial=MODES.some(item=>item.key===params.mode)?params.mode as Mode:'for_you';
  const [mode,setMode]=useState<Mode>(initial);const [rows,setRows]=useState<Row[]>([]);const [loading,setLoading]=useState(true);const [refreshing,setRefreshing]=useState(false);
  const load=useCallback(async(nextMode:Mode=mode,refresh=false)=>{
    refresh?setRefreshing(true):setLoading(true);
    try{const {data,error}=await (supabase as any).rpc('get_buklod_community_discovery_v1',{p_mode:nextMode,p_limit:50});if(error)throw error;setRows((data??[]) as Row[]);}catch(error:any){Alert.alert('Community',String(error?.message??'Could not load Living Wall.'));}finally{setLoading(false);setRefreshing(false);}
  },[mode]);
  useEffect(()=>{void load(mode);},[mode,load]);

  return <View style={[styles.screen,{backgroundColor:theme.canvas}]}>
    <View style={[styles.header,{backgroundColor:theme.surface,borderBottomColor:theme.border}]}><Pressable onPress={()=>router.back()} style={styles.iconBtn}><MaterialCommunityIcons name="chevron-left" size={28} color={theme.textPrimary}/></Pressable><View style={{flex:1}}><Text style={[styles.title,{color:theme.textPrimary}]}>Community</Text><Text style={[styles.subtitle,{color:theme.textMuted}]}>See what’s growing</Text></View><Pressable onPress={()=>router.push('/community/create' as any)} style={[styles.createBtn,{backgroundColor:theme.accent}]}><MaterialCommunityIcons name="plus" size={20} color="#fff"/></Pressable></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modeScroll} contentContainerStyle={styles.modeRow}>{MODES.map(item=><Pressable key={item.key} onPress={()=>setMode(item.key)} style={[styles.modeChip,{borderColor:mode===item.key?theme.accent:theme.border,backgroundColor:mode===item.key?theme.accentSoft:theme.surface}]}><Text style={[styles.modeText,{color:mode===item.key?theme.accent:theme.textMuted}]}>{item.label}</Text></Pressable>)}</ScrollView>
    {loading&&!rows.length?<View style={styles.center}><ActivityIndicator/></View>:<FlatList data={rows} keyExtractor={item=>item.post_id} refreshing={refreshing} onRefresh={()=>void load(mode,true)} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} renderItem={({item})=><View style={[styles.card,{backgroundColor:theme.surface,borderColor:theme.border}]}>
      <View style={styles.cardTop}><Text style={[styles.kind,{color:theme.accent}]}>{BUKLOD_COMMUNITY_KIND_LABELS[item.kind as BuklodCommunityKind]??'Community'}</Text>{item.chain_status==='resolved'?<Text style={[styles.resolved,{color:theme.textMuted}]}>Resolved ✓</Text>:null}</View>
      <Text style={[styles.body,{color:theme.textPrimary}]}>{item.body}</Text><LivingExtra row={item}/><View style={styles.bottomRow}><Text style={[styles.softText,{color:theme.textMuted}]}>{item.quiet_mode?'Quiet chain':`${Number(item.dugtong_count??0)} Dugtong · ${Number(item.branch_count??0)} branches`}</Text><BuklodDugtongAction postId={item.post_id}/></View>
    </View>} ListEmptyComponent={<View style={styles.center}><Text style={{color:theme.textMuted}}>Nothing here yet. Keep scrolling the main Wall or start something.</Text></View>}/>} 
  </View>;
}

const styles=StyleSheet.create({
  screen:{flex:1},header:{minHeight:60,paddingHorizontal:10,flexDirection:'row',alignItems:'center',borderBottomWidth:StyleSheet.hairlineWidth},iconBtn:{width:42,height:42,alignItems:'center',justifyContent:'center'},title:{fontSize:16,fontWeight:'900'},subtitle:{fontSize:9.5,fontWeight:'600',marginTop:1},createBtn:{width:38,height:38,borderRadius:19,alignItems:'center',justifyContent:'center'},modeScroll:{flexGrow:0},modeRow:{paddingHorizontal:12,paddingVertical:10,gap:7},modeChip:{minHeight:33,borderRadius:17,borderWidth:StyleSheet.hairlineWidth,paddingHorizontal:11,alignItems:'center',justifyContent:'center'},modeText:{fontSize:10,fontWeight:'800'},list:{paddingHorizontal:12,paddingBottom:30,gap:10},card:{borderRadius:18,borderWidth:StyleSheet.hairlineWidth,padding:13},cardTop:{flexDirection:'row',alignItems:'center',marginBottom:7},kind:{flex:1,fontSize:9.5,fontWeight:'900',textTransform:'uppercase',letterSpacing:.45},resolved:{fontSize:9.5,fontWeight:'700'},body:{fontSize:15,lineHeight:21,fontWeight:'600'},bottomRow:{marginTop:9,minHeight:34,flexDirection:'row',alignItems:'center',gap:8},softText:{fontSize:10.5,fontWeight:'600',flex:1},extra:{marginTop:10,gap:7},pollChoice:{minHeight:40,borderRadius:12,borderWidth:StyleSheet.hairlineWidth,paddingHorizontal:11,flexDirection:'row',alignItems:'center',gap:8},pollText:{flex:1,fontSize:12,fontWeight:'700'},pollCount:{fontSize:10,fontWeight:'800'},challengeRow:{marginTop:10,flexDirection:'row',alignItems:'center',gap:8},smallPill:{minHeight:32,borderRadius:16,paddingHorizontal:10,alignItems:'center',justifyContent:'center'},smallPillText:{fontSize:10,fontWeight:'800'},resourceBox:{marginTop:10,borderRadius:14,padding:10},resourceHead:{flexDirection:'row',gap:9,alignItems:'center'},resourceTitle:{fontSize:12,fontWeight:'900'},resourceActions:{marginTop:9,flexDirection:'row',gap:18},actionText:{fontSize:10.5,fontWeight:'800'},center:{minHeight:220,alignItems:'center',justifyContent:'center',padding:24},
});
