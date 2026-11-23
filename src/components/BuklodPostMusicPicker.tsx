import React,{useEffect,useMemo,useRef,useState} from 'react';
import BuklodMusicClipTimeline from '@/components/BuklodMusicClipTimeline';
import BuklodMusicVideoMixPreview from '@/components/BuklodMusicVideoMixPreview';
import {ActivityIndicator,FlatList,Modal,PanResponder,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {listBuklodPostMusic,type BuklodPostMusicTrack} from '@/lib/buklodPostCreatives';
import {BUKLOD_MUSIC_CATEGORIES,BUKLOD_MUSIC_PAGE_SIZE,type BuklodMusicFolder} from '@/lib/buklodMusicCategories';

type Props={
 visible:boolean;selectedId?:string|null;selectedTrack?:BuklodPostMusicTrack|null;previewId?:string|null;
 previewPlaying?:boolean;previewDurationSeconds?:number;clipStartSeconds:number; clipDurationSeconds:number;
 onClipChange:(startSeconds:number,durationSeconds:number)=>void;
 onSelect:(track:BuklodPostMusicTrack|null,startSeconds:number,durationSeconds:number)=>void;
 onPreview:(track:BuklodPostMusicTrack,startSeconds:number,durationSeconds:number)=>void;
 onScrub:(track:BuklodPostMusicTrack,startSeconds:number,durationSeconds:number)=>void;
 musicVolume:number;videoVolume:number;videoPreviewUri?:string|null;
 onVolumeChange:(musicVolume:number,videoVolume:number)=>void;
 onClose:()=>void;
};
function AudioMixSlider({label,value,onChange}:{label:string;value:number;onChange:(volume:number)=>void}){
 const [width,setWidth]=useState(240);
 const widthRef=useRef(width);widthRef.current=width;
 const callbackRef=useRef(onChange);callbackRef.current=onChange;
 const updateRef=useRef((v:number)=>{});
 updateRef.current=(next:number)=>callbackRef.current(Math.round(Math.max(0,Math.min(1,next))*100)/100);
 const starting=useRef(value);
 const pan=useMemo(()=>PanResponder.create({
  onStartShouldSetPanResponder:()=>true,onMoveShouldSetPanResponder:()=>true,
  onPanResponderGrant:e=>{
   starting.current=Math.max(0,Math.min(1,(Number(e.nativeEvent.locationX)||0)/Math.max(1,widthRef.current)));
   updateRef.current(starting.current);
  },
  onPanResponderMove:(_,gesture)=>updateRef.current(starting.current+gesture.dx/Math.max(1,widthRef.current)),
 }),[]);
 return <View style={{marginTop:7}}>
   <View style={{flexDirection:'row',justifyContent:'space-between'}}>
    <Text style={{fontSize:12,fontWeight:'800',color:'#234a3b'}}>{label}</Text>
    <Text style={{fontSize:12,fontWeight:'900',color:'#195d47'}}>{Math.round(value*100)}%</Text>
   </View>
   <View accessibilityRole="adjustable" accessibilityLabel={label+' volume'}
    accessibilityValue={{min:0,max:100,now:Math.round(value*100)}}
    accessibilityActions={[{name:'increment'},{name:'decrement'}]}
    onAccessibilityAction={e=>updateRef.current(value+(e.nativeEvent.actionName==='increment'?0.1:-0.1))}
    onLayout={e=>setWidth(Math.max(1,e.nativeEvent.layout.width))}
    {...pan.panHandlers}
    style={{height:28,justifyContent:'center'}}>
     <View pointerEvents="none" style={{height:8,borderRadius:5,backgroundColor:'#d7e6dd',overflow:'hidden'}}>
      <View style={{height:'100%',width:(Math.round(value*100)+'%') as any,backgroundColor:'#1b6b50'}}/>
     </View>
     <View pointerEvents="none" style={{position:'absolute',left:(Math.round(value*100)+'%') as any,
      width:22,height:22,borderRadius:11,marginLeft:-11,backgroundColor:'#fff',borderWidth:3,borderColor:'#1b6b50'}}/>
   </View>
 </View>;
}
export default function BuklodPostMusicPicker({
 visible,selectedId,selectedTrack,previewId,previewPlaying,previewDurationSeconds,
 clipStartSeconds,clipDurationSeconds,onClipChange,onSelect,onPreview,onScrub,
 musicVolume,videoVolume,videoPreviewUri,onVolumeChange,onClose,
}:Props){
 const insets=useSafeAreaInsets();
 const [search,setSearch]=useState('');
 const [folder,setFolder]=useState<BuklodMusicFolder>('all');
 const [tracks,setTracks]=useState<BuklodPostMusicTrack[]>([]);
 const [activeTrack,setActiveTrack]=useState<BuklodPostMusicTrack|null>(null);
 const [loading,setLoading]=useState(false);
 const [loadingMore,setLoadingMore]=useState(false);
 const [hasMore,setHasMore]=useState(false);
 const [error,setError]=useState('');
 const [clipStartText,setClipStartText]=useState(String(clipStartSeconds));
 const [preciseTimingOpen,setPreciseTimingOpen]=useState(false);
 const [mixerOpen,setMixerOpen]=useState(false);
 const requestId=useRef(0);
 const moreInFlight=useRef(false);
 useEffect(()=>{
   if(!visible){requestId.current++;setActiveTrack(null);setMixerOpen(false);return;}
   setClipStartText(String(clipStartSeconds));
 },[visible]);
 useEffect(()=>{
   if(!visible)return;
   const token=++requestId.current;
   setLoading(true);setError('');setTracks([]);setHasMore(false);
   const timer=setTimeout(()=>{
     void listBuklodPostMusic(search,folder,0,BUKLOD_MUSIC_PAGE_SIZE).then(rows=>{
       if(token!==requestId.current)return;
       setTracks(rows);setHasMore(rows.length===BUKLOD_MUSIC_PAGE_SIZE);
     }).catch(e=>{
       if(token===requestId.current)setError(String(e?.message??'Music library unavailable.'));
     }).finally(()=>{if(token===requestId.current)setLoading(false);});
   },search?250:0);
   return()=>{requestId.current++;clearTimeout(timer);};
 },[visible,search,folder]);
 const more=async()=>{
   if(!visible||loading||loadingMore||moreInFlight.current||!hasMore)return;
   moreInFlight.current=true;setLoadingMore(true);
   const token=requestId.current;
   try{
     const rows=await listBuklodPostMusic(search,folder,tracks.length,BUKLOD_MUSIC_PAGE_SIZE);
     if(token!==requestId.current)return;
     setTracks(current=>{
       const ids=new Set(current.map(x=>x.id));
       return [...current,...rows.filter(row=>!ids.has(row.id))];
     });
     setHasMore(rows.length===BUKLOD_MUSIC_PAGE_SIZE);
   }catch(e:any){
     if(token===requestId.current)setError(String(e?.message??'Could not load more music.'));
   }finally{moreInFlight.current=false;setLoadingMore(false);}
 };
 const currentTrack=activeTrack??selectedTrack??tracks.find(x=>x.id===previewId)??null;
 const knownDuration=previewId===currentTrack?.id&&Number(previewDurationSeconds)>0?
   Number(previewDurationSeconds):0;
 const readClip=():[number,number]=>{
   const n=Number(clipStartText);
   return [Number.isFinite(n)?Math.max(0,Math.min(
     knownDuration>0?Math.max(0,Math.floor(knownDuration)-30):21600,Math.round(n))):0,30];
 };
 const commitClip=():[number,number]=>{
   const [start,duration]=readClip();setClipStartText(String(start));onClipChange(start,duration);
   return [start,duration];
 };
 const chip=(id:BuklodMusicFolder,label:string)=>(
   <Pressable key={id} onPress={()=>setFolder(id)} accessibilityRole="button"
     accessibilityState={{selected:folder===id}} style={{borderRadius:20,paddingVertical:7,
       paddingHorizontal:14,marginRight:7,backgroundColor:folder===id?'#195d47':'#eff4f0'}}>
     <Text style={{color:folder===id?'#fff':'#285844',fontWeight:'800',fontSize:12}}>{label}</Text>
   </Pressable>
 );
 return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
   <View style={{flex:1,backgroundColor:'rgba(5,20,18,.65)',alignItems:'center',
     justifyContent:'center',paddingHorizontal:14,paddingTop:Math.max(insets.top,12),
     paddingBottom:Math.max(insets.bottom,12)}}>
     <View style={{width:'100%',maxWidth:580,borderRadius:20,
       backgroundColor:'#fff',padding:12,height:'96%',maxHeight:920,minHeight:0}}>
       <View style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:5}}>
         <MaterialCommunityIcons name="music-circle-outline" size={25} color="#195d47"/>
         <Text style={{flex:1,fontSize:16,fontWeight:'900',color:'#183c31'}}>BUKLOD Music</Text>
         <Pressable accessibilityRole="button" accessibilityLabel="Close music picker" onPress={onClose}>
           <MaterialCommunityIcons name="close" size={24} color="#41574f"/>
         </Pressable>
       </View>
       <Text style={{color:'#61756d',fontSize:11,marginBottom:6}}>
         Choose music, then drag the 30-second bar to preview any part.
       </Text>
       <TextInput value={search} onChangeText={setSearch} placeholder="Search songs or artists"
         accessibilityLabel="Search music library" autoCapitalize="none"
         style={{minHeight:40,borderWidth:1,borderColor:'#d5e1da',
           borderRadius:12,paddingHorizontal:12,marginBottom:6,color:'#183c31'}}/>
       <ScrollView horizontal showsHorizontalScrollIndicator={false}
         keyboardShouldPersistTaps="always" style={{flexGrow:0,height:38,maxHeight:38,marginBottom:5}}>
         {chip('all','All Music')}
         {BUKLOD_MUSIC_CATEGORIES.map(c=>chip(c.id,c.label))}
       </ScrollView>
       <View style={{padding:8,borderWidth:1,borderColor:'#CEE4D7',borderRadius:12,
         backgroundColor:'#F0FAF4',marginBottom:6}}>
         <Text style={{fontSize:12,fontWeight:'900',color:'#195d47',marginBottom:3}}>
           Song segment for this post
         </Text>
         <Text style={{fontSize:10,color:'#527366',marginBottom:4}}>
           Move the green selection or tap the waveform; use the 5s controls for precision.
         </Text>
         <BuklodMusicClipTimeline start={Number(clipStartText)||0} length={30} fixedLength={30}
           total={knownDuration||Math.max(120,(Number(clipStartText)||0)+90)}
           onChange={start=>{setClipStartText(String(start));onClipChange(start,30);}}
           onScrub={start=>{if(currentTrack)onScrub(currentTrack,start,30);}}/>
         <Pressable accessibilityRole="button" onPress={()=>setPreciseTimingOpen(v=>!v)}
           style={{alignSelf:'flex-end',paddingVertical:3,paddingHorizontal:6}}>
           <Text style={{color:'#145C41',fontWeight:'800'}}>
             {preciseTimingOpen?'Hide exact timing':'Exact seconds'}
           </Text>
         </Pressable>
         {preciseTimingOpen&&<View style={{flexDirection:'row',gap:10,alignItems:'center'}}>
           <View style={{flex:1}}>
             <Text style={{fontSize:11,color:'#527366'}}>Start at (seconds)</Text>
             <TextInput accessibilityLabel="Song clip start time in seconds" value={clipStartText}
               onChangeText={v=>setClipStartText(v.replace(/[^\d]/g,''))}
               keyboardType="number-pad" selectTextOnFocus
               style={{borderColor:'#B6D4C4',borderWidth:1,borderRadius:8,
                 padding:8,color:'#173c2d'}}/>
           </View>
           <Pressable accessibilityRole="button" accessibilityLabel="Apply music segment"
             onPress={()=>{const [start]=commitClip();if(currentTrack)onScrub(currentTrack,start,30);}}
             style={{padding:9,borderRadius:9,backgroundColor:'#195d47',alignSelf:'flex-end'}}>
             <Text style={{color:'#fff',fontWeight:'800'}}>Set</Text>
           </Pressable>
         </View>}

       </View>
       {!!currentTrack&&<Pressable accessibilityRole="button" accessibilityLabel="Preview selected 30 second loop"
         onPress={()=>{const [start]=commitClip();onPreview(currentTrack,start,30);}}
         style={{backgroundColor:'#dcefe5',borderRadius:10,padding:7,
           alignItems:'center',marginBottom:5}}>
         <Text style={{fontWeight:'800',color:'#195d47'}}>
           {previewId===currentTrack.id&&previewPlaying?'Pause preview':'▶ Preview selected 30s loop'}
         </Text>
       </Pressable>}
       {!!currentTrack&&<View style={{borderWidth:1,borderColor:'#d5e7dc',borderRadius:10,
         paddingHorizontal:9,paddingVertical:5,marginBottom:5}}>
         <Pressable accessibilityRole="button" accessibilityLabel="Adjust video and music volume"
           onPress={()=>setMixerOpen(v=>!v)} style={{flexDirection:'row',justifyContent:'space-between',minHeight:31,alignItems:'center'}}>
           <Text style={{color:'#195d47',fontSize:12,fontWeight:'900'}}>Sound balance · Music {Math.round(musicVolume*100)}%{videoPreviewUri?' · Video '+Math.round(videoVolume*100)+'%':''}</Text>
           <MaterialCommunityIcons name={mixerOpen?'chevron-up':'chevron-down'} size={20} color="#195d47"/>
         </Pressable>
         {mixerOpen&&<>
           <AudioMixSlider label="Added music" value={musicVolume}
             onChange={next=>onVolumeChange(next,videoVolume)}/>
           {!!videoPreviewUri&&<>
             <AudioMixSlider label="Original video sound" value={videoVolume}
               onChange={next=>onVolumeChange(musicVolume,next)}/>
             <BuklodMusicVideoMixPreview uri={videoPreviewUri} volume={videoVolume} active={visible}/>
             <Text style={{fontSize:10,color:'#527366'}}>Video and music play together in this preview.</Text>
           </>}
         </>}
       </View>}
       {loading&&<ActivityIndicator color="#195d47"/>}
       {!!error&&<Text accessibilityRole="alert" style={{color:'#b43a2b',marginBottom:8}}>{error}</Text>}
       <FlatList data={tracks} keyExtractor={item=>item.id}
         keyboardShouldPersistTaps="handled" nestedScrollEnabled style={{flex:1,minHeight:170}}
         onEndReachedThreshold={0.45} onEndReached={()=>void more()}
         ListFooterComponent={loadingMore?<ActivityIndicator color="#195d47"/>:
           hasMore?<Pressable accessibilityRole="button" onPress={()=>void more()}
             style={{padding:12,alignItems:'center'}}>
             <Text style={{color:'#195d47'}}>Load more songs</Text>
           </Pressable>:null}
         ListEmptyComponent={!loading&&!error?<Text style={{textAlign:'center',padding:20,color:'#6a7d75'}}>
           No approved tracks in this folder.
         </Text>:null}
         renderItem={({item})=><View style={{flexDirection:'row',alignItems:'center',
           paddingVertical:10,gap:10,borderBottomWidth:1,borderBottomColor:'#edf1ed'}}>
           <Pressable accessibilityRole="button"
             accessibilityLabel={(previewId===item.id&&previewPlaying?'Pause':'Preview')+' '+item.title}
             onPress={()=>{
               const same=currentTrack?.id===item.id;
               setActiveTrack(item);
               const start=same?Number(clipStartText)||0:0;
               if(!same){setClipStartText('0');onClipChange(0,30);}
               onPreview(item,start,30);
             }}
             style={{width:46,height:46,borderRadius:23,backgroundColor:'#e7f4ef',
               justifyContent:'center',alignItems:'center'}}>
             <MaterialCommunityIcons name={previewId===item.id&&previewPlaying?'pause':'play'}
               size={22} color="#1c6049"/>
           </Pressable>
           <View style={{flex:1,minWidth:0}}>
             <Text numberOfLines={1} style={{color:'#193d31',fontWeight:'800'}}>{item.title}</Text>
             <Text numberOfLines={1} style={{color:'#678075',fontSize:11}}>{item.artist||'BUKLOD Music'}</Text>
           </View>
           <Pressable accessibilityRole="button" accessibilityLabel={'Use '+item.title}
             onPress={()=>{
               const same=currentTrack?.id===item.id;
               setActiveTrack(item);
               const start=same?Number(clipStartText)||0:0;
               if(!same){setClipStartText('0');onClipChange(0,30);}
               onPreview(item,start,30);
             }}
             style={{paddingVertical:9,paddingHorizontal:12,borderRadius:12,
               backgroundColor:currentTrack?.id===item.id?'#dcebe4':'#1c6049'}}>
             <Text style={{color:currentTrack?.id===item.id?'#1c6049':'#fff',fontWeight:'800'}}>
               {currentTrack?.id===item.id?'Previewing':'Choose'}
             </Text>
           </Pressable>
         </View>}/>
       {!!currentTrack&&<Pressable accessibilityRole="button" accessibilityLabel="Confirm selected 30 second song segment"
         onPress={()=>{const [start]=commitClip();onSelect(currentTrack,start,30);onClose();}}
         style={{minHeight:44,borderRadius:11,backgroundColor:'#195d47',justifyContent:'center',
           alignItems:'center',marginTop:7}}>
         <Text style={{fontSize:14,fontWeight:'900',color:'#fff'}}>Use this 30s segment ✓</Text>
       </Pressable>}
       <Pressable accessibilityRole="button" accessibilityLabel="Remove post music"
         onPress={()=>{onSelect(null,0,30);onClose();}} style={{alignSelf:'center',padding:7}}>
         <Text style={{color:'#405d50',fontSize:11,fontWeight:'700'}}>No music / Remove</Text>
       </Pressable>
     </View>
   </View>
 </Modal>;
}
