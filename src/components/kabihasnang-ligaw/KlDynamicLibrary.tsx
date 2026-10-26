import React,{useEffect,useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {Image} from 'expo-image';
import {supabase} from '@/lib/supabase';
import {KlSceneEffect,type SceneEffect} from './KlSceneEffect';
type Chapter={id:string;season_number:number;episode_number:number;title:string};
type Media={kind:string;placement:number;path:string;anchor?:string;side?:string;effect?:SceneEffect;intensity?:number};
export default function KlDynamicLibrary(){
 const [chapters,setChapters]=useState<Chapter[]>([]);
 const [chapter,setChapter]=useState<Chapter|null>(null);
 const [text,setText]=useState('');
 const [media,setMedia]=useState<Media[]>([]);
 const [urls,setUrls]=useState<Record<string,string>>({});
 const [message,setMessage]=useState('');
 const [startTime,setStartTime]=useState(0);
 const refresh=async()=>{const {data,error}=await supabase.rpc('kl_list_library_v1');if(error){setMessage(error.message);return;}if(Array.isArray(data))setChapters(data as Chapter[]);};
 useEffect(()=>{void refresh();},[]);
 const open=async(c:Chapter)=>{
 setMessage('');setText('');setMedia([]);setUrls({});setChapter(c);setStartTime(Date.now());
 const {data,error}=await supabase.rpc('kl_read_episode_v1',{p_episode_id:c.id});
 const payload=data as {readable?:boolean;content?:{text:string}[]}|null;
 if(error||!payload?.readable){setMessage(error?.message??'Chapter not available');return;}
 setText((payload.content??[]).map(x=>x.text).join('\n\n'));
 void supabase.rpc('kl_reading_progress_v1',{p_episode_id:c.id,p_action:'start'});
 const result=await supabase.rpc('kl_episode_media_v1',{p_episode_id:c.id});
 const items=Array.isArray(result.data)?result.data as Media[]:[];
 setMedia(items);
 const next:Record<string,string>={};
 for(const m of items){const signed=await supabase.storage.from('kl-publishing').createSignedUrl(m.path,3600);if(signed.data?.signedUrl)next[m.kind+':'+m.placement]=signed.data.signedUrl;}
 setUrls(next);
 };
 useEffect(()=>{
 if(!chapter||!text)return;
 const timer=setInterval(()=>{void supabase.rpc('kl_reading_progress_v1',{p_episode_id:chapter.id,p_action:'ping'});},30000);
 return()=>clearInterval(timer);
 },[chapter?.id,text]);
 const complete=async()=>{
 if(!chapter||Date.now()-startTime<90000){setMessage('Ipagpatuloy muna ang pagbabasa.');return;}
 const {data,error}=await supabase.rpc('kl_reading_progress_v1',{p_episode_id:chapter.id,p_action:'complete'});
 const result=data as {new_completion?:boolean;completed?:boolean}|null;
 setMessage(error?.message??(result?.new_completion?'Completed · +7 BUKLOD Points':result?.completed===false?'Reading not yet verified':'Completion recorded.'));
 };
 const image=(m:Media)=>{const uri=urls[m.kind+':'+m.placement];return uri?<View key={m.kind+':'+m.placement} style={{height:240,overflow:'hidden',borderRadius:10}}>
 <Image source={{uri}} contentFit="cover" style={{height:'100%',width:'100%'}}/>
 <KlSceneEffect effect={m.effect??'none'} intensity={m.intensity??30}/></View>:null;};
 const paragraphs=text.split(/\n\s*\n/).filter(Boolean);
 return <View style={{gap:12}}>
 <Pressable onPress={()=>void refresh()}><Text style={{color:'#f1d39b'}}>Refresh released chapters</Text></Pressable>
 {chapter?<View style={{gap:12}}>
 <Pressable onPress={()=>{setChapter(null);setText('');}}><Text style={{color:'#f1d39b'}}>Back to library</Text></Pressable>
 <Text style={{color:'#fff',fontSize:22}}>{chapter.title}</Text>
 {media.filter(m=>m.kind==='cover').map(image)}
 {paragraphs.map((p,i)=><View key={i} style={{gap:8}}>
 {media.filter(m=>m.kind==='illustration'&&m.side==='before'&&m.anchor&&p.includes(m.anchor)).map(image)}
 <Text style={{color:'#fff',fontSize:18,lineHeight:29}}>{p}</Text>
 {media.filter(m=>m.kind==='illustration'&&m.side!=='before'&&m.anchor&&p.includes(m.anchor)).map(image)}
 </View>)}
 <Pressable onPress={()=>void complete()}><Text style={{color:'#f1d39b'}}>Mark Chapter Complete</Text></Pressable>
 </View>:chapters.map(c=><Pressable key={c.id} onPress={()=>void open(c)} style={{padding:10,backgroundColor:'#243849',borderRadius:8}}>
 <Text style={{color:'#fff'}}>S{c.season_number} · Kabanata {c.episode_number}: {c.title}</Text></Pressable>)}
 {message?<Text accessibilityRole="alert" style={{color:'#fff'}}>{message}</Text>:null}
 </View>;
}
