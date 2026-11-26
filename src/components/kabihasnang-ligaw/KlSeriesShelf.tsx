import React, {useCallback,useEffect,useRef,useState} from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import KlCoverImage from './KlCoverImage';

export type KlSeries = {season_number:number; title:string; cover_path:string|null; published:boolean};
const FALLBACK:KlSeries={season_number:1,title:'Ang Lupang Hindi Namamatay',cover_path:null,published:true};
const BUCKET='kl-series-covers';
export function parseKlSeries(value:unknown):KlSeries[]{
 if(!Array.isArray(value))return [];
 const seen=new Set<number>();
 return value.flatMap((x:unknown)=>{
  if(!x||typeof x!=='object')return [];
  const r=x as Record<string,unknown>, n=Number(r.season_number);
  if(!Number.isInteger(n)||n<1||n>12||seen.has(n)||typeof r.title!=='string'||!r.title.trim()||typeof r.published!=='boolean')return [];
  seen.add(n);return [{season_number:n,title:r.title,cover_path:typeof r.cover_path==='string'&&r.cover_path.startsWith(n+'/')?r.cover_path:null,published:r.published}];
 }).sort((a,b)=>a.season_number-b.season_number);
}
export function useKlSeries(admin=false){
 const [rows,setRows]=useState<KlSeries[]>([]);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const sequence=useRef(0);
 const reload=useCallback(async()=>{
  const id=++sequence.current;setLoading(true);
  try{
   const {data,error}=await supabase.rpc('kl_series_list_v1',{p_admin:admin});
   if(id!==sequence.current)return;
   if(error||!Array.isArray(data))throw Error(error?.message??'Series catalog unavailable');
   setRows(parseKlSeries(data).filter(r=>admin||r.published));setError('');
  }catch(e){if(id===sequence.current)setError(e instanceof Error?e.message:'Series catalog unavailable');}
  finally{if(id===sequence.current)setLoading(false);}
 },[admin]);
 useFocusEffect(useCallback(()=>{void reload();return()=>{sequence.current++;};},[reload]));
 return {rows,error,loading,reload};
}
function SeriesCover({row}:{row:KlSeries}){
 const [signed,setSigned]=useState<{path:string;url:string}|null>(null);
 useEffect(()=>{
  let alive=true;
  if(row.cover_path)void supabase.storage.from(BUCKET).createSignedUrl(row.cover_path,3600).then(r=>{
   if(alive&&r.data?.signedUrl)setSigned({path:row.cover_path!,url:r.data.signedUrl});
  },()=>undefined);
  return()=>{alive=false;};
 },[row.cover_path]);
 return signed?.path===row.cover_path&&signed?.url?
  <Image accessibilityLabel={row.title+' cover'} source={{uri:signed.url}} contentFit="contain" cachePolicy="memory-disk" style={{width:'100%',aspectRatio:3/4,backgroundColor:'#142226'}}/>:
  row.season_number===1?<KlCoverImage variant="series" lowBandwidth={false}/>:
  <View style={{width:'100%',aspectRatio:3/4,backgroundColor:'#243849',justifyContent:'center',padding:12}}>
   <Text style={{color:'#f1d39b',fontSize:20,fontWeight:'800',textAlign:'center'}}>{row.title}</Text>
  </View>;
}
export function KlSeriesShelf({onOpen,isAdmin=false}:{onOpen:(row:KlSeries)=>void;isAdmin?:boolean}){
 const {rows,error,loading,reload}=useKlSeries(isAdmin);
 // Series 1 is the existing released catalog; no future placeholder or auto-create.
 const visible=rows.length?rows:[FALLBACK];
 return <View style={{gap:12}}>
  <Text style={{fontSize:27,fontWeight:'800',color:'#f6dfb0'}}>Kabihasnang Ligaw</Text>
  <Text style={{color:'#d6c8ad'}}>Piliin ang seryeng nais basahin.</Text>
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>
   {visible.map(row=><Pressable key={row.season_number} accessibilityRole="button" accessibilityLabel={'Serye '+row.season_number+': '+row.title} onPress={()=>onOpen(row)} style={{width:'47%',flexGrow:1,maxWidth:350,backgroundColor:'#16262a',borderRadius:12,overflow:'hidden'}}>
    <SeriesCover row={row}/>
    <View style={{padding:10,gap:4}}>
     <Text style={{color:'#e5c891',fontSize:12,fontWeight:'700'}}>SERYE {row.season_number}{!row.published?' · PRIVATE DRAFT':''}</Text>
     <Text style={{color:'#fff4df',fontSize:17,fontWeight:'800'}}>{row.title}</Text>
     <Text style={{color:'#d6c8ad'}}>Buksan ang mga kabanata</Text>
    </View>
   </Pressable>)}
  </View>
  {loading?<Text style={{color:'#d6c8ad'}}>Kinukuha ang mga serye…</Text>:null}
  {error?<Text style={{color:'#d6c8ad'}}>Hindi ma-refresh ang catalog. Available pa rin ang Unang Serye.</Text>:null}
  <Pressable accessibilityRole="button" onPress={()=>void reload()}><Text style={{color:'#f1d39b'}}>I-refresh ang mga serye</Text></Pressable>
 </View>;
}

const field={borderColor:'#718096',borderWidth:1,borderRadius:9,color:'#fff',padding:12} as const;
export function KlSeriesAdmin({disabled=false,onSelect}:{disabled?:boolean;onSelect?:(n:number)=>void}){
 const {rows,error,loading,reload}=useKlSeries(true);
 const [number,setNumber]=useState('2'),[title,setTitle]=useState(''),[cover,setCover]=useState<string|null>(null),[preview,setPreview]=useState<string|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[confirm,setConfirm]=useState(false);
 const lock=useRef(false);
 const selected=rows.find(r=>r.season_number===Number(number));
 const run=async(work:()=>Promise<void>)=>{if(lock.current||disabled)return;lock.current=true;setBusy(true);setMessage('');try{await work();}catch(e){setMessage(e instanceof Error?e.message:'Hindi nakumpleto ang series action.');}finally{lock.current=false;setBusy(false);}};
 const season=()=>{const n=Number(number);if(!Number.isInteger(n)||n<1||n>12||title.trim().length<3||title.trim().length>250)throw Error('Series 1–12 at title na 3–250 characters ang kailangan.');return n;};
 const save=async(publish:boolean,path=cover)=>{
  const n=season();
  const r=await supabase.rpc('kl_series_save_v1',{p_season:n,p_title:title.trim(),p_cover_path:path,p_publish:publish});
  if(r.error||!r.data)throw Error(r.error?.message??'Hindi nakumpirma ang save.');
  setCover(r.data.cover_path??null);setConfirm(false);setMessage(r.data.published?'Nasa public bookshelf na ang serye.':'Na-save ang private series draft.');
  onSelect?.(n);await reload();
 };
 const upload=()=>void run(async()=>{
  const n=season();
  if(!selected)throw Error('I-save muna ang private series bago mag-upload ng cover.');
  const picked=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:false,base64:true,quality:0.85});
  if(picked.canceled)return;
  const asset=picked.assets[0],mime=asset.mimeType??'image/jpeg';
  const ext:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
  if(!asset.base64||!ext[mime])throw Error('JPEG, PNG o WebP lamang.');
  if(Math.ceil(asset.base64.length*3/4)>5242880)throw Error('Hanggang 5 MB ang cover.');
  const path=n+'/'+Date.now()+'-'+Math.random().toString(36).slice(2)+'.'+ext[mime];
  const result=await supabase.storage.from(BUCKET).upload(path,decode(asset.base64),{contentType:mime,upsert:false});
  if(result.error)throw Error(result.error.message);
  // Store immediately; retry save with the same path if the network is interrupted.
  setCover(path);setPreview(asset.uri);await save(false,path);
 });
 const button=(label:string,fn:()=>void,off=false)=><Pressable accessibilityRole="button" disabled={disabled||busy||off} onPress={fn} style={{alignSelf:'flex-start',backgroundColor:disabled||busy||off?'#45505d':'#385c55',borderRadius:9,padding:12}}><Text style={{color:'#ffe0a8',fontWeight:'700'}}>{label}</Text></Pressable>;
 return <View style={{gap:10,borderWidth:1,borderColor:'#718096',borderRadius:12,padding:12}}>
  <Text style={{fontSize:19,color:'#f1d39b',fontWeight:'800'}}>Series Management</Text>
  <Text style={{color:'#fff'}}>Ang bagong serye ay private hanggang piliin mo ang Publish Series. Hiwalay pa rin ang chapter approval at release.</Text>
  {rows.map(r=><Pressable key={r.season_number} disabled={disabled||busy} onPress={()=>{setNumber(String(r.season_number));setTitle(r.title);setCover(r.cover_path);setPreview(null);setConfirm(false);onSelect?.(r.season_number);}}><Text style={{color:'#f1d39b'}}>S{r.season_number} · {r.title} · {r.published?'PUBLIC':'DRAFT'}</Text></Pressable>)}
  {button('New series',()=>{const n=Array.from({length:12},(_,i)=>i+1).find(i=>!rows.some(r=>r.season_number===i));if(!n){setMessage('Naabot ang 12 series.');return;}setNumber(String(n));setTitle('');setCover(null);setPreview(null);setConfirm(false);})}
  <TextInput value={number} editable={!disabled&&!busy} keyboardType="numeric" style={field} placeholder="Series number" placeholderTextColor="#aaa" onChangeText={n=>{setNumber(n);const r=rows.find(x=>String(x.season_number)===n);setTitle(r?.title??'');setCover(r?.cover_path??null);setPreview(null);setConfirm(false);}}/>
  <TextInput value={title} editable={!disabled&&!busy} style={field} placeholder="Series title" placeholderTextColor="#aaa" onChangeText={t=>{setTitle(t);setConfirm(false);}}/>
  {preview?<Image source={{uri:preview}} contentFit="contain" style={{width:'100%',aspectRatio:3/4,maxHeight:260}}/>:selected?<SeriesCover row={selected}/>:null}
  {button('Save series',()=>void run(()=>save(false)))}
  {button('Upload cover photo',upload,!selected)}
  {!selected?.published?button(confirm?'Confirm publish series':'Publish series',()=>{if(!confirm){setConfirm(true);return;}void run(()=>save(true));},!selected||!cover):null}
  {button('Refresh series',()=>void reload())}
  {loading?<Text style={{color:'#ddd'}}>Loading series…</Text>:null}
  {message||error?<Text accessibilityRole="alert" style={{color:'#fff'}}>{message||error}</Text>:null}
 </View>;
}
