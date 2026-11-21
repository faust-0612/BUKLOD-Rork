/**
 * Season 2 map concierge lives OUTSIDE the owner-approved Valley illustration.
 * Uses the original locally packaged Phan animation; never draws over gold
 * landmarks, never impersonates AI, changes earned BP, or bypasses route guards.
 * All navigation still enters the original permissioned Expo Router screens.
 */
import React, {useEffect, useState} from 'react';
import {AccessibilityInfo, Pressable, StyleSheet, Text, View} from 'react-native';
import {Image as ExpoImage} from 'expo-image';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {ARENA_GENERATED_ART} from '@/features/games/empire/arenaGeneratedAssets';
import {ARENA_HERO_ART} from '@/features/games/empire/arenaVisualBaseline';

const TIPS=[
  'Kumusta! Ako si Phan, ang BUKLOD guide mo. Isang tap lang sa mapa, pasok ka na!',
  'Para sa character at collectibles, buksan ang Character Kingdom. Iba ang Empire Arena.',
  'Sa Community Village matatagpuan ang mga cluster at bayanihang gawain.',
  'Ang earned BP, Character Diamonds at QMP ay magkakaibang record. Walang points na nadodoble sa pag-trade.',
] as const;

type Props={
  active:boolean;
  onCharacterKingdom:()=>void;
  onCommunityVillage:()=>void;
  onDirectory:()=>void;
};
export default function GenesisWorldGuide({active,onCharacterKingdom,onCommunityVillage,onDirectory}:Props){
  const [tip,setTip]=useState(0);
  const [reduceMotion,setReduceMotion]=useState(true);
  useEffect(()=>{
    let mounted=true;
    AccessibilityInfo.isReduceMotionEnabled().then(value=>{
      if(mounted)setReduceMotion(value);
    }).catch(()=>undefined);
    return ()=>{mounted=false;};
  },[]);
  // Animated local WebP is active only when this screen is focused and the user
  // has not requested reduced motion; no timers, streams or second subscriptions.
  const art=active&&!reduceMotion
    ? ARENA_GENERATED_ART['sprite:phan'] || ARENA_HERO_ART.phan
    : ARENA_HERO_ART.phan;
  return <View style={styles.shell} accessibilityLabel="BUKLOD character guide, outside the world map">
    <View style={styles.row}>
      <View style={styles.character}>
        <ExpoImage accessibilityLabel="Phan, animated BUKLOD guide" source={art}
          contentFit="contain" style={styles.characterArt}/>
      </View>
      <View style={styles.message}>
        <Text style={styles.heading}>PHAN · BUKLOD GUIDE</Text>
        <Text style={styles.speech}>{TIPS[tip]}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Next useful BUKLOD guide tip"
          onPress={()=>setTip(t=>(t+1)%TIPS.length)} style={styles.tipButton}>
          <MaterialCommunityIcons name="comment-question-outline" size={15} color="#FBE6B4"/>
          <Text style={styles.tipText}>Isa pang tip</Text>
        </Pressable>
      </View>
    </View>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel="Enter Character Kingdom"
        onPress={onCharacterKingdom} style={styles.action}>
        <MaterialCommunityIcons name="castle" size={18} color="#E9EED7"/>
        <Text style={styles.actionText}>Character Kingdom</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Enter Community Village"
        onPress={onCommunityVillage} style={styles.action}>
        <MaterialCommunityIcons name="account-group-outline" size={18} color="#E9EED7"/>
        <Text style={styles.actionText}>Community Village</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Show all destinations"
        onPress={onDirectory} style={styles.action}>
        <MaterialCommunityIcons name="compass-outline" size={18} color="#E9EED7"/>
        <Text style={styles.actionText}>All places</Text>
      </Pressable>
    </View>
  </View>;
}

const styles=StyleSheet.create({
  shell:{marginTop:8,borderRadius:17,borderWidth:1,borderColor:'rgba(231,213,155,.43)',
    padding:10,backgroundColor:'rgba(7,26,40,.93)',gap:8},
  row:{flexDirection:'row',alignItems:'center',gap:9},
  character:{width:61,height:67,borderRadius:14,borderWidth:1,borderColor:'rgba(178,247,204,.50)',
    backgroundColor:'rgba(11,57,61,.71)',overflow:'hidden'},
  characterArt:{width:'100%',height:'100%'},
  message:{flex:1,minWidth:0,gap:4},
  heading:{fontSize:10,fontWeight:'900',color:'#A3EBCB',letterSpacing:.7},
  speech:{fontSize:11,lineHeight:15,color:'#F3F2E7',fontWeight:'600'},
  tipButton:{alignSelf:'flex-start',flexDirection:'row',gap:5,alignItems:'center',
    minHeight:31,paddingHorizontal:8,borderRadius:9,backgroundColor:'rgba(215,191,123,.13)'},
  tipText:{fontSize:10,fontWeight:'800',color:'#FBE6B4'},
  actions:{flexDirection:'row',flexWrap:'wrap',gap:6},
  action:{flexGrow:1,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:5,
    paddingHorizontal:9,minHeight:44,borderRadius:11,backgroundColor:'rgba(35,73,67,.91)',
    borderWidth:1,borderColor:'rgba(182,232,206,.42)'},
  actionText:{fontSize:11,fontWeight:'800',color:'#F5F7E6'},
});
