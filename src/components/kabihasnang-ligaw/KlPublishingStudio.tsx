import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import KlAdminMediaUpload from './KlAdminMediaUpload';

type Episode = { id: string; title: string; season_number: number; episode_number: number; status: string };
export default function KlPublishingStudio() {
 const [episodes,setEpisodes]=useState<Episode[]>([]);
 const [id,setId]=useState('');
 const [title,setTitle]=useState('');
 const [manuscript,setManuscript]=useState('');
 const [season,setSeason]=useState('1');
 const [chapter,setChapter]=useState('2');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const refresh=async()=>{const {data,error}=await supabase.rpc('kl_admin_list_v1');if(error){setMessage(error.message);return;}if(Array.isArray(data))setEpisodes(data as Episode[]);};
 useEffect(()=>{void refresh();},[]);
 const load=async(episode:Episode)=>{setId(episode.id);setTitle(episode.title);setSeason(String(episode.season_number??1));setChapter(String(episode.episode_number));
 const {data,error}=await supabase.rpc('kl_admin_preview_v1',{p_episode_id:episode.id});
 if(error)setMessage(error.message);else setManuscript((data as {manuscript?:string})?.manuscript??'');};
 const execute=async(fn:()=>Promise<void>)=>{if(busy)return;setBusy(true);try{await fn();}catch(e){setMessage(e instanceof Error?e.message:'Operation failed');}finally{setBusy(false);}};
 const create=()=>execute(async()=>{const {data,error}=await supabase.rpc('kl_admin_create_chapter_v1',{p_season:Number(season),p_episode:Number(chapter),p_title:title});if(error)throw error;
 const episodeId=(data as {id:string}).id;setId(episodeId);setManuscript('');setMessage('Chapter created. Add manuscript and media.');await refresh();});
 const save=()=>execute(async()=>{const {error}=await supabase.rpc('kl_admin_save_content_v1',{p_episode_id:id,p_title:title,p_manuscript:manuscript});if(error)throw error;setMessage('Draft saved on server.');});
 const prepare=()=>execute(async()=>{const {data,error}=await supabase.rpc('kl_admin_prepare_preview_v1',{p_episode_id:id});if(error)throw error;setMessage('Preview ready in Community Wall → KL → Admin card. This is NOT published.');await refresh();});
 const field={color:'#fff',borderColor:'#667',borderWidth:1,padding:10,borderRadius:8} as const;
 return <View style={{gap:12,padding:16,backgroundColor:'#182537',borderRadius:12}}>
  <Text style={{color:'#f1d39b',fontWeight:'bold',fontSize:18}}>KL · Content Creation Studio</Text>
  <Text style={{color:'#fff'}}>Profile admin: prepare content and preview only. Approval and Release Now are in Community Wall KL.</Text>
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
  {episodes.map(ep=><Pressable key={ep.id} onPress={()=>void load(ep)} style={{padding:8,borderRadius:8,backgroundColor:ep.id===id?'#466':'#344'}}>
  <Text style={{color:'#fff'}}>S{ep.season_number??1} Ch{ep.episode_number} · {ep.title}</Text></Pressable>)}</View>
  <Text style={{color:'#fff'}}>Create another chapter (1–12 series, 30 chapters each)</Text>
  <TextInput style={field} keyboardType="numeric" value={season} onChangeText={setSeason} placeholder="Series 1–12" placeholderTextColor="#aaa"/>
  <TextInput style={field} keyboardType="numeric" value={chapter} onChangeText={setChapter} placeholder="Chapter 1–30" placeholderTextColor="#aaa"/>
  <TextInput style={field} value={title} onChangeText={setTitle} placeholder="Chapter title" placeholderTextColor="#aaa"/>
  <Pressable disabled={busy||title.trim().length<3} onPress={create}><Text style={{color:'#f1d39b'}}>Create / Open Chapter</Text></Pressable>
  {id ? <>
  <Text style={{color:'#fff'}}>Full manuscript</Text>
  <TextInput style={[field,{minHeight:220,textAlignVertical:'top'}]} multiline value={manuscript} onChangeText={setManuscript} placeholder="Paste complete manuscript here" placeholderTextColor="#aaa"/>
  <Pressable disabled={busy||manuscript.trim().length<30} onPress={save}><Text style={{color:'#f1d39b'}}>Save Manuscript</Text></Pressable>
  <KlAdminMediaUpload episodeNumber={Number(chapter)} episodeId={id}/>
  <Pressable disabled={busy} onPress={prepare}><Text style={{color:'#f1d39b'}}>Prepare Preview for Community Wall KL Admin</Text></Pressable>
  </>:null}
  {message?<Text accessibilityRole="alert" style={{color:'#fff'}}>{message}</Text>:null}
 </View>;
}
