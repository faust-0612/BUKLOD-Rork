/* BUKLOD public location filters.
 * The default Wall stays casual and scroll-first: Public plus local place chips only.
 */
import React, { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import BuklodCommunityHelp from '@/components/BuklodCommunityHelp';
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

export default function BuklodPublicLocationChips({selectedScopeId,onChange}:Props){
  const {scopes}=useBuklodScope();
  const localScopes=useMemo(()=>(scopes as LocalScope[])
    .filter(scope=>scope.scope_type==='LOCAL'&&Boolean(scope.scope_id)&&Boolean(String(scope.name??'').trim())&&(!scope.membership_status||scope.membership_status==='ACTIVE'))
    .sort((a,b)=>weight(a)-weight(b)),[scopes]);

  return <View>
    <BuklodCommunityHelp />

    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroller}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Show all Public Community posts"
        onPress={()=>onChange(null)}
        style={({pressed})=>[
          styles.chip,
          selectedScopeId===null&&styles.chipOn,
          pressed&&{opacity:.74},
        ]}
      >
        <Text style={[styles.text,selectedScopeId===null&&styles.textOn]}>PUBLIC</Text>
      </Pressable>

      {localScopes.map(scope=>{
        const on=selectedScopeId===scope.scope_id;
        return <Pressable
          key={scope.scope_id}
          accessibilityRole="button"
          accessibilityLabel={`Filter Community to ${scope.name}`}
          onPress={()=>onChange(scope.scope_id)}
          style={({pressed})=>[styles.chip,on&&styles.chipOn,pressed&&{opacity:.74}]}
        >
          <Text numberOfLines={1} style={[styles.text,on&&styles.textOn]}>
            {String(scope.name).toUpperCase()}
          </Text>
        </Pressable>;
      })}
    </ScrollView>
  </View>;
}

const styles=StyleSheet.create({
  scroller:{marginTop:8,marginBottom:11,flexGrow:0},
  row:{paddingHorizontal:1,gap:7},
  chip:{minHeight:34,maxWidth:150,paddingHorizontal:12,borderRadius:18,borderWidth:StyleSheet.hairlineWidth,borderColor:'#C9DCCF',alignItems:'center',justifyContent:'center',backgroundColor:'#FFFFFF'},
  chipOn:{borderColor:colors.greenDark,backgroundColor:colors.greenDark},
  text:{fontSize:9.5,fontWeight:'900',letterSpacing:.25,color:colors.greenDark},
  textOn:{color:'#FFFFFF'},
});