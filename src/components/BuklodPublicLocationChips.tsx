/* BUKLOD Living Wall discovery + public location filters.
 * Keeps the main Community casual: one lightweight discovery rail, then the
 * existing location rail. Deep chain structure stays behind taps.
 */
import React, { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import { colors } from '@/lib/theme';

type LocalScope = {
  scope_id: string;
  scope_type: string;
  name: string;
  geo_level?: 'BARANGAY'|'MUNICIPALITY_CITY'|'PROVINCE'|'COUNTRY'|string|null;
  membership_status?: string|null;
};
type Props = {
  selectedScopeId:string|null;
  onChange:(scopeId:string|null)=>void;
};

function weight(scope:LocalScope){
  switch(scope.geo_level){
    case 'BARANGAY':return 10;
    case 'MUNICIPALITY_CITY':return 20;
    case 'PROVINCE':return 30;
    case 'COUNTRY':return 40;
    default:return 90;
  }
}

const LIVING = [
  { label:'FOR YOU', icon:'compass-outline', mode:'for_you' },
  { label:'NEEDS DUGTONG', icon:'link-variant-plus', mode:'needs_dugtong' },
  { label:'GROWING', icon:'sprout-outline', mode:'growing' },
  { label:'CHALLENGES', icon:'flag-outline', mode:'challenges' },
] as const;

export default function BuklodPublicLocationChips({selectedScopeId,onChange}:Props){
  const {scopes}=useBuklodScope();
  const localScopes=useMemo(()=>(scopes as LocalScope[])
    .filter(scope=>scope.scope_type==='LOCAL'&&Boolean(scope.scope_id)&&Boolean(String(scope.name??'').trim())&&(!scope.membership_status||scope.membership_status==='ACTIVE'))
    .sort((a,b)=>weight(a)-weight(b)),[scopes]);

  return <View style={styles.wrap}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroller} contentContainerStyle={styles.row}>
      {LIVING.map(item=><Pressable key={item.mode}
        accessibilityRole="button"
        accessibilityLabel={`Open ${item.label} Community`}
        onPress={()=>router.push(`/community/discover?mode=${item.mode}` as any)}
        style={({pressed})=>[styles.livingChip,pressed&&{opacity:.7}]}
      >
        <MaterialCommunityIcons name={item.icon} size={15} color={colors.greenDark}/>
        <Text style={styles.livingText}>{item.label}</Text>
      </Pressable>)}
      <Pressable onPress={()=>router.push('/community/create' as any)} style={({pressed})=>[styles.createChip,pressed&&{opacity:.7}]}>
        <MaterialCommunityIcons name="plus" size={17} color="#FFFFFF"/>
        <Text style={styles.createText}>CREATE</Text>
      </Pressable>
    </ScrollView>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.locationRow} style={styles.locationScroller}>
      <Pressable accessibilityRole="button" accessibilityLabel="Show all Public Community posts" onPress={()=>onChange(null)}
        style={({pressed})=>[styles.chip,selectedScopeId===null&&styles.chipOn,pressed&&{opacity:.74}]}
      ><Text style={[styles.text,selectedScopeId===null&&styles.textOn]}>PUBLIC</Text></Pressable>

      {localScopes.map(scope=>{
        const on=selectedScopeId===scope.scope_id;
        return <Pressable key={scope.scope_id} accessibilityRole="button" accessibilityLabel={`Filter Community to ${scope.name}`}
          onPress={()=>onChange(scope.scope_id)} style={({pressed})=>[styles.chip,on&&styles.chipOn,pressed&&{opacity:.74}]}
        ><Text numberOfLines={1} style={[styles.text,on&&styles.textOn]}>{String(scope.name).toUpperCase()}</Text></Pressable>;
      })}
    </ScrollView>
  </View>;
}

const styles=StyleSheet.create({
  wrap:{marginTop:7,marginBottom:6},
  scroller:{flexGrow:0},row:{paddingHorizontal:1,gap:7,paddingBottom:7},
  livingChip:{minHeight:34,borderRadius:17,paddingHorizontal:11,backgroundColor:'#F2F7F4',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5},
  livingText:{fontSize:9,fontWeight:'900',letterSpacing:.2,color:colors.greenDark},
  createChip:{minHeight:34,borderRadius:17,paddingHorizontal:12,backgroundColor:colors.greenDark,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:4},
  createText:{fontSize:9,fontWeight:'900',letterSpacing:.2,color:'#FFFFFF'},
  locationScroller:{flexGrow:0},locationRow:{paddingHorizontal:1,gap:7,paddingBottom:5},
  chip:{minHeight:30,maxWidth:150,paddingHorizontal:11,borderRadius:15,borderWidth:StyleSheet.hairlineWidth,borderColor:'#C9DCCF',alignItems:'center',justifyContent:'center',backgroundColor:'#FFFFFF'},
  chipOn:{borderColor:colors.greenDark,backgroundColor:colors.greenDark},
  text:{fontSize:9,fontWeight:'900',letterSpacing:.25,color:colors.greenDark},textOn:{color:'#FFFFFF'},
});
