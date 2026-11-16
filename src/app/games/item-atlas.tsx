/** 20-core + 7 legacy owner-supplied Kingdom class artwork. */
import React,{useState} from 'react';
import {Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {router} from 'expo-router';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import BuklodKingdomCoreAtlas from '@/components/kingdom/BuklodKingdomCoreAtlas';
import BuklodKingdomClassGallery from '@/components/kingdom/BuklodKingdomClassGallery';
export default function BuklodKingdomItemAtlasScreen(){
 const insets=useSafeAreaInsets();const [library,setLibrary]=useState<'core'|'legacy'>('core');
 return <View style={styles.root}>
  <LinearGradient colors={['#071e2c','#174338','#082e31']} style={StyleSheet.absoluteFill}/>
  <ScrollView contentContainerStyle={[styles.content,{paddingTop:Math.max(insets.top+8,18),paddingBottom:Math.max(insets.bottom+22,30)}]}>
   <View style={styles.row}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={()=>router.back()} style={styles.back}><MaterialCommunityIcons name="arrow-left" color="#e9ca89" size={24}/></Pressable><View style={{flex:1}}><Text style={styles.overline}>BUKLOD KINGDOM</Text><Text style={styles.title}>Item & Reward Atlas</Text></View></View>
   <View style={styles.switcher}>
    <Pressable accessibilityRole="button" accessibilityState={{selected:library==='core'}} onPress={()=>setLibrary('core')} style={[styles.option,library==='core'&&styles.active]}><Text style={[styles.optionText,library==='core'&&styles.activeText]}>20 CORE CLASSES</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityState={{selected:library==='legacy'}} onPress={()=>setLibrary('legacy')} style={[styles.option,library==='legacy'&&styles.active]}><Text style={[styles.optionText,library==='legacy'&&styles.activeText]}>CLASSIC COLLECTIONS</Text></Pressable>
   </View>
   {library==='core'?<BuklodKingdomCoreAtlas/>:<BuklodKingdomClassGallery/>}
  </ScrollView>
 </View>;
}
const styles=StyleSheet.create({root:{flex:1,backgroundColor:'#081f2a'},content:{width:'100%',maxWidth:770,alignSelf:'center',paddingHorizontal:12,gap:15},row:{flexDirection:'row',gap:10,alignItems:'center'},back:{width:44,height:44,borderWidth:1,borderColor:'#e9ca89',borderRadius:11,alignItems:'center',justifyContent:'center'},overline:{fontSize:10,fontWeight:'900',color:'#b9f0ca',letterSpacing:1.5},title:{fontSize:24,fontWeight:'900',color:'#fff4d6'},switcher:{flexDirection:'row',gap:8},option:{flex:1,minHeight:43,alignItems:'center',justifyContent:'center',padding:9,backgroundColor:'#123943',borderRadius:11,borderWidth:1,borderColor:'#5f907f'},active:{backgroundColor:'#b9eba7'},optionText:{fontSize:11,fontWeight:'900',color:'#e8f8e8'},activeText:{color:'#10392e'}});
