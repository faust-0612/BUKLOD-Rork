/**
 * Distinct Show Faith and Non-Show Faith reward tracks.
 * UI derived from already provided active scope, not a member-editable
 * earning preference; no network, RPC, claims, wallet writes or auto-awards.
 */
import React,{useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {useBuklodScope} from '@/providers/BuklodScopeProvider';
import {
 S2_BOTH_TRACK_LIMITS,S2_TRACK_LEARNING_BP,S2_TRACKS,
 S2_TRACK_BADGE_PREVIEWS,S2_TRACK_SOURCES,S2_TRACK_ROLLOUT,
 previewTrackForScope,type S2RewardTrack
} from '@/lib/season2/buklodSeason2RewardTracksR1';

const C={ink:'#183C2B',green:'#10653C',muted:'#596E5E',edge:'#DAE7DE',amber:'#80591C'};
export default function BuklodS2RewardTracksGuide(){
 const {activeScope}=useBuklodScope();
 const track=previewTrackForScope(activeScope);
 const [comparison,setComparison]=useState(false);
 const display:readonly S2RewardTrack[]=comparison?['show_faith','non_show_faith'] as const:track?[track]:[];
 return <View style={s.root}>
  <Text style={s.title}>DALAWANG HIWALAY NA REWARD TRACKS</Text>
  <Text style={s.note}>Ang kasalukuyang scope ang batayan — hindi ito pagpili para lumipat ng rewards. Hindi kinukuha o iniimbento ang personal na paniniwala ng member.</Text>
  <View style={s.head}>
   <Text style={s.green}>CURRENT SCOPE</Text>
   <Text style={s.scope}>{activeScope?.name||'Unverified'}</Text>
   <Text style={s.status}>{track?S2_TRACKS[track].title:'NO VERIFIED SCOPE MODE · NO NEW GRANTS'}</Text>
  </View>
  <Text style={s.note}>Ang mode sa app ay preview ng server-scoped policy; hindi ito proof of reward eligibility. Kailangan pa ring patunayan sa server ang event-time scope, membership, source at immutable ID.</Text>
  <Pressable accessibilityRole="button" accessibilityState={{expanded:comparison}}
    onPress={()=>setComparison(v=>!v)} style={s.button}>
   <Text style={s.buttonText}>{comparison?'Itago ang kabilang track':'Ihambing ang dalawang reward track'}</Text>
  </Pressable>
  {!track&&!comparison?<Text style={s.warn}>Hindi matukoy ang Show Faith setting ng scope. Hindi magpapakita ng claimable rewards hanggang ma-verify ito.</Text>:null}
  {display.map(id=>{
    const config=S2_TRACKS[id];
    const awards=S2_TRACK_BADGE_PREVIEWS.filter(a=>a.track===id);
    return <View key={id} style={s.section}>
      <Text style={s.heading}>{config.title}</Text>
      <Text style={s.green}>Learning P0</Text>
      <Text style={s.note}>{config.p0Learning}</Text>
      <Text style={s.green}>Community P0</Text>
      <Text style={s.note}>{config.p0Community}</Text>
      <Text style={s.subhead}>Specific learning BP rules</Text>
      {S2_TRACK_LEARNING_BP[id].map(row=><View key={row.key} style={s.row}>
       <View style={{flex:1}}>
        <Text style={s.item}>{row.title}</Text>
        <Text style={s.note}>{row.requirements}</Text>
        <Text style={s.warn}>{row.activeLegacyCatalog?'SEASON 1 CONFIG — event verification still required':'PROPOSED FOR S2 · NOT LIVE'}</Text>
       </View>
       <Text style={s.rate}>+{row.bp} BP</Text>
      </View>)}
      <Text style={s.subhead}>Distinct mode badges · no extra BP/Token award</Text>
      {awards.map(a=><View key={a.key} style={s.row}>
       <View style={{flex:1}}>
        <Text style={s.item}>{a.key.replaceAll('_',' ')}</Text>
        <Text style={s.note}>{a.criteria}</Text>
       </View>
       <Text style={s.warn}>NOT LIVE</Text>
      </View>)}
      <Text style={s.note}>Weekly claim namespace: {config.missionKey}. Seasonal badge namespace: {config.seasonalAwardNamespace}. Ang mission at badges ng track na ito ay hindi maaaring i-claim sa kabilang track.</Text>
    </View>;
  })}
  <Text style={s.heading}>Shared activities — pareho ang basic opportunity</Text>
  {Object.entries(S2_TRACK_SOURCES).filter(([,r])=>r.mode==='both'&&r.tokens>0).map(([key,rule])=>
    <View key={key} style={s.row}>
     <View style={{flex:1}}><Text style={s.item}>{key.replaceAll('_',' ')}</Text>
       <Text style={s.note}>{rule.category} · max {rule.dailyCount}/day, verified source only</Text>
     </View><Text style={s.rate}>+{rule.tokens} Tokens</Text>
    </View>)}
  <Text style={s.note}>P0 pareho ang basic rule: {S2_BOTH_TRACK_LIMITS.requiredVerifiedLearning} learning + {S2_BOTH_TRACK_LIMITS.requiredDifferentVerifiedCommunity} distinct social activity/week; {S2_BOTH_TRACK_LIMITS.normalWeekDays} days + {S2_BOTH_TRACK_LIMITS.graceDays} days grace; {S2_BOTH_TRACK_LIMITS.flexCreditsPerSeason} optional Flex Credits × {S2_BOTH_TRACK_LIMITS.daysPerFlexCredit} days. Token ceiling {S2_BOTH_TRACK_LIMITS.globalDailyTokenCeiling}/day shared across tracks, hindi doble.</Text>
  <Text style={s.warn}>REWARDS NOT LIVE · Faith-only prayer participation grants 0 Journey Tokens/QMP/cash. Ang Non-Show Faith ay hindi kailangang gumawa ng Bible o faith activities. Walang permanent BP/QMP/cash deduction dahil sa paglipat ng mode.</Text>
  <Text style={s.note}>Backend mode attribution: {S2_TRACK_ROLLOUT.serverAttribution?'ENABLED':'BLOCKED'}. Track claims: {S2_TRACK_ROLLOUT.missionClaim?'ENABLED':'BLOCKED'}. Wallet: shared, existing, canonical only.</Text>
 </View>;
}
const s=StyleSheet.create({
 root:{padding:9,borderRadius:10,borderWidth:1,borderColor:C.edge,gap:7},
 title:{fontSize:12,fontWeight:'900',color:C.green},
 heading:{fontSize:12,fontWeight:'900',color:C.green},
 subhead:{fontSize:11,fontWeight:'900',color:C.ink,marginTop:4},
 note:{fontSize:10,lineHeight:16,color:C.muted},
 head:{backgroundColor:'#EDF8F1',padding:9,borderRadius:8,gap:3},
 scope:{fontSize:11,fontWeight:'800',color:C.ink},
 green:{fontSize:10,fontWeight:'800',color:C.green},
 status:{fontSize:10,fontWeight:'800',color:C.green},
 button:{paddingVertical:8,paddingHorizontal:9,borderWidth:1,borderColor:'#B6DCC0',backgroundColor:'#E9F7ED',borderRadius:8},
 buttonText:{fontSize:11,fontWeight:'800',color:C.green,textAlign:'center'},
 section:{gap:5,marginTop:6,padding:9,borderWidth:1,borderColor:C.edge,borderRadius:8},
 row:{flexDirection:'row',gap:8,paddingVertical:6,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.edge},
 item:{fontSize:11,fontWeight:'800',color:C.ink},
 rate:{fontSize:10,fontWeight:'900',color:C.green},
 warn:{fontSize:10,color:C.amber,lineHeight:15,fontWeight:'700'},
});
