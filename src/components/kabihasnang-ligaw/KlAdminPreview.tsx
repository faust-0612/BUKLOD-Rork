import KlChapterAudio from './KlChapterAudio';
import React,{useEffect,useRef,useState} from 'react';
import { Image } from 'expo-image';
import { Pressable,Text,View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { KlSceneEffect,type SceneEffect } from './KlSceneEffect';
import { illustrationsAtParagraph } from '@/lib/kabihasnang-ligaw/mediaPlacement';
type Media={kind:string;placement:number;path:string;anchor?:string;side?:string;effect?:SceneEffect;intensity?:number};
type Bundle={title:string;manuscript:string;version:number;media:Media[]};
export default function KlAdminPreview({episodeId,onApproved}:{episodeId:string;onApproved?:()=>void}) {
 const [bundle,setBundle]=useState<Bundle|null>(null);
 const [urls,setUrls]=useState<Record<string,string>>({});
 const [error,setError]=useState('');
 const [feedback,setFeedback]=useState('');
 const [imageErrors,setImageErrors]=useState<Record<string,string>>({});
 const [approvals,setApprovals]=useState<Record<string,boolean>>({});
 const [loading,setLoading]=useState(false);
 const [motionPlaying,setMotionPlaying]=useState(true);
 const [showSceneGallery,setShowSceneGallery]=useState(true);
 const [busy,setBusy]=useState(false);
 const requestId=useRef(0);
 const load=async(confirmRefresh=false)=>{
 const request=++requestId.current;
 setLoading(true);
 try {
 const [preview,list]=await Promise.all([
  supabase.rpc('kl_admin_preview_bundle_v1',{p_episode_id:episodeId}),
  supabase.rpc('kl_admin_media_list_v1',{p_episode_id:episodeId}),
 ]);
 if(preview.error)throw preview.error;
 if(list.error)throw list.error;
 const b=preview.data as Bundle;
 if(!b||!Array.isArray(b.media))throw new Error('Incomplete private preview from server.');
 const signed=await Promise.all(b.media.map(async m=>{
  const key=m.kind+':'+m.placement;
  try {
   const result=await supabase.storage.from('kl-publishing').createSignedUrl(m.path,3600);
   return {key,url:result.data?.signedUrl,error:result.error?.message};
  }catch(cause){return {key,error:cause instanceof Error?cause.message:'Media signing failed.'};}
 }));
 const u:Record<string,string>={};
 const failures:Record<string,string>={};
 for(const result of signed){
  if(result.url)u[result.key]=result.url;
  else failures[result.key]=result.error??'No private media URL';
 }
 const status:Record<string,boolean>={};
 if(Array.isArray(list.data))for(const item of list.data as {kind:string;placement:number;approved:boolean}[]){
  status[item.kind+':'+item.placement]=item.approved===true;
 }
 if(request!==requestId.current)return;
 setBundle(b);setUrls(u);setImageErrors(failures);setApprovals(status);setError('');
 if(confirmRefresh)setFeedback('Media and approval status refreshed from server.');
 }catch(cause){if(request===requestId.current)setError(cause instanceof Error?cause.message:'Preview load failed.');}
 finally{if(request===requestId.current)setLoading(false);}
 };
 useEffect(()=>{void load();return()=>{requestId.current+=1;};},[episodeId]);
 const approve=async(m:Media)=>{
  if(busy)return;
  setBusy(true);
  setFeedback('Approving '+m.kind+' '+m.placement+' on server…');
  setError('');
  try{
   const {data,error:e}=await supabase.rpc('kl_admin_media_approve_v1',{p_episode_id:episodeId,p_kind:m.kind,p_placement:m.placement});
   if(e)throw e;
   if(!(data as {ok?:boolean}|null)?.ok)throw new Error('Server did not confirm approval.');
   setApprovals((previous)=>({...previous,[m.kind+':'+m.placement]:true}));
   onApproved?.();
   await load();
   setFeedback(m.kind+' '+m.placement+' approved on server. Chapter is still private until release.');
  }catch(cause){setFeedback('');setError(cause instanceof Error?cause.message:'Approval failed.');}
  finally{setBusy(false);}
 };
 if(!bundle)return <View style={{padding:12}}>
  <Pressable accessibilityRole="button" disabled={loading} onPress={event=>{event.stopPropagation();void load(true);}}>
   <Text style={{color:'#f1d39b'}}>{loading?'Loading private preview…':'Retry prepared preview'}</Text>
  </Pressable>
  {error?<Text accessibilityRole="alert" style={{color:'#ffb8b8'}}>{error}</Text>:null}
 {feedback?<Text accessibilityRole="alert" style={{color:'#c7f4d8'}}>{feedback}</Text>:null}
 </View>;
 const paragraphs=bundle.manuscript.split(/\n\s*\n/).filter(Boolean);
 const image=(m:Media, gallery=false)=>{
 const key=m.kind+':'+m.placement;
 const uri=urls[key];
 if(!uri||imageErrors[key])return <View key={key} style={{padding:12,backgroundColor:'#4c3038',borderRadius:8}}>
  <Text style={{color:'#fff'}}>Hindi maipakita ang {m.kind} {m.placement}: {imageErrors[key]??'Private link unavailable'}. Tap Refresh media.</Text>
 </View>;
 return <View key={key} style={{overflow:'hidden',borderRadius:8,backgroundColor:'#243748'}}>
  <Image source={{uri}} style={{width:'100%',aspectRatio:16/9}} contentFit="contain" cachePolicy="memory-disk"
   onError={()=>setImageErrors(previous=>({...previous,[key]:'Image download or decode failed'}))}/>
  {m.kind==='illustration'?<KlSceneEffect effect={m.effect??'none'} intensity={m.intensity??30}
    active={motionPlaying&&(gallery||!showSceneGallery)}/>:null}
 </View>;
 };
 return <View style={{padding:12,gap:12,backgroundColor:'#192b39'}}>
 <Text style={{color:'#f1d39b',fontSize:20}}>{bundle.title} · Preview v{bundle.version}</Text>
 <Text style={{color:'#fff'}}>Private admin preview — not released. Artwork approval is separate from chapter approval.</Text>
 <Pressable accessibilityRole="button" disabled={loading||busy} onPress={event=>{event.stopPropagation();void load(true);}}
  style={{padding:12,backgroundColor:'#36594f',borderRadius:8}}>
  <Text style={{color:'#fff'}}>{loading?'Loading media…':'Refresh media & approval status'}</Text>
 </Pressable>
 <Text style={{color:'#f1d39b',fontWeight:'700'}}>Music & ambience · top of preview</Text>
 <KlChapterAudio music={urls['music:0']} ambient={urls['ambient:0']} showWhenEmpty/>
 <Text style={{color:'#f1d39b'}}>Scene animation · built-in atmosphere over the illustration</Text>
 <Pressable accessibilityRole="button" onPress={event=>{event.stopPropagation();setMotionPlaying(!motionPlaying);}}
  style={{padding:12,backgroundColor:'#344e5b',borderRadius:8}}>
  <Text style={{color:'#fff'}}>{motionPlaying?'Pause animation preview':'Play animation preview'}</Text>
 </Pressable>
 <Text style={{color:'#c9d9e2'}}>An effect set to “none” is a still image. Select and save an effect in Profile KL to see motion.</Text>
 <Pressable accessibilityRole="button" onPress={event=>{event.stopPropagation();setShowSceneGallery(!showSceneGallery);}}
  style={{padding:12,backgroundColor:'#36594f',borderRadius:8}}>
  <Text style={{color:'#fff'}}>{showSceneGallery?'Hide':'Show'} scene artwork check · {bundle.media.filter(m=>m.kind==='illustration').length} illustrations</Text>
 </Pressable>
 {showSceneGallery?bundle.media.filter(m=>m.kind==='illustration').map(m=>(
  <View key={'gallery-'+m.placement} style={{gap:5}}>
   <Text style={{color:'#f1d39b'}}>Scene {m.placement} · {approvals[m.kind+':'+m.placement]?'Server approved':'Awaiting server approval'} · {m.effect??'none'} {m.intensity??30}%</Text>
   {image(m,true)}
  </View>
 )):null}
 <Text style={{color:'#c9d9e2'}}>Story layout begins below. The same scenes also appear at their saved manuscript anchors.</Text>
 {bundle.media.filter(m=>m.kind==='cover').map(m=>image(m))}
 {paragraphs.map((p,i)=><View key={i} style={{gap:8}}>
 {illustrationsAtParagraph(bundle.media,p,'before').map(m=>image(m))}
 <Text style={{color:'#fff',fontSize:17,lineHeight:27}}>{p}</Text>
 {illustrationsAtParagraph(bundle.media,p,'after').map(m=>image(m))}
 </View>)}
 <Text style={{color:'#fff'}}>Review uploaded media before approval:</Text>
 {bundle.media.map(m=><Pressable accessibilityRole="button" disabled={busy||approvals[m.kind+':'+m.placement]} key={m.kind+':'+m.placement}
  onPress={event=>{event.stopPropagation();void approve(m);}} style={{padding:12,minHeight:44,backgroundColor:approvals[m.kind+':'+m.placement]?'#285343':'#3c5260',borderRadius:8}}>
  <Text style={{color:'#f1d39b'}}>{approvals[m.kind+':'+m.placement]?'Approved ✓':'Approve'} {m.kind} {m.placement}{m.kind==='illustration'?' · '+(m.effect??'none')+' '+(m.intensity??30)+'%':''}</Text></Pressable>)}
 {error?<Text accessibilityRole="alert" style={{color:'#ffb8b8'}}>{error}</Text>:null}
 {feedback?<Text accessibilityRole="alert" style={{color:'#c7f4d8'}}>{feedback}</Text>:null}
 </View>;
}
