import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import {
  BUKLOD_REEL_MAX_DURATION_SECONDS,
  formatVideoBytes,
  validateCommunityVideoUpload,
} from '@/lib/buklodCommunityWallMedia';
import IgpatQuickEditPanel, {
  DEFAULT_IGPAT_QUICK_EDIT,
  type IgpatQuickEditState,
} from '@/components/igpat/IgpatQuickEditPanel';
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
  revokeOnDispose?: boolean;
};

function extensionForMime(mime: string) {
  if (mime === 'video/webm') return 'webm';
  if (mime === 'video/quicktime') return 'mov';
  return 'mp4';
}

function Preview({ uri, edit }: { uri: string; edit: IgpatQuickEditState }) {
  const player = useVideoPlayer(uri, instance => {
    instance.loop = true;
    instance.muted = false;
    instance.playbackRate = edit.speed;
  });
  useEffect(() => {
    try {
      player.playbackRate = edit.speed;
      player.currentTime = Math.max(0, edit.trimStartSeconds);
      player.play();
    } catch {}
    return () => { try { player.pause(); } catch {} };
  }, [edit.speed, edit.trimStartSeconds, player]);
  useEffect(() => {
    const sub = player.addListener('timeUpdate', ({ currentTime }: any) => {
      const end = edit.trimEndSeconds;
      if (end != null && currentTime >= end) {
        try { player.currentTime = edit.trimStartSeconds; } catch {}
      }
    });
    return () => { try { sub.remove(); } catch {} };
  }, [edit.trimEndSeconds, edit.trimStartSeconds, player]);
  return (
    <View style={styles.previewWrap}>
      <VideoView player={player} style={styles.preview} nativeControls contentFit="contain" />
      {!!edit.textOverlay && <Text pointerEvents="none" style={styles.previewOverlay}>{edit.textOverlay}</Text>}
    </View>
  );
}

export default function IgpatCreateWebR7() {
  const { user, profile } = useAuth();
  const [draft, setDraft] = useState<MediaDraft | null>(null);
  const [caption, setCaption] = useState('');
  const [audience, setAudience] = useState<Audience>('public');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [edit, setEdit] = useState<IgpatQuickEditState>({ ...DEFAULT_IGPAT_QUICK_EDIT });

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStartedAtRef = useRef(0);

  useEffect(() => {
    if (!user?.id) return;
    void supabase.from('group_members').select('group_id').eq('user_id', user.id).eq('is_active', true).limit(1).maybeSingle()
      .then(({ data }) => {
        const id = data?.group_id ?? null;
        setGroupId(id);
        if (id) setAudience('group');
      });
  }, [user?.id]);

  const stopCamera = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    tickRef.current = null;
    stopTimerRef.current = null;
    for (const track of streamRef.current?.getTracks?.() ?? []) {
      try { track.stop(); } catch {}
    }
    streamRef.current = null;
    setCameraReady(false);
  };

  useEffect(() => () => {
    stopCamera();
    if (draft?.revokeOnDispose) {
      try { URL.revokeObjectURL(draft.uri); } catch {}
    }
  }, [draft?.revokeOnDispose, draft?.uri]);

  const disposeDraft = () => {
    if (draft?.revokeOnDispose) {
      try { URL.revokeObjectURL(draft.uri); } catch {}
    }
    setDraft(null);
    setEdit({ ...DEFAULT_IGPAT_QUICK_EDIT });
  };

  const setAcceptedDraft = (next: MediaDraft) => {
    disposeDraft();
    setDraft(next);
    setEdit({ ...DEFAULT_IGPAT_QUICK_EDIT, trimEndSeconds: next.durationSeconds });
  };

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      Alert.alert('Camera unavailable', 'This browser does not support direct camera recording.');
      return;
    }
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
      streamRef.current = stream;
      setCameraReady(true);
      setTimeout(() => {
        const video = liveVideoRef.current;
        if (video) {
          video.srcObject = stream;
          void video.play().catch(() => undefined);
        }
      }, 0);
    } catch (error: any) {
      Alert.alert('Camera permission', error?.message ?? 'Camera and microphone permission are required.');
    }
  };

  const startRecording = async () => {
    if (!streamRef.current) { await openCamera(); return; }
    if (typeof MediaRecorder === 'undefined') {
      Alert.alert('Recording unavailable', 'This browser does not support MediaRecorder.');
      return;
    }
    const candidates = ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
    const mimeType = candidates.find(candidate => !MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(candidate)) ?? 'video/webm';
    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    recorderRef.current = recorder;
    recordStartedAtRef.current = Date.now();
    setRecordSeconds(0);
    recorder.ondataavailable = event => { if (event.data?.size) chunksRef.current.push(event.data); };
    recorder.onerror = () => { setRecording(false); Alert.alert('Recording error', 'Camera recording failed.'); };
    recorder.onstop = () => {
      const durationSeconds = Math.max(1, Math.min(60, Math.ceil((Date.now() - recordStartedAtRef.current) / 1000)));
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      chunksRef.current = [];
      setRecording(false);
      stopCamera();
      if (!blob.size) return Alert.alert('BUKLOD IGPAT', 'The recorded video was empty. Please try again.');
      const validationError = validateCommunityVideoUpload({ durationSeconds, sizeBytes: blob.size, isReel: true });
      if (validationError) return Alert.alert('BUKLOD IGPAT', validationError);
      setAcceptedDraft({
        uri: URL.createObjectURL(blob),
        durationSeconds,
        sizeBytes: blob.size,
        mimeType: 'video/webm',
        fileName: `igpat-${Date.now()}.webm`,
        revokeOnDispose: true,
      });
    };
    recorder.start(1000);
    setRecording(true);
    tickRef.current = setInterval(() => setRecordSeconds(Math.min(60, Math.floor((Date.now() - recordStartedAtRef.current) / 1000))), 500);
    stopTimerRef.current = setTimeout(() => { try { if (recorder.state === 'recording') recorder.stop(); } catch {} }, 60000);
  };

  const stopRecording = () => { try { if (recorderRef.current?.state === 'recording') recorderRef.current.stop(); } catch {} };

  const chooseVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsEditing: false, quality: 1 });
    if (result.canceled || !result.assets?.length) return;
    const asset: any = result.assets[0];
    const durationSeconds = Math.max(1, Math.ceil(Number(asset.duration ?? 0) / 1000));
    if (durationSeconds > BUKLOD_REEL_MAX_DURATION_SECONDS) return Alert.alert('Maximum 60 Seconds', `This video is ${durationSeconds} seconds.`);
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    const sizeBytes = Number(blob.size ?? asset.fileSize ?? 0);
    const mimeType = String(asset.mimeType || blob.type || 'video/mp4').toLowerCase();
    const validationError = validateCommunityVideoUpload({ durationSeconds, sizeBytes, isReel: true });
    if (validationError) return Alert.alert('BUKLOD IGPAT', validationError);
    setAcceptedDraft({
      uri: asset.uri,
      durationSeconds,
      sizeBytes,
      mimeType: mimeType === 'video/webm' || mimeType === 'video/quicktime' ? mimeType : 'video/mp4',
      fileName: String(asset.fileName ?? `igpat.${extensionForMime(mimeType)}`),
    });
  };

  const effectiveDuration = useMemo(() => draft ? Math.max(1, (edit.trimEndSeconds ?? draft.durationSeconds) - edit.trimStartSeconds) : 0, [draft, edit.trimEndSeconds, edit.trimStartSeconds]);

  const saveDraft = async () => {
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
    Alert.alert('Draft saved', 'This IGPAT draft is saved on this device.');
  };

  const publish = async () => {
    if (!user?.id || !draft || busy) return;
    if (audience === 'group' && !groupId) return Alert.alert('BUKLOD IGPAT', 'You do not have an active BUKLOD Cluster.');
    if ((audience === 'local' || audience === 'public') && !profile?.church_id) return Alert.alert('BUKLOD IGPAT', 'Choose CLUSTER, or complete your Local Church assignment.');

    setBusy(true);
    setProgress(0);
    setStage('Preparing upload');
    let uploadedPath: string | null = null;
    await trackIgpatEvent({ event: 'publish_start', meta: { audience, duration: effectiveDuration } });
    try {
      uploadedPath = `${user.id}/igpat-${Date.now()}-${Math.random().toString(36).slice(2)}.${extensionForMime(draft.mimeType)}`;
      setStage('Uploading video');
      await uploadIgpatVideoFile({ path: uploadedPath, uri: draft.uri, contentType: draft.mimeType, sizeBytes: draft.sizeBytes, onProgress: setProgress });
      setStage('Creating IGPAT post');
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
      if (!postId) throw new Error('The server did not return the new IGPAT post ID.');
      setStage('Saving Quick Edit');
      await saveIgpatPostMetadata(postId, edit);
      await trackIgpatEvent({ event: 'publish_success', postId, meta: { audience, quick_edit: edit } });
      disposeDraft();
      setCaption('');
      Alert.alert('IGPAT Published', 'Your IGPAT is now available in the selected feed.');
      router.replace('/igpat' as any);
    } catch (error: any) {
      if (uploadedPath) await supabase.storage.from('community-media').remove([uploadedPath]).catch(() => undefined as any);
      await trackIgpatEvent({ event: 'publish_fail', meta: { stage, message: String(error?.message ?? error) } });
      Alert.alert('Could Not Publish IGPAT', `${stage}: ${String(error?.message ?? error ?? 'Please try again.')}`);
    } finally {
      setBusy(false);
      setProgress(null);
      setStage('');
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>BUKLOD IGPAT</Text>
      <Text style={styles.title}>Create an Instant Bond</Text>
      <Text style={styles.subtitle}>Record → Quick Edit → Preview → Publish.</Text>

      {cameraReady && !draft ? (
        <View style={styles.cameraCard}>
          {React.createElement('video', { ref: liveVideoRef, autoPlay: true, muted: true, playsInline: true, style: { width: '100%', height: 380, objectFit: 'cover', backgroundColor: '#000' } })}
          <View style={styles.cameraActions}>
            <Text style={styles.recordTime}>{recording ? `REC ${recordSeconds}s / 60s` : 'CAMERA READY'}</Text>
            <Pressable style={[styles.recordButton, recording && styles.stopButton]} onPress={recording ? stopRecording : startRecording}>
              <Text style={styles.recordButtonText}>{recording ? 'STOP' : 'START RECORDING'}</Text>
            </Pressable>
            {!recording ? <Pressable onPress={stopCamera}><Text style={styles.change}>CLOSE CAMERA</Text></Pressable> : null}
          </View>
        </View>
      ) : draft ? (
        <View style={styles.previewCard}>
          <Preview uri={draft.uri} edit={edit} />
          <View style={styles.previewMeta}>
            <Text style={styles.metaStrong}>{effectiveDuration.toFixed(0)}s</Text>
            <Text style={styles.meta}>{formatVideoBytes(draft.sizeBytes)}</Text>
            <Pressable onPress={disposeDraft} disabled={busy}><Text style={styles.change}>CHANGE</Text></Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.sourceRow}>
          <Pressable style={styles.sourceButton} onPress={() => void openCamera()} disabled={busy}><Text style={styles.sourceTitle}>RECORD</Text><Text style={styles.sourceCopy}>Open camera + mic</Text></Pressable>
          <Pressable style={styles.sourceButton} onPress={() => void chooseVideo()} disabled={busy}><Text style={styles.sourceTitle}>SELECT</Text><Text style={styles.sourceCopy}>From device</Text></Pressable>
        </View>
      )}

      {draft ? <IgpatQuickEditPanel value={edit} durationSeconds={draft.durationSeconds} disabled={busy} onChange={next => { setEdit(next); void trackIgpatEvent({ event: 'quick_edit' }); }} /> : null}

      <TextInput value={caption} onChangeText={setCaption} placeholder="Write a caption…" placeholderTextColor="rgba(255,255,255,.38)" multiline maxLength={500} style={styles.caption} editable={!busy} />
      <Text style={styles.label}>AUDIENCE</Text>
      <View style={styles.audienceRow}>
        {(['public','local','group'] as Audience[]).map(value => (
          <Pressable key={value} style={[styles.audienceButton, audience === value && styles.audienceSelected]} onPress={() => setAudience(value)} disabled={busy}>
            <Text style={[styles.audienceText, audience === value && styles.audienceSelectedText]}>{value === 'group' ? 'CLUSTER' : value.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.scopeHint}>Use IGPAT Share after publish for Organization, Sub-org, Cluster, Community and direct Connect targets. The reference is shared; the video is not duplicated.</Text>

      {busy ? <View style={styles.progressRow}><ActivityIndicator color="#fff" /><Text style={styles.progressText}>{stage} {progress == null ? '' : `${Math.round(progress * 100)}%`}</Text></View> : null}
      <View style={styles.finalActions}>
        <Pressable style={[styles.draftButton, (!draft || busy) && styles.disabled]} disabled={!draft || busy} onPress={() => void saveDraft()}><Text style={styles.draftText}>SAVE DRAFT</Text></Pressable>
        <Pressable style={[styles.publish, (!draft || busy) && styles.disabled]} disabled={!draft || busy} onPress={() => void publish()}><Text style={styles.publishText}>{busy ? 'PUBLISHING…' : 'PUBLISH IGPAT'}</Text></Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060908' },
  content: { padding: 20, paddingTop: 58, paddingBottom: 48 },
  eyebrow: { color: '#A7E6BB', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  title: { marginTop: 7, color: '#fff', fontSize: 27, lineHeight: 32, fontWeight: '900' },
  subtitle: { marginTop: 7, color: 'rgba(255,255,255,.62)', fontSize: 12, lineHeight: 18 },
  sourceRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  sourceButton: { flex: 1, minHeight: 116, borderWidth: 1, borderColor: 'rgba(255,255,255,.18)', borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101512' },
  sourceTitle: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  sourceCopy: { marginTop: 5, color: 'rgba(255,255,255,.48)', fontSize: 10 },
  cameraCard: { marginTop: 24, overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,.12)', backgroundColor: '#0C110E' },
  cameraActions: { padding: 14, gap: 9 },
  recordTime: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  recordButton: { minHeight: 44, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  stopButton: { backgroundColor: '#ff6868' },
  recordButtonText: { color: '#07100B', fontSize: 10, fontWeight: '900' },
  previewCard: { marginTop: 24, overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,.12)', backgroundColor: '#0C110E' },
  previewWrap: { position: 'relative', width: '100%', height: 420 },
  preview: { width: '100%', height: '100%', backgroundColor: '#000' },
  previewOverlay: { position: 'absolute', left: 18, right: 18, bottom: 26, color: '#fff', fontSize: 20, fontWeight: '900', textAlign: 'center', textShadowColor: 'rgba(0,0,0,.8)', textShadowRadius: 6 },
  previewMeta: { minHeight: 50, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  metaStrong: { color: '#fff', fontSize: 11, fontWeight: '900' },
  meta: { flex: 1, color: 'rgba(255,255,255,.50)', fontSize: 10 },
  change: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: .8 },
  caption: { marginTop: 18, minHeight: 92, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,.16)', color: '#fff', paddingHorizontal: 15, paddingVertical: 13, textAlignVertical: 'top', backgroundColor: '#0D120F' },
  label: { marginTop: 20, marginBottom: 9, color: 'rgba(255,255,255,.52)', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  audienceRow: { flexDirection: 'row', gap: 8 },
  audienceButton: { flex: 1, paddingVertical: 11, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,.18)', alignItems: 'center' },
  audienceSelected: { backgroundColor: '#fff', borderColor: '#fff' },
  audienceText: { color: 'rgba(255,255,255,.68)', fontSize: 9, fontWeight: '900', letterSpacing: .7 },
  audienceSelectedText: { color: '#080C09' },
  scopeHint: { marginTop: 9, color: '#77827A', fontSize: 9, lineHeight: 14 },
  progressRow: { marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  progressText: { color: 'rgba(255,255,255,.70)', fontSize: 11, fontWeight: '700' },
  finalActions: { flexDirection: 'row', gap: 9, marginTop: 24 },
  draftButton: { flex: 1, minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#3A443D' },
  draftText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  publish: { flex: 1.4, minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  publishText: { color: '#060908', fontSize: 11, fontWeight: '900', letterSpacing: .8 },
  disabled: { opacity: .36 },
});
