/**
 * Genesis Character Kingdom: two separate owner-approved, portrait-first maps
 * (5 Core + 8 Specials) using only the existing Kabihasnang Ligaw visual motifs.
 * This is art direction, not a new manuscript canon or character-to-place claim.
 * All stations retain canonical game IDs, server gates, and no reward writes.
 */
import React from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {Image as ExpoImage} from 'expo-image';
import {LinearGradient} from 'expo-linear-gradient';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import Svg,{Circle,Path} from 'react-native-svg';
import GenesisKingdomStationScene from './GenesisKingdomStationScene';
import {KL_KINGDOM_VISUAL_MOTIFS,type KlKingdomVisualId} from './klKingdomVisualMotifs';

const SCENERY=require('../../../../assets/season2/genesis/kingdom/kingdom-nature-panorama-compact.webp');
export const CORE_KINGDOM_IDS=[
 'phan-enterprise-builder','quin-discovery-expedition','van-living-city-dispatch',
 'christian-civic-leadership','lhen-rhythm-journey',
] as const;
export const SPECIAL_KINGDOM_IDS=[
 'ace-rescue-grid','elesur-village-builder','jawo-forest-trail',
 'mitch-restore-mural','niel-mission-trail','angel-kingdom-treasury',
 'vhen-farm-to-market','trudice-playground-memory',
] as const;
export type KingdomMapKind='core'|'special';
export type KingdomMapRealm={id:KlKingdomVisualId;name:string;character:string;title:string;caption:string};
type Props={
 mode:KingdomMapKind;realms:readonly KingdomMapRealm[];unlockedSpecialIds:readonly string[];
 onSelect:(realm:KingdomMapRealm)=>void;onSwitch:(mode:KingdomMapKind)=>void;
 stationClears:Readonly<Record<string,number>>;loadingSpecial:boolean;
};
const CORE=new Set<string>(CORE_KINGDOM_IDS);
const SPECIAL=new Set<string>(SPECIAL_KINGDOM_IDS);

export function getKingdomMapGroup(id:string):KingdomMapKind|null{
 return CORE.has(id)?'core':SPECIAL.has(id)?'special':null;
}

/** A locked Special's name, artwork and route are NEVER emitted into the UI,
 * including screen-reader labels. Server-visible special IDs are authoritative.
 */
export function canDisplayKingdomStation(mode:KingdomMapKind,id:string,character:string,unlocked:readonly string[]){
 return mode==='core'?CORE.has(id):SPECIAL.has(id)&&unlocked.includes(character);
}

function KingdomRoute({mode,realms,unlockedSpecialIds,onSelect,onSwitch,stationClears,loadingSpecial}:Props){
 const activeIds=mode==='core'?CORE_KINGDOM_IDS:SPECIAL_KINGDOM_IDS;
 const byId=new Map(realms.map(realm=>[realm.id,realm]));
 const activeRealms=activeIds.map(id=>byId.get(id)).filter((v):v is KingdomMapRealm=>Boolean(v));
 const isCore=mode==='core';
 const unlocked=new Set(unlockedSpecialIds);
 return <View style={styles.root} accessibilityLabel="Kabihasnang Ligaw Character Kingdom stations">
  <View style={styles.modeRow}>
   <Pressable accessibilityRole="tab" accessibilityState={{selected:isCore}}
     accessibilityLabel="Main Characters map, five stations"
     onPress={()=>onSwitch('core')} style={[styles.mode,isCore&&styles.modeActive]}>
    <MaterialCommunityIcons name="map-marker-multiple-outline" size={19} color="#F7E8C8"/>
    <Text style={styles.modeText}>MAIN · 5</Text>
   </Pressable>
   <Pressable accessibilityRole="tab" accessibilityState={{selected:!isCore}}
     accessibilityLabel="Special Characters map, eight stations"
     onPress={()=>onSwitch('special')} style={[styles.mode,!isCore&&styles.modeActive]}>
    <MaterialCommunityIcons name="creation" size={19} color="#F7E8C8"/>
    <Text style={styles.modeText}>SPECIAL · 8</Text>
   </Pressable>
  </View>
  <View style={styles.world}>
   <ExpoImage source={SCENERY} contentFit="cover" style={StyleSheet.absoluteFillObject}
    accessibilityLabel="Bundled Genesis world art: waterfalls, ancient forests and distant mountains"/>
   <LinearGradient pointerEvents="none"
     colors={isCore?['rgba(3,25,23,.48)','rgba(3,29,34,.66)','rgba(4,22,30,.90)']:
       ['rgba(9,12,37,.57)','rgba(23,13,49,.76)','rgba(5,23,38,.92)']}
     style={StyleSheet.absoluteFillObject}/>
   <View pointerEvents="none" style={styles.trail}>
    <Svg width="100%" height="100%" viewBox={isCore?'0 0 360 664':'0 0 360 850'}
      preserveAspectRatio="none">
     <Path d={isCore
      ? 'M75 155 C115 185 240 135 285 235 S130 340 82 410 S255 515 195 582'
      : 'M75 115 C155 140 210 110 285 195 S115 260 82 320 S275 385 285 450 S83 514 80 580 S285 652 285 710 S151 776 80 795'}
       stroke="#FFE29B" strokeWidth={4} fill="none" opacity={.75}/>
     <Path d={isCore
      ? 'M75 155 C115 185 240 135 285 235 S130 340 82 410 S255 515 195 582'
      : 'M75 115 C155 140 210 110 285 195 S115 260 82 320 S275 385 285 450 S83 514 80 580 S285 652 285 710 S151 776 80 795'}
       stroke="#FFF8D2" strokeWidth={1.4} fill="none" strokeDasharray="3 8" opacity={.85}/>
     <Circle cx={180} cy={isCore?65:49} r={14} fill="#F8E1A7" opacity={.28}/>
    </Svg>
   </View>
   <View style={styles.worldHeading}>
    <Text style={styles.kicker}>KABIHASNANG LIGAW · GENESIS</Text>
    <Text style={styles.title}>{isCore?'Limang Daigdig':'Walong Hiwagang Daigdig'}</Text>
    <Text style={styles.subtitle}>{isCore
     ? 'Mga bakas ng alaala, buhay na ugat, at tahanang nililikha ng liwanag'
     : 'Mga lihim na lugar na unti-unting nahahayag sa iyong paglalakbay'}</Text>
   </View>
   <View style={styles.stationGrid}>
    {activeRealms.map((realm,index)=>{
     const visible=canDisplayKingdomStation(mode,realm.id,realm.character,unlockedSpecialIds);
     const motif=KL_KINGDOM_VISUAL_MOTIFS[realm.id];
     const clears=stationClears[realm.id]??0;
     return <Pressable key={realm.id} disabled={!visible}
       accessibilityRole="button"
       accessibilityLabel={visible?'Enter '+realm.name+' character station':'Locked Special station '+(index+1)}
       accessibilityHint={visible?'Play the canonical Kingdom game':'Requires verified Character unlock'}
       accessibilityState={{disabled:!visible}}
       onPress={()=>{if(visible)onSelect(realm);}}
       style={({pressed})=>[styles.station,{borderColor:visible?motif.accent:'#76918B'},
         pressed&&styles.pressed]}>
      <View style={styles.art}>
       {visible?<GenesisKingdomStationScene id={realm.id}/>:
         <LinearGradient colors={['#1C2637','#17283B','#0B1D27']} style={StyleSheet.absoluteFillObject}/>}
       {!visible?<View style={styles.mysteryArt} pointerEvents="none">
        <MaterialCommunityIcons name="lock-outline" size={37} color="#B9C4B2"/>
        <Text style={styles.mysteryGlyph}>✦</Text>
       </View>:null}
      </View>
      <View style={styles.stationCopy}>
       <Text style={styles.stationIndex}>{isCore?'MAIN':'SPECIAL'} · {String(index+1).padStart(2,'0')}</Text>
       <Text numberOfLines={1} style={styles.name}>{visible?realm.name:'Hindi pa nabubuksan'}</Text>
       <View style={styles.stationFooter}>
        <Text numberOfLines={1} style={styles.status}>{visible?(clears>0?'LOCAL CLEARS '+clears:'TAP TO PLAY'):
           (loadingSpecial?'VERIFYING':'LOCKED')}</Text>
        <MaterialCommunityIcons name={visible?'arrow-right-circle':'lock'}
         size={17} color={visible?'#FFE7A8':'#B9C4B2'}/>
       </View>
      </View>
     </Pressable>;
    })}
   </View>
   {!isCore?<Text style={styles.privacyNote}>
    Nakatago ang mga hindi pa unlocked na Special Character. Ang server ang tumitiyak ng access.
   </Text>:null}
  </View>
 </View>;
}
export default React.memo(KingdomRoute);
const styles=StyleSheet.create({
 root:{gap:8},
 modeRow:{flexDirection:'row',gap:8},
 mode:{flex:1,minHeight:48,flexDirection:'row',gap:6,alignItems:'center',justifyContent:'center',
  borderWidth:1,borderRadius:14,borderColor:'#6D8779',backgroundColor:'#0C2932'},
 modeActive:{backgroundColor:'#215447',borderColor:'#F6D99A'},
 modeText:{fontSize:12,fontWeight:'900',color:'#FFF1CF'},
 world:{borderRadius:18,borderWidth:1,borderColor:'#E0C590',backgroundColor:'#0A2430',
  overflow:'hidden',minHeight:620},
 trail:{position:'absolute',left:2,right:2,top:94,bottom:6,opacity:.75},
 worldHeading:{paddingHorizontal:12,paddingTop:17,paddingBottom:12},
 kicker:{fontSize:9,letterSpacing:1.2,fontWeight:'900',color:'#FFDBA3'},
 title:{fontSize:20,fontWeight:'900',color:'#FFF0C5',marginTop:3},
 subtitle:{fontSize:11,lineHeight:16,color:'#E7ECE6',marginTop:4,maxWidth:340},
 stationGrid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-around',
  paddingHorizontal:6,paddingTop:6,paddingBottom:15,rowGap:18,columnGap:8},
 station:{width:'47%',minWidth:120,maxWidth:206,minHeight:155,borderWidth:1.5,
  borderRadius:14,overflow:'hidden',backgroundColor:'rgba(5,26,34,.96)',elevation:4},
 art:{height:101,width:'100%',overflow:'hidden',backgroundColor:'#1A3A39'},
 mysteryArt:{...StyleSheet.absoluteFillObject,alignItems:'center',justifyContent:'center',
  backgroundColor:'rgba(2,15,26,.44)'},
 mysteryGlyph:{color:'#FFE2A0',fontSize:13},
 stationCopy:{paddingHorizontal:8,paddingVertical:6,gap:3},
 stationIndex:{fontSize:9,fontWeight:'900',color:'#E3D7B2'},
 name:{fontSize:13,fontWeight:'900',color:'#FFF0C9'},
 stationFooter:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 status:{fontSize:9,color:'#B8DBCA',fontWeight:'800',flex:1},
 pressed:{opacity:.72},
 privacyNote:{fontSize:10,color:'#E9E8DB',lineHeight:16,paddingHorizontal:13,paddingBottom:15}
});
