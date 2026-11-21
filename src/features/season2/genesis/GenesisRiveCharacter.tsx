/** A lightweight Season 2 idle animation for locally owned character art.
 * This is NOT a Rive state machine or a fabricated rig. The existing character's
 * actual image is rendered inside a native-driver floating stage, with motion
 * disabled when the parent loses focus, app backgrounds, or Reduce Motion is on.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

export default function GenesisRiveCharacter({active,width,height,fallback}:{
  rigId?:string|null;active:boolean;width:number;height:number;fallback?:React.ReactNode;
}){
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    drift.stopAnimation();
    drift.setValue(0);
    if (!active) return;
    const animation=Animated.loop(Animated.sequence([
      Animated.timing(drift,{toValue:1,duration:2200,easing:Easing.inOut(Easing.sin),useNativeDriver:true}),
      Animated.timing(drift,{toValue:0,duration:2200,easing:Easing.inOut(Easing.sin),useNativeDriver:true}),
    ]));
    animation.start();
    return ()=>{animation.stop();drift.stopAnimation();drift.setValue(0);};
  },[active,drift]);
  return <Animated.View pointerEvents="none" accessible={false} style={{
    width,height,
    alignItems:'center',justifyContent:'center',
    transform:[
      {translateY:drift.interpolate({inputRange:[0,1],outputRange:[2,-6]})},
      {scale:drift.interpolate({inputRange:[0,1],outputRange:[1,1.025]})},
    ],
  }}>{fallback??null}</Animated.View>;
}
