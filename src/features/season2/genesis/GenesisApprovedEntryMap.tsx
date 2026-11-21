/**
 * Owner-approved portrait Genesis welcome.
 *
 * Exact local illustrated scene includes the nine baked feature signs, the
 * Welcome Guide and four question bubbles. ONLY transparent accessible
 * press surfaces sit over that original design (no duplicated text/buttons).
 * Main Home/Community/Connect/Cluster/Profile navigation is rendered by
 * BuklodPersistentBottomNav outside this component.
 */
import React,{useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,Pressable,StyleSheet,Text,View,useWindowDimensions} from 'react-native';
import {Image as ExpoImage} from 'expo-image';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {getGenesisDeviceQuality} from './genesisDeviceQuality';
import approved from './genesisApprovedEntryHotspots.json';

const PORTRAIT_IMAGE=require('../../../../assets/season2/genesis/world/buklod-genesis-portrait-welcome-720x995.webp');
const COMPACT_MAP_IMAGE=require('../../../../assets/season2/genesis/world/buklod-genesis-portrait-9doors-720x670.webp');
export type GenesisApprovedEntryDoor={
  id:string;label:string;districtId:string;route:string;fallbackRoute?:string;
  icon:string;faithOnly:boolean;
};
const DOORS=approved.hotspots as readonly GenesisApprovedEntryDoor[];
const WORLD_POSITIONS:Record<string,[number,number]>={
  'character-kingdom':[.288,.149],'hero-arena':[.735,.148],
  'learnings':[.201,.271],'university':[.791,.271],
  'my-house':[.198,.394],'church':[.796,.393],
  'my-community':[.210,.515],'office-building':[.804,.514],
  'special-events':[.500,.609],
};
const COMPACT_POSITIONS:Record<string,[number,number]>={
  'character-kingdom':[.288,.220],'hero-arena':[.735,.220],
  'learnings':[.201,.391],'university':[.791,.391],
  'my-house':[.198,.590],'church':[.796,.590],
  'my-community':[.210,.770],'office-building':[.804,.770],
  'special-events':[.500,.910],
};
const PROMPTS=[
  {label:'Gusto mong may makasama?',route:'/clusters',x:.475,y:.820},
  {label:'Maglaro?',route:'/season2/games',x:.810,y:.820},
  {label:'Matuto?',route:'/season2/learnings',x:.475,y:.916},
  {label:'Makipag-usap?',route:'/buklod',x:.810,y:.916},
] as const;
const PORTRAIT_RATIO=995/720;
const COMPACT_RATIO=670/720;
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));

export default function GenesisApprovedEntryMap({
 active,showFaith,availableWidth,onOpen,onMenu,
}:{
 active:boolean;showFaith:boolean;availableWidth?:number;
 onOpen:(door:GenesisApprovedEntryDoor,route:string)=>void;
 onMenu:()=>void;
}){
 const {width,height}=useWindowDimensions();
 const landscape=width>height&&height<540;
 const mapWidth=clamp((availableWidth??width)-20,270,900);
 const mapHeight=Math.round(mapWidth*(landscape?COMPACT_RATIO:PORTRAIT_RATIO));
 const quality=getGenesisDeviceQuality('home');
 const [reduceMotion,setReduceMotion]=useState(true);
 const glow=useRef(new Animated.Value(.32)).current;
 useEffect(()=>{
   let mounted=true;
   void AccessibilityInfo.isReduceMotionEnabled()
     .then(v=>{if(mounted)setReduceMotion(v);}).catch(()=>undefined);
   return()=>{mounted=false;};
 },[]);
 useEffect(()=>{
   glow.stopAnimation();
   if(!active||reduceMotion){glow.setValue(.32);return;}
   const cycle=Animated.loop(Animated.sequence([
     Animated.timing(glow,{toValue:.84,duration:1350,useNativeDriver:true}),
     Animated.timing(glow,{toValue:.32,duration:1350,useNativeDriver:true}),
   ]));
   cycle.start();
   return()=>{cycle.stop();glow.stopAnimation();};
 },[active,reduceMotion,glow]);
 const hotspot=(x:number,y:number,w:number,h=44)=>{
   const hitWidth=clamp(w,74,mapWidth-4);
   return {
     position:'absolute' as const,zIndex:3,
     left:clamp(x*mapWidth-hitWidth/2,0,mapWidth-hitWidth),
     top:clamp(y*mapHeight-h/2,0,mapHeight-h),
     width:hitWidth,height:h,
   };
 };
 const doorTarget=(door:GenesisApprovedEntryDoor)=>{
   const pos=(landscape?COMPACT_POSITIONS:WORLD_POSITIONS)[door.id]||[.5,.5];
   return hotspot(pos[0],pos[1],door.id==='special-events'?mapWidth*.37:mapWidth*.33);
 };
 return <View style={styles.frame} accessibilityLabel="BUKLOD illustrated one-tap world and Welcome Guide">
   <View style={{width:mapWidth,height:mapHeight,alignSelf:'center',overflow:'hidden'}}>
     <ExpoImage source={landscape?COMPACT_MAP_IMAGE:PORTRAIT_IMAGE} contentFit="fill"
       priority={quality==='minimal'?'normal':'high'} transition={reduceMotion?0:150}
       style={StyleSheet.absoluteFillObject}
       accessibilityLabel="Owner-approved Genesis premium portrait artwork: Character Kingdom, Hero Arena, Learnings, University, My House, Church, My Community, Office Building, Special Events and the Welcome Guide"/>
     {DOORS.map(door=><Pressable
       key={door.id} accessibilityRole="button" accessibilityLabel={'Enter '+door.label}
       accessibilityHint={door.faithOnly&&!showFaith?'Show Faith is off: open equivalent learning path':'Opens the feature directly with existing permissions'}
       onPress={()=>onOpen(door,door.faithOnly&&!showFaith?(door.fallbackRoute||'/season2/learnings'):door.route)}
       style={({pressed})=>[styles.target,doorTarget(door),door.id==='special-events'&&styles.specialLandmark,pressed&&styles.pressed]}>
       {door.id==='special-events'?<Animated.View pointerEvents="none"
         style={[styles.eventSparkle,{opacity:glow}]}>
         <MaterialCommunityIcons name="star-four-points" size={20} color="#FFEFBC"/>
       </Animated.View>:null}
       {!showFaith&&door.faithOnly?<View pointerEvents="none" style={styles.faithMask}>
         <Text style={styles.faithMaskText}>Learnings</Text>
       </View>:null}
     </Pressable>)}
     {!landscape?PROMPTS.map(prompt=><Pressable key={prompt.label} accessibilityRole="button"
       accessibilityLabel={'Open '+prompt.label}
       accessibilityHint="The Welcome Guide opens the suggested destination in one tap"
       onPress={()=>router.push(prompt.route as any)}
       style={({pressed})=>[
         styles.promptTarget,hotspot(prompt.x,prompt.y,mapWidth*.30),
         pressed&&styles.pressed,
       ]}/>):null}
     {!landscape?<Animated.View pointerEvents="none" style={[
       styles.guideLife,{left:mapWidth*.11,top:mapHeight*.865,opacity:glow,
       transform:[{translateY:glow.interpolate({inputRange:[.32,.84],outputRange:[3,-3]})},
         {rotate:glow.interpolate({inputRange:[.32,.84],outputRange:['-12deg','14deg']})}]},
     ]}>
       <MaterialCommunityIcons name="hand-wave-outline" size={23} color="#FFE9AB"/>
     </Animated.View>:null}
     <Pressable accessibilityRole="button" accessibilityLabel="Open complete BUKLOD destination directory"
       onPress={onMenu} style={[styles.directory,hotspot(.95,.045,44)]}>
       <MaterialCommunityIcons name="compass-outline" size={21} color="#FFE8BB"/>
     </Pressable>
   </View>
 </View>;
}
const styles=StyleSheet.create({
 frame:{width:'100%',borderRadius:16,overflow:'hidden',borderWidth:1,borderColor:'#DDC58A',backgroundColor:'#102D2C'},
 target:{borderRadius:15,backgroundColor:'transparent',borderColor:'transparent',borderWidth:1},
 promptTarget:{borderRadius:17,backgroundColor:'transparent',borderColor:'transparent',borderWidth:1},
 pressed:{backgroundColor:'rgba(126,250,172,.22)',borderColor:'#FFE4A4'},
 directory:{borderRadius:22,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(5,24,34,.28)'},
 specialLandmark:{borderColor:'rgba(255,240,185,.10)'},
 eventSparkle:{position:'absolute',top:-13,right:12},
 guideLife:{position:'absolute',width:30,height:30,alignItems:'center',justifyContent:'center'},
 faithMask:{position:'absolute',top:1,bottom:1,left:1,right:1,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:'#173D38'},
 faithMaskText:{color:'#FFF0B5',fontSize:11,fontWeight:'900'},
});
