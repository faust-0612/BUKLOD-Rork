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
type CreateStep = 'source' | 'quick-edit' | 'preview' | 'details';

const QUICK_EDIT_TOOLS = ['Trim', 'Text', 'Audio', 'Speed', 'Cover', 'More'] as const;

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
  const [step, setStep] = useState<CreateStep>('source');
  const [caption, setCaption] = useState('');
  const [audience, setAudience] = useState<Audience>('public');
  const [groups, setGroups] = useState<IgpatGroupOption[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

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
    setStep('quick-edit');
  };

  const resetDraft = () => {
    if (busy) return;
    setDraft(null);
    setStep('source');
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

  const renderDraftPreview = () => {
    if (!draft) return null;
    return (
      <View style={styles.previewCard}>
        <Preview uri={draft.uri} />
        <View style={styles.previewMeta}>
          <Text style={styles.metaStrong}>{draft.durationSeconds}s</Text>
          <Text style={styles.meta}>{formatVideoBytes(draft.sizeBytes)}</Text>
          <Pressable onPress={resetDraft} disabled={busy}>
            <Text style={styles.change}>CHANGE</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderQuickEditShell = () => {
    if (!draft) return null;
    return (
      <>
        <View style={styles.timelineSection}>
          <View style={styles.timelineHeader}>
            <Text style={styles.timelineLabel}>TIMELINE</Text>
            <Text style={styles.timelineTime}>0:00 / 0:{String(draft.durationSeconds).padStart(2, '0')}</Text>
          </View>
          <View style={styles.timelineTrack}>
            {Array.from({ length: 12 }).map((_, index) => (
              <View key={index} style={styles.timelineFrame} />
            ))}
            <View style={styles.timelinePlayhead} />
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toolRail}
          style={styles.toolScroller}
        >
          {QUICK_EDIT_TOOLS.map(tool => (
            <View key={tool} style={styles.toolChip}>
              <Text style={styles.toolText}>{tool}</Text>
            </View>
          ))}
        </ScrollView>
      </>
    );
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>BUKLOD IGPAT</Text>
      <Text style={styles.title}>Create an Instant Bond</Text>
      <Text style={styles.subtitle}>Record or choose a short video, review it, then publish.</Text>

      {!draft || step === 'source' ? (
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
      ) : step === 'quick-edit' ? (
        <View>
          <Text style={styles.stepTitle}>QUICK EDIT</Text>
          <Text style={styles.stepCopy}>Keep the important tools close without crowding the screen.</Text>
          {renderDraftPreview()}
          {renderQuickEditShell()}
          <View style={styles.actionStack}>
            <Pressable style={styles.primaryAction} onPress={() => setStep('preview')} disabled={busy}>
              <Text style={styles.primaryActionText}>PREVIEW</Text>
            </Pressable>
            <Pressable style={styles.secondaryAction} onPress={() => setStep('details')} disabled={busy}>
              <Text style={styles.secondaryActionText}>SKIP EDITING / POST AS IS</Text>
            </Pressable>
          </View>
        </View>
      ) : step === 'preview' ? (
        <View>
          <Text style={styles.stepTitle}>PREVIEW</Text>
          <Text style={styles.stepCopy}>Watch the IGPAT before adding its caption and audience.</Text>
          {renderDraftPreview()}
          <View style={styles.actionStack}>
            <Pressable style={styles.primaryAction} onPress={() => setStep('details')} disabled={busy}>
              <Text style={styles.primaryActionText}>CONTINUE</Text>
            </Pressable>
            <Pressable style={styles.secondaryAction} onPress={() => setStep('quick-edit')} disabled={busy}>
              <Text style={styles.secondaryActionText}>BACK TO QUICK EDIT</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View>
          <Text style={styles.stepTitle}>CAPTION & AUDIENCE</Text>
          {renderDraftPreview()}

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
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060908' },
  content: { padding: 20, paddingTop: 58, paddingBottom: 48 },
  eyebrow: { color: 'rgba(255,255,255,0.58)', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  title: { marginTop: 7, color: '#FFFFFF', fontSize: 27, lineHeight: 32, fontWeight: '900' },
  subtitle: { marginTop: 7, color: 'rgba(255,255,255,0.62)', fontSize: 12, lineHeight: 18 },
  stepTitle: { marginTop: 24, color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 1.1 },
  stepCopy: { marginTop: 6, color: 'rgba(255,255,255,0.55)', fontSize: 11, lineHeight: 17 },
  sourceRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  sourceButton: { flex: 1, minHeight: 116, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101512' },
  sourceTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  sourceCopy: { marginTop: 5, color: 'rgba(255,255,255,0.48)', fontSize: 10 },
  previewCard: { marginTop: 18, overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0C110E' },
  preview: { width: '100%', height: 420, backgroundColor: '#000000' },
  previewMeta: { minHeight: 50, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  metaStrong: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  meta: { flex: 1, color: 'rgba(255,255,255,0.50)', fontSize: 10 },
  change: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  timelineSection: { marginTop: 14 },
  timelineHeader: { marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timelineLabel: { color: 'rgba(255,255,255,0.48)', fontSize: 8, fontWeight: '900', letterSpacing: 0.9 },
  timelineTime: { color: 'rgba(255,255,255,0.46)', fontSize: 9, fontWeight: '700' },
  timelineTrack: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0B100D', flexDirection: 'row', overflow: 'hidden', padding: 4, gap: 2, position: 'relative' },
  timelineFrame: { flex: 1, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.10)' },
  timelinePlayhead: { position: 'absolute', top: 0, bottom: 0, left: 6, width: 2, backgroundColor: '#FFFFFF' },
  toolScroller: { marginTop: 12 },
  toolRail: { gap: 8, paddingRight: 18 },
  toolChip: { minWidth: 68, minHeight: 38, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#0D120F', alignItems: 'center', justifyContent: 'center' },
  toolText: { color: 'rgba(255,255,255,0.76)', fontSize: 10, fontWeight: '800' },
  actionStack: { marginTop: 16, gap: 10 },
  primaryAction: { minHeight: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  primaryActionText: { color: '#060908', fontSize: 11, fontWeight: '900', letterSpacing: 0.9 },
  secondaryAction: { minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D120F' },
  secondaryActionText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
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