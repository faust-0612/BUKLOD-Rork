import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';

import {
  formatMinorPhp, formatQuotaBytes, formatCommunityPoolPercent, formatCommunitySharePercent, getCommunityRevenueBreakdown, loadMyCommunityContribution, loadMyCommunityQmpHistory, requestCommunityContributionReview,
  type CommunityContributionDashboard,
} from '@/lib/buklodCommunityContributionEconomy';
import type { CommunityQmpHistory } from '@/lib/buklodQmpHistory';

/* BUKLOD_COMMUNITY_CONTRIBUTION_PAGE_R1 */

export default function CommunityContributionScreen() {
  const params = useLocalSearchParams<{ guide?: string }>();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [report,setReport]=useState<{owner:string;value:CommunityContributionDashboard}|null>(null);
  const data = report?.owner === userId ? report.value : null;
  const [historyReport,setHistoryReport]=useState<{owner:string;value:CommunityQmpHistory}|null>(null);
  const history = historyReport?.owner === userId ? historyReport.value : null;
  const requestId = useRef(0);
  const [busy,setBusy]=useState(true); const [refreshing,setRefreshing]=useState(false);
  const load=useCallback(async(silent=false)=>{
    if(!userId){setBusy(false);return;}
    const request=++requestId.current;
    // Independent, authenticated read-only request. Never block monthly QMP UI.
    void loadMyCommunityQmpHistory()
      .then(next => {
        if(request===requestId.current)setHistoryReport({owner:userId,value:next});
      })
      .catch(()=>{ /* Unavailable history is not a legitimate zero. */ });
    try {
      const next=await loadMyCommunityContribution();
      if(request===requestId.current)setReport({owner:userId,value:next});
    } catch(e:any) {
      if(!silent&&request===requestId.current)Alert.alert('Community Contribution',e?.message||'Could not load your contribution report.');
    } finally {
      if(request===requestId.current)setBusy(false);
    }
  },[userId]);
  useFocusEffect(useCallback(()=>{
    setBusy(true);
    ++requestId.current;
    void load();
    const timer=setInterval(()=>{if(AppState.currentState==='active')void load(true);},240_000+Math.floor(Math.random()*90_000));
    return()=>{clearInterval(timer);++requestId.current;};
  },[load]));
  const refresh=useCallback(async()=>{setRefreshing(true);await load();setRefreshing(false);},[load]);
  if(busy&&!data)return <View style={s.center}><ActivityIndicator color="#1E6B45"/><Text style={s.muted}>Loading your private contribution report…</Text></View>;
  if(!data)return null;
  const q=data.video_quota; const weight=Math.max(0,Number(data.share_weight||0))*100; const guide=String(params.guide||'')==='1';
  const revenue = getCommunityRevenueBreakdown(data);
  return <ScrollView style={s.screen} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh}/>}>
    <Pressable onPress={()=>router.back()} style={s.back}><MaterialCommunityIcons name="arrow-left" size={19} color="#1E6B45"/><Text style={s.backText}>BACK TO COMMUNITY</Text></Pressable>
    <View style={s.hero}><Text style={s.eyebrow}>PRIVATE · YOUR COMMUNITY CONTRIBUTION</Text><Text style={s.title}>Create value. Build community.</Text><Text style={s.heroBody}>Qualified Monthly Points (QMP) are monthly contribution weight — not pesos. Final share depends on the finalized designated User Revenue Pool and your proportion of total qualified QMP.</Text></View>
    <View style={s.grid}><Metric label="THIS MONTH QMP" value={String(data.this_month_qmp)}/><Metric label="LIFETIME QMP" value={history ? history.lifetime_qmp.toLocaleString() : '—'}/><Metric label="SHARE WEIGHT" value={`${weight.toFixed(weight<.01?4:2)}%`}/><Metric label="LEVEL" value={data.contribution_level}/><Metric label="PERIOD" value={data.period.key}/></View>
    <Card title="QMP HISTORY · ALL MONTHS">
      <Text style={s.note}>Lifetime QMP is the total qualified contribution across recorded months. It does not reset on payout or create withdrawable money. Monthly share calculation remains unchanged.</Text>
      {history ? (
        history.periods.length > 0
          ? history.periods.map(item => (
              <Row
                key={item.period_key}
                label={`${item.period_key} · ${item.status}`}
                value={`${item.qualified_qmp.toLocaleString()} QMP${item.held_qmp > 0 ? ` · ${item.held_qmp.toLocaleString()} held` : ''}`}
              />
            ))
          : <Text style={s.note}>No qualified monthly QMP history yet.</Text>
      ) : <Text style={s.note}>Historical QMP unavailable. Your current monthly data is unchanged.</Text>}
    </Card>
    <Card title="QUALIFIED CONTRIBUTION"><Row label="Useful posts" value={String(data.qualified_posts)}/><Row label="Qualified videos" value={String(data.qualified_videos)}/><Row label="Meaningful replies" value={String(data.meaningful_replies)}/><Row label="Held for review" value={`${data.held_qmp} QMP`}/><Text style={s.note}>{data.next_level?`${data.next_level.remaining_qmp} QMP to ${data.next_level.label}.`:'Highest current contribution level.'}</Text></Card>
    <Card title="WHAT HELPED YOUR SHARE GROW?">
      <Row label="Useful posts QMP" value={String(data.engagement_breakdown?.useful_post_qmp ?? 0)}/>
      <Row label="Qualified video QMP" value={String(data.engagement_breakdown?.qualified_video_qmp ?? 0)}/>
      <Row label="Meaningful reply QMP" value={String(data.engagement_breakdown?.meaningful_reply_qmp ?? 0)}/>
      <Row label="Validated engagement QMP" value={String(data.engagement_breakdown?.validated_engagement_qmp ?? 0)}/>
      <Row label="Reaction bonus QMP" value={String(data.engagement_breakdown?.reaction_bonus_qmp ?? 0)}/>
      <Row label="Internal share bonus QMP" value={String(data.engagement_breakdown?.internal_share_bonus_qmp ?? 0)}/>
      <Row label="Helpful reply engagement QMP" value={String(data.engagement_breakdown?.reply_engagement_bonus_qmp ?? 0)}/>
      <Row label="Share-weight trend" value={`${Number(data.share_weight_delta||0)>=0?'+':''}${(Number(data.share_weight_delta||0)*100).toFixed(Math.abs(Number(data.share_weight_delta||0)*100)<.01?4:2)} pp`}/>
      <Text style={s.note}>Only qualified, unique, legitimate engagement counts. Self-engagement, duplicate/loop activity, bots, spam, and ad interactions do not raise your share weight.</Text>
    </Card>
    <Card title="ESTIMATED ADMOB REVENUE · 100% BREAKDOWN">
      {revenue ? <>
        <Text style={s.note}>{revenue.isOfficial ? 'Official AdMob Network Report' : 'Admin-submitted preliminary AdMob report'} · {data.period.key} · PHP amounts rounded to cents for the preview.</Text>
        <Row label="Total app estimated revenue · 100%" value={formatMinorPhp(revenue.grossMinor)}/>
        <Row label={`Community Contribution pool · ${formatCommunityPoolPercent(revenue.poolBps)}`} value={formatMinorPhp(revenue.poolMinor)}/>
        <Row label={`Outside the community pool · ${formatCommunityPoolPercent(revenue.remainderBps)} + rounding`} value={formatMinorPhp(revenue.remainderMinor)}/>
        <Text style={s.note}>The non-pool amount is not the app's net profit; operating costs, tax, and actual payouts are separate.</Text>
        <View style={s.breakdownSeparator}/>
        <Row label="Your qualified QMP" value={Number(data.this_month_qmp).toLocaleString()}/>
        <Row label="All qualified QMP" value={Number(data.total_qualified_qmp).toLocaleString()}/>
        <Row label={`Your share of the ${formatCommunityPoolPercent(revenue.poolBps)} pool`} value={formatCommunitySharePercent(revenue.memberPoolFraction)}/>
        <Row label="Your effective share of total revenue" value={formatCommunitySharePercent(revenue.memberGrossFraction)}/>
        <Row label="Your estimated peso share" value={data.estimated_share_minor===null?'Not available':data.estimate_below_cent?'Below ₱0.01':formatMinorPhp(data.estimated_share_minor)}/>
        <Text style={s.note}>Calculation: your QMP ÷ all qualified QMP × Community pool. Individual estimates round down to a cent and may change when the report or QMP changes.</Text>
      </> : <Text style={s.note}>Source-backed breakdown is unavailable for this period. No gross or pool amounts are inferred from old, missing, or stale reports.</Text>}
    </Card>
    <Card title="USER REVENUE SHARE">
      <Row label="Estimated share" value={data.estimated_share_minor===null?'Not available':data.estimate_below_cent?'Below ₱0.01':formatMinorPhp(data.estimated_share_minor)}/>
      <Text style={s.warn}>{data.estimate_label}</Text>
      {data.estimate_updated_at?<Row label="Estimate source updated" value={new Date(data.estimate_updated_at).toLocaleString()}/>:null}
      <Row label="Finalized share" value={data.finalized_share?`${formatMinorPhp(data.finalized_share.amount_minor)} · ${data.finalized_share.status}`:'Not finalized'}/>
      <Text style={s.note}>Preliminary earnings are not finalized, funded, or withdrawable. Referral rewards and Community Fund remain separate programs.</Text>
    </Card>
    <View style={[s.card,guide&&s.guide]}><Text style={s.cardTitle}>HOW CAN I INCREASE MY SHARE?</Text>{['Create useful original Community posts.','Upload legitimate original Wall videos within your quota.','Give meaningful replies that help other people.','Join useful discussions across multiple days.','Improve content quality instead of repeating low-value activity.'].map(x=><View key={x} style={s.bulletRow}><MaterialCommunityIcons name="check-circle-outline" size={16} color="#1E6B45"/><Text style={s.bullet}>{x}</Text></View>)}<Text style={s.warn}>Never watch/click ads, refresh, loop videos, spam comments, create fake accounts, or manipulate engagement to earn QMP. Those actions do not create cash entitlement.</Text></View>
    <Card title="MONTHLY VIDEO ALLOWANCE"><Row label="Used" value={formatQuotaBytes(q.used_bytes)}/><Row label="Remaining" value={formatQuotaBytes(q.remaining_bytes)}/><Row label="Allowance" value={formatQuotaBytes(q.allowance_bytes)}/><Row label="Reset" value={new Date(q.reset_at).toLocaleDateString()}/><Text style={s.note}>Per video: maximum 1 GB and 30 minutes.</Text></Card>
    {!!data.review_items?.length&&<Card title="QUALIFICATION REVIEW">{data.review_items.map(item=><View key={item.event_id} style={s.reviewRow}><View style={{flex:1}}><Text style={s.reviewType}>{item.type.replace(/_/g,' ')}</Text><Text style={s.note}>{item.status} · {item.reason_category.replace(/_/g,' ')}</Text></View>{item.review_eligible?<Pressable onPress={()=>void requestCommunityContributionReview(item.event_id).then(()=>Alert.alert('Review Requested','Your contribution was submitted for review.')).catch((e:any)=>Alert.alert('Review',e?.message||'Could not request review.'))} style={s.reviewButton}><Text style={s.reviewButtonText}>REQUEST REVIEW</Text></Pressable>:null}</View>)}</Card>}
    <Card title="TRANSPARENCY"><Text style={s.body}>There is no fixed peso value per post, video, comment, view, or QMP. Raw views, ad views, ad clicks, self-viewing, looping, bots, fake engagement, and paid Boost do not directly buy QMP or cash. Estimated shares are not withdrawable and may change before settlement closes.</Text></Card>
  </ScrollView>;
}
function Metric({label,value}:{label:string;value:string}){return <View style={s.metric}><Text style={s.metricValue}>{value}</Text><Text style={s.metricLabel}>{label}</Text></View>}
function Row({label,value}:{label:string;value:string}){return <View style={s.row}><Text style={s.rowLabel}>{label}</Text><Text style={s.rowValue}>{value}</Text></View>}
function Card({title,children}:{title:string;children:React.ReactNode}){return <View style={s.card}><Text style={s.cardTitle}>{title}</Text>{children}</View>}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:'#F5F8F6'},content:{padding:16,paddingBottom:80,gap:12},center:{flex:1,alignItems:'center',justifyContent:'center',gap:10,backgroundColor:'#F5F8F6'},back:{flexDirection:'row',alignItems:'center',gap:5,alignSelf:'flex-start'},backText:{fontSize:9,fontWeight:'900',color:'#1E6B45'},hero:{borderRadius:18,backgroundColor:'#173C2C',padding:16},eyebrow:{fontSize:9,fontWeight:'900',color:'#CDE7D8',letterSpacing:.6},title:{marginTop:5,fontSize:23,lineHeight:28,fontWeight:'900',color:'#FFF'},heroBody:{marginTop:7,fontSize:12.5,lineHeight:19,color:'#DDEBE3'},body:{fontSize:12,lineHeight:18,color:'#51645A'},muted:{fontSize:11,color:'#6E7C74'},grid:{flexDirection:'row',flexWrap:'wrap',gap:8},metric:{width:'48%',minHeight:72,borderRadius:14,borderWidth:1,borderColor:'#DCE7E1',backgroundColor:'#FFF',padding:11,justifyContent:'center'},metricValue:{fontSize:18,fontWeight:'900',color:'#173C2C'},metricLabel:{marginTop:3,fontSize:7.5,fontWeight:'900',color:'#7A887F'},card:{borderRadius:16,borderWidth:1,borderColor:'#DCE7E1',backgroundColor:'#FFF',padding:13},breakdownSeparator:{height:1,backgroundColor:'#E5ECE8',marginVertical:9},guide:{borderColor:'#77AA8D',backgroundColor:'#FAFDFB'},cardTitle:{marginBottom:7,fontSize:11,fontWeight:'900',color:'#173C2C',letterSpacing:.4},row:{minHeight:34,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#E5ECE8'},rowLabel:{flex:1,fontSize:10,color:'#6E7C74'},rowValue:{fontSize:10.5,fontWeight:'900',color:'#173C2C',textAlign:'right'},note:{marginTop:7,fontSize:9.5,lineHeight:14,color:'#6E7C74'},warn:{marginTop:8,fontSize:8.5,lineHeight:13,fontWeight:'800',color:'#7B6A2D'},bulletRow:{flexDirection:'row',gap:7,alignItems:'flex-start',marginTop:6},bullet:{flex:1,fontSize:10.5,lineHeight:15,color:'#43554B'},reviewRow:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:8,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#E5ECE8'},reviewType:{fontSize:10,fontWeight:'900',color:'#173C2C'},reviewButton:{minHeight:30,paddingHorizontal:9,borderRadius:9,backgroundColor:'#1E6B45',alignItems:'center',justifyContent:'center'},reviewButtonText:{fontSize:7.5,fontWeight:'900',color:'#FFF'}});
