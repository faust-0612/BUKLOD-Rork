import React,{useEffect,useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {useAudioPlayer} from 'expo-audio';
import {otherAudioPlaying} from '@/lib/kabihasnang-ligaw/externalAudioState';
export default function KlChapterAudio({music,ambient}:{music?:string;ambient?:string}){
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
 if(!music&&!ambient)return null;
 return <View style={{flexDirection:'row',flexWrap:'wrap',gap:12,paddingVertical:8}}>
 <Pressable onPress={toggle}><Text style={{color:'#f1d39b'}}>{enabled?'Pause scene audio':'Play scene audio'}</Text></Pressable>
 <Pressable onPress={()=>{player.pause();setEnabled(false);setTrack(track==='music'?'ambient':'music');}}><Text style={{color:'#fff'}}>{track==='music'?'Music':'Ambient'} (change)</Text></Pressable>
 <Pressable onPress={()=>setMuted(!muted)}><Text style={{color:'#fff'}}>{muted?'Unmute':'Mute'}</Text></Pressable>
 </View>;
}
