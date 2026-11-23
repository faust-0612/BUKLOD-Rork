/** An Android-safe, fail-open visual gateway for the exact approved Genesis scene.
 * WebP sources remain SHA-verified in the repository; this renders their
 * approved JPEG equivalents through React Native's native image pipeline.
 * Inline, JS-bundled JPEGs are the remote-asset-free fallback. A permanent
 * blank panel is NEVER an acceptable terminal state.
 */
import React,{useEffect,useState} from 'react';
import {Image,Pressable,StyleSheet,Text,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {GENESIS_PORTRAIT_RESCUE_URI,GENESIS_COMPACT_RESCUE_URI} from './genesisPortraitFallback.generated';

import GenesisDimensionalMapEffects from './GenesisDimensionalMapEffects';

const NATIVE_PORTRAIT=require('../../../../assets/season2/genesis/world/buklod-genesis-portrait-welcome-720x995.jpg');
const NATIVE_COMPACT=require('../../../../assets/season2/genesis/world/buklod-genesis-portrait-9doors-720x670.jpg');
type Door={id:string;districtId:string;label:string;route:string;fallbackRoute?:string;faithOnly:boolean;icon:string};
const PROMPTS=[
 {label:'Gusto mong may makasama?',route:'/clusters',icon:'account-group-outline'},
 {label:'Maglaro?',route:'/season2/games',icon:'gamepad-variant-outline'},
 {label:'Matuto?',route:'/season2/learnings',icon:'book-open-variant'},
 {label:'Makipag-usap?',route:'/buklod',icon:'chat-processing-outline'},
] as const;
const nextMode=(current:'native'|'embedded'|'safe')=>current==='native'?'embedded':'safe';
export default function GenesisReliablePortraitImage({
  landscape,width,height,active,showFaith,doors,onOpen,onMenu,onImageReadyChange,
}:{
  landscape:boolean;width:number;height:number;active:boolean;showFaith:boolean;
  doors:readonly Door[];onOpen:(door:Door,route:string)=>void;onMenu:()=>void;
  onImageReadyChange?:(ready:boolean)=>void;
}){
 const [mode,setMode]=useState<'native'|'embedded'|'safe'>('native');
 const [loaded,setLoaded]=useState(false);
 useEffect(()=>{onImageReadyChange?.(mode!=='safe'&&loaded);},[mode,loaded,onImageReadyChange]);
 useEffect(()=>{setLoaded(false);setMode('native');},[landscape]);
 useEffect(()=>{
   if(!active||loaded||mode==='safe')return;
   // Guard both onError and the Android case where no decode callback arrives.
   const watch=setTimeout(()=>{setLoaded(false);setMode(nextMode);},3800);
   return()=>clearTimeout(watch);
 },[active,loaded,mode,landscape]);
 const onFailed=()=>{
   console.warn('[GenesisWelcome] Decoder or asset transfer failure; using offline recovery');
   setLoaded(false);setMode(nextMode);
 };
 const routeFor=(door:Door)=>door.faithOnly&&!showFaith?(door.fallbackRoute||'/season2/learnings'):door.route;
 const imageSource=mode==='native'
   ? (landscape?NATIVE_COMPACT:NATIVE_PORTRAIT)
   : {uri:landscape?GENESIS_COMPACT_RESCUE_URI:GENESIS_PORTRAIT_RESCUE_URI,
      width:720,height:landscape?670:995};
 // Emergency directory must layer above transparent baked-art hitboxes.
 return <View style={[styles.root,{width,height,zIndex:mode==='safe'?10:0}]}>
  {mode!=='safe'?<Image key={landscape+'-'+mode}
    source={imageSource} resizeMode="stretch" fadeDuration={0}
    style={[StyleSheet.absoluteFillObject,{width,height}]}
    onLoad={()=>setLoaded(true)} onError={onFailed}
    accessibilityLabel="Premium Genesis visual world with nine special landmarks, guide and welcome"/>:null}
  {mode!=='safe'&&loaded?<GenesisDimensionalMapEffects active={active} landscape={landscape}/>:null}
  {mode!=='safe'&&!loaded?<View pointerEvents="none" style={styles.loading}>
    <MaterialCommunityIcons name="image-filter-hdr" size={27} color="#F5DC98"/>
    <Text style={styles.loadingText}>Inihahanda ang BUKLOD World...</Text>
  </View>:null}
  {mode==='safe'?<View style={styles.safeWorld}>
   <Text style={styles.heading}>BUKLOD · GENESIS</Text>
   <Text style={styles.note}>Welcome sa BUKLOD! Saan tayo magsisimula ngayon?</Text>
   <View style={styles.grid}>
     {doors.map(door=><Pressable key={door.id} accessibilityRole="button"
       accessibilityLabel={'Enter '+door.label}
       onPress={()=>onOpen(door,routeFor(door))}
       style={({pressed})=>[styles.door,pressed&&styles.pressed]}>
       <MaterialCommunityIcons name={door.icon as any} color="#FFE2A8" size={20}/>
       <Text style={styles.doorText} numberOfLines={2}>{door.faithOnly&&!showFaith?'Learnings':door.label}</Text>
     </Pressable>)}
   </View>
   <View style={styles.guidance}>
     <Image source={require('../../../../assets/buklod-guide/wave.png')}
       style={styles.human} resizeMode="contain"/>
     <View style={{flex:1}}>
       <Text style={styles.note}>Ano ang gusto mong gawin?</Text>
       <View style={styles.prompts}>
        {PROMPTS.map(p=><Pressable key={p.route} accessibilityRole="button"
          accessibilityLabel={p.label} onPress={()=>router.push(p.route as any)}
          style={styles.prompt}>
          <MaterialCommunityIcons name={p.icon as any} size={17} color="#FFE5AE"/>
          <Text numberOfLines={2} style={styles.promptText}>{p.label}</Text>
        </Pressable>)}
       </View>
     </View>
   </View>
   <View style={styles.recoveryRow}>
     <Pressable accessibilityRole="button" accessibilityLabel="Reload premium map"
       onPress={()=>{setLoaded(false);setMode('native');}} style={styles.retry}>
       <MaterialCommunityIcons name="refresh" size={19} color="#FFE5A8"/>
       <Text style={styles.retryText}>Reload Map</Text>
     </Pressable>
     <Pressable accessibilityRole="button" accessibilityLabel="Open BUKLOD feature directory"
       onPress={onMenu} style={styles.retry}>
       <MaterialCommunityIcons name="compass-outline" size={18} color="#FFE5A8"/>
       <Text style={styles.retryText}>Lahat ng Features</Text>
     </Pressable>
   </View>
  </View>:null}
 </View>;
}
const styles=StyleSheet.create({
 root:{overflow:'hidden',backgroundColor:'#15392F'},
 loading:{position:'absolute',left:0,right:0,top:'44%',alignItems:'center',gap:7,padding:10},
 loadingText:{color:'#FFEBC5',fontSize:11,fontWeight:'800'},
 safeWorld:{flex:1,justifyContent:'space-around',paddingHorizontal:10,paddingVertical:8,gap:7},
 heading:{fontSize:16,fontWeight:'900',color:'#FCE2A7',textAlign:'center'},
 note:{fontSize:11,lineHeight:15,color:'#F1F6EA',textAlign:'center',fontWeight:'700'},
 grid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:5},
 door:{width:'31%',minHeight:49,padding:3,borderRadius:10,borderWidth:1,borderColor:'#C9B77F',
   backgroundColor:'#1C5241',alignItems:'center',justifyContent:'center',gap:3},
 doorText:{fontSize:9,lineHeight:12,fontWeight:'800',color:'#FFF0D3',textAlign:'center'},
 guidance:{flexDirection:'row',gap:5,alignItems:'center'},
 human:{width:90,height:93},
 prompts:{flexDirection:'row',flexWrap:'wrap',gap:4,marginTop:5},
 prompt:{width:'48%',minHeight:36,padding:3,borderRadius:10,borderWidth:1,borderColor:'#C4B18B',
   flexDirection:'row',alignItems:'center',justifyContent:'center',gap:3,backgroundColor:'#195B4F'},
 promptText:{color:'#FFF2D6',fontSize:9,lineHeight:11,flex:1,fontWeight:'800'},
 recoveryRow:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},
 retry:{minHeight:38,borderRadius:11,paddingHorizontal:9,borderWidth:1,borderColor:'#B0B88B',
   flexDirection:'row',alignItems:'center',justifyContent:'center',gap:4},
 retryText:{fontSize:10,color:'#FFE7B0',fontWeight:'900'},pressed:{opacity:.68},
});
