import React, { useEffect, useState } from 'react';
import BuklodMusicClipTimeline from '@/components/BuklodMusicClipTimeline';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listBuklodPostMusic, type BuklodPostMusicTrack } from '@/lib/buklodPostCreatives';

type Props={
  visible:boolean; selectedId?:string|null; previewId?:string|null;
  previewPlaying?:boolean; previewDurationSeconds?:number; clipStartSeconds:number; clipDurationSeconds:number;
  onClipChange:(startSeconds:number,durationSeconds:number)=>void;
  onSelect:(track:BuklodPostMusicTrack|null,startSeconds:number,durationSeconds:number)=>void;
  onPreview:(track:BuklodPostMusicTrack,startSeconds:number,durationSeconds:number)=>void;
  onClose:()=>void;
};
export default function BuklodPostMusicPicker({
  visible,selectedId,previewId,previewPlaying,previewDurationSeconds,clipStartSeconds,clipDurationSeconds,onClipChange,onSelect,onPreview,onClose,
}:Props) {
  const insets=useSafeAreaInsets();
  const [search,setSearch]=useState('');
  const [tracks,setTracks]=useState<BuklodPostMusicTrack[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [clipStartText,setClipStartText]=useState(String(clipStartSeconds));
  const [clipDurationText,setClipDurationText]=useState(String(clipDurationSeconds));
  const [preciseTimingOpen,setPreciseTimingOpen]=useState(false);
  useEffect(() => {
    if (visible) {
      setClipStartText(String(clipStartSeconds));
      setClipDurationText(String(clipDurationSeconds));
    }
  }, [visible]);
  const readClip=():[number,number]=>{
    const start=Number(clipStartText),duration=Number(clipDurationText);
    return [
      Number.isFinite(start)?Math.max(0,Math.min(21600,Math.round(start))):0,
      Number.isFinite(duration)?Math.max(5,Math.min(60,Math.round(duration))):30,
    ];
  };
  const commitClip=():[number,number]=>{
    const [start,duration]=readClip();
    setClipStartText(String(start));setClipDurationText(String(duration));
    onClipChange(start,duration);
    return [start,duration];
  };
  useEffect(()=>{
    if(!visible)return;
    let cancelled=false;
    setLoading(true);setError('');
    const timer=setTimeout(()=>{
      void listBuklodPostMusic(search).then(data=>{
        if(!cancelled)setTracks(data);
      }).catch(e=>{
        if(!cancelled)setError(String(e?.message ?? 'Music library unavailable.'));
      }).finally(()=>{if(!cancelled)setLoading(false);});
    },search?300:0);
    return()=>{cancelled=true;clearTimeout(timer);};
  },[visible,search]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{flex:1,backgroundColor:'rgba(5,20,18,.65)',
        alignItems:'center',justifyContent:'center',paddingHorizontal:14,
        paddingTop:Math.max(insets.top,12),paddingBottom:Math.max(insets.bottom,12)}}>
        <View style={{width:'100%',maxWidth:580,maxHeight:'94%',borderRadius:20,
          backgroundColor:'#fff',padding:16}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:9,marginBottom:10}}>
            <MaterialCommunityIcons name="music-circle-outline" size={25} color="#195d47" />
            <Text style={{flex:1,fontSize:17,fontWeight:'900',color:'#183c31'}}>BUKLOD Music</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close music picker" onPress={onClose}>
              <MaterialCommunityIcons name="close" size={24} color="#41574f"/>
            </Pressable>
          </View>
          <Text style={{color:'#61756d',fontSize:12,marginBottom:9}}>
            Select licensed BUKLOD music and choose which 5–60 second section plays with the post.
          </Text>
          <TextInput value={search} onChangeText={setSearch} placeholder="Search song title"
            accessibilityLabel="Search music library" autoCapitalize="none"
            style={{minHeight:44,borderWidth:1,borderColor:'#d5e1da',borderRadius:12,
              paddingHorizontal:12,marginBottom:10,color:'#183c31'}}/>
          <View style={{padding:10,borderWidth:1,borderColor:'#CEE4D7',borderRadius:12,backgroundColor:'#F0FAF4',marginBottom:9}}>
            <Text style={{fontSize:12,fontWeight:'900',color:'#195d47',marginBottom:6}}>Song segment for this post</Text>
            <Text style={{fontSize:11,color:'#527366',marginBottom:8}}>Drag the green window to choose the part of the song. Move either edge to change its length (5–60 seconds).</Text>
            <BuklodMusicClipTimeline start={Number(clipStartText)||0} length={Number(clipDurationText)||30}
              total={previewDurationSeconds&&previewDurationSeconds>0?previewDurationSeconds:Math.max(120,(Number(clipStartText)||0)+90)}
              onChange={(start,duration)=>{setClipStartText(String(start));setClipDurationText(String(duration));onClipChange(start,duration);}}/>
            <View style={{flexDirection:'row',alignItems:'center',gap:8,marginTop:8,marginBottom:6}}>
              <Pressable accessibilityRole="button" accessibilityLabel="Shorten music clip by five seconds"
                onPress={()=>{const [start,duration]=readClip();const n=Math.max(5,duration-5);setClipDurationText(String(n));onClipChange(start,n);}}
                style={{backgroundColor:'#DDEFE5',padding:8,borderRadius:8}}><Text style={{color:'#145C41',fontWeight:'900'}}>−5s</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Lengthen music clip by five seconds"
                onPress={()=>{const [start,duration]=readClip();const n=Math.min(60,duration+5);setClipDurationText(String(n));onClipChange(start,n);}}
                style={{backgroundColor:'#DDEFE5',padding:8,borderRadius:8}}><Text style={{color:'#145C41',fontWeight:'900'}}>+5s</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={()=>setPreciseTimingOpen(v=>!v)} style={{marginLeft:'auto',padding:8}}>
                <Text style={{color:'#145C41',fontWeight:'800'}}>{preciseTimingOpen?'Hide exact timing':'Exact seconds'}</Text></Pressable>
            </View>
            {preciseTimingOpen&&<View style={{flexDirection:'row',gap:10,alignItems:'center'}}>
              <View style={{flex:1}}>
                <Text style={{fontSize:11,color:'#527366'}}>Start at (seconds)</Text>
                <TextInput accessibilityLabel="Song clip start time in seconds" value={clipStartText}
                  onChangeText={v=>setClipStartText(v.replace(/[^\d]/g,''))}
                  keyboardType="number-pad" selectTextOnFocus
                  style={{borderColor:'#B6D4C4',borderWidth:1,borderRadius:8,padding:8,color:'#173c2d'}}/>
              </View>
              <View style={{flex:1}}>
                <Text style={{fontSize:11,color:'#527366'}}>Length (5–60 sec)</Text>
                <TextInput accessibilityLabel="Song clip duration in seconds" value={clipDurationText}
                  onChangeText={v=>setClipDurationText(v.replace(/[^\d]/g,''))}
                  keyboardType="number-pad" selectTextOnFocus
                  style={{borderColor:'#B6D4C4',borderWidth:1,borderRadius:8,padding:8,color:'#173c2d'}}/>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Apply music segment"
                onPress={()=>{commitClip();}}
                style={{padding:9,borderRadius:9,backgroundColor:'#195d47',alignSelf:'flex-end'}}>
                <Text style={{color:'#fff',fontWeight:'800'}}>Set</Text>
              </Pressable>
            </View>
            </View>}
            <Text style={{fontSize:10,color:'#527366',marginTop:5}}>
              Preview plays the chosen section. Full audio is not copied into your post.
            </Text>
          </View>
          {loading && <ActivityIndicator color="#195d47"/>}
          {!!error && <Text style={{color:'#b43a2b',marginBottom:8}}>{error}</Text>}
          <FlatList data={tracks} keyExtractor={item=>item.id}
            keyboardShouldPersistTaps="handled" style={{flexGrow:0}}
            ListEmptyComponent={!loading&&!error?<Text style={{textAlign:'center',padding:20,color:'#6a7d75'}}>No approved tracks found.</Text>:null}
            renderItem={({item})=>(
              <View style={{flexDirection:'row',alignItems:'center',paddingVertical:9,gap:9,
                borderBottomWidth:1,borderBottomColor:'#edf1ed'}}>
                <Pressable accessibilityRole="button"
                  accessibilityLabel={(previewId===item.id&&previewPlaying?'Pause':'Preview')+' '+item.title}
                  onPress={()=>{const [start,duration]=commitClip();onPreview(item,start,duration);}}
                  style={{width:42,height:42,borderRadius:21,backgroundColor:'#e7f4ef',
                    justifyContent:'center',alignItems:'center'}}>
                  <MaterialCommunityIcons name={previewId===item.id&&previewPlaying?'pause':'play'} size={22} color="#1c6049"/>
                </Pressable>
                <View style={{flex:1,minWidth:0}}>
                  <Text numberOfLines={1} style={{color:'#193d31',fontWeight:'800'}}>{item.title}</Text>
                  <Text numberOfLines={1} style={{color:'#678075',fontSize:11}}>{item.artist||'BUKLOD Music'}</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={'Use '+item.title}
                  onPress={()=>{const [start,duration]=commitClip();onSelect(item,start,duration);onClose();}}
                  style={{paddingVertical:9,paddingHorizontal:12,borderRadius:12,
                    backgroundColor:selectedId===item.id?'#dcebe4':'#1c6049'}}>
                  <Text style={{color:selectedId===item.id?'#1c6049':'#fff',fontWeight:'800'}}>
                    {selectedId===item.id?'Selected':'Use'}
                  </Text>
                </Pressable>
              </View>
            )}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Remove post music"
            onPress={()=>{onSelect(null,0,30);onClose();}} style={{alignSelf:'center',padding:12}}>
            <Text style={{color:'#405d50',fontWeight:'700'}}>No music / Remove</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
