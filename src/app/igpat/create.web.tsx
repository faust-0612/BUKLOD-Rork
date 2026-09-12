import React, { useEffect, useRef, useState } from 'react';
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

type Audience = 'group' | 'local' | 'public';

type IgpatDraft = {
  uri: string;
  durationSeconds: number;
  sizeBytes: number;
  mimeType: string;
  fileName: string;
  revokeOnDispose?: boolean;
};

type IgpatGroupOption = {
  group_id: string;
  group_name?: string | null;
  group_code?: string | null;
};

function Preview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, instance => {
    instance.loop = true;
    instance.muted = false;
  });

  useEffect(() => {
    try { player.play(); } catch {}
    return () => {
      try { player.pause(); } catch {}
    };
  }, [player]);

  return <VideoView player={player} style={styles.preview} nativeControls contentFit="contain" />;
}

function extensionForMime(mime: string) {
  if (mime === 'video/webm') return 'webm';
  if (mime === 'video/quicktime') return 'mov';
  return 'mp4';
}

async function uploadWebIgpatDirect({
  path,
  uri,
  contentType,
  onProgress,
}: {
  path: string;
  uri: string;
  contentType: string;
  onProgress: (ratio: number) => void;
}) {
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`Could not read selected video (${response.status}).`);
  const blob = await response.blob();

  onProgress(0.05);
  const bucket = supabase.storage.from('community-media');
  const { data: signed, error: signedError } = await bucket.createSignedUploadUrl(path, { upsert: false });
  if (signedError) throw signedError;

  const signedUrl = String(signed?.signedUrl ?? '');
  if (!signedUrl) throw new Error('Could not prepare IGPAT upload URL.');

  const upload = await fetch(signedUrl, {
    method: 'PUT',
    headers: {
      'content-type': contentType,
      'cache-control': '3600',
      'x-upsert': 'false',
    },
    body: blob,
  });

  if (!upload.ok) {
    const body = await upload.text().catch(() => '');
    throw new Error(`IGPAT upload failed (${upload.status})${body ? `: ${body.slice(0, 180)}` : ''}`);
  }

  onProgress(1);
}

export default function IgpatCreateWebScreen() {
  const { user, profile } = useAuth();
  const [draft, setDraft] = useState<IgpatDraft | null>(null);
  const [caption, setCaption] = useState('');
  const [audience, setAudience] = useState<Audience>('public');
  const [groups, setGroups] = useState<IgpatGroupOption[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const streamRef = useRef<any>(null);
  const recorderRef = useRef<any>(null);
  const chunksRef = useRef<any[]>([]);
  const liveVideoRef = useRef<any>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStartedAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    if (!user?.id) {
      setGroups([]);
      setGroupId(null);
      setGroupsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setGroupsLoading(true);

    void (supabase as any)
      .rpc('get_my_active_igpat_groups_v1')
      .then(({ data, error }: any) => {
        if (cancelled) return;

        if (error) {
          console.warn('BUKLOD IGPAT groups:', error.message);
          setGroups([]);
          setGroupId(null);
          return;
        }

        const options = ((data ?? []) as IgpatGroupOption[])
          .filter(row => Boolean(row?.group_id))
          .map(row => ({
            group_id: String(row.group_id),
            group_name: row.group_name ? String(row.group_name) : null,
            group_code: row.group_code ? String(row.group_code) : null,
          }));

        setGroups(options);
        setGroupId(current =>
          current && options.some(row => row.group_id === current)
            ? current
            : options[0]?.group_id ?? null
        );

        if (!profile?.church_id && options.length) {
          setAudience('group');
        }
      })
      .catch((error: any) => {
        if (cancelled) return;
        console.warn('BUKLOD IGPAT groups:', String(error?.message ?? error));
        setGroups([]);
        setGroupId(null);
      })
      .finally(() => {
        if (!cancelled) setGroupsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profile?.church_id, user?.id]);

  const stopCamera = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    tickRef.current = null;
    stopTimerRef.current = null;
    const stream = streamRef.current;
    if (stream?.getTracks) {
      for (const track of stream.getTracks()) {
        try { track.stop(); } catch {}
      }
    }
    streamRef.current = null;
    setCameraReady(false);
  };

  useEffect(() => () => {
    stopCamera();
    if (draft?.revokeOnDispose && draft.uri) {
      try { URL.revokeObjectURL(draft.uri); } catch {}
    }
  }, [draft?.revokeOnDispose, draft?.uri]);

  const disposeDraft = () => {
    if (draft?.revokeOnDispose && draft.uri) {
      try { URL.revokeObjectURL(draft.uri); } catch {}
    }
    setDraft(null);
  };

  const openCamera = async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      Alert.alert('Camera unavailable', 'This browser does not support direct camera recording.');
      return;
    }

    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      });
      streamRef.current = stream;
      setCameraReady(true);
      setTimeout(() => {
        if (liveVideoRef.current) {
          liveVideoRef.current.srcObject = stream;
          void liveVideoRef.current.play?.().catch?.(() => {});
        }
      }, 0);
    } catch (error: any) {
      Alert.alert('Camera permission', error?.message ?? 'Camera and microphone permission are required.');
    }
  };

  const startRecording = async () => {
    if (!streamRef.current) {
      await openCamera();
      return;
    }

    const Recorder = (globalThis as any).MediaRecorder;
    if (!Recorder) {
      Alert.alert('Recording unavailable', 'This browser does not support MediaRecorder.');
      return;
    }

    chunksRef.current = [];
    const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    let mimeType = 'video/webm';
    for (const candidate of candidates) {
      try {
        if (!Recorder.isTypeSupported || Recorder.isTypeSupported(candidate)) {
          mimeType = candidate;
          break;
        }
      } catch {}
    }

    const recorder = new Recorder(streamRef.current, { mimeType });
    recorderRef.current = recorder;
    recordStartedAtRef.current = Date.now();
    setRecordSeconds(0);

    recorder.ondataavailable = (event: any) => {
      if (event?.data?.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onerror = (event: any) => {
      setRecording(false);
      Alert.alert('Recording error', event?.error?.message ?? 'Camera recording failed.');
    };

    recorder.onstop = () => {
      const durationSeconds = Math.max(1, Math.min(60, Math.ceil((Date.now() - recordStartedAtRef.current) / 1000)));
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      chunksRef.current = [];
      setRecording(false);
      stopCamera();

      if (!blob.size) {
        Alert.alert('BUKLOD IGPAT', 'The recorded video was empty. Please try again.');
        return;
      }

      const validationError = validateCommunityVideoUpload({
        durationSeconds,
        sizeBytes: blob.size,
        isReel: true,
      });
      if (validationError) {
        Alert.alert('BUKLOD IGPAT', validationError);
        return;
      }

      disposeDraft();
      setDraft({
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
    tickRef.current = setInterval(() => {
      setRecordSeconds(Math.min(60, Math.floor((Date.now() - recordStartedAtRef.current) / 1000)));
    }, 500);
    stopTimerRef.current = setTimeout(() => {
      try {
        if (recorder.state === 'recording') recorder.stop();
      } catch {}
    }, 60000);
  };

  const stopRecording = () => {
    try {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    } catch {}
  };

  const chooseVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled || !result.assets?.length) return;

    const asset: any = result.assets[0];
    const durationSeconds = Math.max(1, Math.ceil(Number(asset?.duration ?? 0) / 1000));
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    const sizeBytes = Number(blob.size ?? asset?.fileSize ?? 0);
    const mimeType = String(asset?.mimeType || blob.type || 'video/mp4').toLowerCase();

    if (durationSeconds > BUKLOD_REEL_MAX_DURATION_SECONDS) {
      Alert.alert('Maximum 60 Seconds', `This video is ${durationSeconds} seconds. IGPAT videos may be up to 60 seconds only.`);
      return;
    }

    const validationError = validateCommunityVideoUpload({ durationSeconds, sizeBytes, isReel: true });
    if (validationError) {
      Alert.alert('BUKLOD IGPAT', validationError);
      return;
    }

    disposeDraft();
    setDraft({
      uri: asset.uri,
      durationSeconds,
      sizeBytes,
      mimeType: mimeType === 'video/quicktime' || mimeType === 'video/webm' ? mimeType : 'video/mp4',
      fileName: String(asset?.fileName ?? `igpat.${extensionForMime(mimeType)}`),
    });
  };

  const publish = async () => {
    if (!user?.id || !draft || busy) return;

    if (
      audience === 'group' &&
      (!groupId || !groups.some(row => row.group_id === groupId))
    ) {
      Alert.alert('BUKLOD IGPAT', 'Choose an active BUKLOD Cluster first.');
      return;
    }
    if ((audience === 'local' || audience === 'public') && !profile?.church_id) {
      Alert.alert('BUKLOD IGPAT', 'Choose CLUSTER, or ask an admin to complete your Local Church assignment.');
      return;
    }

    setBusy(true);
    setProgress(0);
    setStage('Preparing upload…');
    let uploadedPath: string | null = null;

    try {
      uploadedPath = `${user.id}/igpat-${Date.now()}-${Math.random().toString(36).slice(2)}.${extensionForMime(draft.mimeType)}`;

      setStage('Uploading video…');
      await uploadWebIgpatDirect({
        path: uploadedPath,
        uri: draft.uri,
        contentType: draft.mimeType,
        onProgress: setProgress,
      });

      setStage('Creating IGPAT post…');
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
      if (!data) throw new Error('The server did not return the new IGPAT post ID.');

      setStage('Published');
      disposeDraft();
      setCaption('');
      Alert.alert('IGPAT Published', 'Your IGPAT is now available in the selected feed.');
      router.replace('/igpat' as any);
    } catch (error: any) {
      const message = String(error?.message ?? error ?? 'Please try again.');
      console.error('BUKLOD IGPAT publish:', message);
      if (uploadedPath) {
        await supabase.storage.from('community-media').remove([uploadedPath]).catch(() => undefined as any);
      }
      Alert.alert('Could Not Publish IGPAT', `${stage || 'Publish'}: ${message}`);
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
      <Text style={styles.subtitle}>Record directly from your camera or choose a short video, preview it, then publish.</Text>

      {cameraReady && !draft ? (
        <View style={styles.cameraCard}>
          {React.createElement('video', {
            ref: liveVideoRef,
            autoPlay: true,
            muted: true,
            playsInline: true,
            style: { width: '100%', height: 380, objectFit: 'cover', backgroundColor: '#000' },
          })}
          <View style={styles.cameraActions}>
            <Text style={styles.recordTime}>{recording ? `REC ${recordSeconds}s / 60s` : 'CAMERA READY'}</Text>
            <Pressable style={[styles.recordButton, recording && styles.stopButton]} onPress={recording ? stopRecording : startRecording}>
              <Text style={styles.recordButtonText}>{recording ? 'STOP' : 'START RECORDING'}</Text>
            </Pressable>
            {!recording ? (
              <Pressable onPress={stopCamera}><Text style={styles.change}>CLOSE CAMERA</Text></Pressable>
            ) : null}
          </View>
        </View>
      ) : draft ? (
        <View style={styles.previewCard}>
          <Preview uri={draft.uri} />
          <View style={styles.previewMeta}>
            <Text style={styles.metaStrong}>{draft.durationSeconds}s</Text>
            <Text style={styles.meta}>{formatVideoBytes(draft.sizeBytes)}</Text>
            <Pressable onPress={disposeDraft} disabled={busy}><Text style={styles.change}>CHANGE</Text></Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.sourceRow}>
          <Pressable style={styles.sourceButton} onPress={() => void openCamera()} disabled={busy}>
            <Text style={styles.sourceTitle}>RECORD</Text>
            <Text style={styles.sourceCopy}>Open camera + mic</Text>
          </Pressable>
          <Pressable style={styles.sourceButton} onPress={() => void chooseVideo()} disabled={busy}>
            <Text style={styles.sourceTitle}>SELECT</Text>
            <Text style={styles.sourceCopy}>From device</Text>
          </Pressable>
        </View>
      )}

      <TextInput
        value={caption}
        onChangeText={setCaption}
        placeholder="Write a caption…"
        placeholderTextColor="rgba(255,255,255,0.38)"
        multiline
        maxLength={500}
        style={styles.caption}
        editable={!busy}
      />

      <Text style={styles.label}>AUDIENCE</Text>
      <View style={styles.audienceRow}>
        {(['group', 'public', 'local'] as Audience[]).map(value => {
          const disabled = value === 'group'
            ? groupsLoading || !groups.length
            : !profile?.church_id;
          return (
            <Pressable
              key={value}
              style={[
                styles.audienceButton,
                audience === value && styles.audienceSelected,
                disabled && styles.audienceDisabled,
              ]}
              onPress={() => {
                if (disabled) return;
                setAudience(value);
                if (value === 'group' && !groupId) {
                  setGroupId(groups[0]?.group_id ?? null);
                }
              }}
              disabled={busy || disabled}
            >
              <Text style={[styles.audienceText, audience === value && styles.audienceSelectedText]}>
                {value === 'group' ? 'CLUSTER' : value.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {audience === 'group' && groups.length > 0 ? (
        <View style={styles.clusterSection}>
          <Text style={styles.clusterLabel}>POST TO CLUSTER</Text>
          <View style={styles.clusterRow}>
            {groups.map(option => {
              const selected = option.group_id === groupId;
              const label = option.group_name || option.group_code || 'BUKLOD Cluster';
              return (
                <Pressable
                  key={option.group_id}
                  style={[styles.clusterChip, selected && styles.clusterChipSelected]}
                  onPress={() => setGroupId(option.group_id)}
                  disabled={busy}
                >
                  <Text style={[styles.clusterText, selected && styles.clusterTextSelected]} numberOfLines={1}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {busy ? (
        <View style={styles.progressRow}>
          <ActivityIndicator color="#FFFFFF" />
          <View>
            <Text style={styles.progressText}>{stage}</Text>
            {progress != null ? <Text style={styles.progressSub}>{Math.round(progress * 100)}%</Text> : null}
          </View>
        </View>
      ) : null}

      <Pressable style={[styles.publish, (!draft || busy) && styles.publishDisabled]} disabled={!draft || busy} onPress={() => void publish()}>
        <Text style={styles.publishText}>{busy ? 'PUBLISHING…' : 'PUBLISH IGPAT'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060908' },
  content: { padding: 20, paddingTop: 58, paddingBottom: 48 },
  eyebrow: { color: 'rgba(255,255,255,0.58)', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  title: { marginTop: 7, color: '#FFFFFF', fontSize: 27, lineHeight: 32, fontWeight: '900' },
  subtitle: { marginTop: 7, color: 'rgba(255,255,255,0.62)', fontSize: 12, lineHeight: 18 },
  sourceRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  sourceButton: { flex: 1, minHeight: 116, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101512' },
  sourceTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  sourceCopy: { marginTop: 5, color: 'rgba(255,255,255,0.48)', fontSize: 10 },
  cameraCard: { marginTop: 24, overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0C110E' },
  cameraActions: { padding: 14, gap: 10, alignItems: 'center' },
  recordTime: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  recordButton: { minWidth: 180, minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  stopButton: { backgroundColor: '#F0D7D7' },
  recordButtonText: { color: '#060908', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  previewCard: { marginTop: 24, overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0C110E' },
  preview: { width: '100%', height: 420, backgroundColor: '#000000' },
  previewMeta: { minHeight: 50, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  metaStrong: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  meta: { flex: 1, color: 'rgba(255,255,255,0.50)', fontSize: 10 },
  change: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  caption: { marginTop: 18, minHeight: 92, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', color: '#FFFFFF', paddingHorizontal: 15, paddingVertical: 13, textAlignVertical: 'top', backgroundColor: '#0D120F' },
  label: { marginTop: 20, marginBottom: 9, color: 'rgba(255,255,255,0.52)', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  audienceRow: { flexDirection: 'row', gap: 8 },
  audienceButton: { flex: 1, paddingVertical: 11, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center' },
  audienceSelected: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  audienceDisabled: { opacity: 0.28 },
  audienceText: { color: 'rgba(255,255,255,0.68)', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  audienceSelectedText: { color: '#080C09' },
  clusterSection: { marginTop: 14 },
  clusterLabel: { marginBottom: 8, color: 'rgba(255,255,255,0.46)', fontSize: 8, fontWeight: '900', letterSpacing: 0.9 },
  clusterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  clusterChip: { maxWidth: '100%', paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: '#0D120F' },
  clusterChipSelected: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  clusterText: { maxWidth: 240, color: 'rgba(255,255,255,0.72)', fontSize: 10, fontWeight: '800' },
  clusterTextSelected: { color: '#080C09' },
  progressRow: { marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  progressText: { color: 'rgba(255,255,255,0.82)', fontSize: 11, fontWeight: '800' },
  progressSub: { marginTop: 2, color: 'rgba(255,255,255,0.50)', fontSize: 9 },
  publish: { marginTop: 24, minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  publishDisabled: { opacity: 0.36 },
  publishText: { color: '#060908', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
});
