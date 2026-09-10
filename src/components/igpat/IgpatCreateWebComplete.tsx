import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { BUKLOD_REEL_MAX_DURATION_SECONDS, formatVideoBytes, validateCommunityVideoUpload } from '@/lib/buklodCommunityWallMedia';
import IgpatQuickEditPanel, { DEFAULT_IGPAT_QUICK_EDIT, type IgpatQuickEditState } from '@/components/igpat/IgpatQuickEditPanel';
import { uploadIgpatVideoFile } from '@/lib/igpat/uploadIgpatVideoFile';
import { saveIgpatPostMetadata } from '@/lib/igpat/igpatMetadata';
import { saveIgpatDraft, trackIgpatEvent } from '@/lib/igpat/igpatRuntime';

type Audience = 'group' | 'local' | 'public';
type MediaDraft = {
  uri: string;
  durationSeconds: number;
  sizeBytes: number;
  mimeType: string;
  fileName: string;
  objectUrl: boolean;
};

function extensionForMime(mime: string) {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('quicktime')) return 'mov';
  return 'mp4';
}

async function probeVideo(blob: Blob, fileName: string, mimeType: string): Promise<MediaDraft> {
  const uri = URL.createObjectURL(blob);
  try {
    const durationSeconds = await new Promise<number>((resolve, reject) => {
      const video = document.createElement('video');
      const timer = window.setTimeout(() => reject(new Error('Could not read video duration.')), 12000);
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.clearTimeout(timer);
        const value = Number(video.duration);
        if (!Number.isFinite(value) || value <= 0) reject(new Error('Invalid video duration.'));
        else resolve(Math.ceil(value));
      };
      video.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error('This video could not be decoded by the browser.'));
      };
      video.src = uri;
    });
    return {
      uri,
      durationSeconds,
      sizeBytes: blob.size,
      mimeType: mimeType || blob.type || 'video/mp4',
      fileName,
      objectUrl: true,
    };
  } catch (error) {
    URL.revokeObjectURL(uri);
    throw error;
  }
}

function WebPreview({ draft, edit }: { draft: MediaDraft; edit: IgpatQuickEditState }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.playbackRate = edit.speed;
    const onTime = () => {
      const end = edit.trimEndSeconds ?? draft.durationSeconds;
      if (video.currentTime < edit.trimStartSeconds) video.currentTime = edit.trimStartSeconds;
      if (video.currentTime >= end) video.currentTime = edit.trimStartSeconds;
    };
    video.addEventListener('timeupdate', onTime);
    video.currentTime = Math.max(0, edit.trimStartSeconds);
    void video.play().catch(() => undefined);
    return () => video.removeEventListener('timeupdate', onTime);
  }, [draft.durationSeconds, edit.speed, edit.trimEndSeconds, edit.trimStartSeconds]);

  return (
    <View style={styles.previewFrame}>
      {React.createElement('video', {
        ref,
        src: draft.uri,
        controls: true,
        playsInline: true,
        muted: false,
        loop: true,
        style: { width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#030504' },
      })}
      {!!edit.textOverlay && <View pointerEvents="none" style={styles.textOverlay}><Text style={styles.textOverlayText}>{edit.textOverlay}</Text></View>}
    </View>
  );
}

export default function IgpatCreateWebComplete() {
  const { user, profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const hardStopRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);

  const [draft, setDraft] = useState<MediaDraft | null>(null);
  const [caption, setCaption] = useState('');
  const [audience, setAudience] = useState<Audience>('public');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [edit, setEdit] = useState<IgpatQuickEditState>({ ...DEFAULT_IGPAT_QUICK_EDIT });
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    void supabase.from('group_members').select('group_id').eq('user_id', user.id).eq('is_active', true).limit(1).maybeSingle().then(({ data }) => {
      const id = data?.group_id ?? null;
      setGroupId(id);
      if (id) setAudience('group');
    });
  }, [user?.id]);

  const cleanupCamera = () => {
    if (hardStopRef.current != null) window.clearTimeout(hardStopRef.current);
    if (tickRef.current != null) window.clearInterval(tickRef.current);
    hardStopRef.current = null;
    tickRef.current = null;
    for (const track of streamRef.current?.getTracks?.() ?? []) {
      try { track.stop(); } catch {}
    }
    streamRef.current = null;
    setCameraReady(false);
    setRecording(false);
  };

  const clearDraft = () => {
    if (draft?.objectUrl) {
      try { URL.revokeObjectURL(draft.uri); } catch {}
    }
    setDraft(null);
    setEdit({ ...DEFAULT_IGPAT_QUICK_EDIT });
  };

  useEffect(() => () => {
    cleanupCamera();
    if (draft?.objectUrl) {
      try { URL.revokeObjectURL(draft.uri); } catch {}
    }
  }, [draft?.objectUrl, draft?.uri]);

  const acceptDraft = (next: MediaDraft) => {
    if (draft?.objectUrl) {
      try { URL.revokeObjectURL(draft.uri); } catch {}
    }
    setDraft(next);
    setEdit({ ...DEFAULT_IGPAT_QUICK_EDIT, trimEndSeconds: next.durationSeconds });
  };

  const acceptBlob = async (blob: Blob, fileName: string, mimeType: string) => {
    try {
      const next = await probeVideo(blob, fileName, mimeType);
      const validation = validateCommunityVideoUpload({ durationSeconds: next.durationSeconds, sizeBytes: next.sizeBytes, isReel: true });
      if (validation) {
        URL.revokeObjectURL(next.uri);
        Alert.alert('BUKLOD IGPAT', validation);
        return;
      }
      if (next.durationSeconds > BUKLOD_REEL_MAX_DURATION_SECONDS) {
        URL.revokeObjectURL(next.uri);
        Alert.alert('Maximum 60 Seconds', `This video is ${next.durationSeconds} seconds.`);
        return;
      }
      acceptDraft(next);
    } catch (error: any) {
      Alert.alert('Video could not be prepared', String(error?.message ?? error));
    }
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      Alert.alert('Camera unavailable', 'Direct browser recording is not supported here. Use Select Video instead.');
      return;
    }
    try {
      cleanupCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
      streamRef.current = stream;
      setCameraReady(true);
      window.setTimeout(() => {
        if (liveVideoRef.current) {
          liveVideoRef.current.srcObject = stream;
          void liveVideoRef.current.play().catch(() => undefined);
        }
      }, 0);
    } catch (error: any) {
      Alert.alert('Camera permission', String(error?.message ?? 'Camera and microphone permission are required.'));
    }
  };

  const startRecording = async () => {
    if (!streamRef.current) {
      await openCamera();
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      Alert.alert('Recording unavailable', 'This browser does not support MediaRecorder.');
      return;
    }
    const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    const mimeType = candidates.find(x => !MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(x)) ?? 'video/webm';
    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    setRecordSeconds(0);
    recorder.ondataavailable = event => { if (event.data?.size) chunksRef.current.push(event.data); };
    recorder.onerror = () => Alert.alert('Recording failed', 'The browser stopped the recording unexpectedly.');
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      chunksRef.current = [];
      cleanupCamera();
      if (!blob.size) return Alert.alert('BUKLOD IGPAT', 'Recorded video is empty.');
      void acceptBlob(blob, `igpat-${Date.now()}.webm`, 'video/webm');
    };
    recorder.start(750);
    setRecording(true);
    tickRef.current = window.setInterval(() => setRecordSeconds(Math.min(60, Math.floor((Date.now() - startedAtRef.current) / 1000))), 300);
    hardStopRef.current = window.setTimeout(() => {
      try { if (recorder.state === 'recording') recorder.stop(); } catch {}
    }, 60000);
  };

  const stopRecording = () => {
    try { if (recorderRef.current?.state === 'recording') recorderRef.current.stop(); } catch {}
  };

  const effectiveDuration = useMemo(() => {
    if (!draft) return 0;
    return Math.max(1, (edit.trimEndSeconds ?? draft.durationSeconds) - edit.trimStartSeconds);
  }, [draft, edit.trimEndSeconds, edit.trimStartSeconds]);

  const saveLocalDraft = async () => {
    if (!draft) return;
    const now = new Date().toISOString();
    await saveIgpatDraft({
      id: `draft-${Date.now()}`,
      uri: draft.uri,
      caption,
      audience,
      trimStartMs: Math.round(edit.trimStartSeconds * 1000),
      trimEndMs: edit.trimEndSeconds == null ? null : Math.round(edit.trimEndSeconds * 1000),
      speed: edit.speed,
      textOverlay: edit.textOverlay,
      captionsEnabled: edit.captionsEnabled,
      audioLabel: edit.audioLabel,
      createdAt: now,
      updatedAt: now,
    });
    Alert.alert('Draft saved', 'Draft metadata is saved on this device.');
  };

  const publish = async () => {
    if (!user?.id || !draft || busy) return;
    if (audience === 'group' && !groupId) return Alert.alert('BUKLOD IGPAT', 'You do not have an active Cluster.');
    if ((audience === 'local' || audience === 'public') && !profile?.church_id) return Alert.alert('BUKLOD IGPAT', 'Complete your Local Church assignment or choose Cluster.');

    setBusy(true);
    setProgress(0);
    let uploadedPath: string | null = null;
    let currentStage = 'Preparing';
    setStage(currentStage);
    await trackIgpatEvent({ event: 'publish_start', meta: { audience, duration: effectiveDuration } });
    try {
      uploadedPath = `${user.id}/igpat-${Date.now()}-${Math.random().toString(36).slice(2)}.${extensionForMime(draft.mimeType)}`;
      currentStage = 'Uploading video';
      setStage(currentStage);
      await uploadIgpatVideoFile({ path: uploadedPath, uri: draft.uri, contentType: draft.mimeType, sizeBytes: draft.sizeBytes, onProgress: setProgress });

      currentStage = 'Creating IGPAT post';
      setStage(currentStage);
      const { data, error } = await (supabase as any).rpc('create_buklod_reel_v1', {
        p_audience: audience,
        p_group_id: audience === 'group' ? groupId : null,
        p_body: caption.trim(),
        p_media_path: uploadedPath,
        p_media_mime_type: draft.mimeType,
        p_media_size_bytes: draft.sizeBytes,
        p_duration_seconds: draft.durationSeconds,
      });
      if (error) throw error;
      const postId = String(Array.isArray(data) ? data[0]?.id ?? data[0] ?? '' : data?.id ?? data ?? '').trim();
      if (!postId) throw new Error('Server did not return a new IGPAT post ID.');

      currentStage = 'Saving Quick Edit';
      setStage(currentStage);
      await saveIgpatPostMetadata(postId, edit);
      await trackIgpatEvent({ event: 'publish_success', postId, meta: { audience, quick_edit: edit } });
      clearDraft();
      setCaption('');
      Alert.alert('IGPAT Published', 'Your video is now published.');
      router.replace('/igpat' as any);
    } catch (error: any) {
      if (uploadedPath) {
        try { await supabase.storage.from('community-media').remove([uploadedPath]); } catch {}
      }
      await trackIgpatEvent({ event: 'publish_fail', meta: { stage: currentStage, message: String(error?.message ?? error) } });
      Alert.alert('Could Not Publish IGPAT', `${currentStage}: ${String(error?.message ?? error ?? 'Unknown error')}`);
    } finally {
      setBusy(false);
      setProgress(null);
      setStage('');
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {React.createElement('input', {
        ref: fileInputRef,
        type: 'file',
        accept: 'video/mp4,video/webm,video/quicktime,video/*',
        style: { display: 'none' },
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void acceptBlob(file, file.name || `igpat.${extensionForMime(file.type)}`, file.type || 'video/mp4');
        },
      })}

      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.iconButton}><MaterialCommunityIcons name="arrow-left" size={22} color="#fff" /></Pressable>
        <View style={{ flex: 1 }}><Text style={styles.eyebrow}>BUKLOD IGPAT</Text><Text style={styles.title}>Creator Studio</Text><Text style={styles.subtitle}>Record · Edit · Preview · Publish</Text></View>
        <View style={styles.liveBadge}><View style={styles.liveDot}/><Text style={styles.liveText}>CREATOR</Text></View>
      </View>

      {!draft ? (
        <LinearGradient colors={['#152A24','#0B1512','#080B0A']} style={styles.heroCard}>
          <MaterialCommunityIcons name="movie-open-play-outline" size={42} color="#B8F5D3" />
          <Text style={styles.heroTitle}>Create a sharp, high-quality IGPAT.</Text>
          <Text style={styles.heroCopy}>Choose an existing video or record directly. Maximum duration is 60 seconds.</Text>
          <View style={styles.sourceRow}>
            <Pressable style={styles.primarySource} onPress={openFilePicker} disabled={busy}><MaterialCommunityIcons name="folder-play-outline" size={22} color="#07140D"/><Text style={styles.primarySourceText}>SELECT VIDEO</Text></Pressable>
            <Pressable style={styles.secondarySource} onPress={() => void openCamera()} disabled={busy}><MaterialCommunityIcons name="camera-outline" size={22} color="#fff"/><Text style={styles.secondarySourceText}>RECORD</Text></Pressable>
          </View>
        </LinearGradient>
      ) : null}

      {cameraReady && !draft ? (
        <View style={styles.cameraCard}>
          {React.createElement('video', { ref: liveVideoRef, autoPlay: true, muted: true, playsInline: true, style: { width: '100%', height: 420, objectFit: 'cover', backgroundColor: '#000' } })}
          <View style={styles.cameraBar}>
            <Text style={styles.recordState}>{recording ? `REC ${recordSeconds}s / 60s` : 'CAMERA READY'}</Text>
            <Pressable style={[styles.recordButton, recording && styles.stopButton]} onPress={recording ? stopRecording : startRecording}><MaterialCommunityIcons name={recording ? 'stop' : 'record-rec'} size={20} color="#fff"/><Text style={styles.recordButtonText}>{recording ? 'STOP' : 'START'}</Text></Pressable>
            {!recording ? <Pressable onPress={cleanupCamera}><Text style={styles.linkText}>CLOSE</Text></Pressable> : null}
          </View>
        </View>
      ) : null}

      {draft ? (
        <>
          <View style={styles.previewCard}><WebPreview draft={draft} edit={edit}/><View style={styles.metaBar}><Text style={styles.metaStrong}>{effectiveDuration.toFixed(0)}s</Text><Text style={styles.meta}>{formatVideoBytes(draft.sizeBytes)}</Text><Text style={styles.meta}>{draft.fileName}</Text><Pressable disabled={busy} onPress={clearDraft}><Text style={styles.linkText}>CHANGE</Text></Pressable></View></View>
          <View style={styles.panel}><Text style={styles.panelTitle}>QUICK EDIT</Text><IgpatQuickEditPanel value={edit} onChange={setEdit} durationSeconds={draft.durationSeconds}/></View>
          <View style={styles.panel}><Text style={styles.panelTitle}>POST DETAILS</Text><TextInput value={caption} onChangeText={setCaption} editable={!busy} maxLength={500} multiline placeholder="Write a caption…" placeholderTextColor="#65726C" style={styles.captionInput}/><View style={styles.audienceRow}>{(['group','local','public'] as Audience[]).map(value => <Pressable key={value} disabled={busy} onPress={() => setAudience(value)} style={[styles.audienceChip,audience===value&&styles.audienceChipOn]}><Text style={[styles.audienceText,audience===value&&styles.audienceTextOn]}>{value==='group'?'CLUSTER':value.toUpperCase()}</Text></Pressable>)}</View></View>
          {busy ? <View style={styles.progressCard}><View style={styles.progressHead}><Text style={styles.progressStage}>{stage}</Text><Text style={styles.progressPct}>{progress == null ? '' : `${Math.round(progress*100)}%`}</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill,{width:`${Math.max(4,Math.round((progress??0)*100))}%`}]} /></View></View> : null}
          <View style={styles.actionRow}><Pressable disabled={busy} onPress={() => void saveLocalDraft()} style={styles.draftButton}><MaterialCommunityIcons name="content-save-outline" size={19} color="#D7E1DC"/><Text style={styles.draftText}>SAVE DRAFT</Text></Pressable><Pressable disabled={busy} onPress={() => void publish()} style={[styles.publishButton,busy&&{opacity:.55}]}>{busy?<ActivityIndicator color="#07140D"/>:<MaterialCommunityIcons name="send" size={19} color="#07140D"/>}<Text style={styles.publishText}>{busy?'PUBLISHING…':'PUBLISH IGPAT'}</Text></Pressable></View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:'#050706'},content:{width:'100%',maxWidth:920,alignSelf:'center',padding:18,paddingBottom:70,gap:16},
  headerRow:{flexDirection:'row',alignItems:'center',gap:12},iconButton:{width:44,height:44,borderRadius:14,backgroundColor:'#101512',borderWidth:1,borderColor:'#28332E',alignItems:'center',justifyContent:'center'},eyebrow:{fontSize:9,fontWeight:'900',letterSpacing:1.5,color:'#8FE4B3'},title:{fontSize:28,fontWeight:'900',color:'#fff'},subtitle:{marginTop:2,fontSize:11,fontWeight:'700',color:'#839088'},liveBadge:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:10,paddingVertical:7,borderRadius:999,backgroundColor:'#111814',borderWidth:1,borderColor:'#294036'},liveDot:{width:7,height:7,borderRadius:4,backgroundColor:'#7EF1A9'},liveText:{fontSize:8,fontWeight:'900',color:'#B9F4CF'},
  heroCard:{padding:24,borderRadius:28,borderWidth:1,borderColor:'#27463A',minHeight:245,justifyContent:'center'},heroTitle:{marginTop:12,fontSize:25,lineHeight:30,fontWeight:'900',color:'#fff',maxWidth:620},heroCopy:{marginTop:8,fontSize:12,lineHeight:18,color:'#AEBAB4',maxWidth:650},sourceRow:{marginTop:20,flexDirection:'row',gap:10,flexWrap:'wrap'},primarySource:{minHeight:48,paddingHorizontal:18,borderRadius:14,backgroundColor:'#DDF7E8',flexDirection:'row',alignItems:'center',gap:8},primarySourceText:{fontSize:10,fontWeight:'900',color:'#07140D'},secondarySource:{minHeight:48,paddingHorizontal:18,borderRadius:14,borderWidth:1,borderColor:'#53635B',backgroundColor:'rgba(0,0,0,.22)',flexDirection:'row',alignItems:'center',gap:8},secondarySourceText:{fontSize:10,fontWeight:'900',color:'#fff'},
  cameraCard:{borderRadius:24,overflow:'hidden',borderWidth:1,borderColor:'#2A3731',backgroundColor:'#070A08'},cameraBar:{minHeight:64,paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:10},recordState:{flex:1,fontSize:10,fontWeight:'900',color:'#E7ECE9'},recordButton:{minHeight:40,paddingHorizontal:14,borderRadius:12,backgroundColor:'#C62A39',flexDirection:'row',alignItems:'center',gap:6},stopButton:{backgroundColor:'#7A1720'},recordButtonText:{fontSize:9,fontWeight:'900',color:'#fff'},linkText:{fontSize:9,fontWeight:'900',color:'#98E9B9'},
  previewCard:{borderRadius:24,overflow:'hidden',borderWidth:1,borderColor:'#27322D',backgroundColor:'#090C0A'},previewFrame:{height:520,position:'relative',backgroundColor:'#000'},textOverlay:{position:'absolute',left:24,right:24,bottom:44,alignItems:'center'},textOverlayText:{paddingHorizontal:12,paddingVertical:8,borderRadius:12,backgroundColor:'rgba(0,0,0,.56)',fontSize:18,fontWeight:'900',color:'#fff',textAlign:'center'},metaBar:{minHeight:54,paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:10,flexWrap:'wrap'},metaStrong:{fontSize:12,fontWeight:'900',color:'#fff'},meta:{fontSize:10,color:'#87928C'},
  panel:{padding:16,borderRadius:20,backgroundColor:'#0D110F',borderWidth:1,borderColor:'#27302C'},panelTitle:{fontSize:9,fontWeight:'900',letterSpacing:1.2,color:'#98E9B9',marginBottom:12},captionInput:{minHeight:110,textAlignVertical:'top',borderRadius:14,borderWidth:1,borderColor:'#303A35',backgroundColor:'#080B09',padding:12,fontSize:13,color:'#fff'},audienceRow:{marginTop:12,flexDirection:'row',gap:8,flexWrap:'wrap'},audienceChip:{paddingHorizontal:13,paddingVertical:9,borderRadius:999,borderWidth:1,borderColor:'#39443E',backgroundColor:'#111613'},audienceChipOn:{backgroundColor:'#DDF7E8',borderColor:'#DDF7E8'},audienceText:{fontSize:9,fontWeight:'900',color:'#D5DDD8'},audienceTextOn:{color:'#07140D'},
  progressCard:{padding:14,borderRadius:16,backgroundColor:'#0E1712',borderWidth:1,borderColor:'#2F4B3D'},progressHead:{flexDirection:'row',justifyContent:'space-between'},progressStage:{fontSize:10,fontWeight:'900',color:'#DDF7E8'},progressPct:{fontSize:10,fontWeight:'900',color:'#8FE4B3'},progressTrack:{height:7,borderRadius:8,backgroundColor:'#1D2B24',overflow:'hidden',marginTop:9},progressFill:{height:'100%',borderRadius:8,backgroundColor:'#8FE4B3'},actionRow:{flexDirection:'row',gap:10,justifyContent:'flex-end',flexWrap:'wrap'},draftButton:{minHeight:50,paddingHorizontal:16,borderRadius:14,borderWidth:1,borderColor:'#3A4640',backgroundColor:'#101411',flexDirection:'row',alignItems:'center',gap:7},draftText:{fontSize:10,fontWeight:'900',color:'#D7E1DC'},publishButton:{minHeight:50,paddingHorizontal:18,borderRadius:14,backgroundColor:'#DDF7E8',flexDirection:'row',alignItems:'center',gap:7},publishText:{fontSize:10,fontWeight:'900',color:'#07140D'}
});