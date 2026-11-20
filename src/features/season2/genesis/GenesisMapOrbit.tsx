/** Focus-gated premium ambient creation map, native driver only, no backend/network. */
import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import {useGenesisMotionAllowed} from './GenesisVisuals';
import {getGenesisDeviceQuality} from './genesisDeviceQuality';

export default function GenesisMapOrbit({active}:{active:boolean}) {
  const motion = useGenesisMotionAllowed(active,getGenesisDeviceQuality('home'),'home');
  const phase=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    phase.stopAnimation(); phase.setValue(0);
    if(!motion)return;
    const loop=Animated.loop(Animated.sequence([
      Animated.timing(phase,{toValue:1,duration:7200,easing:Easing.inOut(Easing.sin),useNativeDriver:true}),
      Animated.timing(phase,{toValue:0,duration:7200,easing:Easing.inOut(Easing.sin),useNativeDriver:true}),
    ]));
    loop.start();
    return()=>{loop.stop();phase.stopAnimation();};
  },[motion,phase]);
  const auraOpacity=phase.interpolate({inputRange:[0,1],outputRange:[.15,.42]});
  const auraScale=phase.interpolate({inputRange:[0,1],outputRange:[.9,1.16]});
  const planetY=phase.interpolate({inputRange:[0,1],outputRange:[0,-7]});
  const planetOpacity=phase.interpolate({inputRange:[0,1],outputRange:[.45,.72]});
  return <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <Animated.Image source={require('../../../../assets/season2/genesis/galaxy/earth.jpg')}
      resizeMode="cover" style={[styles.planet,{opacity:planetOpacity,transform:[{translateY:planetY}]}]}/>
    <Animated.View style={[styles.aura,{opacity:auraOpacity,transform:[{scale:auraScale}]}]}/>
    <View style={styles.lens}/>
  </View>;
}
const styles=StyleSheet.create({
  planet:{position:'absolute',top:11,right:-18,width:145,height:145,borderRadius:72,
    borderWidth:1,borderColor:'rgba(174,222,245,.2)'},
  aura:{position:'absolute',left:'36%',top:'28%',width:'28%',aspectRatio:1,
    borderRadius:99,backgroundColor:'#FFF0CE',shadowColor:'#FFE5BA',
    shadowRadius:26,shadowOpacity:.6},
  lens:{position:'absolute',left:18,bottom:20,width:65,height:1,
    backgroundColor:'rgba(169,229,231,.18)',transform:[{rotate:'-30deg'}]},
});
