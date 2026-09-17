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
import { router, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { createVideoPlayer, VideoView, useVideoPlayer } from 'expo-video';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useIncomingShare } from '@/lib/buklodIncomingShare';
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

type IgpatGroupOption = {
  group_id: string;
  group_name?: string | null;
  group_code?: string | null;
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

async function readSharedVideoDurationSeconds(uri: string): Promise<number> {
  const player = createVideoPlayer(null);

  return await new Promise<number>((resolve, reject) => {
    let finished = false;
    let sourceSubscription: any = null;
    let statusSubscription: any = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = (error: Error | null, duration = 0) => {
      if (finished) return;
      finished = true;

      try {
        sourceSubscription?.remove?.();
      } catch {}
      try {
        statusSubscription?.remove?.();
      } catch {}
      if (timer) clearTimeout(timer);
      try {
        player.release();
      } catch {}

      if (error) reject(error);
      else resolve(duration);
    };

    sourceSubscription = player.addListener('sourceLoad', (event: any) => {
      const duration = Number(event?.duration ?? player.duration ?? 0);
      if (duration > 0) {
        finish(null, duration);
      } else {
        finish(new Error('Could not determine the shared video duration.'));
      }
    });

    statusSubscription = player.addListener('statusChange', (event: any) => {
      if (event?.status === 'error') {
        finish(
          new Error(
            String(event?.error?.message ?? 'Could not open the shared video.')
          )
        );
      }
    });

    timer = setTimeout(() => {
      finish(new Error('BUKLOD could not inspect the shared video.'));
    }, 15000);

    void player.replaceAsync(uri).catch((error: any) => {
      finish(
        new Error(
          String(error?.message ?? 'Could not open the shared video.')
        )
      );
    });
  });
}

function Preview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, instance => {
    instance.loop = true;
    instance.muted = false;
  });

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {}
    };
  }, [player]);

  return (
    <VideoView
      player={player}
      style={styles.preview}
      nativeControls
      contentFit="contain"
    />
  );
}

export default function IgpatCreateScreen() {
  const { user, profile } = useAuth();
  const params = useLocalSearchParams<{ incomingShare?: string | string[] }>();
  const incoming = useIncomingShare();
  const incomingShareSignatureRef = useRef('');
  const shouldImportIncomingShare =
    String(
      Array.isArray(params.incomingShare)
        ? params.incomingShare[0]
        : params.incomingShare ?? ''
    ) === '1';

  const [draft, setDraft] = useState<IgpatDraft | null>(null);
  const [caption, setCaption] = useState('');
  const [audience, setAudience] = useState<Audience>('public');
  const [groups, setGroups] = useState<IgpatGroupOption[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const pickerBusyRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      pickerBusyRef.current = false;
    };
  }, []);

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

  const acceptVideo = async (asset: any): Promise<boolean> => {
    try {
      if (!asset?.uri) {
        Alert.alert('BUKLOD IGPAT', 'The selected video could not be read.');
        return false;
      }

      const durationSeconds = Math.ceil(Number(asset?.duration ?? 0) / 1000);
      if (!durationSeconds || durationSeconds < 1) {
        Alert.alert('BUKLOD IGPAT', 'Could not determine the video duration.');
        return false;
      }
      if (durationSeconds > BUKLOD_REEL_MAX_DURATION_SECONDS) {
        Alert.alert(
          'Maximum 60 Seconds',
          `This video is ${durationSeconds} seconds. IGPAT videos may be up to 60 seconds only.`
        );
        return false;
      }

      const sizeBytes = await readVideoSizeBytes(asset, async (uri, options) =>
        FileSystem.getInfoAsync(uri, options as any)
      );
      const validationError = validateCommunityVideoUpload({
        durationSeconds,
        sizeBytes,
        isReel: true,
      });
      if (validationError) {
        Alert.alert('BUKLOD IGPAT', validationError);
        return false;
      }

      const mimeType = inferMime(asset);
      if (!mountedRef.current) return false;
      setDraft({
        uri: asset.uri,
        durationSeconds,
        sizeBytes,
        mimeType,
        fileName: String(asset.fileName ?? `igpat.${extensionForMime(mimeType)}`),
      });
      return true;
    } catch (error: any) {
      console.warn('BUKLOD IGPAT accept video:', String(error?.message ?? error));
      if (mountedRef.current) {
        Alert.alert(
          'Could Not Prepare Video',
          error?.message ?? 'The video could not be prepared safely. Please try again.'
        );
      }
      return false;
    }
  };

  useEffect(() => {
    if (!shouldImportIncomingShare || incoming.isResolving || draft) return;

    const raw: any[] = incoming.sharedPayloads ?? [];
    const resolved: any[] = incoming.resolvedSharedPayloads ?? [];
    if (!raw.length && !resolved.length) return;

    const videos = (resolved.length
      ? resolved
      : raw.map((row: any) => ({
          contentType: row?.shareType,
          contentUri: row?.value,
          contentMimeType: row?.mimeType,
          contentSize: null,
          originalName: null,
        })))
      .filter(
        (row: any) =>
          (row?.contentType === 'video' ||
            String(row?.contentMimeType ?? '').toLowerCase().startsWith('video/')) &&
          typeof row?.contentUri === 'string' &&
          row.contentUri.length > 0
      );

    if (!videos.length) return;

    const signature = JSON.stringify(
      videos.map((row: any) => [
        row?.contentUri,
        row?.contentMimeType,
        row?.contentSize,
        row?.originalName,
      ])
    );
    if (!signature || incomingShareSignatureRef.current === signature) return;
    incomingShareSignatureRef.current = signature;

    void (async () => {
      try {
        const video = videos[0];
        const durationSeconds = await readSharedVideoDurationSeconds(
          video.contentUri
        );

        const sharedCaption = raw
          .filter(
            (row: any) => row?.shareType === 'text' || row?.shareType === 'url'
          )
          .map((row: any) => String(row?.value ?? '').trim())
          .filter(Boolean)
          .join('\n\n');

        if (sharedCaption) {
          setCaption(current => current.trim() ? current : sharedCaption.slice(0, 500));
        }

        const accepted = await acceptVideo({
          uri: video.contentUri,
          duration: durationSeconds * 1000,
          fileSize: Number(video.contentSize ?? 0) || undefined,
          mimeType: video.contentMimeType || 'video/mp4',
          fileName: video.originalName || 'shared-igpat.mp4',
          type: 'video',
        });

        if (!accepted) return;

        incoming.clearSharedPayloads();
        Alert.alert(
          'Shared Video Ready',
          'The video shared to BUKLOD is now in IGPAT. Review the preview, caption, and audience before publishing.'
        );
      } catch (error: any) {
        console.warn('BUKLOD IGPAT incoming share:', String(error?.message ?? error));
        Alert.alert(
          'Could Not Import Shared Video',
          String(error?.message ?? 'Please share the video to BUKLOD again or select it from your device.')
        );
      }
    })();
  }, [
    shouldImportIncomingShare,
    incoming.isResolving,
    incoming.sharedPayloads,
    incoming.resolvedSharedPayloads,
    draft,
  ]);

  const handlePickerResult = async (result: any) => {
    if (!result) return;

    if (result?.code) {
      console.warn(
        'BUKLOD IGPAT picker result:',
        String(result?.message ?? result?.code)
      );
      if (mountedRef.current) {
        Alert.alert(
          'Camera Result Could Not Be Restored',
          result?.message ?? 'Please record or select the video again.'
        );
      }
      return;
    }

    if (!result.canceled && result.assets?.length) {
      await acceptVideo(result.assets[0]);
    }
  };

  const beginPicker = () => {
    if (busy || pickerBusyRef.current) return false;
    pickerBusyRef.current = true;
    if (mountedRef.current) setPickerBusy(true);
    return true;
  };

  const endPicker = () => {
    pickerBusyRef.current = false;
    if (mountedRef.current) setPickerBusy(false);
  };

  const chooseVideo = async () => {
    if (!beginPicker()) return;

    try {
      // Load the native picker only after explicit user action. This keeps
      // /igpat/create mount-compatible with older production binaries and
      // turns native-module drift into a caught error instead of an app crash.
      const ImagePicker = await import('expo-image-picker');
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Media Permission',
          'Photo and video library access is required to select an IGPAT.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
      });
      await handlePickerResult(result);
    } catch (error: any) {
      console.warn('BUKLOD IGPAT library picker:', String(error?.message ?? error));
      Alert.alert(
        'Could Not Open Videos',
        error?.message ??
          'Video selection is not available in this installed app version. Please update the app before trying again.'
      );
    } finally {
      endPicker();
    }
  };

  const recordVideo = async () => {
    if (!beginPicker()) return;

    try {
      // Same compatibility rule as SELECT: never require ImagePicker native
      // methods merely by opening the IGPAT creator.
      const ImagePicker = await import('expo-image-picker');
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Camera Permission',
          'Camera access is required to record an IGPAT.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        videoMaxDuration: 60,
        allowsEditing: false,
      });
      await handlePickerResult(result);
    } catch (error: any) {
      console.warn('BUKLOD IGPAT camera picker:', String(error?.message ?? error));
      Alert.alert(
        'Could Not Record Video',
        error?.message ??
          'Camera video recording is not available in this installed app version. Please update the app before trying again.'
      );
    } finally {
      endPicker();
    }
  };

  const publish = async () => {
    if (!user?.id || !draft || busy || pickerBusy) return;
    if (
      audience === 'group' &&
      (!groupId || !groups.some(row => row.group_id === groupId))
    ) {
      return Alert.alert('BUKLOD IGPAT', 'Choose an active BUKLOD Cluster first.');
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
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.eyebrow}>BUKLOD IGPAT</Text>
      <Text style={styles.title}>Create an Instant Bond</Text>
      <Text style={styles.subtitle}>
        Record or choose a short video, preview it, then publish.
      </Text>

      {draft ? (
        <View style={styles.previewCard}>
          <Preview uri={draft.uri} />
          <View style={styles.previewMeta}>
            <Text style={styles.metaStrong}>{draft.durationSeconds}s</Text>
            <Text style={styles.meta}>{formatVideoBytes(draft.sizeBytes)}</Text>
            <Pressable onPress={() => setDraft(null)} disabled={busy || pickerBusy}>
              <Text style={styles.change}>CHANGE</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.sourceRow}>
          <Pressable
            style={[styles.sourceButton, pickerBusy && styles.sourceButtonDisabled]}
            onPress={() => void recordVideo()}
            disabled={busy || pickerBusy}
          >
            {pickerBusy ? <ActivityIndicator color="#FFFFFF" /> : null}
            <Text style={styles.sourceTitle}>RECORD</Text>
            <Text style={styles.sourceCopy}>
              {pickerBusy ? 'Opening…' : 'Use camera'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.sourceButton, pickerBusy && styles.sourceButtonDisabled]}
            onPress={() => void chooseVideo()}
            disabled={busy || pickerBusy}
          >
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
        editable={!busy && !pickerBusy}
      />

      <Text style={styles.label}>AUDIENCE</Text>
      <View style={styles.audienceRow}>
        {(['public', 'local', 'group'] as Audience[]).map(value => {
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
              disabled={busy || pickerBusy || disabled}
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
                  disabled={busy || pickerBusy}
                >
                  <Text
                    style={[styles.clusterText, selected && styles.clusterTextSelected]}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {busy && (
        <View style={styles.progressRow}>
          <ActivityIndicator color="#FFFFFF" />
          <Text style={styles.progressText}>
            Uploading {progress == null ? '' : `${Math.round(progress * 100)}%`}
          </Text>
        </View>
      )}

      <Pressable
        style={[styles.publish, (!draft || busy || pickerBusy) && styles.publishDisabled]}
        disabled={!draft || busy || pickerBusy}
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
  sourceButtonDisabled: { opacity: 0.58 },
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
  progressText: { color: 'rgba(255,255,255,0.70)', fontSize: 11, fontWeight: '700' },
  publish: { marginTop: 24, minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  publishDisabled: { opacity: 0.36 },
  publishText: { color: '#060908', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
});