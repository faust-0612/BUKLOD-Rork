import React from 'react';
import { Pressable,StyleSheet,Text,View } from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {router} from 'expo-router';
import type {BuklodScope} from '@/lib/buklodScope';

/**
 * No dashboard network dependency. Dual-gated:
 * OTA env switch and server rollout, both OFF until explicit RC authorization.
 */
export default function BuklodSaliksikDoor({scope}:{scope:BuklodScope}){
 if(process.env.EXPO_PUBLIC_SALIKSIK_ENABLED!=='true' ||
    scope.scope_type!=='CLUSTER' || !scope.show_faith_content)return null;
 return <Pressable accessibilityRole="button" accessibilityLabel="Open SALIKSIK investigations"
  style={({pressed})=>[styles.card,pressed&&{opacity:.82}]}
  onPress={()=>router.push({pathname:'/scope/saliksik',params:{scopeId:scope.scope_id}} as any)}>
  <View style={styles.icon}><MaterialCommunityIcons name="book-search-outline" size={26} color="#FFFFFF"/></View>
  <View style={{flex:1,gap:3}}>
   <Text style={styles.title}>SALIKSIK</Text>
   <Text style={styles.sub}>Tuklasin • Suriin • Unawain</Text>
   <Text style={styles.hint}>Biblical investigation • Adaptive mastery • Verified rewards</Text>
  </View>
  <MaterialCommunityIcons name="chevron-right" color="#fff" size={23}/>
 </Pressable>;
}
const styles=StyleSheet.create({
 card:{borderRadius:16,backgroundColor:'#19563F',padding:14,flexDirection:'row',alignItems:'center',gap:12,marginVertical:8},
 icon:{width:44,height:44,borderRadius:13,backgroundColor:'#2D7855',alignItems:'center',justifyContent:'center'},
 title:{fontSize:17,fontWeight:'900',color:'#fff',letterSpacing:1},
 sub:{fontSize:12,fontWeight:'700',color:'#D8F3E0'},
 hint:{fontSize:11,color:'#C0E7CE',lineHeight:15}
});
