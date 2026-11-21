/** Original Genesis atmosphere layers. Uses a single native animation,
 * never blocks hotspots, and suspends whenever this screen loses focus.
 */
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,StyleSheet,View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import Svg,{Circle,Defs,Ellipse,G,Line,LinearGradient,Path,Stop} from 'react-native-svg';
type Props={world:'home'|'village';level:number;building?:boolean};
const STAR_POINTS=[[32,25,2],[75,43,1],[125,27,2],[165,56,1],[217,27,2],[274,48,2],[319,24,1],[367,55,2],[24,98,1],[385,104,1],[85,87,1],[342,88,1]];
export default function EstateGenesisAtmosphere({world,level,building=false}:Props){
 const [reduce,setReduce]=useState(true);
 const breath=useRef(new Animated.Value(.16)).current;
 useEffect(()=>{let active=true;AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(active)setReduce(v);}).catch(()=>undefined);return()=>{active=false;};},[]);
 useFocusEffect(useCallback(()=>{
  if(reduce){breath.setValue(.20);return()=>{};}
  const loop=Animated.loop(Animated.sequence([
   Animated.timing(breath,{toValue:.32,duration:4400,useNativeDriver:true}),
   Animated.timing(breath,{toValue:.11,duration:4400,useNativeDriver:true}),
  ]));
  loop.start();
  return()=>{loop.stop();breath.setValue(.16);};
 },[reduce,breath]));
 const warm=world==='home'?'#F5DDA0':'#C6EDEA';
 const luminous=level>7?'#C3E6FF':warm;
 return <View pointerEvents="none" style={StyleSheet.absoluteFillObject} accessible={false}>
  <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
   <Defs>
    <LinearGradient id="estate-sunray" x1="0" x2="0" y1="0" y2="1">
     <Stop offset="0" stopColor={warm} stopOpacity=".35"/>
     <Stop offset="1" stopColor={warm} stopOpacity="0"/>
    </LinearGradient>
   </Defs>
   <G opacity=".45">
    <Path d="M204 12 L169 194 L265 194 Z" fill="url(#estate-sunray)"/>
    <Path d="M204 12 L68 167 L197 210 Z" fill="url(#estate-sunray)"/>
    <Path d="M204 12 L238 202 L352 142 Z" fill="url(#estate-sunray)"/>
   </G>
   {STAR_POINTS.map(([x,y,r],i)=><G key={'creation-'+i}>
     <Circle cx={x} cy={y} r={r} fill={luminous} opacity={i%3===0?.86:.54}/>
     {i%4===0&&<Path d={'M'+x+' '+(y-5)+' v10 M'+(x-5)+' '+y+' h10'}
       stroke="#EAF7E9" strokeWidth=".8" opacity=".46"/>}
   </G>)}
   <Path d="M0 284 Q102 258 195 282 T400 270" stroke={world==='home'?'#D6D49C':'#95D1B9'} strokeWidth="1.2" opacity=".2" fill="none"/>
  </Svg>
  <Animated.View style={[StyleSheet.absoluteFillObject,{opacity:breath}]}>
   <Svg width="100%" height="100%" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
    <Ellipse cx="203" cy="73" rx="92" ry="23" fill="#FFE8B0" opacity=".22"/>
    <Path d="M124 84 Q199 46 286 88" stroke={luminous} strokeWidth="2" fill="none" opacity=".66"/>
    {building&&<G>
     <Circle cx="163" cy="153" r="6" fill="#FFF3CA" opacity=".83"/>
     <Circle cx="239" cy="178" r="4" fill="#B8F2D2" opacity=".90"/>
     <Line x1="163" x2="163" y1="140" y2="163" stroke="#F7E0AB" strokeWidth="2"/>
     <Line x1="152" x2="176" y1="153" y2="153" stroke="#F7E0AB" strokeWidth="2"/>
    </G>}
   </Svg>
  </Animated.View>
 </View>;
}
