import React, { useEffect, useState } from 'react';
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
import * as FileSystem from 'expo-file-system/legacy';
import { VideoView, useVideoPlayer } from 'expo-video';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { uploadCommunityVideoFile } from '@/lib/uploadCommunityVideoFile';
import {
  BUKLOD_REEL_MAX_DURATION_SECONDS,
  formatVideoBytes,
  readVideoSizeBytes,
  validateCommunityVideoUpload,
} from '@/lib/buklodCommunityWallMedia';

type Audience = 'group' | 'local' | 'public';

type IgpatDraft = {
  uri: string;
  durationSeconds: number;
  sizeBytes: number;
  mimeType: string;
  fileName: string;
};

function inferMime(asset: any): string {
  const direct = String(asset?.mimeType ?? '').toLowerCase();
  if (direct === 'video/mp4' || direct === 'video/quicktime' || direct === 'video/webm') {
    return direct;
  }
  const name = String(asset?.fileName ?? asset?.uri ?? '').toLowerCase();
  if (name.endsWith('.mov')) return 'video/quicktime';
  if (name.endsWith('.webm')) return 'video/webm';
  return 'video/mp4';
}

function extensionForMime(mime: string): string {
  if (mime === 'video/quicktime') return 'mov';
  if (mime === 'video/webm') return 'webm';
  return 'mp4';
}

function Preview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, instance => {
    instance.loop = true;
    instance.muted = false;
  });

  useEffect(() => {
    try {
      player.play();
    } catch {}
    return () => {
      try {
        player.pause();
      } catch {}
    };
  }, [player]);

  return <VideoView player={player} style={styles.preview} nativeControls contentFit="contain" />;
}

export default function IgpatCreateScreen() {
  const { user, profile } = useAuth();
  const [draft, setDraft] = useState<IgpatDraft | null>(null);
  const [caption, setCaption] = useState('');
  const [audience, setAudience] = useState<Audience>('public');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    void supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setGroupId(data?.group_id ?? null);
      });
  }, [user?.id]);

  const acceptVideo = async (asset: any) => {
    const durationSeconds = Math.ceil(Number(asset?.duration ?? 0) / 1000);
    if (!durationSeconds || durationSeconds < 1) {
      return Alert.alert('BUKLOD IGPAT', 'Could not determine the video duration.');
    }
    if (durationSeconds > BUKLOD_REEL_MAX_DURATION_SECONDS) {
      return Alert.alert(
        'Maximum 60 Seconds',
        `This video is ${durationSeconds} seconds. IGPAT videos may be up to 60 seconds only.`
      );
    }

    const sizeBytes = await readVideoSizeBytes(asset, async (uri, options) =>
      FileSystem.getInfoAsync(uri, options as any)
    );
    const validationError = validateCommunityVideoUpload({
      durationSeconds,
      sizeBytes,
      isReel: true,
    });
    if (validationError) return Alert.alert('BUKLOD IGPAT', validationError);

    const mimeType = inferMime(asset);
    setDraft({
      uri: asset.uri,
      durationSeconds,
      sizeBytes,
      mimeType,
      fileName: String(asset.fileName ?? `igpat.${extensionForMime(mimeType)}`),
    });
  };

  const chooseVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets?.length) await acceptVideo(result.assets[0]);
  };

  const recordVideo = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      return Alert.alert('Camera Permission', 'Camera access is required to record an IGPAT.');
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: 60,
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets?.length) await acceptVideo(result.assets[0]);
  };

  const publish = async () => {
    if (!user?.id || !draft || busy) return;
    if (audience === 'group' && !groupId) {
      return Alert.alert('BUKLOD IGPAT', 'You do not have an active BUKLOD Cluster.');
    }
    if ((audience === 'local' || audience === 'public') && !profile?.church_id) {
      return Alert.alert('BUKLOD IGPAT', 'A Local Church assignment is required for this audience.');
    }

    setBusy(true);
    let uploadedPath: string | null = null;

    try {
      uploadedPath = `${user.id}/igpat-${Date.now()}-${Math.random().toString(36).slice(2)}.${extensionForMime(draft.mimeType)}`;
      setProgress(0);
      await uploadCommunityVideoFile({
        path: uploadedPath,
        uri: draft.uri,
        contentType: draft.mimeType,
        onProgress: value => setProgress(value.ratio),
      });

      const { error } = await (supabase as any).rpc('create_buklod_reel_v1', {
        p_audience: audience,
        p_group_id: audience === 'group' ? groupId : null,
        p_body: caption.trim(),
        p_media_path: uploadedPath,
        p_media_mime_type: draft.mimeType,
        p_media_size_bytes: draft.sizeBytes,
        p_duration_seconds: draft.durationSeconds,
      });
      if (error) throw error;

      Alert.alert('IGPAT Published', 'Your IGPAT is now available to the selected audience.');
      router.replace('/igpat' as any);
    } catch (error: any) {
      if (uploadedPath) {
        await supabase.storage.from('community-media').remove([uploadedPath]);
      }
      Alert.alert('Could Not Publish IGPAT', error?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>BUKLOD IGPAT</Text>
      <Text style={styles.title}>Create an Instant Bond</Text>
      <Text style={styles.subtitle}>Record or choose a short video, preview it, then publish.</Text>

      {draft ? (
        <View style={styles.previewCard}>
          <Preview uri={draft.uri} />
          <View style={styles.previewMeta}>
            <Text style={styles.metaStrong}>{draft.durationSeconds}s</Text>
            <Text style={styles.meta}>{formatVideoBytes(draft.sizeBytes)}</Text>
            <Pressable onPress={() => setDraft(null)} disabled={busy}>
              <Text style={styles.change}>CHANGE</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.sourceRow}>
          <Pressable style={styles.sourceButton} onPress={() => void recordVideo()} disabled={busy}>
            <Text style={styles.sourceTitle}>RECORD</Text>
            <Text style={styles.sourceCopy}>Use camera</Text>
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
        placeholder="Write a caption..."
        placeholderTextColor="rgba(255,255,255,0.38)"
        multiline
        maxLength={500}
        style={styles.caption}
        editable={!busy}
      />

      <Text style={styles.label}>AUDIENCE</Text>
      <View style={styles.audienceRow}>
        {(['public', 'local', 'group'] as Audience[]).map(value => (
          <Pressable
            key={value}
            style={[styles.audienceButton, audience === value && styles.audienceSelected]}
            onPress={() => setAudience(value)}
            disabled={busy}
          >
            <Text style={[styles.audienceText, audience === value && styles.audienceSelectedText]}>
              {value === 'group' ? 'CLUSTER' : value.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      {busy && (
        <View style={styles.progressRow}>
          <ActivityIndicator color="#FFFFFF" />
          <Text style={styles.progressText}>
            Uploading {progress == null ? '' : `${Math.round(progress * 100)}%`}
          </Text>
        </View>
      )}

      <Pressable
        style={[styles.publish, (!draft || busy) && styles.publishDisabled]}
        disabled={!draft || busy}
        onPress={() => void publish()}
      >
        <Text style={styles.publishText}>{busy ? 'PUBLISHING...' : 'PUBLISH IGPAT'}</Text>
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
  audienceText: { color: 'rgba(255,255,255,0.68)', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  audienceSelectedText: { color: '#080C09' },
  progressRow: { marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  progressText: { color: 'rgba(255,255,255,0.70)', fontSize: 11, fontWeight: '700' },
  publish: { marginTop: 24, minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  publishDisabled: { opacity: 0.36 },
  publishText: { color: '#060908', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
});
