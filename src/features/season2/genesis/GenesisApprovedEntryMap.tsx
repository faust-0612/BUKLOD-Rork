/**
 * BUKLOD Genesis approved illustrated 1672×941 map, not the superseded Valley.
 *
 * Entrances are transparent accessible hit targets over their ORIGINAL baked
 * labels. The whole image is contained; no title/icon is repainted, cropped,
 * or watermarked. One press navigates to the existing guarded Expo route.
 */
import React, {useEffect, useRef, useState} from 'react';
import {
  AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View,
  useWindowDimensions,
} from 'react-native';
import {Image as ExpoImage} from 'expo-image';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {getGenesisDeviceQuality} from './genesisDeviceQuality';
import approved from './genesisApprovedEntryHotspots.json';

const MAP_SOURCE=require('../../../../assets/season2/genesis/world/buklod-approved-entry-map-1672x941.webp');
const ASPECT=approved.imageHeight/approved.imageWidth;

export type GenesisApprovedEntryDoor={
  id:string;label:string;districtId:string;route:string;
  fallbackRoute?:string;x:number;y:number;icon:string;faithOnly:boolean;
};
const DOORS=approved.hotspots as readonly GenesisApprovedEntryDoor[];

export default function GenesisApprovedEntryMap({
  active,showFaith,onOpen,onMenu,onProfile,onNotifications,onSearch,
}:{
  active:boolean;showFaith:boolean;onOpen:(door:GenesisApprovedEntryDoor,route:string)=>void;
  onMenu:()=>void;onProfile:()=>void;onNotifications:()=>void;onSearch:()=>void;
}){
  const {width}=useWindowDimensions();
  const viewportWidth=Math.max(270,Math.min(width-24,900));
  const [zoomed,setZoomed]=useState(false);
  const [reduceMotion,setReduceMotion]=useState(true);
  const scroller=useRef<ScrollView|null>(null);
  const quality=getGenesisDeviceQuality('home');
  const mapWidth=zoomed?Math.max(800,Math.round(viewportWidth*1.65)):viewportWidth;
  const mapHeight=mapWidth*ASPECT;
  useEffect(()=>{
    let current=true;
    void AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(current)setReduceMotion(v);}).catch(()=>undefined);
    return ()=>{current=false;};
  },[]);
  useEffect(()=>{scroller.current?.scrollTo({x:0,animated:active&&!reduceMotion});},[active,reduceMotion,zoomed]);
  const touch=(x:number,y:number,diameter:number)=>{
    const left=Math.max(0,Math.min(mapWidth-diameter,x*mapWidth-diameter/2));
    const top=Math.max(0,Math.min(mapHeight-diameter,y*mapHeight-diameter/2));
    return {left,top,width:diameter,height:diameter};
  };
  return <View style={styles.container} accessibilityLabel="BUKLOD Season 2 approved landscape entry map">
    <View style={styles.controls}>
      <Text style={styles.label}>BUKLOD · ONE-TAP WORLD ENTRANCE</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={zoomed?'Return to whole world view':'Zoom into approved world map'}
        onPress={()=>setZoomed(x=>!x)} style={styles.zoomButton}>
        <MaterialCommunityIcons name={zoomed?'magnify-minus':'magnify-plus'} size={17} color="#E5ECCC"/>
        <Text style={styles.zoomLabel}>{zoomed?'WHOLE MAP':'EXPLORE'}</Text>
      </Pressable>
    </View>
    <ScrollView horizontal ref={scroller} bounces={false} nestedScrollEnabled
      showsHorizontalScrollIndicator={false} scrollEnabled={zoomed} style={{height:mapHeight}}
      contentContainerStyle={{width:mapWidth}} accessibilityLabel="Owner-approved illustrated map with one-tap building entrances">
      <View style={{width:mapWidth,height:mapHeight}}>
        <ExpoImage source={MAP_SOURCE} contentFit="fill" priority={quality==='minimal'?'normal':'high'}
          transition={reduceMotion?0:160} style={StyleSheet.absoluteFillObject}
          accessibilityLabel="BUKLOD Season 2 official illustration, Character Kingdom and Empire Arena on separate sides"
        />
        {DOORS.map(door=><Pressable key={door.id} accessibilityRole="button"
          accessibilityLabel={'Enter '+door.label}
          accessibilityHint={door.faithOnly&&!showFaith?'Faith is hidden: opens the equivalent learning path':'Opens the guarded BUKLOD feature immediately'}
          onPress={()=>onOpen(door,door.faithOnly&&!showFaith?(door.fallbackRoute||'/learn'):door.route)}
          style={[styles.door,touch(door.x,door.y,zoomed?54:44)]}
        ><View pointerEvents="none" style={styles.pressHalo}/></Pressable>)}
        <Pressable accessibilityRole="button" accessibilityLabel="Open BUKLOD destinations menu"
          onPress={onMenu} style={[styles.corner,touch(.041,.04,44)]}/>
        <Pressable accessibilityRole="button" accessibilityLabel="Open my BUKLOD profile"
          onPress={onProfile} style={[styles.corner,touch(.098,.04,44)]}/>
        <Pressable accessibilityRole="button" accessibilityLabel="Open notifications"
          onPress={onNotifications} style={[styles.corner,touch(.906,.04,44)]}/>
        <Pressable accessibilityRole="button" accessibilityLabel="Search BUKLOD"
          onPress={onSearch} style={[styles.corner,touch(.963,.04,44)]}/>
      </View>
    </ScrollView>
    <View style={styles.legend}>
      <MaterialCommunityIcons name="gesture-tap-button" size={16} color="#F5DA97"/>
      <Text style={styles.legendText}>Tap a building sign to enter. No second ENTER button.</Text>
    </View>
  </View>;
}
const styles=StyleSheet.create({
  container:{borderRadius:16,overflow:'hidden',borderWidth:1,
    borderColor:'rgba(234,216,165,.72)',backgroundColor:'#16352D'},
  controls:{height:42,paddingHorizontal:10,alignItems:'center',flexDirection:'row',
    justifyContent:'space-between',gap:5,backgroundColor:'rgba(5,25,25,.96)'},
  label:{color:'#F8E2A6',fontWeight:'900',fontSize:10,flex:1,letterSpacing:.3},
  zoomButton:{minHeight:36,paddingHorizontal:10,flexDirection:'row',alignItems:'center',
    gap:5,borderRadius:12,borderWidth:1,borderColor:'#B4D4B2',backgroundColor:'#274A48'},
  zoomLabel:{fontSize:10,fontWeight:'900',color:'#F0F9E4'},
  door:{position:'absolute',zIndex:2,alignItems:'center',justifyContent:'center'},
  pressHalo:{width:'100%',height:'100%',borderRadius:18,borderWidth:1,
    borderColor:'rgba(251,235,164,.16)',backgroundColor:'rgba(255,248,202,.025)'},
  corner:{position:'absolute',zIndex:3},
  legend:{minHeight:37,paddingHorizontal:12,flexDirection:'row',gap:7,
    alignItems:'center',backgroundColor:'rgba(5,25,25,.98)'},
  legendText:{flex:1,color:'#E6F5D9',fontSize:10,fontWeight:'800'},
});
