import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listBuklodPostMusic, type BuklodPostMusicTrack } from '@/lib/buklodPostCreatives';

type Props={
  visible:boolean; selectedId?:string|null; previewId?:string|null;
  previewPlaying?:boolean; onSelect:(track:BuklodPostMusicTrack|null)=>void;
  onPreview:(track:BuklodPostMusicTrack)=>void; onClose:()=>void;
};
export default function BuklodPostMusicPicker({
  visible,selectedId,previewId,previewPlaying,onSelect,onPreview,onClose,
}:Props) {
  const insets=useSafeAreaInsets();
  const [search,setSearch]=useState('');
  const [tracks,setTracks]=useState<BuklodPostMusicTrack[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
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
            Select approved music. Playback only starts when someone taps Play.
          </Text>
          <TextInput value={search} onChangeText={setSearch} placeholder="Search song title"
            accessibilityLabel="Search music library" autoCapitalize="none"
            style={{minHeight:44,borderWidth:1,borderColor:'#d5e1da',borderRadius:12,
              paddingHorizontal:12,marginBottom:10,color:'#183c31'}}/>
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
                  onPress={()=>onPreview(item)}
                  style={{width:42,height:42,borderRadius:21,backgroundColor:'#e7f4ef',
                    justifyContent:'center',alignItems:'center'}}>
                  <MaterialCommunityIcons name={previewId===item.id&&previewPlaying?'pause':'play'} size={22} color="#1c6049"/>
                </Pressable>
                <View style={{flex:1,minWidth:0}}>
                  <Text numberOfLines={1} style={{color:'#193d31',fontWeight:'800'}}>{item.title}</Text>
                  <Text numberOfLines={1} style={{color:'#678075',fontSize:11}}>{item.artist||'BUKLOD Music'}</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={'Use '+item.title}
                  onPress={()=>{onSelect(item);onClose();}}
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
            onPress={()=>{onSelect(null);onClose();}} style={{alignSelf:'center',padding:12}}>
            <Text style={{color:'#405d50',fontWeight:'700'}}>No music / Remove</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
