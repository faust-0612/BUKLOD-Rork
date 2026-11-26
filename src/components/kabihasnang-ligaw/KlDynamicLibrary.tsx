import { splitKlItalics } from '@/lib/kabihasnang-ligaw/italicFormatting';
import React,{useCallback,useEffect,useRef,useState} from 'react';
import { useFocusEffect } from 'expo-router';
import {AppState,Modal,Pressable,Text,TextInput,View} from 'react-native';
import {Image} from 'expo-image';
import {supabase} from '@/lib/supabase';
import {KlSceneEffect,type SceneEffect} from './KlSceneEffect';
import KlChapterAudio from './KlChapterAudio';
import KlReadingQuiz from './KlReadingQuiz';
import KlAdminPreview from './KlAdminPreview';
import KlLiveDiscussion from './KlLiveDiscussion';
import { type KlSeries, KlSeriesShelf } from './KlSeriesShelf';
import { useKlChapterDictionary } from '@/lib/kabihasnang-ligaw/useKlChapterDictionary';
import { parseKlAdminChapters, isKlChapterReleased, klReleaseBlockers, type KlAdminChapterRow } from '@/lib/kabihasnang-ligaw/releasePreflight';
import { illustrationsAtParagraph } from '@/lib/kabihasnang-ligaw/mediaPlacement';
import { splitKlManuscriptBlocks } from '@/lib/kabihasnang-ligaw/paragraphBlocks';
import { warmBuklodAdOpportunity } from '@/lib/buklodAdOpportunities';
type Chapter={id:string;season_number:number;episode_number:number;title:string};
type Media={kind:string;placement:number;path:string;anchor?:string;side?:string;effect?:SceneEffect;intensity?:number};
export default function KlDynamicLibrary({series,isAdmin=false,onBack}:{series?:KlSeries;isAdmin?:boolean;onBack?:()=>void}={}){
 const [standaloneSeries,setStandaloneSeries]=useState<KlSeries|null>(null);
 const currentSeries=series??standaloneSeries;
 const [adminRows,setAdminRows]=useState<(KlAdminChapterRow & {title:string})[]>([]);
 const [adminPreview,setAdminPreview]=useState<string|null>(null);
 const [adminBusy,setAdminBusy]=useState(false);
 const adminLock=useRef(false);
 const [adminConfirm,setAdminConfirm]=useState<string|null>(null);
 const [rejectNotes,setRejectNotes]=useState('');
 const [openTerm,setOpenTerm]=useState<string|null>(null);
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
 const refresh=async()=>{
  const {data,error}=await supabase.rpc('kl_list_library_v1');
  if(error)setMessage(error.message);else if(Array.isArray(data))setChapters(data as Chapter[]);
  if(isAdmin&&currentSeries){
   const admin=await supabase.rpc('kl_admin_list_v1');
   if(admin.error||!Array.isArray(admin.data)){setAdminRows([]);setMessage(admin.error?.message??'Hindi nabasa ang admin chapters.');return;}
   const titles=new Map((admin.data as Chapter[]).map(r=>[r.id,r.title]));
   setAdminRows(parseKlAdminChapters(admin.data).filter(r=>r.season_number===currentSeries.season_number).map(r=>({...r,title:titles.get(r.id)??'Kabanata '+r.episode_number})));
  }else setAdminRows([]);
 };
 useEffect(()=>{void refresh();},[currentSeries?.season_number,isAdmin]);
 const prepareQuiz=async(id:string)=>{
  const existing=await supabase.rpc('kl_quiz_admin_context_v1',{p_episode_id:id});
  if(existing.error)throw Error('Hindi ma-verify ang quiz.');
  if(existing.data?.quiz_status==='ready')return;
  await supabase.functions.invoke('kl-generate-reading-quiz',{body:{episode_id:id}});
  const check=await supabase.rpc('kl_quiz_admin_context_v1',{p_episode_id:id});
  if(check.error||check.data?.quiz_status!=='ready')throw Error('Pending ang validated reading questions. Subukan muli; hindi pa maaaring i-release.');
 };
 const chapterAction=async(row:KlAdminChapterRow,action:'approve'|'release'|'reject'|'quiz')=>{
  if(!isAdmin||adminLock.current)return;
  if(action==='release'&&adminConfirm!==row.id){setAdminConfirm(row.id);return;}
  adminLock.current=true;setAdminBusy(true);setMessage('');
  try{
   const fresh=await supabase.rpc('kl_admin_list_v1');
   if(fresh.error)throw Error(fresh.error.message);
   const target=parseKlAdminChapters(fresh.data).find(r=>r.id===row.id&&r.season_number===currentSeries?.season_number);
   if(!target)throw Error('Chapter not found.');
   if(action==='quiz'||action==='release'){
    if(action==='release'){
     const blockers=klReleaseBlockers(target);
     if(blockers.length)throw Error(blockers.join(' '));
     if(!currentSeries?.published)throw Error('Publish the series first in KL Studio.');
    }
    await prepareQuiz(row.id);
   }
   if(action!=='quiz'){
    const {data,error}=await supabase.rpc('kl_admin_action_v1',{p_episode_id:row.id,p_action:action,p_notes:action==='reject'?rejectNotes:null,p_manila_date:null});
    if(error||data?.ok!==true)throw Error(error?.message??'Server action not confirmed.');
    if(action==='approve'){
     try{await prepareQuiz(row.id);}catch(e){setMessage('Approved, private. '+(e instanceof Error?e.message:'Quiz pending.'));await refresh();return;}
    }
   }
   if(action==='release'){
    const check=await supabase.rpc('kl_list_library_v1');
    if(check.error||!Array.isArray(check.data)||!check.data.some((c:Chapter)=>c.id===row.id))throw Error('Release not yet verified. Refresh status.');
   }
   setMessage(action==='release'?'Verified: chapter released.':action==='approve'?'Approved; private until release.':action==='quiz'?'Reading questions ready.':'Returned to draft.');
   setAdminConfirm(null);setRejectNotes('');await refresh();
  }catch(e){setMessage(e instanceof Error?e.message:'Chapter action failed.');}
  finally{adminLock.current=false;setAdminBusy(false);}
 };
 const open=async(c:Chapter)=>{
 const sequence=++openSequence.current;
 setMessage('');setOpenTerm(null);setText('');setMedia([]);setUrls({});setMediaErrors({});setChapter(c);
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
 const dictionary=useKlChapterDictionary(chapter?.id??null,text,routeFocused&&appActive);
 const term=openTerm?dictionary.byName(openTerm):null;
 const chapterRows=chapters.filter(c=>c.season_number===currentSeries?.season_number);
 if(!currentSeries)return <KlSeriesShelf isAdmin={isAdmin} onOpen={setStandaloneSeries}/>;
 return <View style={{gap:12}}>
 {!chapter?<><Pressable accessibilityRole="button" onPress={()=>{if(onBack)onBack();else setStandaloneSeries(null);}}><Text style={{color:'#f1d39b'}}>‹ Bumalik sa mga serye</Text></Pressable><Text style={{color:'#f6dfb0',fontSize:24,fontWeight:'800'}}>{currentSeries.title}</Text><Pressable onPress={()=>void refresh()}><Text style={{color:'#f1d39b'}}>I-refresh ang mga kabanata</Text></Pressable></>:null}
 {chapter?<View style={{gap:12}}>
 <Pressable onPress={()=>{openSequence.current+=1;setChapter(null);setOpenTerm(null);setText('');setUrls({});}}><Text style={{color:'#f1d39b'}}>Bumalik sa mga kabanata</Text></Pressable>
 <Text style={{color:'#fff',fontSize:22}}>{chapter.title}</Text>
 <KlChapterAudio music={urls['music:0']} ambient={urls['ambient:0']}/>
 {media.filter(m=>m.kind==='cover').map(image)}
 {paragraphs.map((p,i)=><View key={i} style={{gap:8}}>
 {illustrationsAtParagraph(media,p,'before').map(image)}
 <Text style={{color:'#fff',fontSize:18,lineHeight:29}}>{splitKlItalics(p,chapter.season_number,chapter.episode_number).flatMap(run=>dictionary.split(run.text).map(part=>({...part,italic:run.italic}))).map((part,j)=><Text key={j} style={[part.italic&&{fontStyle:'italic'},part.term&&{color:'#e5c891',textDecorationLine:'underline',fontWeight:'700'}]} onPress={part.term?()=>setOpenTerm(part.term):undefined}>{part.text}</Text>)}</Text>
 {illustrationsAtParagraph(media,p,'after').map(image)}
 </View>)}
 {text?<><KlReadingQuiz key={chapter.id} episodeId={chapter.id}/><KlLiveDiscussion episodeId={chapter.id} live={true}/></>:null}
 </View>:<View style={{gap:12}}>
 {chapterRows.map(c=><Pressable key={c.id} onPress={()=>void open(c)} style={{padding:12,backgroundColor:'#243849',borderRadius:8}}>
 <Text style={{color:'#fff'}}>Kabanata {c.episode_number}: {c.title}</Text></Pressable>)}
 {!chapterRows.length?<Text style={{color:'#d6c8ad'}}>Wala pang inilalabas na kabanata sa seryeng ito.</Text>:null}
 {isAdmin?adminRows.map(row=><View key={row.id} style={{gap:8,padding:12,borderRadius:8,backgroundColor:'#16262a'}}>
 <Text style={{color:'#fff',fontWeight:'700'}}>Ch{row.episode_number} · {row.title} · {row.status}</Text>
 <Pressable accessibilityRole="button" onPress={()=>setAdminPreview(adminPreview===row.id?null:row.id)}><Text style={{color:'#f1d39b'}}>Private preview</Text></Pressable>
 {adminPreview===row.id?<KlAdminPreview episodeId={row.id} season={row.season_number} chapter={row.episode_number} onApproved={()=>void refresh()}/>:null}
 {!isKlChapterReleased(row)?<>
 <Pressable disabled={adminBusy} onPress={()=>void chapterAction(row,'approve')}><Text style={{color:'#f1d39b'}}>Approve</Text></Pressable>
 <Pressable disabled={adminBusy||row.status!=='approved'} onPress={()=>void chapterAction(row,'quiz')}><Text style={{color:'#f1d39b'}}>Prepare / retry reading quiz</Text></Pressable>
 <Pressable disabled={adminBusy||!currentSeries.published||klReleaseBlockers(row).length>0} onPress={()=>void chapterAction(row,'release')}><Text style={{color:'#f1d39b'}}>{adminConfirm===row.id?'Confirm release':'Release chapter'}</Text></Pressable>
 <TextInput value={rejectNotes} onChangeText={setRejectNotes} placeholder="Rejection reason (5+ characters)" placeholderTextColor="#aaa" style={{color:'#fff',borderColor:'#718096',borderWidth:1,padding:9}}/>
 <Pressable disabled={adminBusy||rejectNotes.trim().length<5} onPress={()=>void chapterAction(row,'reject')}><Text style={{color:'#f1d39b'}}>Reject to draft</Text></Pressable>
 </>:null}
 </View>):null}
 </View>}
 <Modal visible={!!term} transparent animationType="fade" onRequestClose={()=>setOpenTerm(null)}>
 <Pressable onPress={()=>setOpenTerm(null)} style={{flex:1,backgroundColor:'#0009',justifyContent:'flex-end',padding:16}}>
 <Pressable onPress={()=>undefined} style={{backgroundColor:'#16262a',padding:18,borderRadius:14,gap:8}}>
 <Text style={{color:'#f6dfb0',fontSize:20,fontWeight:'800'}}>{term?.name}</Text><Text style={{color:'#d6c8ad'}}>{term?.kind}</Text><Text style={{color:'#fff',fontSize:17}}>{term?.meaning}</Text>
 <Pressable onPress={()=>setOpenTerm(null)}><Text style={{color:'#f1d39b'}}>Isara</Text></Pressable>
 </Pressable></Pressable></Modal>
 {message?<Text accessibilityRole="alert" style={{color:'#fff'}}>{message}</Text>:null}
 </View>;
}
