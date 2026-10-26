import KlChapterAudio from './KlChapterAudio';
import React,{useEffect,useState} from 'react';
import { Image } from 'expo-image';
import { Pressable,Text,View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { KlSceneEffect,type SceneEffect } from './KlSceneEffect';
type Media={kind:string;placement:number;path:string;anchor?:string;side?:string;effect?:SceneEffect;intensity?:number};
type Bundle={title:string;manuscript:string;version:number;media:Media[]};
export default function KlAdminPreview({episodeId}:{episodeId:string}) {
 const [bundle,setBundle]=useState<Bundle|null>(null);
 const [urls,setUrls]=useState<Record<string,string>>({});
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const load=async()=>{
 const {data,error:e}=await supabase.rpc('kl_admin_preview_bundle_v1',{p_episode_id:episodeId});
 if(e){setError(e.message);return;}
 const b=data as Bundle;setBundle(b);
 const u:Record<string,string>={};
 for(const m of b.media){const signed=await supabase.storage.from('kl-publishing').createSignedUrl(m.path,3600);if(signed.data?.signedUrl)u[m.kind+':'+m.placement]=signed.data.signedUrl;}
 setUrls(u);
 };
 useEffect(()=>{void load();},[episodeId]);
 const approve=async(m:Media)=>{setBusy(true);const {error:e}=await supabase.rpc('kl_admin_media_approve_v1',{p_episode_id:episodeId,p_kind:m.kind,p_placement:m.placement});setError(e?.message??'Media approved.');setBusy(false);};
 if(!bundle)return <View style={{padding:12}}><Pressable onPress={()=>void load()}><Text style={{color:'#f1d39b'}}>Open prepared preview</Text></Pressable>{error?<Text style={{color:'#fff'}}>{error}</Text>:null}</View>;
 const paragraphs=bundle.manuscript.split(/\n\s*\n/).filter(Boolean);
 const image=(m:Media)=>{const uri=urls[m.kind+':'+m.placement];return uri?<View key={m.kind+':'+m.placement} style={{height:220,overflow:'hidden',borderRadius:8}}>
 <Image source={{uri}} style={{height:'100%',width:'100%'}} contentFit="cover"/>
 <KlSceneEffect effect={m.effect??'none'} intensity={m.intensity??30}/>
 </View>:null;};
 return <View style={{padding:12,gap:12,backgroundColor:'#192b39'}}>
 <Text style={{color:'#f1d39b',fontSize:20}}>{bundle.title} · Preview v{bundle.version}</Text>
 <Text style={{color:'#fff'}}>Private admin preview — not released</Text>
 <KlChapterAudio music={urls['music:0']} ambient={urls['ambient:0']}/>
 {bundle.media.filter(m=>m.kind==='cover').map(image)}
 {paragraphs.map((p,i)=><View key={i} style={{gap:8}}>
 {bundle.media.filter(m=>m.kind==='illustration'&&m.side==='before'&&m.anchor&&p.includes(m.anchor)).map(image)}
 <Text style={{color:'#fff',fontSize:17,lineHeight:27}}>{p}</Text>
 {bundle.media.filter(m=>m.kind==='illustration'&&m.side!=='before'&&m.anchor&&p.includes(m.anchor)).map(image)}
 </View>)}
 <Text style={{color:'#fff'}}>Review uploaded media before approval:</Text>
 {bundle.media.map(m=><Pressable disabled={busy} key={m.kind+':'+m.placement} onPress={()=>void approve(m)}>
 <Text style={{color:'#f1d39b'}}>Approve {m.kind} {m.placement}</Text></Pressable>)}
 {error?<Text accessibilityRole="alert" style={{color:'#fff'}}>{error}</Text>:null}
 </View>;
}
