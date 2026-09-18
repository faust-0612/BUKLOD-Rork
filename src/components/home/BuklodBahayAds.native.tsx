import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import BuklodAdMobBanner from '@/components/BuklodAdMobBanner';
import { claimBahayGardenAdReward } from '@/lib/buklodBahay';
import { showBuklodRewardedAd, warmBuklodRewardedAd } from '@/lib/buklodRewardedAds';

export function BahayHomeAdBanner() {
  return (
    <View style={styles.bannerShell}>
      <BuklodAdMobBanner
        placement="home"
        compact
        format="adaptive"
        diagnosticName="home_bottom_banner"
      />
    </View>
  );
}

export function BahayGardenRewardAd({
  homeId,
  onGranted,
}: {
  homeId: string;
  onGranted?: () => void | Promise<void>;
}) {
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    warmBuklodRewardedAd();
  },[]);

  const handleWatch=useCallback(async()=>{
    if (busy || !homeId) return;
    setBusy(true);
    try {
      const ad=await showBuklodRewardedAd();
      if (!ad.shown) {
        warmBuklodRewardedAd();
        Alert.alert('Garden Ad','The rewarded ad is still preparing. Try again shortly.');
        return;
      }
      if (!ad.earned) {
        Alert.alert('Garden Ad','Finish the rewarded ad to receive the Garden boost.');
        return;
      }

      const token=`garden-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
      const claim=await claimBahayGardenAdReward(homeId,token);
      if (!claim.granted) {
        Alert.alert('Garden boost limit','You already used today’s 3 Garden ad boosts in this Bahay.');
        return;
      }

      await onGranted?.();
      Alert.alert(
        'Garden boosted 🌱',
        `+1 Garden Energy. ${claim.remainingToday} rewarded boost${claim.remainingToday===1?'':'s'} left today.`,
      );
    } catch (error:any) {
      console.warn('BUKLOD Bahay Garden rewarded ad:',error);
      Alert.alert('Garden Ad',String(error?.message ?? 'Could not grant the Garden boost.'));
    } finally {
      setBusy(false);
    }
  },[busy,homeId,onGranted]);

  return (
    <View style={styles.rewardCard}>
      <View style={styles.rewardIcon}>
        <MaterialCommunityIcons name="weather-sunny" size={21} color="#A66D16"/>
      </View>
      <View style={styles.rewardCopy}>
        <Text style={styles.rewardEyebrow}>OPTIONAL REWARDED AD</Text>
        <Text style={styles.rewardTitle}>Watch 1 ad · +1 Garden Energy</Text>
        <Text style={styles.rewardBody}>Up to 3 boosts per day in this Bahay. No Circle Points, cash, or redeemable value.</Text>
      </View>
      <Pressable disabled={busy} onPress={handleWatch} style={({pressed})=>[styles.rewardButton,(pressed||busy)&&{opacity:.72}]}>
        <MaterialCommunityIcons name="play-circle-outline" size={18} color="#FFFFFF"/>
        <Text style={styles.rewardButtonText}>{busy?'Preparing…':'WATCH'}</Text>
      </Pressable>
    </View>
  );
}

const styles=StyleSheet.create({
  bannerShell:{width:'100%',marginVertical:4},
  rewardCard:{
    flexDirection:'row',
    alignItems:'center',
    gap:9,
    borderWidth:1,
    borderColor:'#D9C68F',
    backgroundColor:'#FFF9E9',
    borderRadius:15,
    padding:11,
  },
  rewardIcon:{
    width:38,height:38,borderRadius:12,
    alignItems:'center',justifyContent:'center',
    backgroundColor:'#F7E8B9',
  },
  rewardCopy:{flex:1,minWidth:0},
  rewardEyebrow:{fontSize:7.5,fontWeight:'900',letterSpacing:.65,color:'#8B7540'},
  rewardTitle:{fontSize:11,fontWeight:'900',color:'#5B4721',marginTop:2},
  rewardBody:{fontSize:8.5,lineHeight:12,color:'#7B6B46',marginTop:2},
  rewardButton:{
    minHeight:38,
    paddingHorizontal:10,
    borderRadius:11,
    backgroundColor:'#A66D16',
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'center',
    gap:4,
  },
  rewardButtonText:{fontSize:8.5,fontWeight:'900',color:'#FFFFFF'},
});
