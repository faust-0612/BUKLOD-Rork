import React,{useEffect,useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {useAudioPlayer,useAudioPlayerStatus} from 'expo-audio';
import {otherAudioPlaying} from '@/lib/kabihasnang-ligaw/externalAudioState';
export default function KlChapterAudio({music,ambient,showWhenEmpty=false}:{music?:string;ambient?:string;showWhenEmpty?:boolean}){
 const player=useAudioPlayer(null);
 const status=useAudioPlayerStatus(player);
 const [enabled,setEnabled]=useState(false);
 const [track,setTrack]=useState<'music'|'ambient'>('music');
 const [muted,setMuted]=useState(false);
 const [message,setMessage]=useState('');
 useEffect(()=>{player.pause();setEnabled(false);setMessage('');return()=>{player.pause();};},[music,ambient,player]);
 useEffect(()=>{
  if(enabled&&status.isLoaded&&!status.playing&&!status.isBuffering&&status.duration>0
    &&status.currentTime>=status.duration-0.1){setEnabled(false);setMessage('Audio finished. Press Play to replay.');}
 },[enabled,status.currentTime,status.duration,status.isBuffering,status.isLoaded,status.playing]);
 const toggle=()=>{
 if(enabled){player.pause();setEnabled(false);setMessage('Paused.');return;}
 if(otherAudioPlaying()){setMessage('May ibang BUKLOD audio na tumutugtog. I-pause muna iyon para i-test ang chapter audio.');return;}
 const uri=track==='music'?(music??ambient):(ambient??music);
 if(!uri){setMessage('Wala pang audio file na puwedeng i-play.');return;}
 try {
  player.replace({uri});
  player.volume=muted?0:0.35;
  player.play();setEnabled(true);setMessage('Loading / playing private audio…');
 }catch(cause){setEnabled(false);setMessage(cause instanceof Error?cause.message:'Hindi ma-play ang audio file.');}
 };
 useEffect(()=>{player.volume=muted?0:0.35;},[muted,player]);
 const clock=(seconds:number)=>{
  if(!Number.isFinite(seconds)||seconds<0)return '0:00';
  const count=Math.floor(seconds);
  return Math.floor(count/60)+':'+String(count%60).padStart(2,'0');
 };
 if(!music&&!ambient&&!showWhenEmpty)return null;
 return <View style={{gap:8,paddingVertical:8}}>
 <Text style={{color:'#c9d9e2'}}>
  {music?'Music ready':'No music uploaded'} · {ambient?'Ambience ready':'No ambience uploaded'}
 </Text>
 {(music||ambient)?<Text style={{color:'#c9d9e2'}} accessibilityLiveRegion="polite">
  {status.isBuffering?'Buffering…':status.playing?'Playing':enabled?'Preparing audio':'Ready to test'}
  {' · '}{clock(status.currentTime??0)} / {clock(status.duration??0)}
 </Text>:null}
 <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>
 <Pressable accessibilityRole="button" disabled={!music&&!ambient} onPress={event=>{event.stopPropagation();toggle();}}
  style={{padding:10,borderRadius:8,backgroundColor:'#355b4f'}}>
  <Text style={{color:'#fff'}}>{enabled?'Pause scene audio':'Play / test audio'}</Text>
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
 {message?<Text accessibilityRole="alert" style={{color:'#dce8e8'}}>{message}</Text>:null}
 </View>;
}
