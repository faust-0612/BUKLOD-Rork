import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import BuklodS2CompleteRewardsReference from '@/components/points/BuklodS2CompleteRewardsReference';
import { isGenesisPreviewBuild } from '@/features/season2/genesis/genesisContract';

/** Presentation-only Season 2 encyclopedia, isolated from first-view Points and MAIN reward writes. */
export default function BuklodSeason2GuideRoute() {
  if (!isGenesisPreviewBuild()) {
    return <View style={{flex:1,backgroundColor:'#050A19',padding:20}}>
      <Text style={{fontSize:18,fontWeight:'800',color:'#FFFFFF'}}>Season 2 guide is not available in this build.</Text>
    </View>;
  }
  return <ScrollView style={{flex:1,backgroundColor:'#09142C'}} contentContainerStyle={{padding:12,paddingTop:20,paddingBottom:80}}>
    <Pressable accessibilityRole="button" accessibilityLabel="Return to BUKLOD Points"
      onPress={()=>router.back()} style={{paddingVertical:10,paddingHorizontal:12,alignSelf:'flex-start'}}>
      <Text style={{color:'#E9F3FF',fontWeight:'800'}}>‹ Back to Points</Text>
    </Pressable>
    <Text style={{fontSize:20,fontWeight:'900',color:'#FFE8B6',marginBottom:5}}>Genesis: Let There Be Light</Text>
    <Text style={{fontSize:12,color:'#E9F3FF',marginBottom:12,lineHeight:18}}>Full BP, QMP, Tokens, badges, 1,300 items and requirements. Preview information only — Season 2 awards, points, token minting and spending remain locked. Tap below to expand the guide.</Text>
    <BuklodS2CompleteRewardsReference />
  </ScrollView>;
}
