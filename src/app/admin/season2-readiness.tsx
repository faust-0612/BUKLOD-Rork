import React from 'react';
import {ScrollView,StyleSheet,Text,View} from 'react-native';
import {AdminGate} from '@/components/AdminGate';
import {SEASON2_RESET_POLICY} from '@/lib/season2/buklodSeason2CarryoverContractR1';
const sections=[
 {title:'Production',state:'LOCKED',detail:'Season 2 production embargo until December 6 plus signed, SHA-bound approval and RC/device evidence. Season 1 remains unchanged.'},
 {title:'Reward backend',state:'NOT LIVE',detail:'Isolated schema/source draft only; no verified staging backend deployment, grant or spending.'},
 {title:'Season rollover',state:'CONTRACT ONLY',detail:'Deterministic read-only planner and retention checks. Atomic server transaction, signed archive, concurrency, recovery and reconciliation still required.'},
 {title:'Offline sync and token grants',state:'SOURCE ONLY',detail:'Pure outbox/reward contracts need server integration and real weak-network tests.'},
 {title:'Monitoring',state:'NOT CONNECTED',detail:'15/30/60-minute build-segmented classifier exists; no certified live metrics ingestion or automatic incident recovery.'},
 {title:'AdMob and navigation',state:'DEVICE EVIDENCE PENDING',detail:'Android first-view ad fill and instantaneous tab switching are release-critical checks.'},
] as const;
export default function Season2Readiness(){
 return <AdminGate><ScrollView style={s.page} contentContainerStyle={s.content}>
   <Text style={s.title}>Season 2 Readiness</Text>
   <Text style={s.subtitle}>STAGING PREVIEW • source evidence only. This screen does not query a live readiness service.</Text>
   <View style={s.warning}><Text style={s.warningText}>
     No automatic launch, rank reset, rewards, or wallet changes. Production promotion remains blocked.
   </Text></View>
   <Text style={s.heading}>Seasonal carryover policy</Text>
   <Text style={s.body}>Reset only: {SEASON2_RESET_POLICY.resettable.join(', ').replaceAll('_',' ')}.</Text>
   <Text style={s.body}>Retain all character levels, lifetime Circle Rank, earned items, badges, memberships and financial history.</Text>
   <Text style={s.heading}>Implementation evidence</Text>
   {sections.map(x=><View style={s.card} key={x.title}>
      <View style={s.row}><Text style={s.cardTitle}>{x.title}</Text><Text style={s.status}>{x.state}</Text></View>
      <Text style={s.body}>{x.detail}</Text>
   </View>)}
   <Text style={s.footer}>Status must be reconciled with the GitHub implementation ledger and verified RC before any release. Owner design approval alone does not bypass safety gates.</Text>
 </ScrollView></AdminGate>;
}
const s=StyleSheet.create({
 page:{flex:1,backgroundColor:'#F5F9F6'},content:{padding:14,gap:9,paddingBottom:40},
 title:{fontSize:22,fontWeight:'900',color:'#183F2D'},
 subtitle:{fontSize:12,color:'#527464',lineHeight:18},
 warning:{backgroundColor:'#FFF0DA',borderWidth:1,borderColor:'#D9AC70',borderRadius:10,padding:12},
 warningText:{fontWeight:'700',color:'#77501A',fontSize:12,lineHeight:18},
 heading:{fontSize:14,fontWeight:'900',color:'#1A5B39',marginTop:6},
 body:{fontSize:12,color:'#3F5E4D',lineHeight:19},
 card:{backgroundColor:'#FFF',borderWidth:1,borderColor:'#D6E7DA',borderRadius:10,padding:11,gap:5},
 row:{flexDirection:'row',justifyContent:'space-between',gap:8,alignItems:'center'},
 cardTitle:{fontSize:13,fontWeight:'800',color:'#1A4C30',flex:1},
 status:{fontSize:10,fontWeight:'900',color:'#905C1B',textAlign:'right'},
 footer:{fontSize:11,color:'#557464',lineHeight:17},
});
