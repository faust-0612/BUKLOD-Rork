import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as VectorGradient, Path, Rect, Stop } from 'react-native-svg';
import type { ArcadeMode, ArcadeEntity } from './arcadeCore';
import BuklodProgressiveCharacterArt from '@/components/points/BuklodProgressiveCharacterArt';
import BuklodSpecialCharacterArtV2 from '@/components/points/BuklodSpecialCharacterArtV2';

/**
 * Lightweight local vector scenery with native-driver motion. Deliberately
 * capped at 11 scenery nodes + 8 burst sparks; zero remote images/requests.
 * It is a visual layer only and never intercepts gameplay controls.
 */
export const ArcadePremiumFX = React.memo(function ArcadePremiumFX({accent, mode, active, eventSeq, outcome, stage}:{
  accent:string; mode:ArcadeMode; active:boolean; eventSeq:number;
  outcome:'move'|'collect'|'impact'|'unlock'; stage:number;
}) {
  const drift=useRef(new Animated.Value(0)).current;
  const burst=useRef(new Animated.Value(0)).current;
  const started=useRef(false);
  const stars=useMemo(()=>Array.from({length:11},(_,i)=>({
    x:18+(i*97+stage*17)%345,y:20+(i*71+stage*29)%440,r:1.3+(i%3)*.7,
  })),[stage]);
  const particles=useMemo(()=>Array.from({length:8},(_,i)=>({
    angle:(Math.PI*2*i)/8,
    distance:46+(i%3)*17,
  })),[]);
  useEffect(()=>{
    if(!active){drift.stopAnimation();return;}
    const loop=Animated.loop(Animated.timing(drift,{
      toValue:1,duration:7000,easing:Easing.linear,useNativeDriver:true,
    }));
    loop.start();
    return ()=>loop.stop();
  },[active,drift]);
  useEffect(()=>{
    if(!started.current){started.current=true;return;}
    if(!active || (outcome!=='collect'&&outcome!=='impact'&&outcome!=='unlock'))return;
    burst.stopAnimation();
    burst.setValue(0);
    Animated.timing(burst,{
      toValue:1,duration:outcome==='impact'?380:850,
      easing:Easing.out(Easing.cubic),useNativeDriver:true,
    }).start();
  },[eventSeq,active,outcome,burst]);
  const offset=drift.interpolate({inputRange:[0,1],outputRange:[0,-24]});
  const opacity=burst.interpolate({inputRange:[0,.2,1],outputRange:[0,.85,0]});
  const palette=mode==='rhythm'
    ? (['#090f29','#24224b','#56316e'] as const)
    : mode==='catch'||mode==='stack'
      ? (['#0a1a30','#233454','#4d4568'] as const)
      : (['#08172a','#17334a','#2a4d50'] as const);
  return <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
    <LinearGradient colors={palette} style={StyleSheet.absoluteFillObject}/>
    <Animated.View style={[styles.sky,{transform:[{translateY:offset}]}]}>
      <Svg width="100%" height="100%" viewBox="0 0 380 520" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <VectorGradient id="arcade-horizon" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={accent} stopOpacity=".04"/>
            <Stop offset=".55" stopColor={accent} stopOpacity=".14"/>
            <Stop offset="1" stopColor={accent} stopOpacity=".05"/>
          </VectorGradient>
        </Defs>
        <Circle cx="320" cy="95" r="82" fill={accent} opacity=".10"/>
        <Circle cx="320" cy="95" r="58" fill={accent} opacity=".08"/>
        {stars.map((p,i)=><Circle key={i} cx={p.x} cy={p.y} r={p.r} fill="#fff4da" opacity={.2+(i%4)*.12}/>)}
        <Path d="M0 370 Q88 300 190 360 T380 345 L380 520 L0 520 Z" fill="url(#arcade-horizon)"/>
        <Path d="M0 445 Q96 387 187 432 T380 413 L380 520 L0 520 Z" fill={accent} opacity=".08"/>
        {mode==='rhythm' ? Array.from({length:6},(_,i)=>
          <Rect key={'eq'+i} x={25+i*58} y={370-(i%3)*18} width="25" height={65+(i%3)*23}
            rx="8" fill={accent} opacity=".17"/>) : null}
        {mode==='lane'||mode==='runner'||mode==='defend' ?
          <Path d="M190 260 L20 520 M190 260 L360 520" stroke={accent} strokeWidth="2" opacity=".26" /> : null}
        <Path d="M-40 210 Q180 157 420 208" stroke={accent} strokeWidth="1.8" opacity=".22" fill="none"/>
      </Svg>
    </Animated.View>
    <View style={styles.horizonGlow}>
      <LinearGradient colors={['transparent',accent+'22','transparent']} style={StyleSheet.absoluteFillObject}/>
    </View>
    {particles.map((p,i)=><Animated.View key={i} style={[styles.spark,{
      backgroundColor:outcome==='impact'?'#ff8e83':accent,
      opacity,
      left:'50%',top:'44%',
      transform:[
        {translateX:burst.interpolate({inputRange:[0,1],outputRange:[0,Math.cos(p.angle)*p.distance]})},
        {translateY:burst.interpolate({inputRange:[0,1],outputRange:[0,Math.sin(p.angle)*p.distance]})},
        {scale:burst.interpolate({inputRange:[0,.25,1],outputRange:[.2,1.1,.1]})},
      ],
    }]}/>)}
    <View style={[styles.levelStripe,{borderTopColor:accent+'55'}]}/>
  </View>;
});


const CORE_HEROES=['phan','quin','van','christian','lhen'] as const;
const SPECIAL_HEROES=['jawo','trudice','ace','mitch','niel','angel','vhen','ellusur'] as const;
/** Approved BUKLOD sprite art, not emoji substitutes or third-party characters. */
export const ArcadeHeroSprite = React.memo(function ArcadeHeroSprite({character,dim=51}: {character:string;dim?:number}) {
  if(CORE_HEROES.some(key=>key===character))return (
    <BuklodProgressiveCharacterArt characterId={character as (typeof CORE_HEROES)[number]}
      level={1} height={dim} viewportWidth={dim}/>
  );
  if(SPECIAL_HEROES.some(key=>key===character))return (
    <BuklodSpecialCharacterArtV2 characterId={character as (typeof SPECIAL_HEROES)[number]}
      height={dim} viewportWidth={dim}/>
  );
  return null;
});

/** Native-driver collectible motion; capped at nine active items per arcade run. */
export function ArcadeMovingItem({item,icon,accent,ms=160}:{
  item:ArcadeEntity;icon:string;accent:string;ms?:number;
}) {
  const y=useRef(new Animated.Value(item.y)).current;
  const scale=useRef(new Animated.Value(.5)).current;
  useEffect(()=>{
    Animated.spring(scale,{toValue:1,tension:115,friction:11,useNativeDriver:true}).start();
  },[scale]);
  useEffect(()=>{
    Animated.timing(y,{toValue:item.y,duration:ms,easing:Easing.linear,useNativeDriver:true}).start();
  },[item.y,ms,y]);
  const yPixels=y.interpolate({inputRange:[0,6],outputRange:[0,270],extrapolate:'clamp'});
  const left=item.lane===0?'4%':item.lane===1?'37%':'70%';
  return <Animated.View pointerEvents="none" style={[styles.movingItem,{
    left:left as any,borderColor:accent,transform:[{translateY:yPixels},{scale}],
  }]}>
    <LinearGradient colors={[accent+'88',accent+'22','#0b1836ee']} style={styles.itemGradient}/>
    <Animated.Text style={styles.movingGlyph}>{icon}</Animated.Text>
  </Animated.View>;
}

const styles=StyleSheet.create({
  sky:{...StyleSheet.absoluteFillObject,bottom:-26},
  movingItem:{position:'absolute',top:0,width:'26%',height:52,borderRadius:17,
    borderWidth:1.5,overflow:'hidden',alignItems:'center',justifyContent:'center',
    shadowColor:'#ffffff',shadowOpacity:.3,shadowRadius:6},
  itemGradient:{...StyleSheet.absoluteFillObject,borderRadius:17},
  movingGlyph:{fontSize:30,includeFontPadding:false},
  horizonGlow:{position:'absolute',top:'25%',left:0,right:0,height:130},
  spark:{position:'absolute',width:8,height:8,borderRadius:4,
    shadowOpacity:.9,shadowRadius:7,shadowColor:'#fff'},
  levelStripe:{position:'absolute',bottom:0,left:0,right:0,borderTopWidth:1,height:2},
});
