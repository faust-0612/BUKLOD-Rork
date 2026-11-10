/* BUKLOD Main / Kingdom Shard Store
 * Game-only permanent items. Transactions run only inside authenticated
 * server-owned SQL; no optimistic debit, no ad-gated spending or real cash.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';
import BuklodNativeSponsoredCard from '@/components/BuklodNativeSponsoredCard';
import { maybeShowBuklodInterstitial, warmBuklodInterstitial } from '@/lib/buklodAds';
import {
  buyMyKingdomItem, getMyKingdomShards, emptyKingdomShards, KINGDOM_SHARD_ITEMS,
  type KingdomShardItemKey, type KingdomShardsSnapshot,
} from '@/lib/buklodKingdomShards';

const COLORS={dark:'#092739',gold:'#efcd86',muted:'#bed6d8',white:'#fdf1d6'};
const icons: Record<KingdomShardItemKey, 'lightbulb-on-outline' | 'shield-star-outline' | 'compass-rose' | 'creation'> = {
  wisdom_lens:'lightbulb-on-outline',
  guardian_shield:'shield-star-outline',
  explorer_compass:'compass-rose',
  aura_emerald:'creation',
};
export default function KingdomRewardsScreen() {
  const insets=useSafeAreaInsets();
  const { user }=useAuth();
  const uid=user?.id??null;
  const uidRef=useRef(uid);
  uidRef.current=uid;
  const [snapshot,setSnapshot]=useState<KingdomShardsSnapshot>(emptyKingdomShards);
  const [loading,setLoading]=useState(Boolean(uid));
  const [busy,setBusy]=useState<KingdomShardItemKey|null>(null);
  const [notice,setNotice]=useState('');
  useEffect(() => { warmBuklodInterstitial('interstitial_kingdom_power_unlocked'); }, []);

  const reload=useCallback(async () => {
    if(!uid) {setSnapshot(emptyKingdomShards());return;}
    setLoading(true);setNotice('');
    try {
      const fresh=await getMyKingdomShards(uid);
      if(uidRef.current===uid) setSnapshot(fresh);
    } finally {if(uidRef.current===uid) setLoading(false);}
  },[uid]);
  useEffect(()=>{
    let active=true;
    setSnapshot(emptyKingdomShards());setNotice('');setBusy(null);
    if(!uid){setLoading(false);return;}
    setLoading(true);
    void getMyKingdomShards(uid).then(fresh=>{
      if(active&&uidRef.current===uid) setSnapshot(fresh);
    }).finally(()=>{if(active&&uidRef.current===uid)setLoading(false);});
    return()=>{active=false;};
  },[uid]);
  const purchase=async(key:KingdomShardItemKey)=>{
    if(!uid||busy||snapshot.source!=='server')return;
    setBusy(key);setNotice('');
    let verifiedUnlock = false;
    try {
      const receipt=await buyMyKingdomItem(uid,key);
      if(uidRef.current!==uid)return;
      setSnapshot(receipt.state);
      verifiedUnlock = Boolean(receipt.purchased);
      setNotice(receipt.purchased?'Unlocked permanently! Use this power in Kingdom practice.'
        :'Already owned. No additional Shards were charged.');
    } catch(reason) {
      if(uidRef.current===uid) setNotice(
        (reason instanceof Error?reason.message:'Purchase not confirmed.')+
        ' Refresh to check your balance before trying again.');
    } finally {
      if(uidRef.current===uid) {
        setBusy(null);
        if(verifiedUnlock) void maybeShowBuklodInterstitial('content_session_completed', 'interstitial_kingdom_power_unlocked');
      }
    }
  };
  return <View style={s.root}>
    <LinearGradient colors={['#071e31','#164451','#082435']} style={StyleSheet.absoluteFill}/>
    <ScrollView contentContainerStyle={[s.content,{
      paddingTop:Math.max(insets.top+10,25),paddingBottom:Math.max(insets.bottom+24,28),
    }]}>
      <View style={s.nav}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to Kingdom"
          onPress={()=>router.back()} style={s.back}>
          <MaterialCommunityIcons name="arrow-left" color={COLORS.gold} size={24}/>
        </Pressable>
        <View style={{flex:1}}>
          <Text style={s.label}>BUKLOD KINGDOM</Text>
          <Text style={s.heading}>Shard Treasury</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh Shards"
          disabled={loading||Boolean(busy)} onPress={()=>void reload()} style={s.back}>
          <MaterialCommunityIcons name="refresh" color={COLORS.gold} size={24}/>
        </Pressable>
      </View>
      <LinearGradient colors={['#294d54','#183d4c','#0e293e']} style={s.wallet}>
        <Text style={s.label}>GAME-ONLY SHARD BALANCE</Text>
        <View style={s.balanceRow}>
          <MaterialCommunityIcons name="diamond-stone" color={COLORS.gold} size={38}/>
          <Text style={s.balance}>{uid?snapshot.balance.toLocaleString('en-PH'):'—'}</Text>
          {loading?<ActivityIndicator color={COLORS.gold}/>:null}
        </View>
        <Text style={s.meta}>Earned {snapshot.earned} · Spent {snapshot.spent}</Text>
        <Text style={s.helper}>
          {snapshot.source==='server'?'Verified against Kingdom ledger'
            :snapshot.source==='cached'?'Offline: last verified balance, purchases paused'
              :'Server balance not available yet. No purchase can be made.'}
        </Text>
      </LinearGradient>
      <View style={s.info}>
        <MaterialCommunityIcons name="shield-check-outline" size={22} color="#9ce0c2"/>
        <Text style={s.infoText}>1 Shard per first verified game Mastery; 2 per first claimed Character collectible. Replays never award more. Existing eligible achievements count when the wallet syncs.</Text>
      </View>
      <Text style={s.sectionTitle}>PERMANENT GAME UNLOCKS</Text>
      {KINGDOM_SHARD_ITEMS.map(item=>{
        const owned=snapshot.ownedItems.includes(item.key);
        const canBuy=uid&&snapshot.source==='server'&&!busy&&!owned&&snapshot.balance>=item.price;
        return <View key={item.key} style={s.item}>
          <View style={s.iconHolder}>
            <MaterialCommunityIcons name={icons[item.key]} size={30} color={COLORS.gold}/>
          </View>
          <View style={{flex:1,minWidth:0,gap:5}}>
            <Text style={s.itemTitle}>{item.name}</Text>
            <Text style={s.desc}>{item.description}</Text>
            <Text style={s.small}>Permanent • Offline practice only • No BP advantage</Text>
          </View>
          <View style={s.right}>
            <Text style={s.price}>{item.price} <MaterialCommunityIcons name="diamond-stone" size={13}/></Text>
            <Pressable accessibilityRole="button" accessibilityLabel={'Unlock '+item.name}
              disabled={!canBuy||loading} onPress={()=>void purchase(item.key)}
              style={[s.buy,(owned||!canBuy)&&s.inactive]}>
              {busy===item.key?<ActivityIndicator color={COLORS.dark}/>:
                <Text style={s.buyText}>{owned?'OWNED':!uid?'SIGN IN':'UNLOCK'}</Text>}
            </Pressable>
          </View>
        </View>;
      })}
      {notice?<Text accessibilityRole="alert" style={s.notice}>{notice}</Text>:null}
      <BuklodNativeSponsoredCard surface="home" slotId="kingdom_treasury_native" />
      <View style={s.footer}>
        <MaterialCommunityIcons name="information-outline" size={19} color={COLORS.muted}/>
        <Text style={s.footerText}>Shards are not BP, earnings, currency, or withdrawable value. Game powers work in free practice after one verified purchase, including offline after syncing. They do not apply to server-scored Mastery examinations.</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={()=>router.push('/games/legacy' as any)}
        style={s.backToHall}><Text style={s.backToHallText}>HALL OF LEGACY & BADGES</Text></Pressable>
    </ScrollView>
  </View>;
}
const s=StyleSheet.create({
  root:{flex:1,backgroundColor:COLORS.dark},
  content:{width:'100%',maxWidth:740,alignSelf:'center',paddingHorizontal:14,gap:15},
  nav:{flexDirection:'row',alignItems:'center',gap:12},
  back:{width:44,height:44,borderWidth:1,borderColor:'#b9a16f',borderRadius:12,alignItems:'center',justifyContent:'center'},
  label:{color:COLORS.gold,fontSize:10,fontWeight:'900',letterSpacing:1.6},
  heading:{color:COLORS.white,fontSize:25,fontWeight:'900'},
  wallet:{borderRadius:23,padding:18,borderWidth:1,borderColor:'#c3ab77',gap:10},
  balanceRow:{flexDirection:'row',alignItems:'center',gap:10},
  balance:{fontSize:42,fontWeight:'900',color:COLORS.white},
  meta:{fontSize:12,fontWeight:'800',color:COLORS.gold},
  helper:{color:COLORS.muted,fontSize:11,lineHeight:18},
  info:{flexDirection:'row',gap:10,padding:13,borderRadius:13,backgroundColor:'#184644'},
  infoText:{flex:1,color:'#dcf3e9',fontSize:12,lineHeight:18},
  sectionTitle:{color:COLORS.gold,fontWeight:'900',fontSize:14,letterSpacing:.8},
  item:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'#1b3d4b',
    borderWidth:1,borderColor:'#728a88',borderRadius:16,padding:11,minHeight:98},
  iconHolder:{width:50,height:56,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:'#102e42'},
  itemTitle:{color:COLORS.white,fontSize:14,fontWeight:'900'},
  desc:{color:'#dbedef',fontSize:11,lineHeight:16},
  small:{color:COLORS.gold,fontSize:10,lineHeight:15},
  right:{alignItems:'center',gap:8},
  price:{color:COLORS.gold,fontSize:14,fontWeight:'900'},
  buy:{minWidth:76,minHeight:39,alignItems:'center',justifyContent:'center',
    backgroundColor:COLORS.gold,paddingHorizontal:9,borderRadius:9},
  inactive:{opacity:.47},
  buyText:{color:'#263945',fontSize:10,fontWeight:'900'},
  notice:{color:'#ffe7b0',backgroundColor:'#3c3c41',padding:12,borderRadius:11,fontSize:12,lineHeight:18},
  footer:{flexDirection:'row',gap:9,padding:12,backgroundColor:'#102c3a',borderRadius:12},
  footerText:{color:COLORS.muted,fontSize:11,lineHeight:17,flex:1},
  backToHall:{minHeight:44,alignItems:'center',justifyContent:'center',borderRadius:11,
    borderWidth:1,borderColor:COLORS.gold},
  backToHallText:{fontWeight:'900',fontSize:12,color:COLORS.gold},
});
