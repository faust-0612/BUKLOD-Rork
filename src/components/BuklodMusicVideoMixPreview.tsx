import React,{useEffect} from 'react';
import {Text,View} from 'react-native';
import {VideoView,useVideoPlayer} from 'expo-video';

// Composer-only preview. Never mounts in a feed row or behind a closed picker.
export default function BuklodMusicVideoMixPreview({
 uri,volume,active,
}:{uri:string;volume:number;active:boolean}){
 const player=useVideoPlayer(uri,instance=>{
  instance.loop=true;
  instance.muted=false;
  instance.audioMixingMode='mixWithOthers';
 });
 useEffect(()=>{
  try{
   player.audioMixingMode='mixWithOthers';
   player.volume=Math.max(0,Math.min(1,Number(volume)||0));
   player.muted=volume<=0;
  }catch{/* released before a rapid close */}
 },[player,volume]);
 useEffect(()=>{
  try{if(active)player.play();else player.pause();}catch{/* unavailable source */}
  return()=>{try{player.pause();}catch{/* disposed */}};
 },[player,active]);
 return <View style={{height:112,backgroundColor:'#111b18',borderRadius:8,
    overflow:'hidden',marginTop:7,alignItems:'center',justifyContent:'center'}}>
   <VideoView player={player} nativeControls={false} contentFit="contain"
     style={{width:'100%',height:'100%'}}/>
   <Text pointerEvents="none" style={{position:'absolute',bottom:3,left:7,
     color:'#fff',fontSize:10,fontWeight:'800',backgroundColor:'rgba(0,0,0,0.45)'}}>
      Live video + music mix
   </Text>
 </View>;
}
