import React, { useEffect, useState, useRef } from 'react';
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
import {
  DEFAULT_IGPAT_QUICK_EDIT,
  IGPAT_MIN_OUTPUT_SECONDS,
  igpatOutputDurationSeconds,
  normalizeIgpatQuickEdit,
  serializeIgpatQuickEdit,
  type IgpatPlaybackRate,
  type IgpatQuickEditState,
  type IgpatRotation,
} from '@/lib/igpat/quickEdit';

type Audience = 'group' | 'local' | 'public';
type CreateStep = 'source' | 'quick-edit' | 'preview' | 'details';
type QuickEditTool = 'Trim' | 'Text' | 'Audio' | 'Speed' | 'Cover' | 'More';

const QUICK_EDIT_TOOLS: QuickEditTool[] = ['Trim', 'Text', 'Audio', 'Speed', 'Cover', 'More'];
const SPEEDS: IgpatPlaybackRate[] = [0.5, 0.75, 1, 1.25, 1.5, 2];

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

function formatClock(seconds: number): string {
  const safe = Math.max(0, Number(seconds) || 0);
  const whole = Math.floor(safe);
  const minutes = Math.floor(whole / 60);
  const remaining = whole % 60;
  const tenth = Math.floor((safe - whole) * 10);
  return `${minutes}:${String(remaining).padStart(2, '0')}.${tenth}`;
}

function EditedPreview({
  uri,
  edit,
  durationSeconds,
  seekSeconds,
  onTimeChange,
}: {
  uri: string;
  edit: IgpatQuickEditState;
  durationSeconds: number;
  seekSeconds: number | null;
  onTimeChange?: (seconds: number) => void;
}) {
  const normalized = normalizeIgpatQuickEdit(edit, durationSeconds);
  const start = normalized.trimStartSeconds;
  const end = Number(normalized.trimEndSeconds ?? durationSeconds);
  const player = useVideoPlayer(uri, instance => {
    instance.loop = false;
    instance.muted = normalized.muted;
    instance.playbackRate = normalized.speed;
  });

  useEffect(() => {
    try {
      player.loop = false;
      player.muted = normalized.muted;
      player.playbackRate = normalized.speed;
      if (player.currentTime < start || player.currentTime >= end) player.currentTime = start;
      player.play();
    } catch {}
  }, [end, normalized.muted, normalized.speed, player, start]);

  useEffect(() => {
    if (seekSeconds == null) return;
    try { player.currentTime = Math.max(start, Math.min(end, seekSeconds)); } catch {}
  }, [end, player, seekSeconds, start]);

  useEffect(() => {
    const timer = setInterval(() => {
      try {
        const current = Number(player.currentTime ?? 0);
        if (current >= end - 0.04 || current < start - 0.04) {
          player.currentTime = start;
          player.play();
          onTimeChange?.(start);
          return;
        }
        onTimeChange?.(current);
      } catch {}
    }, 100);

    return () => {
      clearInterval(timer);
      try { player.pause(); } catch {}
    };
  }, [end, onTimeChange, player, start]);

  return (
    <View style={styles.previewStage}>
      <VideoView
        player={player}
        style={[
          styles.preview,
          normalized.rotation !== 0 ? { transform: [{ rotate: `${normalized.rotation}deg` }] } : null,
        ]}
        nativeControls
        contentFit={normalized.contentFit}
      />
      {!!normalized.textOverlay.trim() && (
        <View pointerEvents="none" style={styles.overlayTextWrap}>
          <Text style={styles.overlayText}>{normalized.textOverlay.trim()}</Text>
        </View>
      )}
      {normalized.muted && (
        <View pointerEvents="none" style={styles.mutedBadge}>
          <Text style={styles.mutedBadgeText}>MUTED</Text>
        </View>
      )}
    </View>
  );
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
  const [step, setStep] = useState<CreateStep>('source');
  const [activeTool, setActiveTool] = useState<QuickEditTool>('Trim');
  const [edit, setEdit] = useState<IgpatQuickEditState>({ ...DEFAULT_IGPAT_QUICK_EDIT });
  const [previewTime, setPreviewTime] = useState(0);
  const [seekSeconds, setSeekSeconds] = useState<number | null>(null);
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
      return () => { cancelled = true; };
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

        if (!profile?.church_id && options.length) setAudience('group');
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

    return () => { cancelled = true; };
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
    setEdit({ ...DEFAULT_IGPAT_QUICK_EDIT });
    setPreviewTime(0);
    setSeekSeconds(null);
    setActiveTool('Trim');
    setStep('source');
  };

  const acceptDraft = (next: IgpatDraft) => {
    disposeDraft();
    setDraft(next);
    setEdit({ ...DEFAULT_IGPAT_QUICK_EDIT, trimEndSeconds: next.durationSeconds });
    setPreviewTime(0);
    setSeekSeconds(0);
    setActiveTool('Trim');
    setStep('quick-edit');
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

      acceptDraft({
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

    acceptDraft({
      uri: asset.uri,
      durationSeconds,
      sizeBytes,
      mimeType: mimeType === 'video/quicktime' || mimeType === 'video/webm' ? mimeType : 'video/mp4',
      fileName: String(asset?.fileName ?? `igpat.${extensionForMime(mimeType)}`),
    });
  };

  const applyEdit = (next: IgpatQuickEditState) => {
    if (!draft) return;
    setEdit(normalizeIgpatQuickEdit(next, draft.durationSeconds));
  };

  const patchEdit = (patch: Partial<IgpatQuickEditState>) => {
    if (!draft) return;
    applyEdit({ ...edit, ...patch });
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

    const normalizedEdit = normalizeIgpatQuickEdit(edit, draft.durationSeconds);
    const outputDuration = igpatOutputDurationSeconds(normalizedEdit, draft.durationSeconds);
    if (outputDuration < IGPAT_MIN_OUTPUT_SECONDS || outputDuration > BUKLOD_REEL_MAX_DURATION_SECONDS) {
      Alert.alert('BUKLOD IGPAT', 'The edited IGPAT must be between 1 and 60 seconds.');
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
      const { data, error } = await (supabase as any).rpc('create_buklod_reel_v2', {
        p_audience: audience,
        p_group_id: audience === 'group' ? groupId : null,
        p_body: caption.trim(),
        p_media_path: uploadedPath,
        p_media_mime_type: draft.mimeType,
        p_media_size_bytes: draft.sizeBytes,
        p_duration_seconds: draft.durationSeconds,
        p_edit_meta: serializeIgpatQuickEdit(normalizedEdit, draft.durationSeconds),
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

  const renderDraftPreview = () => {
    if (!draft) return null;
    return (
      <View style={styles.previewCard}>
        <EditedPreview
          uri={draft.uri}
          edit={edit}
          durationSeconds={draft.durationSeconds}
          seekSeconds={seekSeconds}
          onTimeChange={setPreviewTime}
        />
        <View style={styles.previewMeta}>
          <Text style={styles.metaStrong}>{formatClock(igpatOutputDurationSeconds(edit, draft.durationSeconds))}</Text>
          <Text style={styles.meta}>{formatVideoBytes(draft.sizeBytes)}</Text>
          <Pressable onPress={disposeDraft} disabled={busy}><Text style={styles.change}>CHANGE</Text></Pressable>
        </View>
      </View>
    );
  };

  const renderTrimPanel = () => {
    if (!draft) return null;
    const normalized = normalizeIgpatQuickEdit(edit, draft.durationSeconds);
    const start = normalized.trimStartSeconds;
    const end = Number(normalized.trimEndSeconds ?? draft.durationSeconds);
    const commonRangeStyle = { width: '100%', accentColor: '#ffffff', cursor: 'pointer' } as any;

    const updateStart = (value: number) => {
      const nextStart = Math.min(Math.max(0, value), end - IGPAT_MIN_OUTPUT_SECONDS);
      applyEdit({ ...normalized, trimStartSeconds: nextStart });
      setPreviewTime(nextStart);
      setSeekSeconds(nextStart);
    };

    const updateEnd = (value: number) => {
      const nextEnd = Math.max(start + IGPAT_MIN_OUTPUT_SECONDS, Math.min(draft.durationSeconds, value));
      applyEdit({ ...normalized, trimEndSeconds: nextEnd });
      setPreviewTime(Math.min(previewTime, nextEnd));
      setSeekSeconds(Math.min(previewTime, nextEnd));
    };

    return (
      <View style={styles.editorPanel}>
        <View style={styles.timelineHeader}>
          <Text style={styles.panelTitle}>TRIM · START / END HANDLES</Text>
          <Text style={styles.timelineTime}>{formatClock(start)} – {formatClock(end)}</Text>
        </View>
        <Text style={styles.rangeLabel}>START {formatClock(start)}</Text>
        {React.createElement('input', {
          type: 'range',
          min: 0,
          max: Math.max(0, end - IGPAT_MIN_OUTPUT_SECONDS),
          step: 0.1,
          value: start,
          disabled: busy,
          'aria-label': 'IGPAT trim start',
          onChange: (event: any) => updateStart(Number(event?.target?.value ?? 0)),
          style: commonRangeStyle,
        })}
        <Text style={styles.rangeLabel}>END {formatClock(end)}</Text>
        {React.createElement('input', {
          type: 'range',
          min: Math.min(draft.durationSeconds, start + IGPAT_MIN_OUTPUT_SECONDS),
          max: draft.durationSeconds,
          step: 0.1,
          value: end,
          disabled: busy,
          'aria-label': 'IGPAT trim end',
          onChange: (event: any) => updateEnd(Number(event?.target?.value ?? draft.durationSeconds)),
          style: commonRangeStyle,
        })}
        <Text style={styles.trimOutput}>OUTPUT {formatClock(igpatOutputDurationSeconds(normalized, draft.durationSeconds))}</Text>
      </View>
    );
  };

  const renderToolPanel = () => {
    if (!draft) return null;
    const normalized = normalizeIgpatQuickEdit(edit, draft.durationSeconds);

    if (activeTool === 'Trim') return renderTrimPanel();

    if (activeTool === 'Text') {
      return (
        <View style={styles.editorPanel}>
          <Text style={styles.panelTitle}>TEXT OVERLAY</Text>
          <TextInput
            value={normalized.textOverlay}
            onChangeText={value => patchEdit({ textOverlay: value.slice(0, 160) })}
            placeholder="Add short on-video text"
            placeholderTextColor="rgba(255,255,255,0.36)"
            maxLength={160}
            style={styles.overlayInput}
            editable={!busy}
          />
          <Text style={styles.panelHint}>Clean text overlay is supported. Drag/resize stays hidden until a safe composition renderer is available.</Text>
        </View>
      );
    }

    if (activeTool === 'Audio') {
      return (
        <View style={styles.editorPanel}>
          <Text style={styles.panelTitle}>ORIGINAL AUDIO</Text>
          <View style={styles.choiceRow}>
            <Pressable style={[styles.choiceChip, !normalized.muted && styles.choiceSelected]} onPress={() => patchEdit({ muted: false })} disabled={busy}>
              <Text style={[styles.choiceText, !normalized.muted && styles.choiceTextSelected]}>ON</Text>
            </Pressable>
            <Pressable style={[styles.choiceChip, normalized.muted && styles.choiceSelected]} onPress={() => patchEdit({ muted: true })} disabled={busy}>
              <Text style={[styles.choiceText, normalized.muted && styles.choiceTextSelected]}>MUTE</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    if (activeTool === 'Speed') {
      return (
        <View style={styles.editorPanel}>
          <Text style={styles.panelTitle}>PLAYBACK SPEED</Text>
          <View style={styles.choiceRow}>
            {SPEEDS.map(value => {
              const selected = normalized.speed === value;
              return (
                <Pressable key={value} style={[styles.choiceChip, selected && styles.choiceSelected]} onPress={() => patchEdit({ speed: value })} disabled={busy}>
                  <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{value}×</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    }

    if (activeTool === 'Cover') {
      return (
        <View style={styles.editorPanel}>
          <Text style={styles.panelTitle}>COVER FRAME</Text>
          <Text style={styles.panelValue}>Current frame · {formatClock(previewTime)}</Text>
          <Pressable style={styles.panelAction} onPress={() => patchEdit({ coverSeconds: previewTime })} disabled={busy}>
            <Text style={styles.panelActionText}>USE CURRENT FRAME</Text>
          </Pressable>
          <Text style={styles.panelHint}>Selected · {formatClock(normalized.coverSeconds)}</Text>
        </View>
      );
    }

    return (
      <View style={styles.editorPanel}>
        <Text style={styles.panelTitle}>FRAME & ORIENTATION</Text>
        <Text style={styles.panelLabel}>REFRAME</Text>
        <View style={styles.choiceRow}>
          {(['contain', 'cover'] as const).map(value => {
            const selected = normalized.contentFit === value;
            return (
              <Pressable key={value} style={[styles.choiceChip, selected && styles.choiceSelected]} onPress={() => patchEdit({ contentFit: value })} disabled={busy}>
                <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{value === 'cover' ? 'FILL 9:16' : 'FIT'}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.panelLabel}>ROTATE</Text>
        <View style={styles.choiceRow}>
          {([0, 90, 180, 270] as IgpatRotation[]).map(value => {
            const selected = normalized.rotation === value;
            return (
              <Pressable key={value} style={[styles.choiceChip, selected && styles.choiceSelected]} onPress={() => patchEdit({ rotation: value })} disabled={busy}>
                <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{value}°</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          style={styles.restoreAction}
          onPress={() => {
            setEdit({ ...DEFAULT_IGPAT_QUICK_EDIT, trimEndSeconds: draft.durationSeconds });
            setPreviewTime(0);
            setSeekSeconds(0);
          }}
          disabled={busy}
        >
          <Text style={styles.restoreActionText}>RESTORE ORIGINAL</Text>
        </Pressable>
      </View>
    );
  };

  const renderQuickEditShell = () => (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolRail} style={styles.toolScroller}>
        {QUICK_EDIT_TOOLS.map(tool => {
          const selected = activeTool === tool;
          return (
            <Pressable key={tool} style={[styles.toolChip, selected && styles.toolChipSelected]} onPress={() => setActiveTool(tool)} disabled={busy}>
              <Text style={[styles.toolText, selected && styles.toolTextSelected]}>{tool}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {renderToolPanel()}
    </>
  );

  const renderDetails = () => (
    <View>
      <Text style={styles.stepTitle}>CAPTION & AUDIENCE</Text>
      {renderDraftPreview()}

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
                if (value === 'group' && !groupId) setGroupId(groups[0]?.group_id ?? null);
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
                <Pressable key={option.group_id} style={[styles.clusterChip, selected && styles.clusterChipSelected]} onPress={() => setGroupId(option.group_id)} disabled={busy}>
                  <Text style={[styles.clusterText, selected && styles.clusterTextSelected]} numberOfLines={1}>{label}</Text>
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
    </View>
  );

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>BUKLOD IGPAT</Text>
      <Text style={styles.title}>Create an Instant Bond</Text>
      <Text style={styles.subtitle}>Record → Quick Edit → Preview → Caption / Audience → Post.</Text>

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
            {!recording ? <Pressable onPress={stopCamera}><Text style={styles.change}>CLOSE CAMERA</Text></Pressable> : null}
          </View>
        </View>
      ) : !draft || step === 'source' ? (
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
      ) : step === 'quick-edit' ? (
        <View>
          <Text style={styles.stepTitle}>QUICK EDIT</Text>
          <Text style={styles.stepCopy}>Non-destructive edits. Your original video stays intact.</Text>
          {renderDraftPreview()}
          {renderQuickEditShell()}
          <View style={styles.actionStack}>
            <Pressable style={styles.primaryAction} onPress={() => setStep('preview')} disabled={busy}>
              <Text style={styles.primaryActionText}>PREVIEW</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryAction}
              onPress={() => {
                if (!draft) return;
                setEdit({ ...DEFAULT_IGPAT_QUICK_EDIT, trimEndSeconds: draft.durationSeconds });
                setPreviewTime(0);
                setSeekSeconds(0);
                setStep('details');
              }}
              disabled={busy}
            >
              <Text style={styles.secondaryActionText}>SKIP EDITING / POST AS IS</Text>
            </Pressable>
          </View>
        </View>
      ) : step === 'preview' ? (
        <View>
          <Text style={styles.stepTitle}>PREVIEW</Text>
          <Text style={styles.stepCopy}>Watch the edited IGPAT before adding its caption and audience.</Text>
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
      ) : renderDetails()}
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
  cameraCard: { marginTop: 24, overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0C110E' },
  cameraActions: { padding: 14, gap: 10, alignItems: 'center' },
  recordTime: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  recordButton: { minWidth: 180, minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  stopButton: { backgroundColor: '#F0D7D7' },
  recordButtonText: { color: '#060908', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  previewCard: { marginTop: 18, overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0C110E' },
  previewStage: { width: '100%', height: 420, backgroundColor: '#000000', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  preview: { width: '100%', height: 420, backgroundColor: '#000000' },
  overlayTextWrap: { position: 'absolute', left: 20, right: 20, bottom: 44, alignItems: 'center' },
  overlayText: { maxWidth: '100%', color: '#FFFFFF', fontSize: 22, lineHeight: 28, fontWeight: '900', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.85)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  mutedBadge: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.68)' },
  mutedBadgeText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  previewMeta: { minHeight: 50, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  metaStrong: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  meta: { flex: 1, color: 'rgba(255,255,255,0.50)', fontSize: 10 },
  change: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  toolScroller: { marginTop: 12 },
  toolRail: { gap: 8, paddingRight: 18 },
  toolChip: { minWidth: 68, minHeight: 38, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#0D120F', alignItems: 'center', justifyContent: 'center' },
  toolChipSelected: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  toolText: { color: 'rgba(255,255,255,0.76)', fontSize: 10, fontWeight: '800' },
  toolTextSelected: { color: '#060908' },
  editorPanel: { marginTop: 14, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0B100D' },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  timelineTime: { color: 'rgba(255,255,255,0.62)', fontSize: 9, fontWeight: '800' },
  panelTitle: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  panelLabel: { marginTop: 13, marginBottom: 7, color: 'rgba(255,255,255,0.48)', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  panelHint: { marginTop: 10, color: 'rgba(255,255,255,0.46)', fontSize: 9.5, lineHeight: 15 },
  panelValue: { marginTop: 9, color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: '800' },
  rangeLabel: { marginTop: 12, marginBottom: 4, color: 'rgba(255,255,255,0.56)', fontSize: 8.5, fontWeight: '900' },
  trimOutput: { marginTop: 9, color: '#FFFFFF', fontSize: 9, fontWeight: '900', textAlign: 'center' },
  overlayInput: { marginTop: 10, minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', color: '#FFFFFF', paddingHorizontal: 12, backgroundColor: '#101512' },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  choiceChip: { minWidth: 54, minHeight: 38, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', backgroundColor: '#101512' },
  choiceSelected: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  choiceText: { color: 'rgba(255,255,255,0.72)', fontSize: 9, fontWeight: '900' },
  choiceTextSelected: { color: '#060908' },
  panelAction: { marginTop: 12, minHeight: 42, borderRadius: 13, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  panelActionText: { color: '#060908', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  restoreAction: { marginTop: 16, minHeight: 42, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  restoreActionText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
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
  progressText: { color: 'rgba(255,255,255,0.82)', fontSize: 11, fontWeight: '800' },
  progressSub: { marginTop: 2, color: 'rgba(255,255,255,0.50)', fontSize: 9 },
  publish: { marginTop: 24, minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  publishDisabled: { opacity: 0.36 },
  publishText: { color: '#060908', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
});