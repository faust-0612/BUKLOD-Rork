/**
 * BUKLOD Genesis — moving COSMOS around the owner-approved fixed nine-door map.
 * Cosmetic only: native-composited loops; zero touch interception, network
 * dependencies, frame-by-frame JS or changes to navigation/guide positions.
 */
import React,{useEffect,useRef} from 'react';
import {Animated,Easing,StyleSheet,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import Svg,{Circle,Defs,Ellipse,G,Path,RadialGradient,Stop} from 'react-native-svg';
import {useGenesisMotionAllowed} from './GenesisVisuals';
import {getGenesisDeviceQuality} from './genesisDeviceQuality';

const STARS:readonly (readonly [number,number])[]=[
 [24,39],[81,164],[137,43],[193,96],[257,35],[317,178],
 [370,46],[419,88],[475,30],[539,125],[605,38],[678,139],
 [44,280],[180,306],[285,259],[411,276],[551,328],[698,303],
 [49,463],[165,433],[346,415],[469,492],[596,437],[673,520],
];
export default function GenesisDimensionalMapEffects({active,landscape}:{
 active:boolean;landscape:boolean;
}){
 const run=useGenesisMotionAllowed(active,getGenesisDeviceQuality('home'),'home');
 const orbit=useRef(new Animated.Value(0)).current;
 const breath=useRef(new Animated.Value(0)).current;
 const float=useRef(new Animated.Value(0)).current;
 useEffect(()=>{
   orbit.stopAnimation();breath.stopAnimation();float.stopAnimation();
   orbit.setValue(0);breath.setValue(0);float.setValue(0);
   if(!run)return;
   // Native driver avoids JS-frame work while ScrollView, ads and navigation run.
   const orbital=Animated.loop(Animated.timing(orbit,{toValue:1,duration:36000,
     easing:Easing.linear,useNativeDriver:true,isInteraction:false}));
   const glowing=Animated.loop(Animated.sequence([
     Animated.timing(breath,{toValue:1,duration:4500,easing:Easing.inOut(Easing.sin),
       useNativeDriver:true,isInteraction:false}),
     Animated.timing(breath,{toValue:0,duration:4500,easing:Easing.inOut(Easing.sin),
       useNativeDriver:true,isInteraction:false}),
   ]));
   const drifting=Animated.loop(Animated.sequence([
     Animated.timing(float,{toValue:1,duration:8000,easing:Easing.inOut(Easing.sin),
       useNativeDriver:true,isInteraction:false}),
     Animated.timing(float,{toValue:0,duration:8000,easing:Easing.inOut(Easing.sin),
       useNativeDriver:true,isInteraction:false}),
   ]));
   orbital.start();glowing.start();drifting.start();
   return()=>{orbital.stop();glowing.stop();drifting.stop();
     orbit.stopAnimation();breath.stopAnimation();float.stopAnimation();};
 },[run,orbit,breath,float]);
 const angle=orbit.interpolate({inputRange:[0,1],outputRange:['0deg','360deg']});
 const flare=breath.interpolate({inputRange:[0,1],outputRange:[.54,.93]});
 const scale=breath.interpolate({inputRange:[0,1],outputRange:[.97,1.04]});
 const driftX=float.interpolate({inputRange:[0,1],outputRange:[-5,6]});
 const driftY=float.interpolate({inputRange:[0,1],outputRange:[5,-6]});
 return <View pointerEvents="none" accessible={false}
   style={[styles.frame,{height:landscape?'100%':'64%'}]}>
   {/* The real approved image/labels stay sharp underneath the cosmic atmosphere. */}
   <LinearGradient
     colors={['rgba(4,8,39,.57)','rgba(29,11,72,.37)','rgba(7,20,49,.06)']}
     locations={[0,.54,1]} style={StyleSheet.absoluteFillObject}/>
   <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject,
     {opacity:breath.interpolate({inputRange:[0,1],outputRange:[.75,.96]}),
      transform:[{translateX:driftX},{translateY:driftY}]}]}>
     <Svg width="100%" height="100%" viewBox="0 0 720 640" preserveAspectRatio="none">
       <Defs>
         <RadialGradient id="nebulaV" cx="50%" cy="50%" rx="50%" ry="50%">
           <Stop offset="0" stopColor="#AC6CF5" stopOpacity=".65"/>
           <Stop offset=".60" stopColor="#693AB5" stopOpacity=".25"/>
           <Stop offset="1" stopColor="#101447" stopOpacity="0"/>
         </RadialGradient>
         <RadialGradient id="nebulaC" cx="50%" cy="50%" rx="50%" ry="50%">
           <Stop offset="0" stopColor="#66D8FF" stopOpacity=".46"/>
           <Stop offset=".62" stopColor="#4159C2" stopOpacity=".19"/>
           <Stop offset="1" stopColor="#02132F" stopOpacity="0"/>
         </RadialGradient>
         <RadialGradient id="outerPlanet" cx="25%" cy="19%" rx="77%" ry="83%">
           <Stop offset="0" stopColor="#E9E9FF"/>
           <Stop offset=".4" stopColor="#778BE3"/>
           <Stop offset="1" stopColor="#181641"/>
         </RadialGradient>
       </Defs>
       <Ellipse cx="477" cy="123" rx="252" ry="198" fill="url(#nebulaV)"/>
       <Ellipse cx="107" cy="279" rx="229" ry="260" fill="url(#nebulaC)"/>
       <Ellipse cx="641" cy="414" rx="180" ry="206" fill="url(#nebulaC)"/>
       <Circle cx="50" cy="84" r="42" fill="url(#outerPlanet)" opacity=".83"/>
       <Ellipse cx="50" cy="84" rx="64" ry="14" transform="rotate(-25 50 84)"
         fill="none" stroke="#C4C6FF" strokeOpacity=".7" strokeWidth="1.4"/>
       <Circle cx="666" cy="84" r="18" fill="url(#outerPlanet)" opacity=".73"/>
       <Path d="M-30 299 Q202 -9 408 104 T757 210"
         stroke="#E1D0FF" strokeWidth="2.1" strokeOpacity=".3" fill="none"/>
       <Path d="M-35 347 Q212 55 433 153 T757 264"
         stroke="#9FE7FF" strokeWidth="1.2" strokeOpacity=".28" fill="none"/>
       {STARS.map(([x,y],i)=><G key={i}>
         <Circle cx={x} cy={y} r={i%3===0?1.8:1.1}
           fill={i%3===0?'#FFE8C0':'#DAEEFF'}/>
         {i%4===0?<Path
           d={'M'+(x-5)+' '+y+' H'+(x+5)+' M'+x+' '+(y-5)+' V'+(y+5)}
           stroke="#FFF3DC" strokeWidth=".75" strokeOpacity=".7"/>:null}
       </G>)}
     </Svg>
   </Animated.View>
   {/* Only this orbital decoration rotates: image, texts and hitboxes NEVER do. */}
   <Animated.View pointerEvents="none"
     style={[styles.orbit,{transform:[{rotate:angle}]}]}>
     <Svg width="100%" height="100%" viewBox="0 0 420 420">
       <Ellipse cx="210" cy="210" rx="184" ry="68" transform="rotate(-26 210 210)"
         stroke="#CFBCFF" strokeOpacity=".75" strokeWidth="1.6" fill="none"/>
       <Ellipse cx="210" cy="210" rx="158" ry="42" transform="rotate(41 210 210)"
         stroke="#A3EFFF" strokeOpacity=".53" strokeWidth="1.2" fill="none"/>
       <Circle cx="55" cy="132" r="4" fill="#FFF0B8"/>
       <Circle cx="357" cy="299" r="3" fill="#E0ECFF"/>
     </Svg>
   </Animated.View>
   {/* First Light gently brightens and fades; there are no hard cuts or pauses. */}
   <Animated.View pointerEvents="none" style={[styles.light,
     {opacity:flare,transform:[{scale}]}]}>
     <Svg width="100%" height="100%" viewBox="0 0 280 200">
       <Defs>
         <RadialGradient id="lightBurst" cx="50%" cy="50%" rx="50%" ry="50%">
           <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1"/>
           <Stop offset=".14" stopColor="#FFF4CD" stopOpacity=".85"/>
           <Stop offset=".47" stopColor="#FFC98C" stopOpacity=".38"/>
           <Stop offset="1" stopColor="#FFB878" stopOpacity="0"/>
         </RadialGradient>
       </Defs>
       <Ellipse cx="140" cy="100" rx="138" ry="98" fill="url(#lightBurst)"/>
       <Path d="M140 0 V200 M0 100 H280 M67 28 L213 172 M67 172 L213 28"
         stroke="#FFF3D2" strokeOpacity=".6" strokeWidth="1"/>
       <Circle cx="140" cy="100" r="4" fill="#FFF"/>
     </Svg>
   </Animated.View>
 </View>;
}
const styles=StyleSheet.create({
 frame:{position:'absolute',left:0,right:0,top:0,overflow:'hidden',zIndex:1},
 orbit:{position:'absolute',left:'17%',top:'15%',width:'66%',height:'66%',opacity:.37},
 light:{position:'absolute',left:'29%',top:'0%',width:'42%',height:'25%'},
});
