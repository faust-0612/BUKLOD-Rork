import React,{useCallback,useEffect,useRef,useState} from 'react';
import { useFocusEffect } from 'expo-router';
import {AppState,Pressable,Text,View} from 'react-native';
import {Image} from 'expo-image';
import {supabase} from '@/lib/supabase';
import {KlSceneEffect,type SceneEffect} from './KlSceneEffect';
import KlChapterAudio from './KlChapterAudio';
import KlReadingQuiz from './KlReadingQuiz';
import { illustrationsAtParagraph } from '@/lib/kabihasnang-ligaw/mediaPlacement';
import { splitKlManuscriptBlocks } from '@/lib/kabihasnang-ligaw/paragraphBlocks';
import { warmBuklodAdOpportunity } from '@/lib/buklodAdOpportunities';
type Chapter={id:string;season_number:number;episode_number:number;title:string};
type Media={kind:string;placement:number;path:string;anchor?:string;side?:string;effect?:SceneEffect;intensity?:number};
export default function KlDynamicLibrary(){
 const [chapters,setChapters]=useState<Chapter[]>([]);
 const [chapter,setChapter]=useState<Chapter|null>(null);
 const [text,setText]=useState('');
 const [media,setMedia]=useState<Media[]>([]);
 const [urls,setUrls]=useState<Record<string,string>>({});
 const [mediaErrors,setMediaErrors]=useState<Record<string,string>>({});
 const [message,setMessage]=useState('');
 const [routeFocused,setRouteFocused]=useState(false);
 const [appActive,setAppActive]=useState(AppState.currentState!=='background'&&AppState.currentState!=='inactive');
 useFocusEffect(useCallback(()=>{setRouteFocused(true);return()=>setRouteFocused(false);},[]));
 useEffect(()=>{const sub=AppState.addEventListener('change',s=>setAppActive(s==='active'));return()=>sub.remove();},[]);
 const openSequence=useRef(0);
 const refresh=async()=>{const {data,error}=await supabase.rpc('kl_list_library_v1');if(error){setMessage(error.message);return;}if(Array.isArray(data))setChapters(data as Chapter[]);};
 useEffect(()=>{void refresh();},[]);
 const open=async(c:Chapter)=>{
 const sequence=++openSequence.current;
 setMessage('');setText('');setMedia([]);setUrls({});setMediaErrors({});setChapter(c);
 warmBuklodAdOpportunity('kl_chapter_success');
 const {data,error}=await supabase.rpc('kl_read_episode_v1',{p_episode_id:c.id});
 const payload=data as {readable?:boolean;content?:{text:string}[]}|null;
 if(sequence!==openSequence.current)return;
 if(error||!payload?.readable){setMessage(error?.message??'Chapter not available');return;}
 setText((payload.content??[]).map(x=>x.text).join('\n\n'));
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
 if(!chapter||!text||!routeFocused||!appActive)return;
 const timer=setInterval(()=>{void supabase.rpc('kl_reading_progress_v1',{p_episode_id:chapter.id,p_action:'ping'});},20000);
 return()=>clearInterval(timer);
 },[chapter?.id,text,routeFocused,appActive]);
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
 const paragraphs=splitKlManuscriptBlocks(text);
 return <View style={{gap:12}}>
 <Pressable onPress={()=>void refresh()}><Text style={{color:'#f1d39b'}}>I-refresh ang mga kabanata</Text></Pressable>
 {chapter?<View style={{gap:12}}>
 <Pressable onPress={()=>{openSequence.current+=1;setChapter(null);setText('');setUrls({});}}><Text style={{color:'#f1d39b'}}>Bumalik sa mga kabanata</Text></Pressable>
 <Text style={{color:'#fff',fontSize:22}}>{chapter.title}</Text>
 <KlChapterAudio music={urls['music:0']} ambient={urls['ambient:0']}/>
 {media.filter(m=>m.kind==='cover').map(image)}
 {paragraphs.map((p,i)=><View key={i} style={{gap:8}}>
 {illustrationsAtParagraph(media,p,'before').map(image)}
 <Text style={{color:'#fff',fontSize:18,lineHeight:29}}>{p}</Text>
 {illustrationsAtParagraph(media,p,'after').map(image)}
 </View>)}
 <KlReadingQuiz key={chapter.id} episodeId={chapter.id}/>
 </View>:chapters.map(c=><Pressable key={c.id} onPress={()=>void open(c)} style={{padding:10,backgroundColor:'#243849',borderRadius:8}}>
 <Text style={{color:'#fff'}}>S{c.season_number} · Kabanata {c.episode_number}: {c.title}</Text></Pressable>)}
 {message?<Text accessibilityRole="alert" style={{color:'#fff'}}>{message}</Text>:null}
 </View>;
}
