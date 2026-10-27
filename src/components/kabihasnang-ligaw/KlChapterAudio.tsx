import React,{useEffect,useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {useAudioPlayer} from 'expo-audio';
import {otherAudioPlaying} from '@/lib/kabihasnang-ligaw/externalAudioState';
export default function KlChapterAudio({music,ambient,showWhenEmpty=false}:{music?:string;ambient?:string;showWhenEmpty?:boolean}){
 const player=useAudioPlayer(null);
 const [enabled,setEnabled]=useState(false);
 const [track,setTrack]=useState<'music'|'ambient'>('music');
 const [muted,setMuted]=useState(false);
 useEffect(()=>{player.pause();setEnabled(false);return()=>{player.pause();};},[music,ambient,player]);
 const toggle=()=>{
 if(enabled){player.pause();setEnabled(false);return;}
 if(otherAudioPlaying())return;
 const uri=track==='music'?(music??ambient):(ambient??music);
 if(!uri)return;
 player.replace({uri});
 player.volume=muted?0:0.35;
 player.play();setEnabled(true);
 };
 useEffect(()=>{player.volume=muted?0:0.35;},[muted,player]);
 if(!music&&!ambient&&!showWhenEmpty)return null;
 return <View style={{gap:8,paddingVertical:8}}>
 <Text style={{color:'#c9d9e2'}}>
  {music?'Music ready':'No music uploaded'} · {ambient?'Ambience ready':'No ambience uploaded'}
 </Text>
 <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>
 <Pressable accessibilityRole="button" disabled={!music&&!ambient} onPress={event=>{event.stopPropagation();toggle();}}
  style={{padding:10,borderRadius:8,backgroundColor:'#355b4f'}}>
  <Text style={{color:'#fff'}}>{enabled?'Pause scene audio':'Play scene audio'}</Text>
 </Pressable>
 <Pressable accessibilityRole="button" disabled={!music||!ambient} onPress={event=>{event.stopPropagation();player.pause();setEnabled(false);setTrack(track==='music'?'ambient':'music');}}
  style={{padding:10,borderRadius:8,backgroundColor:'#334a59'}}>
  <Text style={{color:'#fff'}}>{track==='music'?'Music':'Ambience'} (switch)</Text>
 </Pressable>
 <Pressable accessibilityRole="button" disabled={!music&&!ambient} onPress={event=>{event.stopPropagation();setMuted(!muted);}}
  style={{padding:10,borderRadius:8,backgroundColor:'#334a59'}}>
  <Text style={{color:'#fff'}}>{muted?'Unmute':'Mute'}</Text>
 </Pressable>
 </View>
 </View>;
}
