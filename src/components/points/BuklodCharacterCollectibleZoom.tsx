/* Accessible character-art inspection, independent from reward ownership.
 * Native pinch, pan, and button zoom. Text/labels are vector UI text so
 * original sheet typography is not enlarged or mistaken for HD detail.
 */
import React,{useEffect,useState} from 'react';
import {Modal,Pressable,StyleSheet,Text,View} from 'react-native';
import {Image as ExpoImage} from 'expo-image';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {Gesture,GestureDetector,GestureHandlerRootView} from 'react-native-gesture-handler';
import Animated,{useAnimatedStyle,useSharedValue,withTiming} from 'react-native-reanimated';

type Props={
 visible:boolean;onClose:()=>void;
 title:string;description:string;imageUri:string|null;
 characterName:string;level:number;itemIndex:number;
};
export default function BuklodCharacterCollectibleZoom({
 visible,onClose,title,description,imageUri,characterName,level,itemIndex,
}:Props){
 const [broken,setBroken]=useState(false);
 const zoom=useSharedValue(1),base=useSharedValue(1);
 const panX=useSharedValue(0),panY=useSharedValue(0);
 const startX=useSharedValue(0),startY=useSharedValue(0);
 useEffect(()=>{
  if(visible){setBroken(false);zoom.value=1;panX.value=0;panY.value=0;}
 },[visible,imageUri,zoom,panX,panY]);
 const pinch=Gesture.Pinch()
  .onStart(()=>{base.value=zoom.value;})
  .onUpdate(e=>{zoom.value=Math.max(1,Math.min(4,base.value*e.scale));})
  .onEnd(()=>{if(zoom.value<=1.05){zoom.value=withTiming(1);panX.value=withTiming(0);panY.value=withTiming(0);}});
 const pan=Gesture.Pan().minPointers(1)
  .onStart(()=>{startX.value=panX.value;startY.value=panY.value;})
  .onUpdate(e=>{
   if(zoom.value<=1){panX.value=0;panY.value=0;return;}
   const range=(zoom.value-1)*145;
   panX.value=Math.max(-range,Math.min(range,startX.value+e.translationX));
   panY.value=Math.max(-range,Math.min(range,startY.value+e.translationY));
  });
 const combo=Gesture.Simultaneous(pinch,pan);
 const pictureStyle=useAnimatedStyle(()=>({transform:[
  {translateX:panX.value},{translateY:panY.value},{scale:zoom.value},
 ]}));
 const setZoom=(value:number)=>{
  zoom.value=withTiming(Math.min(4,Math.max(1,value)),{duration:160});
  if(value<=1){panX.value=withTiming(0);panY.value=withTiming(0);}
 };
 const canShowImage=Boolean(imageUri&&!broken);
 return <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
  <GestureHandlerRootView style={styles.root}>
   <View style={styles.sheet}>
    <View style={styles.bar}>
     <View style={{flex:1}}>
      <Text style={styles.eyebrow}>{characterName.toUpperCase()} • LEVEL {level} • ITEM {itemIndex}/5</Text>
      <Text style={styles.title} numberOfLines={2}>{title}</Text>
     </View>
     <Pressable accessibilityRole="button" accessibilityLabel="Close image zoom"
      onPress={onClose} style={styles.close}>
      <MaterialCommunityIcons name="close" size={25} color="#EFFFF5"/>
     </Pressable>
    </View>
    <View style={styles.canvas}>
     <GestureDetector gesture={combo}>
      <Animated.View style={[styles.imageFrame,pictureStyle]}>
       {canShowImage?
        <ExpoImage source={{uri:imageUri as string}} style={styles.image}
         contentFit="contain" cachePolicy="memory-disk" transition={0}
         onError={()=>setBroken(true)} accessibilityLabel={title}/>
        :<View style={styles.fallback}>
         <MaterialCommunityIcons name="treasure-chest-outline" color="#D7BB77" size={90}/>
         <Text style={styles.fallbackText}>Artwork is not published yet. Your collection status is unchanged.</Text>
        </View>}
      </Animated.View>
     </GestureDetector>
    </View>
    <View style={styles.controls}>
     <Pressable accessibilityRole="button" accessibilityLabel="Zoom out"
      onPress={()=>setZoom(zoom.value-.5)} style={styles.control}>
      <MaterialCommunityIcons name="minus" size={23} color="#AFF080"/>
     </Pressable>
     <Pressable accessibilityRole="button" accessibilityLabel="Reset zoom to 100 percent"
      onPress={()=>setZoom(1)} style={styles.control}><Text style={styles.label}>RESET</Text></Pressable>
     <Pressable accessibilityRole="button" accessibilityLabel="Zoom in"
      onPress={()=>setZoom(zoom.value+.5)} style={styles.control}>
      <MaterialCommunityIcons name="plus" size={23} color="#AFF080"/>
     </Pressable>
    </View>
    <Text style={styles.description}>{description}</Text>
    <Text style={styles.note}>Pinch to zoom up to 4×, drag to inspect. Image detail is limited by the original collection-sheet resolution; text remains clear at any zoom.</Text>
   </View>
  </GestureHandlerRootView>
 </Modal>;
}
const styles=StyleSheet.create({
 root:{flex:1,justifyContent:'center',backgroundColor:'rgba(0,0,0,.88)',padding:14},
 sheet:{backgroundColor:'#0B2532',borderColor:'#387155',borderWidth:1,borderRadius:17,
  padding:14,maxHeight:'94%',gap:10},
 bar:{flexDirection:'row',alignItems:'flex-start',gap:12},
 eyebrow:{fontSize:11,color:'#AFF080',fontWeight:'800'},
 title:{fontSize:21,color:'#FAFFF4',fontWeight:'900',lineHeight:26},
 close:{padding:7,backgroundColor:'#204A4B',borderRadius:11},
 canvas:{height:310,overflow:'hidden',borderRadius:13,backgroundColor:'#051B12',
  alignItems:'center',justifyContent:'center'},
 imageFrame:{height:285,width:285,alignItems:'center',justifyContent:'center'},
 image:{height:285,width:285},
 fallback:{alignItems:'center',justifyContent:'center',padding:20,gap:15},
 fallbackText:{color:'#D7E6DD',textAlign:'center',fontSize:13,lineHeight:19},
 controls:{flexDirection:'row',gap:14,justifyContent:'center',alignItems:'center'},
 control:{minWidth:60,alignItems:'center',backgroundColor:'#17473B',
  borderRadius:10,paddingHorizontal:15,paddingVertical:9},
 label:{color:'#FAFFF4',fontWeight:'900',fontSize:12},
 description:{fontSize:14,color:'#F0E4B7',lineHeight:20,textAlign:'center'},
 note:{fontSize:11,color:'#BACEC8',lineHeight:17,textAlign:'center'},
});
