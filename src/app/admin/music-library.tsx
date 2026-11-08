import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AdminGate } from '@/components/AdminGate';
import {
  listBuklodMusicAdminTracks, uploadBuklodAdminMusic, deleteBuklodAdminMusic,
  validateBuklodMusicFile, type BuklodMusicAdminTrack,
} from '@/lib/buklodMusicAdmin';

const accent='#215c43', border='#dce7e0';
export default function AdminMusicLibrary(){
  const [tracks,setTracks]=useState<BuklodMusicAdminTrack[]>([]);
  const [picked,setPicked]=useState<DocumentPicker.DocumentPickerAsset|null>(null);
  const [title,setTitle]=useState('');
  const [artist,setArtist]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [pendingDeleteId,setPendingDeleteId]=useState<string|null>(null);
  const [status,setStatus]=useState('');
  const [error,setError]=useState('');
  const refresh=useCallback(async()=>{
    try{
      const rows=await listBuklodMusicAdminTracks();
      setTracks(rows);
    }catch(e:any){setError(String(e?.message??'Music library not available.'));}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void refresh();},[refresh]);
  const choose=async()=>{
    if(busy)return;
    setError('');setStatus('');
    try{
      // Must be initiated by a real tap (especially in web browsers).
      const result=await DocumentPicker.getDocumentAsync({
        type:'audio/*',copyToCacheDirectory:true,multiple:false,
      });
      if(result.canceled||!result.assets?.length)return;
      const file=result.assets[0];
      validateBuklodMusicFile(file.name,Number(file.size??0));
      setPicked(file);
      setTitle(file.name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').slice(0,160));
    }catch(e:any){setError(String(e?.message??'Unable to select audio.'));}
  };
  const upload=async()=>{
    if(!picked||busy)return;
    setBusy(true);setError('');setStatus('Uploading and publishing music…');
    try{
      const saved=await uploadBuklodAdminMusic({asset:picked,title,artist});
      setPicked(null);setTitle('');setArtist('');
      setStatus('Published: '+saved.title+'. Available in the BUKLOD Music picker now.');
      await refresh();
    }catch(e:any){setStatus('');setError(String(e?.message??'Music upload failed.'));}
    finally{setBusy(false);}
  };
  const remove=async(track:BuklodMusicAdminTrack)=>{
    if(busy)return;
    if(pendingDeleteId!==track.id){setPendingDeleteId(track.id);return;}
    setBusy(true);setError('');setStatus('Removing '+track.title+'…');
    try{
      await deleteBuklodAdminMusic(track);
      setStatus('Deleted: '+track.title);
      setPendingDeleteId(null);
    }catch(e:any){setStatus('');setError(String(e?.message??'Delete failed.'));}
    finally{await refresh();setBusy(false);}
  };
  return (
    <AdminGate>
      <ScrollView keyboardShouldPersistTaps="handled"
        contentContainerStyle={{padding:16,paddingBottom:56,gap:14,backgroundColor:'#f5f8f6',flexGrow:1}}>
        <Pressable onPress={()=>router.back()} accessibilityRole="button"
          style={{flexDirection:'row',alignItems:'center',gap:6,paddingVertical:5}}>
          <MaterialCommunityIcons name="arrow-left" color={accent} size={23}/>
          <Text style={{color:accent,fontWeight:'800'}}>Back to System Admin</Text>
        </Pressable>
        <Text style={{fontSize:24,fontWeight:'900',color:'#153d2c'}}>Music Library</Text>
        <Text style={{color:'#536c60',lineHeight:20}}>
          Upload or delete approved music for BUKLOD posts. Published tracks are available in Wall's music picker immediately—no separate music OTA needed.
        </Text>
        <View style={{padding:16,borderWidth:1,borderColor:border,borderRadius:18,backgroundColor:'#fff',gap:10}}>
          <Text style={{fontSize:17,fontWeight:'800',color:'#153d2c'}}>Add music</Text>
          <Text style={{fontSize:12,color:'#60776b'}}>
            MP3, M4A, AAC, WAV and OGG • up to 25 MB • upload audio you own or are licensed to share.
          </Text>
          <Pressable onPress={()=>void choose()} disabled={busy} accessibilityRole="button"
            style={{borderWidth:1,borderColor:accent,borderRadius:12,padding:13,alignItems:'center'}}>
            <Text style={{color:accent,fontWeight:'800'}}>{picked?'Change audio file':'Choose audio file'}</Text>
          </Pressable>
          {!!picked&&<Text numberOfLines={2} style={{color:'#395d49',fontSize:12}}>{picked.name} • {(Number(picked.size??0)/1048576).toFixed(1)} MB</Text>}
          <TextInput value={title} onChangeText={setTitle} placeholder="Song / audio title"
            accessibilityLabel="Music title" maxLength={160}
            style={{borderWidth:1,borderColor:border,borderRadius:12,paddingHorizontal:12,minHeight:46,color:'#142d24'}}/>
          <TextInput value={artist} onChangeText={setArtist} placeholder="Artist / source (optional)"
            accessibilityLabel="Music artist" maxLength={160}
            style={{borderWidth:1,borderColor:border,borderRadius:12,paddingHorizontal:12,minHeight:46,color:'#142d24'}}/>
          <Pressable disabled={!picked||!title.trim()||busy} accessibilityRole="button"
            onPress={()=>void upload()}
            style={{borderRadius:12,padding:14,alignItems:'center',
              backgroundColor:!picked||!title.trim()||busy?'#b5c4bb':accent}}>
            <Text style={{color:'#fff',fontWeight:'900'}}>{busy?'Working…':'Upload and publish now'}</Text>
          </Pressable>
        </View>
        {!!status&&<Text accessibilityRole="text" style={{color:accent,fontWeight:'700'}}>{status}</Text>}
        {!!error&&<Text accessibilityRole="alert" style={{color:'#ad302c',fontWeight:'700'}}>{error}</Text>}
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
          <Text style={{fontSize:17,fontWeight:'900',color:'#153d2c'}}>Library ({tracks.filter(x=>x.is_active).length} active)</Text>
          <Pressable onPress={()=>void refresh()} accessibilityRole="button" style={{padding:9}}>
            <Text style={{color:accent,fontWeight:'800'}}>Refresh</Text>
          </Pressable>
        </View>
        {loading&&<ActivityIndicator color={accent}/>}
        {!loading&&tracks.length===0&&<Text style={{color:'#5d7468'}}>No music tracks yet.</Text>}
        {tracks.map(track=>(
          <View key={track.id} style={{borderWidth:1,borderColor:border,borderRadius:13,backgroundColor:'#fff',
            padding:13,gap:5}}>
            <Text style={{color:'#193d2b',fontWeight:'800'}}>{track.title}</Text>
            <Text style={{color:'#64796f',fontSize:12}}>{track.artist||'BUKLOD Music'} • {track.is_active?'Published':'Hidden / cleanup pending'}</Text>
            {pendingDeleteId===track.id&&<Text style={{color:'#973b2c',fontSize:12}}>
              Confirm permanent deletion. Existing posts using this track will lose their music, but their photos and text remain.
            </Text>}
            <View style={{flexDirection:'row',justifyContent:'flex-end',gap:10}}>
              {pendingDeleteId===track.id&&(
                <Pressable onPress={()=>setPendingDeleteId(null)} accessibilityRole="button" style={{padding:9}}>
                  <Text style={{color:accent,fontWeight:'800'}}>Cancel</Text>
                </Pressable>
              )}
              <Pressable disabled={busy} onPress={()=>void remove(track)} accessibilityRole="button"
                accessibilityLabel={(pendingDeleteId===track.id?'Confirm delete ':'Delete ')+track.title}
                style={{padding:9}}>
                <Text style={{color:'#a63232',fontWeight:'800'}}>
                  {pendingDeleteId===track.id?'Confirm delete':'Delete'}
                </Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </AdminGate>
  );
}
