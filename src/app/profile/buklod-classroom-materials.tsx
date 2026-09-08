import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { ClassroomVideoPlayer } from '@/components/classroom/ClassroomVideoPlayer';
import { createClassroomSignedUrl, saveClassroomFileToDevice, uploadClassroomObject } from '@/lib/education/classroomTransfer';
import { supabase } from '@/lib/supabase';

const BUCKET = 'buklod-classroom';
const MAX_BYTES = 1024 * 1024 * 1024;

type Context = { role: 'FACULTY' | 'STUDENT' };
type FileRow = { id: string; owner_user_id: string; file_kind: 'FILE'|'PHOTO'|'VIDEO'|'AUDIO'|'LINK'; storage_bucket: string; storage_path: string|null; original_name: string|null; mime_type: string|null; file_size: number|null; external_url: string|null; caption: string|null; created_at: string };
type PickedFile = { uri: string; name: string; mimeType?: string|null; size?: number|null };

function fileIcon(kind: FileRow['file_kind']) {
  if (kind === 'PHOTO') return 'image-outline';
  if (kind === 'VIDEO') return 'video-outline';
  if (kind === 'AUDIO') return 'music-note-outline';
  if (kind === 'LINK') return 'link-variant';
  return 'file-document-outline';
}

export default function BuklodClassroomMaterialsScreen() {
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const classroomId = String(params.id ?? '');
  const classroomName = String(params.name ?? 'Classroom');
  const [context, setContext] = useState<Context|null>(null);
  const [rows, setRows] = useState<FileRow[]>([]);
  const [caption, setCaption] = useState('');
  const [link, setLink] = useState('');
  const [picked, setPicked] = useState<PickedFile|null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [video, setVideo] = useState<{ uri: string; title: string }|null>(null);

  const load = useCallback(async () => {
    if (!classroomId) return;
    const [contextRes, fileRes] = await Promise.all([
      supabase.rpc('buklod_classroom_context_v1', { p_classroom_id: classroomId }),
      supabase.from('buklod_education_classroom_files').select('id,owner_user_id,file_kind,storage_bucket,storage_path,original_name,mime_type,file_size,external_url,caption,created_at').eq('classroom_id', classroomId).eq('entity_type','MATERIAL').order('created_at',{ascending:false}),
    ]);
    if (contextRes.error) return Alert.alert('Class Materials', contextRes.error.message);
    if (fileRes.error) return Alert.alert('Class Materials', fileRes.error.message);
    setContext(contextRes.data as Context); setRows((fileRes.data ?? []) as FileRow[]);
  }, [classroomId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const accept = (file: PickedFile) => {
    if (file.size && file.size > MAX_BYTES) return Alert.alert('File Too Large','Classroom private storage accepts up to 1 GB per object.');
    setPicked(file);
  };
  const chooseDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type:'*/*', multiple:false, copyToCacheDirectory:true });
    if (!result.canceled && result.assets[0]) { const a=result.assets[0]; accept({uri:a.uri,name:a.name,mimeType:a.mimeType,size:a.size}); }
  };
  const chooseMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes:['images','videos'], quality:1 });
    if (!result.canceled && result.assets[0]) { const a=result.assets[0]; accept({uri:a.uri,name:a.fileName || `classroom-${Date.now()}`,mimeType:a.mimeType,size:a.fileSize}); }
  };
  const capture = async (videoMode=false) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert('Camera','Camera permission is required for direct Classroom evidence capture.');
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: videoMode ? ['videos'] : ['images'], quality:0.9, videoMaxDuration:300 });
    if (!result.canceled && result.assets[0]) { const a=result.assets[0]; accept({uri:a.uri,name:a.fileName || `${videoMode?'video':'photo'}-${Date.now()}`,mimeType:a.mimeType,size:a.fileSize}); }
  };

  const upload = async () => {
    if (!picked || busy) return; setBusy(true); setProgress(0);
    let path='';
    try {
      const { data: auth } = await supabase.auth.getUser(); const uid=auth.user?.id; if(!uid) throw new Error('Please sign in again.');
      const safeName=picked.name.replace(/[^a-zA-Z0-9._-]+/g,'_').slice(-120); path=`${classroomId}/${uid}/material/${Date.now()}_${safeName}`;
      const transfer=await uploadClassroomObject({uri:picked.uri,bucket:BUCKET,path,name:picked.name,mimeType:picked.mimeType,size:picked.size,onProgress:p=>setProgress(p.percent)});
      const kind:FileRow['file_kind']=picked.mimeType?.startsWith('image/')?'PHOTO':picked.mimeType?.startsWith('video/')?'VIDEO':picked.mimeType?.startsWith('audio/')?'AUDIO':'FILE';
      const { error }=await supabase.from('buklod_education_classroom_files').insert({classroom_id:classroomId,owner_user_id:uid,entity_type:'MATERIAL',file_kind:kind,storage_bucket:BUCKET,storage_path:path,original_name:picked.name,mime_type:picked.mimeType??null,file_size:transfer.size,caption:caption.trim()||null});
      if(error){await supabase.storage.from(BUCKET).remove([path]);throw error;}
      setPicked(null); setCaption(''); setProgress(0); await load(); Alert.alert('Uploaded',transfer.resumable?'Material uploaded with resumable transfer.':'Material uploaded.');
    } catch(error){Alert.alert('Upload Material',error instanceof Error?error.message:'Upload failed.');} finally{setBusy(false);}
  };

  const addLink = async () => {
    const url=link.trim(); if(!url) return; if(!/^https?:\/\//i.test(url)) return Alert.alert('Class Link','Enter a complete http:// or https:// link.');
    const {data:auth}=await supabase.auth.getUser(); const uid=auth.user?.id; if(!uid)return;
    const {error}=await supabase.from('buklod_education_classroom_files').insert({classroom_id:classroomId,owner_user_id:uid,entity_type:'MATERIAL',file_kind:'LINK',external_url:url,caption:caption.trim()||url});
    if(error)return Alert.alert('Class Link',error.message); setLink('');setCaption('');await load();
  };

  const open = async (row:FileRow) => {
    if(row.external_url)return Linking.openURL(row.external_url); if(!row.storage_path)return;
    try { const url=await createClassroomSignedUrl(row.storage_bucket||BUCKET,row.storage_path,900); if(row.file_kind==='VIDEO'){setVideo({uri:url,title:row.caption||row.original_name||'Class video'});return;} await Linking.openURL(url); }
    catch(error){Alert.alert('Material',error instanceof Error?error.message:'Could not open material.');}
  };
  const save = async(row:FileRow)=>{ if(!row.storage_path)return; try{const result=await saveClassroomFileToDevice({bucket:row.storage_bucket||BUCKET,path:row.storage_path,fileName:row.original_name||'classroom-file',mimeType:row.mime_type,fileSize:row.file_size});Alert.alert('Saved',result.mode==='media-library'?'Saved to device media library.':'Save/share destination opened.');}catch(error){Alert.alert('Save File',error instanceof Error?error.message:'Could not save file.');}};
  const remove=(row:FileRow)=>{if(context?.role!=='FACULTY')return;Alert.alert('Delete Material',`Delete ${row.caption||row.original_name||'this material'}?`,[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:async()=>{if(row.storage_path)await supabase.storage.from(row.storage_bucket||BUCKET).remove([row.storage_path]);const{error}=await supabase.from('buklod_education_classroom_files').delete().eq('id',row.id);if(error)return Alert.alert('Delete Material',error.message);await load();}}]);};
  const isFaculty=context?.role==='FACULTY';

  return <View style={{flex:1}}>
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async()=>{setRefreshing(true);await load();setRefreshing(false);}}/>}>
      <Pressable style={styles.back} onPress={()=>router.back()}><MaterialCommunityIcons name="arrow-left" size={22} color="#17311f"/><Text style={styles.backText}>{classroomName}</Text></Pressable>
      <Text style={styles.eyebrow}>MATERIALS & MEDIA</Text><Text style={styles.title}>Class Resources</Text><Text style={styles.subtitle}>Private files, native photo/video capture, secure playback, resumable transfer and device save.</Text>
      {isFaculty&&<View style={styles.uploadCard}><Text style={styles.cardTitle}>Share Material</Text><TextInput value={caption} onChangeText={setCaption} placeholder="Title / caption" style={styles.input}/>
        <View style={styles.actionRow}><Pressable style={styles.action} onPress={chooseDocument}><MaterialCommunityIcons name="file-upload-outline" size={19} color="#1f7a3f"/><Text style={styles.actionText}>File</Text></Pressable><Pressable style={styles.action} onPress={chooseMedia}><MaterialCommunityIcons name="image-multiple-outline" size={19} color="#1f7a3f"/><Text style={styles.actionText}>Media</Text></Pressable><Pressable style={styles.action} onPress={()=>capture(false)}><MaterialCommunityIcons name="camera-outline" size={19} color="#1f7a3f"/><Text style={styles.actionText}>Photo</Text></Pressable><Pressable style={styles.action} onPress={()=>capture(true)}><MaterialCommunityIcons name="video-outline" size={19} color="#1f7a3f"/><Text style={styles.actionText}>Video</Text></Pressable></View>
        {!!picked&&<><Text style={styles.picked}>{picked.name}</Text><Pressable disabled={busy} style={[styles.primary,busy&&styles.disabled]} onPress={upload}><Text style={styles.primaryText}>{busy?`Uploading ${progress}%`:'Upload to Classroom'}</Text></Pressable></>}
        <View style={styles.divider}/><TextInput value={link} onChangeText={setLink} placeholder="https:// learning resource" autoCapitalize="none" style={styles.input}/><Pressable style={styles.secondary} onPress={addLink}><Text style={styles.secondaryText}>Add Learning Link</Text></Pressable><Text style={styles.help}>Files above 6 MB use 6 MB resumable chunks; retrying the same upload resumes safely instead of creating a duplicate object.</Text></View>}
      {rows.length===0?<View style={styles.empty}><Text style={styles.emptyText}>No class material yet.</Text></View>:rows.map(row=><View key={row.id} style={styles.card}><Pressable style={styles.openArea} onPress={()=>open(row)} onLongPress={()=>remove(row)}><View style={styles.iconWrap}><MaterialCommunityIcons name={fileIcon(row.file_kind) as any} size={25} color="#1f7a3f"/></View><View style={{flex:1}}><Text style={styles.materialTitle}>{row.caption||row.original_name||(row.file_kind==='LINK'?'Learning link':'Class material')}</Text><Text style={styles.materialMeta}>{row.file_kind}{row.file_size?` • ${(Number(row.file_size)/1024/1024).toFixed(1)} MB`:''}</Text><Text style={styles.fileName}>{row.original_name||''}</Text></View></Pressable>{row.storage_path&&<Pressable style={styles.saveButton} onPress={()=>save(row)}><MaterialCommunityIcons name="download-outline" size={20} color="#1f7a3f"/></Pressable>}</View>)}
    </ScrollView>{video&&<ClassroomVideoPlayer uri={video.uri} title={video.title} onClose={()=>setVideo(null)}/>}</View>;
}

const styles=StyleSheet.create({screen:{flex:1,backgroundColor:'#f3f6f2'},content:{padding:20,paddingTop:43,paddingBottom:80},back:{flexDirection:'row',alignItems:'center',gap:7,marginBottom:15},backText:{color:'#17311f',fontWeight:'900'},eyebrow:{color:'#1f7a3f',fontSize:10,fontWeight:'900',letterSpacing:1.1},title:{color:'#17311f',fontSize:28,fontWeight:'900'},subtitle:{color:'#6d7970',lineHeight:19,marginTop:4,marginBottom:15},uploadCard:{backgroundColor:'#fff',borderRadius:19,padding:15,marginBottom:15},cardTitle:{color:'#283a2f',fontWeight:'900',fontSize:16,marginBottom:9},input:{backgroundColor:'#f2f5f2',borderRadius:11,paddingHorizontal:12,paddingVertical:10,color:'#26382d',marginBottom:8},actionRow:{flexDirection:'row',gap:6,marginBottom:8},action:{flex:1,backgroundColor:'#edf5ee',borderRadius:10,paddingVertical:9,alignItems:'center'},actionText:{color:'#1f7a3f',fontSize:9,fontWeight:'900',marginTop:2},picked:{color:'#526159',fontSize:11,fontWeight:'800',marginBottom:7},primary:{backgroundColor:'#1f7a3f',borderRadius:11,paddingVertical:11,alignItems:'center'},primaryText:{color:'#fff',fontWeight:'900'},secondary:{backgroundColor:'#e7ede8',borderRadius:11,paddingVertical:10,alignItems:'center'},secondaryText:{color:'#405249',fontWeight:'900'},disabled:{opacity:.45},divider:{height:1,backgroundColor:'#e4eae5',marginVertical:11},help:{color:'#7c877f',fontSize:9,lineHeight:14,marginTop:9},empty:{backgroundColor:'#fff',borderRadius:16,padding:18},emptyText:{color:'#718077'},card:{backgroundColor:'#fff',borderRadius:17,padding:10,marginBottom:9,flexDirection:'row',alignItems:'center'},openArea:{flex:1,flexDirection:'row',alignItems:'center',gap:11},iconWrap:{width:45,height:45,borderRadius:14,backgroundColor:'#e7f4e9',alignItems:'center',justifyContent:'center'},materialTitle:{color:'#2a3c31',fontWeight:'900'},materialMeta:{color:'#748178',fontSize:10,marginTop:3},fileName:{color:'#89928c',fontSize:9,marginTop:2},saveButton:{padding:10}});
