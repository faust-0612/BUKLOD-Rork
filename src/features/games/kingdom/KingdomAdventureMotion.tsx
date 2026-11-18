/** Animated, action-driven character scene using the approved BUKLOD art assets.
 * No layout-shifting entrances; all movement is native-driver, bounded and
 * disabled for Reduce Motion / blur / app background.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useBuklodReduceMotion } from '@/components/HomeMotion';
import BuklodProgressiveCharacterArt from '@/components/points/BuklodProgressiveCharacterArt';
import { getBuklodSpecialLevelAsset } from '@/lib/buklodSpecialCharacterAssets';
import type { BuklodCoreCharacterId, BuklodSpecialCharacterId } from '@/lib/buklodCharacterSelectionV2';
import { ADVENTURE_MOTION, ADVENTURE_CUE_LABEL, type AdventureCue } from '@/lib/kingdomAdventurePresentation';
import type { AdventureCharacter } from '@/lib/buklodCharacterAdventure';

const CORE = new Set<string>(['phan','quin','van','christian','lhen']);
export type AdventureMoment = Readonly<{ id: number; cue: Exclude<AdventureCue, 'invalid'> }>;
export function KingdomAdventureHeroScene({ character, officialLevel, ascensions, moment }:{
  character: AdventureCharacter;
  officialLevel: number;
  ascensions: number;
  moment: AdventureMoment | null;
}) {
  const reduceMotion = useBuklodReduceMotion();
  const [active, setActive] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState==='active');
  const idle = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(0)).current;
  useFocusEffect(useCallback(() => {
    setActive(true);
    return () => { setActive(false); idle.stopAnimation(); reveal.stopAnimation(); };
  },[idle,reveal]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change',state=>setForeground(state==='active'));
    return ()=>subscription.remove();
  },[]);
  useEffect(()=>{
    if(!active||!foreground||reduceMotion){idle.stopAnimation();idle.setValue(0);return;}
    const loop=Animated.loop(Animated.sequence([
      Animated.timing(idle,{toValue:1,duration:ADVENTURE_MOTION.idleDurationMs,easing:Easing.inOut(Easing.sin),useNativeDriver:true}),
      Animated.timing(idle,{toValue:0,duration:ADVENTURE_MOTION.idleDurationMs,easing:Easing.inOut(Easing.sin),useNativeDriver:true}),
    ]));
    loop.start();
    return()=>{loop.stop();idle.setValue(0)};
  },[active,foreground,reduceMotion,idle]);
  useEffect(()=>{
    reveal.stopAnimation();
    if(!moment||!active||!foreground||reduceMotion){reveal.setValue(0);return;}
    reveal.setValue(0);
    const anim=Animated.timing(reveal,{toValue:1,duration:ADVENTURE_MOTION.celebrationDurationMs,easing:Easing.out(Easing.cubic),useNativeDriver:true});
    anim.start();
    return()=>anim.stop();
  },[moment?.id,active,foreground,reduceMotion,reveal]);
  const level=Math.max(1,Math.min(20,Math.floor(officialLevel)||1));
  const isCore=CORE.has(character);
  const celebrationVisible=Boolean(moment&&active&&foreground);
  return <LinearGradient colors={['#102f41','#1c5b50','#0e302b']} style={styles.frame}>
    <View pointerEvents="none" style={styles.haloOuter}/>
    <View pointerEvents="none" style={styles.haloInner}/>
    <Animated.View pointerEvents="none" style={[styles.character,{transform:[{translateY:idle.interpolate({inputRange:[0,1],outputRange:[0,-6]})}]}]}>
      {isCore ? <BuklodProgressiveCharacterArt characterId={character as BuklodCoreCharacterId} level={level} height={172} viewportWidth={150}/>
        : <Image source={getBuklodSpecialLevelAsset(character as BuklodSpecialCharacterId,level)}
            resizeMode="contain" fadeDuration={0} style={styles.specialCharacter}/>}
    </Animated.View>
    {ascensions>0?<View style={styles.ascension}><MaterialCommunityIcons name="crown-outline" size={18} color="#ffe8a8"/>
      <Text style={styles.ascensionText}>ASCENSION {ascensions}</Text></View>:null}
    {celebrationVisible ? <Animated.View pointerEvents="none" style={[styles.celebration,{opacity:reduceMotion?1:reveal.interpolate({inputRange:[0,.15,.7,1],outputRange:[0,1,1,0]}),transform:[{scale:reduceMotion?1:reveal.interpolate({inputRange:[0,.65,1],outputRange:[.76,1.08,1]})}]}]}>
      <MaterialCommunityIcons name="star-four-points" size={27} color="#f8e7a0"/>
      <Text style={styles.celebrationText}>{ADVENTURE_CUE_LABEL[moment!.cue]}</Text>
    </Animated.View> : null}
    {celebrationVisible&&!reduceMotion ? Array.from({length:ADVENTURE_MOTION.sparkCount},(_,i)=>{
      const angle=(Math.PI*2*i)/ADVENTURE_MOTION.sparkCount;
      return <Animated.View key={i} pointerEvents="none" style={[styles.spark,{
        opacity:reveal.interpolate({inputRange:[0,.1,.7,1],outputRange:[0,1,.75,0]}),
        transform:[
          {translateX:reveal.interpolate({inputRange:[0,1],outputRange:[0,Math.round(Math.cos(angle)*86)]})},
          {translateY:reveal.interpolate({inputRange:[0,1],outputRange:[0,Math.round(Math.sin(angle)*54)]})},
          {scale:reveal.interpolate({inputRange:[0,1],outputRange:[.35,1]})},
        ]}]}><MaterialCommunityIcons name="star-four-points" size={14} color="#fff0b4"/></Animated.View>;
    }):null}
    <View style={styles.footer} pointerEvents="none"><Text style={styles.footerText}>OFFICIAL HERO ART • LEVEL {level}</Text></View>
  </LinearGradient>;
}
const styles=StyleSheet.create({
  frame:{height:215,borderRadius:18,overflow:'hidden',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#83c49b',marginTop:4},
  haloOuter:{position:'absolute',width:178,height:178,borderRadius:90,backgroundColor:'rgba(138,224,157,.09)'},
  haloInner:{position:'absolute',width:112,height:112,borderRadius:60,backgroundColor:'rgba(254,221,148,.14)'},
  character:{alignItems:'center',justifyContent:'center',height:175,zIndex:1},
  specialCharacter:{height:172,width:150},
  ascension:{position:'absolute',right:9,top:9,flexDirection:'row',alignItems:'center',backgroundColor:'#63512a',borderRadius:20,paddingHorizontal:9,paddingVertical:5,gap:4,zIndex:3},
  ascensionText:{fontSize:9,color:'#fff4c8',fontWeight:'900'},
  celebration:{position:'absolute',top:12,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(11,55,39,.88)',borderColor:'#d5f1a4',borderWidth:1,paddingHorizontal:12,paddingVertical:7,borderRadius:14,zIndex:5},
  celebrationText:{fontSize:11,color:'#fff8d7',fontWeight:'900',letterSpacing:.8},
  spark:{position:'absolute',zIndex:4,alignItems:'center',justifyContent:'center'},
  footer:{position:'absolute',left:10,bottom:7,backgroundColor:'rgba(8,30,34,.75)',borderRadius:8,paddingVertical:3,paddingHorizontal:6,zIndex:2},
  footerText:{color:'#d7f6e4',fontSize:8,fontWeight:'900',letterSpacing:.4},
});
