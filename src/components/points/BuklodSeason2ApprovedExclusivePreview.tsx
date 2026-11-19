import React,{useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {S2_EXCLUSIVE_FEATURES,S2_EXCLUSIVE_SCOPE_ROLLOUT} from '@/lib/season2/buklodSeason2ApprovedScopeR1';
/** Self-contained, read-only, lazy-expanded ten-feature preview. Never calls a backend. */
export default function BuklodSeason2ApprovedExclusivePreview(){
 const [open,setOpen]=useState(false);
 return <View style={s.wrap}>
  <Pressable accessibilityRole="button" accessibilityLabel="Season 2 approved exclusive features" accessibilityState={{expanded:open}}
    onPress={()=>setOpen(v=>!v)} style={s.toggle}>
    <View style={{flex:1}}><Text style={s.title}>SEASON 2 · TEN APPROVED EXCLUSIVES</Text>
      <Text style={s.subtitle}>Locked for production until Dec 6 or later, subject to separate approval.</Text></View>
    <Text style={s.icon}>{open?'−':'+'}</Text>
  </Pressable>
  {open?<View style={s.content}>
   {S2_EXCLUSIVE_FEATURES.map(item=><View key={item.id} style={s.item}>
    <Text style={s.number}>{item.number.toString().padStart(2,'0')}</Text>
    <View style={{flex:1,minWidth:0}}><Text style={s.feature}>{item.title}</Text>
     <Text style={s.description}>{item.explanation}</Text>
     <Text style={s.status}>LOCKED · {item.status.replaceAll('_',' ')}</Text>
    </View></View>)}
   <Text style={s.footer}>{S2_EXCLUSIVE_SCOPE_ROLLOUT.backendRewardsLive?'':'No BP, tokens, items, badges or cash are awarded in this preview. December 6 is not an automatic release. No other features can enter or leave the approved scope without owner approval.'}</Text>
  </View>:null}
 </View>;
}
const s=StyleSheet.create({
 wrap:{borderWidth:1,borderColor:'#BBD8C4',borderRadius:12,overflow:'hidden',marginTop:9},
 toggle:{paddingHorizontal:12,paddingVertical:12,backgroundColor:'#EDF7F0',flexDirection:'row',alignItems:'center',gap:9},
 title:{fontSize:12,fontWeight:'900',color:'#194B31'},subtitle:{fontSize:11,color:'#436A52',marginTop:3,lineHeight:16},
 icon:{fontSize:21,color:'#236A42'},content:{paddingHorizontal:11,paddingVertical:5,backgroundColor:'#FFFFFF'},
 item:{paddingVertical:9,flexDirection:'row',gap:10,borderBottomWidth:1,borderBottomColor:'#E6EFE9'},
 number:{fontSize:12,fontWeight:'900',color:'#267047',width:21},feature:{fontSize:12,fontWeight:'800',color:'#204B32'},
 description:{fontSize:11,color:'#3F6250',lineHeight:16,marginTop:3},
 status:{fontSize:10,fontWeight:'700',color:'#95682B',marginTop:4},footer:{fontSize:11,color:'#5A655D',lineHeight:16,paddingVertical:11}
});
