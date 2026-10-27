import React,{useEffect,useRef,useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Image} from 'expo-image';
import {supabase} from '@/lib/supabase';
import {useAuth} from '@/providers/AuthProvider';
import {verifiedChapterReward} from '@/lib/kabihasnang-ligaw/releaseBadge';
import {KlSceneEffect,type SceneEffect} from './KlSceneEffect';
import KlChapterAudio from './KlChapterAudio';
import { illustrationsAtParagraph } from '@/lib/kabihasnang-ligaw/mediaPlacement';
type Chapter={id:string;season_number:number;episode_number:number;title:string;release_at?:string};
type Media={kind:string;placement:number;path:string;anchor?:string;side?:string;effect?:SceneEffect;intensity?:number};
export default function KlDynamicLibrary({initialEpisodeId}:{initialEpisodeId?:string}){
 const {user}=useAuth();
 const [chapters,setChapters]=useState<Chapter[]>([]);
 const [chapter,setChapter]=useState<Chapter|null>(null);
 const [text,setText]=useState('');
 const [media,setMedia]=useState<Media[]>([]);
 const [urls,setUrls]=useState<Record<string,string>>({});
 const [mediaErrors,setMediaErrors]=useState<Record<string,string>>({});
 const [message,setMessage]=useState('');
 const [startTime,setStartTime]=useState(0);
 const [seenRelease,setSeenRelease]=useState('');
 const openSequence=useRef(0);
 const openedLink=useRef('');
 const refresh=async()=>{const {data,error}=await supabase.rpc('kl_list_library_v1');if(error){setMessage(error.message);return;}if(Array.isArray(data))setChapters(data as Chapter[]);};
 useEffect(()=>{void refresh();},[]);
 useEffect(()=>{void AsyncStorage.getItem(`kl.seenRelease.v1.${user?.id??'device'}`).then(value=>setSeenRelease(value??''));},[user?.id]);
 const open=async(c:Chapter)=>{
 const sequence=++openSequence.current;
 setMessage('');setText('');setMedia([]);setUrls({});setMediaErrors({});setChapter(c);setStartTime(Date.now());
 const {data,error}=await supabase.rpc('kl_read_episode_v1',{p_episode_id:c.id});
 const payload=data as {readable?:boolean;content?:{text:string}[]}|null;
 if(sequence!==openSequence.current)return;
 if(error||!payload?.readable){setMessage(error?.message??'Chapter not available');return;}
 setText((payload.content??[]).map(x=>x.text).join('\n\n'));
 void AsyncStorage.setItem(`kl.seenRelease.v1.${user?.id??'device'}`,c.id).then(()=>setSeenRelease(c.id)).catch(()=>undefined);
 void supabase.rpc('kl_reading_progress_v1',{p_episode_id:c.id,p_action:'start'});
 const result=await supabase.rpc('kl_episode_media_v1',{p_episode_id:c.id});
 if(sequence!==openSequence.current)return;
 const items=Array.isArray(result.data)?result.data as Media[]:[];
 setMedia(items);
 const next:Record<string,string>={};
 const failures:Record<string,string>={};
 const signed=await Promise.all(items.map(async m=>{
  const key=m.kind+':'+m.placement;
  try{
   const result=await supabase.storage.from('kl-publishing').createSignedUrl(m.path,3600);
   return {key,url:result.data?.signedUrl,error:result.error?.message};
  }catch(cause){return {key,error:cause instanceof Error?cause.message:'Media link unavailable'};}
 }));
 for(const item of signed){
  if(item.url)next[item.key]=item.url;
  else failures[item.key]=item.error??'No private media URL';
 }
 if(sequence!==openSequence.current)return;
 setUrls(next);
 setMediaErrors(failures);
 };
 useEffect(()=>{
  if(!initialEpisodeId||!chapters.length||openedLink.current===initialEpisodeId)return;
  const requested=chapters.find(c=>c.id===initialEpisodeId);
  if(!requested){setMessage('Hindi pa inilalabas ang hinihinging kabanata. Tingnan ang mga available sa library.');return;}
  openedLink.current=initialEpisodeId;
  void open(requested);
 },[initialEpisodeId,chapters]);
 useEffect(()=>{
 if(!chapter||!text)return;
 const timer=setInterval(()=>{void supabase.rpc('kl_reading_progress_v1',{p_episode_id:chapter.id,p_action:'ping'});},30000);
 return()=>clearInterval(timer);
 },[chapter?.id,text]);
 const complete=async()=>{
 if(!chapter||Date.now()-startTime<90000){setMessage('Ipagpatuloy muna ang pagbabasa.');return;}
 const {data,error}=await supabase.rpc('kl_reading_progress_v1',{p_episode_id:chapter.id,p_action:'complete'});
 const result=data as {new_completion?:boolean;points_awarded?:number;completed?:boolean}|null;
 const points=verifiedChapterReward(result);
 setMessage(error?.message??(result?.new_completion
  ? `Verified chapter complete · +${points} BUKLOD Points!` : result?.completed===false
    ? 'Hindi pa verified. Magbasa nang hindi bababa sa 90 segundo at ipagpatuloy ang pagbabasa bago mag-complete.'
    : 'Naitala na ang completion. Isang beses lamang ang +7 points kada kabanata.'));
 };
 const image=(m:Media)=>{
 const key=m.kind+':'+m.placement;
 const uri=urls[key];
 return !uri||mediaErrors[key]?<View key={key} style={{padding:12,backgroundColor:'#51323a',borderRadius:10}}>
  <Text style={{color:'#fff'}}>Scene {m.placement} image unavailable. Reopen the chapter to retry.</Text>
 </View>:<View key={key} style={{overflow:'hidden',borderRadius:10}}>
 <Image source={{uri}} contentFit="contain" style={{width:'100%',aspectRatio:16/9}}
  onError={()=>setMediaErrors(previous=>({...previous,[key]:'Image download failed'}))}/>
 <KlSceneEffect effect={m.effect??'none'} intensity={m.intensity??30}/></View>;
 };
 const paragraphs=text.split(/\n\s*\n/).filter(Boolean);
 const latest=chapters.reduce<Chapter|null>((best,c)=>!best||String(c.release_at??'')>String(best.release_at??'')?c:best,null);
 return <View style={{gap:12}}>
 <View style={{padding:12,backgroundColor:'#244a3b',borderRadius:12,gap:5}}>
  <Text style={{color:'#ffe0a8',fontWeight:'900',fontSize:15}}>✦ KL Reading Rewards</Text>
  <Text style={{color:'#fff'}}>+7 BUKLOD Points sa UNANG verified completion ng bawat opisyal na inilabas na kabanata.</Text>
  <Text style={{color:'#d5ebe2'}}>+10 bonus points kapag nakumpleto ang lahat ng 30 kabanata sa isang buong serye. Hindi nagbibigay ng points ang simpleng pagbukas o paulit-ulit na pag-complete.</Text>
 </View>
 <Pressable accessibilityRole="button" onPress={()=>void refresh()}><Text style={{color:'#f1d39b'}}>Refresh released chapters</Text></Pressable>
 {chapter?<View style={{gap:12}}>
 <Pressable onPress={()=>{openSequence.current+=1;setChapter(null);setText('');}}><Text style={{color:'#f1d39b'}}>Back to library</Text></Pressable>
 <Text style={{color:'#fff',fontSize:22}}>{chapter.title}</Text>
 <KlChapterAudio music={urls['music:0']} ambient={urls['ambient:0']}/>
 {media.filter(m=>m.kind==='cover').map(image)}
 {paragraphs.map((p,i)=><View key={i} style={{gap:8}}>
 {illustrationsAtParagraph(media,p,'before').map(image)}
 <Text style={{color:'#fff',fontSize:18,lineHeight:29}}>{p}</Text>
 {illustrationsAtParagraph(media,p,'after').map(image)}
 </View>)}
 <Pressable accessibilityRole="button" onPress={()=>void complete()} style={{padding:12,backgroundColor:'#345c45',borderRadius:10}}>
  <Text style={{color:'#fff',fontWeight:'800'}}>Natapos ko ang kabanata · I-verify ang +7 Points</Text>
 </Pressable>
 <ReaderVisibilityControl />
 </View>:chapters.map(c=><Pressable key={c.id} onPress={()=>void open(c)} style={{padding:10,backgroundColor:'#243849',borderRadius:8}}>
 {latest?.id===c.id&&seenRelease!==c.id?<Text style={{color:'#ffe0a8',fontWeight:'900'}}>✦ BAGONG KABANATA · BASAHIN NA</Text>:null}
 <Text style={{color:'#fff'}}>S{c.season_number} · Kabanata {c.episode_number}: {c.title}</Text></Pressable>)}
 {message?<Text accessibilityRole="alert" style={{color:'#fff'}}>{message}</Text>:null}
 </View>;
}

function ReaderVisibilityControl(){
 const [visible,setVisible]=useState(false);
 const [busy,setBusy]=useState(false);
 const [feedback,setFeedback]=useState('');
 useEffect(()=>{let active=true;void supabase.rpc('kl_reader_preferences_v1').then(({data,error})=>{
  if(!active)return;
  if(error)setFeedback('Hindi nabasa ang reading-visibility preference.');
  else setVisible((data as {show_completion?:boolean}|null)?.show_completion===true);
 });return()=>{active=false;};},[]);
 const toggle=async()=>{
  if(busy)return;
  setBusy(true);setFeedback('Sine-save ang pagpili…');
  try{
   const {data,error}=await supabase.rpc('kl_reader_preferences_v1',{p_show_completion:!visible});
   if(error)throw error;
   const result=data as {show_completion?:boolean}|null;
   if(typeof result?.show_completion!=='boolean')throw new Error('No server confirmation');
   setVisible(result.show_completion);
   setFeedback(result.show_completion?'Naka-on. Ang iyong public username/first name lang ay maaaring makita sa listahan ng mga verified na nakatapos.':'Naka-off. Tinanggal ang iyong pangalan sa public KL reader lists.');
  }catch(error){setFeedback(error instanceof Error?error.message:'Hindi na-save ang setting.');}
  finally{setBusy(false);}
 };
 return <View style={{gap:5,padding:12,backgroundColor:'#1b3836',borderRadius:10}}>
  <Text style={{color:'#fff',fontWeight:'800'}}>Mga nakatapos nang bumasa</Text>
  <Text style={{color:'#c9e1d5'}}>Bilang ng verified readers ang ipinapakita, hindi live na nanonood/nagbabasa. Opsyonal ang pagpapakita ng pangalan mo.</Text>
  <Pressable accessibilityRole="button" disabled={busy} onPress={()=>void toggle()} style={{padding:10,borderRadius:8,backgroundColor:'#355748'}}>
   <Text style={{color:'#ffe0a8'}}>{busy?'Saving…':visible?'Ipakita ang pangalan ko: ON':'Ipakita ang pangalan ko: OFF'}</Text>
  </Pressable>
  {feedback?<Text accessibilityRole="alert" style={{color:'#c9e1d5'}}>{feedback}</Text>:null}
 </View>;
}
