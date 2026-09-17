/* BUKLOD Living Wall discovery + public location filters.
 * The default Wall must stay casual and scroll-first. Deep Living Wall tools
 * stay behind one lightweight Explore entry instead of a dashboard of buttons.
 */
import React, { useMemo } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import BuklodCommunityHelp from '@/components/BuklodCommunityHelp';
import BuklodDesktopCommunityMapHeader from '@/components/BuklodDesktopCommunityMapHeader';
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
  const {width}=useWindowDimensions();
  const desktopCommunityMap=Platform.OS==='web'&&width>=1200;
  const localScopes=useMemo(()=>(scopes as LocalScope[])
    .filter(scope=>scope.scope_type==='LOCAL'&&Boolean(scope.scope_id)&&Boolean(String(scope.name??'').trim())&&(!scope.membership_status||scope.membership_status==='ACTIVE'))
    .sort((a,b)=>weight(a)-weight(b)),[scopes]);

  return <View>
    {/* Desktop only: real City map is part of the Wall header so it scrolls. */}
    {desktopCommunityMap?<BuklodDesktopCommunityMapHeader/>:null}

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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open BUKLOD Connect"
        accessibilityHint="Opens your BUKLOD messages from inside Community Wall"
        onPress={()=>router.push('/messages' as any)}
        style={({pressed})=>[styles.connectChip,pressed&&{opacity:.72}]}
      >
        <MaterialCommunityIcons name="message-processing-outline" size={14} color="#FFFFFF"/>
        <Text style={styles.connectText}>CONNECT</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Explore Dugtong, Moments, Challenges, Polls and Resources"
        onPress={()=>router.push('/community/discover?mode=for_you' as any)}
        style={({pressed})=>[styles.exploreChip,pressed&&{opacity:.72}]}
      >
        <MaterialCommunityIcons name="compass-outline" size={14} color={colors.greenDark}/>
        <Text style={styles.exploreText}>EXPLORE</Text>
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
  connectChip:{minHeight:34,borderRadius:18,paddingHorizontal:11,backgroundColor:colors.greenDark,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5},
  connectText:{fontSize:9,fontWeight:'900',letterSpacing:.2,color:'#FFFFFF'},
  exploreChip:{minHeight:34,borderRadius:18,paddingHorizontal:11,backgroundColor:'#F2F7F4',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5},
  exploreText:{fontSize:9,fontWeight:'900',letterSpacing:.2,color:colors.greenDark},
});
