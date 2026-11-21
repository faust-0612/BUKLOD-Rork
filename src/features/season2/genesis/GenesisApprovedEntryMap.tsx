/**
 * BUKLOD Genesis premium landmark gateway.
 * Uses existing bundled nature-first original art; labels/hotspots are truly
 * interactive overlay elements, not baked UI or duplicate main tabs.
 * The separate historical approved 1672x941 image is retained in assets for
 * provenance, but its baked Community/Connect/nav controls are not repainted.
 */
import React, {useEffect, useRef, useState} from 'react';
import {
  AccessibilityInfo, Animated, Image, Pressable, StyleSheet, Text, View,
  useWindowDimensions,
} from 'react-native';
import {Image as ExpoImage} from 'expo-image';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {getGenesisDeviceQuality} from './genesisDeviceQuality';
import approved from './genesisApprovedEntryHotspots.json';

const MAP_SOURCE = require('../../../../assets/season2/genesis/kingdom/kingdom-nature-panorama.webp');
const GREEN_B = require('../../../../assets/season2/genesis/genesis-green-b-transparent.png');
export type GenesisApprovedEntryDoor = {
  id:string;label:string;districtId:string;route:string;
  fallbackRoute?:string;icon:string;faithOnly:boolean;
};
const DOORS = approved.hotspots as readonly GenesisApprovedEntryDoor[];
type MapIcon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export default function GenesisApprovedEntryMap({
  active,showFaith,availableWidth,onOpen,onMenu,
}:{
  active:boolean;showFaith:boolean;availableWidth?:number;
  onOpen:(door:GenesisApprovedEntryDoor,route:string)=>void;
  onMenu:()=>void;
}){
  const {width,height}=useWindowDimensions();
  const landscape=width>height&&height<540;
  const mapWidth=Math.max(270,Math.min((availableWidth??width)-20,900));
  // Reserve first-view room for the large off-map guide and the real bottom navigation.
  // Nine 44dp one-tap destinations still fit the five portrait landmark rows.
  const mapHeight=landscape?Math.round(mapWidth*.64):Math.round(Math.max(315,Math.min(400,height*.43)));
  const badgeWidth=landscape?Math.min(138,Math.floor(mapWidth/3)-8):Math.min(146,Math.floor(mapWidth/2)-16);
  const [reduceMotion,setReduceMotion]=useState(true);
  const glow=useRef(new Animated.Value(.42)).current;
  const quality=getGenesisDeviceQuality('home');
  useEffect(()=>{
    let live=true;
    void AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(live)setReduceMotion(v);}).catch(()=>undefined);
    return ()=>{live=false;};
  },[]);
  useEffect(()=>{
    glow.stopAnimation();
    if(!active||reduceMotion){glow.setValue(.42);return;}
    const cycle=Animated.loop(Animated.sequence([
      Animated.timing(glow,{toValue:.82,duration:1900,useNativeDriver:true}),
      Animated.timing(glow,{toValue:.42,duration:1900,useNativeDriver:true}),
    ]));
    cycle.start();
    return ()=>{cycle.stop();glow.stopAnimation();};
  },[active,reduceMotion,glow]);
  const locate=(index:number)=>{
    const column=landscape?index%3:index%2;
    const row=landscape?Math.floor(index/3):Math.floor(index/2);
    const x=landscape?[.17,.5,.83][column]:index===8?.50:[.22,.78][column];
    const y=landscape?[.18,.49,.80][row]:index===8?.89:[.13,.33,.53,.73][row];
    return {
      left:Math.max(0,Math.min(mapWidth-badgeWidth,x*mapWidth-badgeWidth/2)),
      top:Math.max(0,Math.min(mapHeight-44,y*mapHeight-22)),
      width:badgeWidth,
    };
  };
  return <View style={styles.frame} accessibilityLabel="BUKLOD special-feature map">
    <View style={styles.mapTop}>
      <View style={styles.mapTopIdentity}>
        <MaterialCommunityIcons name="map-legend" size={19} color="#FBE4AB"/>
        <Text style={styles.mapTopText}>TUKLASIN ANG BUKLOD</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Explore all special features"
        onPress={onMenu} style={styles.directoryShortcut}>
        <MaterialCommunityIcons name="compass-outline" color="#FFF0C7" size={20}/>
        <Text style={styles.directoryText}>Lahat</Text>
      </Pressable>
    </View>
    <View style={{width:mapWidth,height:mapHeight,alignSelf:'center',overflow:'hidden'}}>
      <ExpoImage source={MAP_SOURCE} contentFit="cover"
        priority={quality==='minimal'?'normal':'high'} transition={reduceMotion?0:170}
        accessibilityLabel="Premium green island world with mountain citadel, river, waterfalls and real BUKLOD landmarks"
        style={StyleSheet.absoluteFillObject}/>
      <LinearGradient pointerEvents="none"
        colors={['rgba(3,18,26,.20)','rgba(3,18,26,.05)','rgba(3,18,26,.30)']}
        style={StyleSheet.absoluteFillObject}/>
      <Animated.View pointerEvents="none" style={[styles.centerGlow,{
        width:Math.min(115,mapWidth*.30),height:Math.min(115,mapWidth*.30),
        opacity:glow,
      }]}/>
      <Image source={GREEN_B} resizeMode="contain"
        style={[styles.centerB,{width:Math.min(92,mapWidth*.25),height:Math.min(92,mapWidth*.25)}]}/>
      {DOORS.map((door,index)=><Pressable key={door.id} accessibilityRole="button"
        accessibilityLabel={'Enter '+door.label}
        accessibilityHint={door.faithOnly&&!showFaith?
          'Faith setting is off: open the equivalent learning path':
          'One tap opens this special feature using the existing access checks'}
        onPress={()=>onOpen(door,door.faithOnly&&!showFaith?(door.fallbackRoute||'/learn'):door.route)}
        style={({pressed})=>[styles.landmark,locate(index),door.id==='special-events'&&styles.specialLandmark,pressed&&styles.pressed]}>
        {door.id==='special-events'?<Animated.View pointerEvents="none" style={[styles.eventSparkle,{opacity:glow}]}><MaterialCommunityIcons name="star-four-points" size={20} color="#FFDF7D"/></Animated.View>:null}
        <MaterialCommunityIcons name={door.icon as MapIcon} size={landscape?16:18} color="#FBE6B5"/>
        <Text style={[styles.landmarkText,landscape&&styles.landscapeText]}
          adjustsFontSizeToFit minimumFontScale={.78} numberOfLines={2}>{door.label}</Text>
      </Pressable>)}
    </View>
    <View style={styles.legend}>
      <MaterialCommunityIcons name="gesture-tap-button" size={17} color="#F4D5A1"/>
      <Text style={styles.legendText}>Isang tap sa landmark, diretso sa feature.</Text>
    </View>
  </View>;
}
const styles=StyleSheet.create({
 frame:{width:'100%',alignSelf:'center',borderWidth:1,borderColor:'#B7B983',borderRadius:17,
   overflow:'hidden',backgroundColor:'#102D2C'},
 mapTop:{height:38,paddingHorizontal:10,flexDirection:'row',alignItems:'center',
   justifyContent:'space-between',backgroundColor:'#0A2828'},
 mapTopIdentity:{flexDirection:'row',alignItems:'center',gap:7},
 mapTopText:{color:'#FFE6AB',fontSize:11,fontWeight:'900',letterSpacing:.6},
 directoryShortcut:{minHeight:38,minWidth:73,flexDirection:'row',alignItems:'center',
   justifyContent:'center',gap:4},
 directoryText:{fontSize:11,fontWeight:'800',color:'#F1E9D2'},
 centerGlow:{position:'absolute',left:'50%',top:'50%',transform:[{translateX:-57},{translateY:-57}],
   backgroundColor:'#A8E7BA',borderRadius:65},
 centerB:{position:'absolute',left:'50%',top:'50%',transform:[{translateX:-46},{translateY:-46}],opacity:.94},
 landmark:{position:'absolute',zIndex:2,minHeight:44,paddingHorizontal:5,paddingVertical:3,
   flexDirection:'row',alignItems:'center',justifyContent:'center',gap:4,
   borderRadius:16,backgroundColor:'rgba(6,38,40,.91)',
   borderWidth:1,borderColor:'rgba(245,215,151,.93)',
   shadowColor:'#000000',shadowOpacity:.27,shadowRadius:4,elevation:3},
 landmarkText:{flex:1,color:'#FFF4D8',fontSize:10,fontWeight:'800',lineHeight:13,textAlign:'center'},
 landscapeText:{fontSize:9,lineHeight:11},
 specialLandmark:{backgroundColor:'rgba(59,31,10,.94)',borderColor:'#FFE19F',elevation:6},
 eventSparkle:{position:'absolute',top:-12,right:-7},
 pressed:{opacity:.70,transform:[{scale:.97}]},
 legend:{minHeight:31,paddingHorizontal:11,flexDirection:'row',alignItems:'center',gap:7,
   backgroundColor:'#0A2828'},
 legendText:{color:'#EAF4DC',fontSize:10,fontWeight:'700',flex:1},
});
