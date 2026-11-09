import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AdminGate } from '@/components/AdminGate';
import {
  listBuklodMusicAdminTracks, uploadBuklodAdminMusic, deleteBuklodAdminMusic,
  validateBuklodMusicFile, updateBuklodAdminMusicCategory, type BuklodMusicAdminTrack,
} from '@/lib/buklodMusicAdmin';
import {BUKLOD_MUSIC_CATEGORIES,BUKLOD_MUSIC_PAGE_SIZE,buklodMusicCategoryLabel,type BuklodMusicCategory,type BuklodMusicFolder} from '@/lib/buklodMusicCategories';

const accent='#215c43', border='#dce7e0';
const MAX_MUSIC_FILES_PER_BATCH=20;
type MusicDraft={
  key:string;asset:DocumentPicker.DocumentPickerAsset;
  title:string;artist:string;category:BuklodMusicCategory;error:string|null;
};
const sizeOf=(asset:DocumentPicker.DocumentPickerAsset)=>
  Number(asset.size??asset.file?.size??0);
const assetSignature=(asset:DocumentPicker.DocumentPickerAsset)=>
  [asset.uri,asset.name,sizeOf(asset)].join('|');
const inferredTitle=(name:string)=>
  name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').trim().slice(0,160);
export default function AdminMusicLibrary(){
  const [tracks,setTracks]=useState<BuklodMusicAdminTrack[]>([]);
  const [picked,setPicked]=useState<MusicDraft[]>([]);
  const [folder,setFolder]=useState<BuklodMusicFolder>('all');
  const [batchCategory,setBatchCategory]=useState<BuklodMusicCategory>('others');
  const [search,setSearch]=useState('');
  const [hasMore,setHasMore]=useState(false);
  const [loadingMore,setLoadingMore]=useState(false);
  const [editingCategoryId,setEditingCategoryId]=useState<string|null>(null);
  const catalogEpochRef=useRef(0);
  const pageBusyRef=useRef(false);
  const [pickerBusy,setPickerBusy]=useState(false);
  const uploadInFlight=useRef(false);
  const pickerInFlight=useRef(false);
  const nextDraftId=useRef(0);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [pendingDeleteId,setPendingDeleteId]=useState<string|null>(null);
  const [status,setStatus]=useState('');
  const [error,setError]=useState('');
  const refresh=useCallback(async()=>{
    const epoch=++catalogEpochRef.current;
    setLoading(true);
    try{
      const rows=await listBuklodMusicAdminTracks({folder,search,offset:0,pageSize:BUKLOD_MUSIC_PAGE_SIZE});
      if(epoch!==catalogEpochRef.current)return;
      setTracks(rows);setHasMore(rows.length===BUKLOD_MUSIC_PAGE_SIZE);
    }catch(e:any){
      if(epoch===catalogEpochRef.current)setError(String(e?.message??'Music library unavailable.'));
    }finally{if(epoch===catalogEpochRef.current)setLoading(false);}
  },[folder,search]);
  useEffect(()=>{
    const timer=setTimeout(()=>{void refresh();},search?250:0);
    return()=>{clearTimeout(timer);catalogEpochRef.current++;};
  },[refresh,search]);
  const loadMore=async()=>{
    if(loading||loadingMore||pageBusyRef.current||!hasMore)return;
    pageBusyRef.current=true;
    const epoch=catalogEpochRef.current;
    setLoadingMore(true);
    try{
      const rows=await listBuklodMusicAdminTracks({folder,search,offset:tracks.length,pageSize:BUKLOD_MUSIC_PAGE_SIZE});
      if(epoch!==catalogEpochRef.current)return;
      setTracks(current=>{
        const ids=new Set(current.map(x=>x.id));
        return [...current,...rows.filter(row=>!ids.has(row.id))];
      });
      setHasMore(rows.length===BUKLOD_MUSIC_PAGE_SIZE);
    }catch(e:any){
      if(epoch===catalogEpochRef.current)setError(String(e?.message??'Could not load more audio.'));
    }finally{pageBusyRef.current=false;setLoadingMore(false);}
  };
  const moveToFolder=async(track:BuklodMusicAdminTrack,category:BuklodMusicCategory)=>{
    if(busy)return;
    setBusy(true);setError('');
    try{
      await updateBuklodAdminMusicCategory(track.id,category);
      setStatus('Moved '+track.title+' to '+buklodMusicCategoryLabel(category)+'.');
      setEditingCategoryId(null);
      await refresh();
    }catch(e:any){setError(String(e?.message??'Could not move track.'));}
    finally{setBusy(false);}
  };
  const folderChip=(id:BuklodMusicFolder,label:string,selected:boolean,onPress:()=>void)=>(
    <Pressable key={id} accessibilityRole="button" accessibilityState={{selected}}
      onPress={onPress} style={{borderRadius:20,paddingHorizontal:12,paddingVertical:9,
        marginRight:6,backgroundColor:selected?accent:'#edf3ee'}}>
      <Text style={{fontSize:12,fontWeight:'800',color:selected?'#fff':accent}}>{label}</Text>
    </Pressable>
  );
  const choose=async()=>{
    if(busy||uploadInFlight.current||pickerInFlight.current)return;
    pickerInFlight.current=true;
    setPickerBusy(true);
    setError('');setStatus('');
    try{
      // Multiple selection is initiated by a real tap, including on mobile web.
      const result=await DocumentPicker.getDocumentAsync({
        type:'audio/*',copyToCacheDirectory:true,multiple:true,
      });
      if(result.canceled||!result.assets?.length)return;
      const signatures=new Set(picked.map(item=>assetSignature(item.asset)));
      const available=Math.max(0,MAX_MUSIC_FILES_PER_BATCH-picked.length);
      const added:MusicDraft[]=[];
      const rejected:string[]=[];
      for(const asset of result.assets){
        if(added.length>=available){
          rejected.push('Batch limit: '+MAX_MUSIC_FILES_PER_BATCH+' files. Publish selected files first.');
          break;
        }
        try{
          validateBuklodMusicFile(asset.name,sizeOf(asset));
          const signature=assetSignature(asset);
          if(signatures.has(signature))continue;
          signatures.add(signature);
          added.push({
            key:'draft-'+(++nextDraftId.current),asset,
            title:inferredTitle(asset.name),artist:'',category:batchCategory,error:null,
          });
        }catch(e:any){
          rejected.push(asset.name+': '+String(e?.message??'Invalid audio file.'));
        }
      }
      if(added.length)setPicked(current=>[...current,...added]);
      if(rejected.length)setError(rejected.slice(0,3).join('\n')+
        (rejected.length>3?' · '+(rejected.length-3)+' more rejected.':''));
      else if(added.length)setStatus(added.length+' file(s) added. Check their titles before publishing.');
    }catch(e:any){setError(String(e?.message??'Unable to select audio.'));}
    finally{pickerInFlight.current=false;setPickerBusy(false);}
  };
  const updateDraft=<K extends 'title'|'artist'|'category'>(key:string,field:K,value:MusicDraft[K])=>{
    setPicked(current=>current.map(item=>item.key===key?
      {...item,[field]:value,error:null}:item));
  };
  const upload=async()=>{
    if(!picked.length||pickerBusy||busy||uploadInFlight.current)return;
    uploadInFlight.current=true;
    setBusy(true);setError('');
    const queue=[...picked];
    let published=0;
    const failures:string[]=[];
    try{
      for(let i=0;i<queue.length;i++){
        const item=queue[i];
        setStatus('Publishing '+(i+1)+' / '+queue.length+': '+item.asset.name+'…');
        if(!item.title.trim()){
          const message='Enter a song title.';
          failures.push(item.asset.name+': '+message);
          setPicked(current=>current.map(row=>row.key===item.key?
            {...row,error:message}:row));
          continue;
        }
        try{
          // Sequential, bounded uploads avoid exhausting phone memory/network.
          // Successful entries leave the queue immediately; retries never
          // accidentally republish already completed files.
          await uploadBuklodAdminMusic({
            asset:item.asset,title:item.title,artist:item.artist,category:item.category,
          });
          published++;
          setPicked(current=>current.filter(row=>row.key!==item.key));
        }catch(e:any){
          const message=String(e?.message??'Upload failed.');
          failures.push(item.asset.name+': '+message);
          setPicked(current=>current.map(row=>row.key===item.key?
            {...row,error:message}:row));
          if(/System Admin authorization required/i.test(message))break;
        }
      }
      setStatus('Published '+published+' / '+queue.length+
        ' selected song(s). '+(failures.length?'Failed files remain below for retry.':
          'Available in the BUKLOD music picker now.'));
      if(failures.length)setError(failures.slice(0,3).join('\n')+
        (failures.length>3?' · '+(failures.length-3)+' more errors.':''));
      if(published)await refresh();
    }finally{uploadInFlight.current=false;setBusy(false);}
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
          <Text style={{fontSize:17,fontWeight:'800',color:'#153d2c'}}>Add music to folder</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow:0}}>
            {BUKLOD_MUSIC_CATEGORIES.map(c=>folderChip(c.id,c.label,batchCategory===c.id,()=>setBatchCategory(c.id)))}
          </ScrollView>
          <Text style={{fontSize:11,color:'#60776b'}}>Choose a folder for this batch, then adjust individual songs below.</Text>
          <Text style={{fontSize:12,color:'#60776b'}}>
            MP3, M4A, AAC, WAV and OGG • up to 25 MB • upload audio you own or are licensed to share.
          </Text>
          <Pressable onPress={()=>void choose()} disabled={busy||pickerBusy||picked.length>=MAX_MUSIC_FILES_PER_BATCH}
            accessibilityRole="button" accessibilityLabel="Choose multiple audio files"
            style={{borderWidth:1,borderColor:accent,borderRadius:12,padding:13,alignItems:'center',
              opacity:busy||pickerBusy?0.5:1}}>
            <Text style={{color:accent,fontWeight:'800'}}>
              {pickerBusy?'Opening files…':picked.length?'Add more audio files':'Choose multiple audio files'}
            </Text>
          </Pressable>
          {!!picked.length&&(
            <View style={{gap:9}}>
              <Text style={{fontSize:12,fontWeight:'800',color:accent}}>
                {picked.length} / {MAX_MUSIC_FILES_PER_BATCH} selected · Edit each song before publishing
              </Text>
              {picked.map((item,index)=>(
                <View key={item.key} style={{padding:10,borderWidth:1,borderColor:item.error?'#d99c98':border,
                  borderRadius:12,gap:8,backgroundColor:'#f8fbf9'}}>
                  <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
                    <MaterialCommunityIcons name="music-note" size={18} color={accent}/>
                    <Text numberOfLines={2} style={{flex:1,color:'#395d49',fontSize:12,fontWeight:'700'}}>
                      {index+1}. {item.asset.name} · {(sizeOf(item.asset)/1048576).toFixed(1)} MB
                    </Text>
                    <Pressable accessibilityRole="button" accessibilityLabel={'Remove selected '+item.asset.name}
                      disabled={busy} onPress={()=>setPicked(current=>current.filter(row=>row.key!==item.key))}
                      style={{padding:6}}>
                      <MaterialCommunityIcons name="close-circle-outline" size={21} color="#a24646"/>
                    </Pressable>
                  </View>
                  <TextInput value={item.title} onChangeText={value=>updateDraft(item.key,'title',value)}
                    placeholder="Song / audio title" accessibilityLabel={'Music title for '+item.asset.name}
                    maxLength={160} editable={!busy}
                    style={{borderWidth:1,borderColor:border,borderRadius:10,paddingHorizontal:12,
                      minHeight:43,color:'#142d24',backgroundColor:'#fff'}}/>
                  <TextInput value={item.artist} onChangeText={value=>updateDraft(item.key,'artist',value)}
                    placeholder="Artist / source (optional)" accessibilityLabel={'Music artist for '+item.asset.name}
                    maxLength={160} editable={!busy}
                    style={{borderWidth:1,borderColor:border,borderRadius:10,paddingHorizontal:12,
                      minHeight:43,color:'#142d24',backgroundColor:'#fff'}}/>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow:0}}>
                    {BUKLOD_MUSIC_CATEGORIES.map(c=>folderChip(c.id,c.label,item.category===c.id,()=>updateDraft(item.key,'category',c.id)))}
                  </ScrollView>
                  {!!item.error&&<Text accessibilityRole="alert" style={{fontSize:11,color:'#a63232'}}>
                    {item.error} · Correct the entry and retry.
                  </Text>}
                </View>
              ))}
            </View>
          )}
          <Pressable disabled={!picked.length||busy||pickerBusy} accessibilityRole="button"
            accessibilityLabel={'Upload and publish '+picked.length+' music files'}
            onPress={()=>void upload()}
            style={{borderRadius:12,padding:14,alignItems:'center',
              backgroundColor:!picked.length||busy||pickerBusy?'#b5c4bb':accent}}>
            <Text style={{color:'#fff',fontWeight:'900'}}>
              {busy?'Publishing music…':picked.length===1?'Upload and publish song':
                'Upload and publish '+picked.length+' songs'}
            </Text>
          </Pressable>
        </View>
        {!!status&&<Text accessibilityRole="text" style={{color:accent,fontWeight:'700'}}>{status}</Text>}
        {!!error&&<Text accessibilityRole="alert" style={{color:'#ad302c',fontWeight:'700'}}>{error}</Text>}
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
          <Text style={{fontSize:17,fontWeight:'900',color:'#153d2c'}}>Library · showing {tracks.length} tracks</Text>
          <Pressable onPress={()=>void refresh()} accessibilityRole="button" style={{padding:9}}>
            <Text style={{color:accent,fontWeight:'800'}}>Refresh</Text>
          </Pressable>
        </View>
        <TextInput value={search} onChangeText={setSearch} placeholder="Search titles or artists"
          accessibilityLabel="Search admin music" autoCapitalize="none"
          style={{borderWidth:1,borderColor:border,borderRadius:12,
            paddingHorizontal:12,minHeight:44,backgroundColor:'#fff'}}/>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow:0}}>
          {folderChip('all','All Music',folder==='all',()=>setFolder('all'))}
          {BUKLOD_MUSIC_CATEGORIES.map(c=>folderChip(c.id,c.label,folder===c.id,()=>setFolder(c.id)))}
        </ScrollView>
        {loading&&<ActivityIndicator color={accent}/>}
        {!loading&&tracks.length===0&&<Text style={{color:'#5d7468'}}>No music tracks yet.</Text>}
        {tracks.map(track=>(
          <View key={track.id} style={{borderWidth:1,borderColor:border,borderRadius:13,backgroundColor:'#fff',
            padding:13,gap:5}}>
            <Text style={{color:'#193d2b',fontWeight:'800'}}>{track.title}</Text>
            <Text style={{color:'#64796f',fontSize:12}}>{track.artist||'BUKLOD Music'} • {buklodMusicCategoryLabel(track.category)} • {track.is_active?'Published':'Hidden / cleanup pending'}</Text>
            <Pressable accessibilityRole="button" disabled={busy}
              onPress={()=>setEditingCategoryId(current=>current===track.id?null:track.id)}>
              <Text style={{fontSize:12,fontWeight:'800',color:accent}}>Move to folder</Text>
            </Pressable>
            {editingCategoryId===track.id&&<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow:0}}>
              {BUKLOD_MUSIC_CATEGORIES.map(c=>folderChip(c.id,c.label,track.category===c.id,()=>void moveToFolder(track,c.id)))}
            </ScrollView>}
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
        {loadingMore&&<ActivityIndicator color={accent}/>}
        {hasMore&&!loadingMore&&<Pressable accessibilityRole="button"
          onPress={()=>void loadMore()} style={{padding:12,alignItems:'center',
            backgroundColor:'#fff',borderRadius:12}}>
          <Text style={{color:accent,fontWeight:'800'}}>Load more music</Text>
        </Pressable>}
      </ScrollView>
    </AdminGate>
  );
}
