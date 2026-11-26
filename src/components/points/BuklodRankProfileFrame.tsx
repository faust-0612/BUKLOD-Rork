import React,{memo,useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,AppState,Easing,StyleSheet,View} from 'react-native';
import Svg,{Circle,Path,Defs,LinearGradient,Stop} from 'react-native-svg';
import type {BuklodCircleRankArt} from '@/lib/buklodCircleRankArt';

/** Large avatar ornaments are cosmetic only. No network or per-frame JS. */
export default memo(function BuklodRankProfileFrame({rank,size,active=false}:{rank:BuklodCircleRankArt;size:number;active?:boolean}){
 const spin=useRef(new Animated.Value(0)).current;
 const [motion,setMotion]=useState(false);
 useEffect(()=>{
  if(!active||rank.order<9)return;
  let live=true,allowed=false,foreground=AppState.currentState==='active';
  const apply=()=>{if(live)setMotion(allowed&&foreground);};
  void AccessibilityInfo.isReduceMotionEnabled().then(v=>{allowed=!v;apply();}).catch(()=>{});
  const a=AccessibilityInfo.addEventListener('reduceMotionChanged',v=>{allowed=!v;apply();});
  const b=AppState.addEventListener('change',s=>{foreground=s==='active';apply();});
  return()=>{live=false;a.remove();b.remove();setMotion(false);};
 },[active,rank.order]);
 useEffect(()=>{
  spin.stopAnimation();spin.setValue(0);
  if(!active||!motion)return;
  const anim=Animated.loop(Animated.timing(spin,{toValue:1,duration:14000,easing:Easing.linear,useNativeDriver:true,isInteraction:false}));
  anim.start();return()=>anim.stop();
 },[active,motion,spin]);
 if(rank.order<9||size<64)return null;
 const radius=47;
 const n=4+rank.familyIndex*2;
 const familyShape=['M50 4 L53 8 50 12 47 8Z','M50 2 Q56 6 50 13 Q44 6 50 2Z','M50 2 L56 7 50 14 44 7Z','M44 4 H56 L53 12 H47Z','M44 8 Q50 0 56 8 Q50 16 44 8Z','M50 1 Q57 9 50 14 Q43 9 50 1Z','M43 8 L50 2 57 8 50 14Z','M50 1 L53 6 59 8 53 10 50 15 47 10 41 8 47 6Z'][rank.familyIndex];
 return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill,{overflow:'visible'}]}>
 <Svg width={size} height={size} viewBox="0 0 100 100">
  <Defs><LinearGradient id="rankMetal" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FFF7D8"/><Stop offset=".45" stopColor={rank.borderColor}/><Stop offset="1" stopColor="#4D4437"/></LinearGradient></Defs>
  <Circle cx="50" cy="50" r={radius} fill="none" stroke="url(#rankMetal)" strokeWidth={2+rank.levelIndex*.45}/>
  <Circle cx="50" cy="50" r="43" fill="none" stroke={rank.borderColor} strokeWidth=".7"/>
  {Array.from({length:n},(_,i)=><Path key={i} d={familyShape} transform={'rotate('+(i*360/n)+' 50 50)'} fill={rank.borderColor} stroke="#FFF2CB" strokeWidth=".45"/>)}
 </Svg>
 {active&&motion&&<Animated.View style={[StyleSheet.absoluteFill,{transform:[{rotate:spin.interpolate({inputRange:[0,1],outputRange:['0deg','360deg']})}]}]}>
 <Svg width={size} height={size} viewBox="0 0 100 100"><Path d="M50 2 A48 48 0 0 1 98 50 M50 98 A48 48 0 0 1 2 50" stroke="#FFF3BD" strokeWidth="1.8" strokeLinecap="round" fill="none"/><Path d="M50 2 L53 6 L50 10 L47 6Z" fill="#FFF8D0"/></Svg>
 </Animated.View>}
 </View>;
});
