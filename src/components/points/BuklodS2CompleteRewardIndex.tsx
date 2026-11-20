/**
 * Read-only complete index of every reward authority and family.
 * Catalog availability is NOT entitlement, activation, or a grant.
 * Numbers are audited configuration snapshots; no network, RPC or wallet writes.
 */
import React from 'react';
import {StyleSheet,Text,View} from 'react-native';
import {S2_REWARD_FAMILY_INDEX,S2_REWARD_CURRENCIES,S2_REWARD_STATUS_LEGEND,S2_REWARD_AWARD_CATEGORIES} from '@/lib/season2/buklodSeason2CompleteRewardIndexR1';

const C={green:'#14663F',ink:'#173D2B',muted:'#4D6657',line:'#D5E7DA'};
export default function BuklodS2CompleteRewardIndex(){
 return <View style={s.wrap}>
  <Text style={s.heading}>BUKLOD · COMPLETE REWARD ENCYCLOPEDIA</Text>
  <Text style={s.note}>Lahat ng reward families, paano makuha, saan magagamit, limit, status at kung saan makikita ang eksaktong entry. Hindi ito proof of ownership o automatic grant.</Text>
  <Text style={s.heading}>7 magkakahiwalay na currency / ledger</Text>
  {S2_REWARD_CURRENCIES.map(x=><View key={x.id} style={s.entry}>
   <Text style={s.name}>{x.title} · {x.status}</Text>
   <Text style={s.note}>{x.details}</Text>
   <Text style={s.note}>Use: {x.use} · Carryover: {x.carryover}</Text>
  </View>)}
  <Text style={s.heading}>Reward status — basahin bago mag-claim</Text>
  {S2_REWARD_STATUS_LEGEND.map(x=><View key={x.id} style={s.entry}><Text style={s.name}>{x.title}</Text><Text style={s.note}>{x.description}</Text></View>)}
  <Text style={s.heading}>Full reward family directory</Text>
  {S2_REWARD_FAMILY_INDEX.map((x,i)=><View key={x.id} style={s.entry}>
   <Text style={s.name}>{i+1}. {x.title}</Text>
   <Text style={s.note}>{x.detail}</Text>
   <Text style={s.note}>Requirements: {x.requirement}</Text>
   <Text style={s.note}>Limit / claim: {x.limit}</Text>
   <Text style={s.link}>Exact entries: {x.tab}</Text>
   <Text style={s.status}>Status: {x.status}</Text>
  </View>)}
  <Text style={s.heading}>Collectible, badge at bonus classes</Text>
  {S2_REWARD_AWARD_CATEGORIES.map(x=><View key={x.id} style={s.entry}>
   <Text style={s.name}>{x.title}</Text><Text style={s.note}>{x.criteria}</Text>
   <Text style={s.status}>{x.status}</Text>
  </View>)}
  <Text style={s.note}>Hindi maaring mag-award mula sa screenshot, client timer, art preview, duplicated event, self-like, o offline pending action lamang. Ang final claim ay nangangailangan ng canonical verified server receipt at aktibong release.</Text>
 </View>;
}
const s=StyleSheet.create({
 wrap:{gap:8},heading:{fontSize:12,fontWeight:'900',color:C.green,marginTop:5},
 entry:{paddingVertical:7,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.line,gap:3},
 name:{fontSize:11,fontWeight:'800',color:C.ink},
 note:{fontSize:10,color:C.muted,lineHeight:16},
 link:{fontSize:10,color:C.green,fontWeight:'700'},
 status:{fontSize:10,color:'#946212',fontWeight:'800'},
});
