import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  formatMinorPhp, formatQuotaBytes, loadMyCommunityContribution, requestCommunityContributionReview,
  type CommunityContributionDashboard,
} from '@/lib/buklodCommunityContributionEconomy';

/* BUKLOD_COMMUNITY_CONTRIBUTION_PAGE_R1 */

export default function CommunityContributionScreen() {
  const params = useLocalSearchParams<{ guide?: string }>();
  const [data,setData]=useState<CommunityContributionDashboard|null>(null);
  const [busy,setBusy]=useState(true); const [refreshing,setRefreshing]=useState(false);
  const load=useCallback(async()=>{try{setData(await loadMyCommunityContribution());}catch(e:any){Alert.alert('Community Contribution',e?.message||'Could not load your contribution report.');}finally{setBusy(false);}},[]);
  useEffect(()=>{void load();},[load]);
  const refresh=useCallback(async()=>{setRefreshing(true);await load();setRefreshing(false);},[load]);
  if(busy&&!data)return <View style={s.center}><ActivityIndicator color="#1E6B45"/><Text style={s.muted}>Loading your private contribution report…</Text></View>;
  if(!data)return null;
  const q=data.video_quota; const weight=Math.max(0,Number(data.share_weight||0))*100; const guide=String(params.guide||'')==='1';

  if(guide){
    return <ScrollView style={s.screen} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh}/>}>
      <Pressable onPress={()=>router.back()} style={s.back}><MaterialCommunityIcons name="arrow-left" size={19} color="#1E6B45"/><Text style={s.backText}>BACK TO COMMUNITY</Text></Pressable>
      <View style={s.hero}>
        <Text style={s.eyebrow}>GROW YOUR COMMUNITY SHARE WEIGHT</Text>
        <Text style={s.title}>Useful activity, not empty activity.</Text>
        <Text style={s.heroBody}>Your current level is {data.contribution_level}. QMP is contribution weight only; it is not a fixed peso amount.</Text>
      </View>
      <View style={s.card}>
        <Text style={s.cardTitle}>WHAT HELPS</Text>
        {[
          'Create useful original Community posts.',
          'Upload legitimate original Wall videos within your quota.',
          'Give meaningful replies that genuinely help other people.',
          'Join useful discussions across multiple days.',
          'Improve content quality instead of repeating low-value activity.',
        ].map(x=><View key={x} style={s.bulletRow}><MaterialCommunityIcons name="check-circle-outline" size={16} color="#1E6B45"/><Text style={s.bullet}>{x}</Text></View>)}
      </View>
      <View style={s.card}>
        <Text style={s.cardTitle}>CURRENT SNAPSHOT</Text>
        <Row label="This month QMP" value={String(data.this_month_qmp)}/>
        <Row label="Share weight" value={`${weight.toFixed(weight<.01?4:2)}%`}/>
        <Row label="Qualified content" value={String(data.qualified_posts+data.qualified_videos)}/>
        <Row label="Meaningful replies" value={String(data.meaningful_replies)}/>
        <Text style={s.note}>{data.next_level?`${data.next_level.remaining_qmp} QMP to ${data.next_level.label}.`:'Highest current contribution level.'}</Text>
      </View>
      <View style={s.card}>
        <Text style={s.cardTitle}>DO NOT TRY TO GAME IT</Text>
        <Text style={s.warn}>Ad watching/clicking, self-viewing, looping, spam comments, fake accounts, bots, and manipulated engagement do not create cash entitlement or valid QMP.</Text>
      </View>
      <Pressable onPress={()=>router.replace('/community-contribution' as any)} style={s.reviewButton}>
        <Text style={s.reviewButtonText}>OPEN FULL CONTRIBUTION REPORT</Text>
      </Pressable>
    </ScrollView>;
  }

  return <ScrollView style={s.screen} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh}/>}>
    <Pressable onPress={()=>router.back()} style={s.back}><MaterialCommunityIcons name="arrow-left" size={19} color="#1E6B45"/><Text style={s.backText}>BACK TO COMMUNITY</Text></Pressable>
    <View style={s.hero}><Text style={s.eyebrow}>PRIVATE · YOUR COMMUNITY CONTRIBUTION</Text><Text style={s.title}>Create value. Build community.</Text><Text style={s.heroBody}>Qualified Monthly Points (QMP) are monthly contribution weight — not pesos. Final share depends on the finalized designated User Revenue Pool and your proportion of total qualified QMP.</Text></View>
    <View style={s.grid}><Metric label="THIS MONTH QMP" value={String(data.this_month_qmp)}/><Metric label="SHARE WEIGHT" value={`${weight.toFixed(weight<.01?4:2)}%`}/><Metric label="LEVEL" value={data.contribution_level}/><Metric label="PERIOD" value={data.period.key}/></View>
    <Card title="QUALIFIED CONTRIBUTION"><Row label="Useful posts" value={String(data.qualified_posts)}/><Row label="Qualified videos" value={String(data.qualified_videos)}/><Row label="Meaningful replies" value={String(data.meaningful_replies)}/><Row label="Held for review" value={`${data.held_qmp} QMP`}/><Text style={s.note}>{data.next_level?`${data.next_level.remaining_qmp} QMP to ${data.next_level.label}.`:'Highest current contribution level.'}</Text></Card>
    <Card title="USER REVENUE SHARE"><Row label="Estimated share" value={data.estimated_share_minor===null?'Not available':formatMinorPhp(data.estimated_share_minor)}/><Text style={s.warn}>{data.estimate_label}</Text><Row label="Finalized share" value={data.finalized_share?`${formatMinorPhp(data.finalized_share.amount_minor)} · ${data.finalized_share.status}`:'Not finalized'}/><Text style={s.note}>Referral rewards and Community Fund remain separate programs and are never merged into this QMP pool.</Text></Card>
    <View style={s.card}><Text style={s.cardTitle}>GROW YOUR SHARE WEIGHT</Text><Text style={s.note}>Practical contribution ideas are kept in a separate focused guide so this page remains your private report.</Text><Pressable onPress={()=>router.push('/community-contribution?guide=1' as any)} style={s.reviewButton}><Text style={s.reviewButtonText}>OPEN GROWTH GUIDE</Text></Pressable></View>
    <Card title="MONTHLY VIDEO ALLOWANCE"><Row label="Used" value={formatQuotaBytes(q.used_bytes)}/><Row label="Remaining" value={formatQuotaBytes(q.remaining_bytes)}/><Row label="Allowance" value={formatQuotaBytes(q.allowance_bytes)}/><Row label="Reset" value={new Date(q.reset_at).toLocaleDateString()}/><Text style={s.note}>Per video: maximum 1 GB and 30 minutes.</Text></Card>
    {!!data.review_items?.length&&<Card title="QUALIFICATION REVIEW">{data.review_items.map(item=><View key={item.event_id} style={s.reviewRow}><View style={{flex:1}}><Text style={s.reviewType}>{item.type.replace(/_/g,' ')}</Text><Text style={s.note}>{item.status} · {item.reason_category.replace(/_/g,' ')}</Text></View>{item.review_eligible?<Pressable onPress={()=>void requestCommunityContributionReview(item.event_id).then(()=>Alert.alert('Review Requested','Your contribution was submitted for review.')).catch((e:any)=>Alert.alert('Review',e?.message||'Could not request review.'))} style={s.reviewButton}><Text style={s.reviewButtonText}>REQUEST REVIEW</Text></Pressable>:null}</View>)}</Card>}
    <Card title="TRANSPARENCY"><Text style={s.body}>There is no fixed peso value per post, video, comment, view, or QMP. Raw views, ad views, ad clicks, self-viewing, looping, bots, fake engagement, and paid Boost do not directly buy QMP or cash. Estimated shares are not withdrawable and may change before settlement closes.</Text></Card>
  </ScrollView>;
}
function Metric({label,value}:{label:string;value:string}){return <View style={s.metric}><Text style={s.metricValue}>{value}</Text><Text style={s.metricLabel}>{label}</Text></View>}
function Row({label,value}:{label:string;value:string}){return <View style={s.row}><Text style={s.rowLabel}>{label}</Text><Text style={s.rowValue}>{value}</Text></View>}
function Card({title,children}:{title:string;children:React.ReactNode}){return <View style={s.card}><Text style={s.cardTitle}>{title}</Text>{children}</View>}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:'#F5F8F6'},content:{padding:16,paddingBottom:80,gap:12},center:{flex:1,alignItems:'center',justifyContent:'center',gap:10,backgroundColor:'#F5F8F6'},back:{flexDirection:'row',alignItems:'center',gap:5,alignSelf:'flex-start'},backText:{fontSize:9,fontWeight:'900',color:'#1E6B45'},hero:{borderRadius:18,backgroundColor:'#173C2C',padding:16},eyebrow:{fontSize:9,fontWeight:'900',color:'#CDE7D8',letterSpacing:.6},title:{marginTop:5,fontSize:23,lineHeight:28,fontWeight:'900',color:'#FFF'},heroBody:{marginTop:7,fontSize:12.5,lineHeight:19,color:'#DDEBE3'},body:{fontSize:12,lineHeight:18,color:'#51645A'},muted:{fontSize:11,color:'#6E7C74'},grid:{flexDirection:'row',flexWrap:'wrap',gap:8},metric:{width:'48%',minHeight:72,borderRadius:14,borderWidth:1,borderColor:'#DCE7E1',backgroundColor:'#FFF',padding:11,justifyContent:'center'},metricValue:{fontSize:18,fontWeight:'900',color:'#173C2C'},metricLabel:{marginTop:3,fontSize:7.5,fontWeight:'900',color:'#7A887F'},card:{borderRadius:16,borderWidth:1,borderColor:'#DCE7E1',backgroundColor:'#FFF',padding:13},guide:{borderColor:'#77AA8D',backgroundColor:'#FAFDFB'},cardTitle:{marginBottom:7,fontSize:11,fontWeight:'900',color:'#173C2C',letterSpacing:.4},row:{minHeight:34,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#E5ECE8'},rowLabel:{flex:1,fontSize:10,color:'#6E7C74'},rowValue:{fontSize:10.5,fontWeight:'900',color:'#173C2C',textAlign:'right'},note:{marginTop:7,fontSize:9.5,lineHeight:14,color:'#6E7C74'},warn:{marginTop:8,fontSize:8.5,lineHeight:13,fontWeight:'800',color:'#7B6A2D'},bulletRow:{flexDirection:'row',gap:7,alignItems:'flex-start',marginTop:6},bullet:{flex:1,fontSize:10.5,lineHeight:15,color:'#43554B'},reviewRow:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:8,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#E5ECE8'},reviewType:{fontSize:10,fontWeight:'900',color:'#173C2C'},reviewButton:{minHeight:30,paddingHorizontal:9,borderRadius:9,backgroundColor:'#1E6B45',alignItems:'center',justifyContent:'center'},reviewButtonText:{fontSize:7.5,fontWeight:'900',color:'#FFF'}});
