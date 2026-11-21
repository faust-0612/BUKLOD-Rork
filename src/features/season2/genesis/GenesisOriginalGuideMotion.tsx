/**
 * Same owner-approved portrait JPEG, never an AI substitute or a different face.
 * Subtle motion is applied to cropped pixels of THAT illustration. Eyes blink via
 * light-weight native transforms; the arm makes a restrained greeting gesture.
 *
 * Image/eye/hand/cheek effects are strictly decorative and never claim to be a
 * separately drawn character rig. Exact studio-grade expressions would require
 * independently approved layered animation frames.
 */
import React,{useEffect,useRef} from 'react';
import {Animated,Easing,Image,StyleSheet,View} from 'react-native';
import Svg,{Path} from 'react-native-svg';
import {useGenesisMotionAllowed} from './GenesisVisuals';
import {getGenesisDeviceQuality} from './genesisDeviceQuality';

const ORIGINAL_GUIDE_IN_MAP=require('../../../../assets/season2/genesis/world/buklod-genesis-portrait-welcome-720x995.jpg');
type Props={active:boolean;landscape:boolean;width:number;height:number};

/** A clipped portion of the exact same bundled portrait artwork. */
function LivePixelCrop({left,top,w,h,imageWidth,imageHeight,opacity,motion}:{
 left:number;top:number;w:number;h:number;imageWidth:number;imageHeight:number;
 opacity:Animated.AnimatedInterpolation<number>;
 motion:Animated.AnimatedInterpolation<string>;
}){
 return <Animated.View pointerEvents="none" accessibilityElementsHidden
   style={{position:'absolute',left,top,width:w,height:h,overflow:'hidden',opacity,
     transform:[{rotate:motion}]}}>
   <Image source={ORIGINAL_GUIDE_IN_MAP} resizeMode="stretch"
     style={{position:'absolute',left:-left,top:-top,width:imageWidth,height:imageHeight}}/>
 </Animated.View>;
}

export default function GenesisOriginalGuideMotion({active,landscape,width,height}:Props){
 const run=useGenesisMotionAllowed(active&&!landscape,getGenesisDeviceQuality('home'),'home');
 const blink=useRef(new Animated.Value(0)).current;
 const arm=useRef(new Animated.Value(0)).current;
 const breath=useRef(new Animated.Value(0)).current;
 useEffect(()=>{
   blink.stopAnimation();arm.stopAnimation();breath.stopAnimation();
   blink.setValue(0);arm.setValue(0);breath.setValue(0);
   if(!run)return;
   const blinking=Animated.loop(Animated.sequence([
     Animated.delay(2500),
     Animated.timing(blink,{toValue:1,duration:110,useNativeDriver:true,isInteraction:false}),
     Animated.timing(blink,{toValue:0,duration:180,useNativeDriver:true,isInteraction:false}),
     Animated.delay(2900),
     Animated.timing(blink,{toValue:1,duration:110,useNativeDriver:true,isInteraction:false}),
     Animated.timing(blink,{toValue:0,duration:180,useNativeDriver:true,isInteraction:false}),
     Animated.delay(2200),
   ]));
   const waving=Animated.loop(Animated.sequence([
     Animated.delay(1900),
     Animated.timing(arm,{toValue:1,duration:650,easing:Easing.inOut(Easing.sin),
       useNativeDriver:true,isInteraction:false}),
     Animated.timing(arm,{toValue:0,duration:700,easing:Easing.inOut(Easing.sin),
       useNativeDriver:true,isInteraction:false}),
     Animated.delay(2100),
   ]));
   const breathing=Animated.loop(Animated.sequence([
     Animated.timing(breath,{toValue:1,duration:3100,easing:Easing.inOut(Easing.sin),
       useNativeDriver:true,isInteraction:false}),
     Animated.timing(breath,{toValue:0,duration:3100,easing:Easing.inOut(Easing.sin),
       useNativeDriver:true,isInteraction:false}),
   ]));
   blinking.start();waving.start();breathing.start();
   return()=>{blinking.stop();waving.stop();breathing.stop();
     blink.stopAnimation();arm.stopAnimation();breath.stopAnimation();};
 },[run,blink,arm,breath]);

 // Do not animate landmarks, baked chat text or the complete map.
 if(landscape || !run)return null;
 const armOpacity=arm.interpolate({inputRange:[0,.25,1],outputRange:[1,1,1]});
 const armRotation=arm.interpolate({inputRange:[0,1],outputRange:['0deg','-3deg']});
 const headOpacity=breath.interpolate({inputRange:[0,1],outputRange:[1,1]});
 const headRotation=breath.interpolate({inputRange:[0,1],outputRange:['0deg','0.3deg']});
 const eyelidOpacity=blink.interpolate({inputRange:[0,.65,1],outputRange:[0,.2,.90]});
 const eyeTop=height*.666;
 const eyeWidth=width*.107;
 const eyesLeft=width*.163;
 return <View pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}>
   {/* Live original portrait pixels. Tiny 0.3° head movement keeps face intact. */}
   <LivePixelCrop imageWidth={width} imageHeight={height}
     left={width*.025} top={height*.59} w={width*.38} h={height*.19}
     opacity={headOpacity} motion={headRotation}/>
   {/* Arm/hand crops animate only a few degrees; no synthetic face or new identity. */}
   <LivePixelCrop imageWidth={width} imageHeight={height}
     left={width*.014} top={height*.835} w={width*.365} h={height*.157}
     opacity={armOpacity} motion={armRotation}/>
   {/* Eyelid marks follow the exact two original face positions; no eye replacement. */}
   <Animated.View pointerEvents="none" style={{position:'absolute',left:eyesLeft,
     top:eyeTop,width:eyeWidth,height:height*.025,opacity:eyelidOpacity}}>
     <Svg width="100%" height="100%" viewBox="0 0 110 28" preserveAspectRatio="none">
       <Path d="M6 14 Q24 20 43 11" fill="none" stroke="#AE7057"
         strokeWidth="4.2" strokeLinecap="round"/>
       <Path d="M62 10 Q82 18 102 10" fill="none" stroke="#AE7057"
         strokeWidth="4.2" strokeLinecap="round"/>
     </Svg>
   </Animated.View>
 </View>;
}
