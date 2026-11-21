/** Lightweight original estate action burst. All effects are decorative and
 * follow reduced-motion preferences; the confirmed backend state is unaffected.
 */
import React,{useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,StyleSheet,Text,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import type {EstateMoment} from './estateFeedback';
import type {EstateCosmetics} from './estateProgressClient';
import EstateResourceEmblem from './EstateResourceEmblem';
import EstateCosmeticTile from './EstateCosmeticTile';
type Props={event:EstateMoment|null;sequence:number;cosmetics?:EstateCosmetics};
const STATES={
 apply:{label:'DESIGN APPLIED',color:'#E5F5CD',icon:'check-decagram'},
 claim:{label:'MILESTONE CLAIMED',color:'#FFDF9F',icon:'star-four-points'},
 build_start:{label:'CONSTRUCTION STARTED',color:'#D3E6B9',icon:'hammer-wrench'},
 build_complete:{label:'NEW STAGE COMPLETE',color:'#FFE1A2',icon:'home-check'},
 contribute:{label:'COMMUNITY SUPPORTED',color:'#C1EED6',icon:'hand-heart'},
 buy_success:{label:'PURCHASE VERIFIED',color:'#FFE4B4',icon:'check-decagram'},
 buy_failure:{label:'PURCHASE NOT COMPLETED',color:'#F8C6C2',icon:'alert-circle-outline'},
 unlock:{label:'NEW DEVELOPMENT',color:'#E4D0FF',icon:'auto-fix'},
 error:{label:'ACTION NOT COMPLETED',color:'#F8C6C2',icon:'shield-alert-outline'},
} as const;
const RESOURCES=['timber','stone','metal','development_xp'] as const;
const PARTICLES=[[-94,-35,0],[-63,-83,1],[0,-96,2],[65,-70,3],[93,-28,4],[72,56,5],[0,77,6],[-78,42,7]];
export default function EstateMomentFX({event,sequence,cosmetics}:Props){
 const progress=useRef(new Animated.Value(0)).current;
 const [shown,setShown]=useState<keyof typeof STATES|null>(null);
 const [reduced,setReduced]=useState(true);
 useEffect(()=>{let live=true;AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(live)setReduced(v);}).catch(()=>undefined);return()=>{live=false;};},[]);
 useEffect(()=>{
  if(!event||!(event in STATES)||sequence<1)return;
  const k=event as keyof typeof STATES;
  setShown(k);progress.stopAnimation();progress.setValue(0);
  const animation=Animated.timing(progress,{toValue:1,duration:reduced?280:1120,useNativeDriver:true});
  animation.start(({finished})=>{if(finished)setShown(current=>current===k?null:current);});
  return()=>{animation.stop();};
 },[event,sequence,reduced,progress]);
 if(!shown)return null;
 const conf=STATES[shown];
 const usingMaterials=shown==='build_start'||shown==='contribute';
 const earningMilestone=shown==='claim'||shown==='build_complete'||shown==='unlock';
 const showingDesign=shown==='apply'&&Boolean(cosmetics);
 const alpha=progress.interpolate({inputRange:[0,.10,.52,.82,1],outputRange:[0,1,1,.65,0]});
 const rise=progress.interpolate({inputRange:[0,1],outputRange:[38,-35]});
 const scale=progress.interpolate({inputRange:[0,.20,1],outputRange:[.78,1.03,1.14]});
 return <View pointerEvents="none" accessible={false} style={styles.fill}>
  {!reduced&&PARTICLES.map(([x,y,i])=><Animated.View key={i}
    style={[styles.particle,{backgroundColor:i%2?'#FFE8AD':'#AFF0E5',
      opacity:alpha,transform:[{translateX:progress.interpolate({inputRange:[0,1],outputRange:[0,x]})},
      {translateY:progress.interpolate({inputRange:[0,1],outputRange:[0,y]})},
      {scale:progress.interpolate({inputRange:[0,1],outputRange:[.2,i%2?1.15:.8]})}]}]}/>)}
  {!reduced&&(usingMaterials||earningMilestone)&&RESOURCES.map((resource,i)=>{
    const x=[-86,-30,36,88][i];
    const outbound=earningMilestone;
    return <Animated.View key={'resource-'+resource} style={[styles.resource,
      {opacity:alpha,transform:[
       {translateX:progress.interpolate({inputRange:[0,1],outputRange:[outbound?0:x,outbound?x:0]})},
       {translateY:progress.interpolate({inputRange:[0,1],outputRange:[outbound?10:66,outbound?-89:0]})},
       {scale:progress.interpolate({inputRange:[0,1],outputRange:[outbound?.45:1,outbound?.98:.35]})},
      ]}]}>
      <EstateResourceEmblem kind={resource} size={32}/>
    </Animated.View>;
  })}
  <Animated.View style={[styles.medallion,{opacity:alpha,transform:[{translateY:rise},{scale}]}]}>
   {showingDesign&&cosmetics?<EstateCosmeticTile family="finish" choice={cosmetics.finish} size={51}/>:null}
   <View style={[styles.circle,{borderColor:conf.color}]}>
    <MaterialCommunityIcons name={conf.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']} size={26} color={conf.color}/>
   </View>
   <Text style={[styles.label,{color:conf.color}]}>{conf.label}</Text>
  </Animated.View>
 </View>;
}
const styles=StyleSheet.create({
 fill:{...StyleSheet.absoluteFillObject,alignItems:'center',justifyContent:'center',zIndex:8},
 medallion:{backgroundColor:'rgba(12,32,37,.94)',paddingHorizontal:16,paddingVertical:12,
   borderRadius:20,borderWidth:1,borderColor:'#B6AB7D',alignItems:'center',gap:7,
   shadowColor:'#FFE6AB',shadowRadius:18,shadowOpacity:.55,elevation:5},
 circle:{width:48,height:48,borderRadius:24,borderWidth:2,alignItems:'center',justifyContent:'center',backgroundColor:'#31534C'},
 label:{fontSize:12,fontWeight:'900',letterSpacing:.6},
 particle:{position:'absolute',top:'50%',left:'50%',height:9,width:9,borderRadius:3},
 resource:{position:'absolute',top:'48%',left:'50%',marginLeft:-16,marginTop:-16,zIndex:9},
});
