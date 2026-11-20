/** Unified Season 2 Genesis glass: presentation-only, preview-gated at each call site. */
import React from 'react';
import {Image,StyleSheet,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {GENESIS_GALAXY_IMAGES} from './genesisGalleryAssets';
export const GENESIS_GLASS=Object.freeze({
 surface:'rgba(5,30,49,0.91)',inset:'rgba(11,61,72,0.71)',input:'rgba(5,24,42,0.88)',
 selected:'rgba(16,106,83,0.67)',metricBlue:'rgba(16,66,90,0.79)',
 metricPurple:'rgba(62,44,99,0.79)',metricGold:'rgba(103,75,39,0.69)',
 row:'rgba(8,54,70,0.56)',border:'rgba(89,232,195,0.66)',borderSoft:'rgba(110,207,202,0.36)',
 text:'#F7FBFF',secondary:'#D1E6EF',muted:'#ABC5D0',accent:'#96F4C7',gold:'#FFE2A5',
 errorSurface:'rgba(113,40,49,0.62)',errorText:'#FFD8D8',
 actionTones:{scan:'rgba(18,107,77,0.48)',camera:'rgba(23,73,118,0.55)',
 import:'rgba(78,45,122,0.57)',note:'rgba(101,73,28,0.56)'},
 actionIcons:{scan:'#96F4C7',camera:'#B3E4FF',import:'#E1C3FF',note:'#FFE2A5'},
});
/** Static bundled galaxy image and noninteractive light line; no extra native SDK or network requests. */
export function GenesisGlassDecoration({scene='earth'}:{scene?:'earth'|'nebula'|'creation'}){
 return <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
   <Image source={GENESIS_GALAXY_IMAGES[scene]} resizeMode="cover"
     style={[StyleSheet.absoluteFillObject,{opacity:0.17}]}/>
   <LinearGradient colors={['rgba(3,18,37,0.70)','rgba(5,30,49,0.14)','rgba(4,29,43,0.60)']}
     start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFillObject}/>
   <View style={styles.lightLine}/>
 </View>;
}
const styles=StyleSheet.create({lightLine:{position:'absolute',bottom:11,right:-14,width:'55%',height:1,
 backgroundColor:'rgba(140,250,182,0.32)',transform:[{rotate:'-11deg'}]}});
