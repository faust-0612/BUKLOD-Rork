import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
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
import {
  DEFAULT_IGPAT_QUICK_EDIT,
  IGPAT_MIN_OUTPUT_SECONDS,
  igpatOutputDurationSeconds,
  normalizeIgpatQuickEdit,
  serializeIgpatQuickEdit,
  suggestIgpatAutoImprove,
  type IgpatPlaybackRate,
  type IgpatQuickEditState,
  type IgpatRotation,
} from '@/lib/igpat/quickEdit';
import {
  igpatRelayPromptLabel,
  normalizeIgpatRelayPrompt,
  type IgpatRelayPrompt,
} from '@/lib/igpat/relay';
import { useIgpatQuickEditHistory } from '@/lib/igpat/useQuickEditHistory';
import type { IgpatCreationMode, IgpatDraftSaveInput } from '@/lib/igpat/draftTypes';
import {
  clearNativeIgpatDraft,
  loadNativeIgpatDraft,
  prepareNativeIgpatDraftMedia,
  saveNativeIgpatDraft,
} from '@/lib/igpat/draftStorage.native';

type Audience = 'group' | 'local' | 'public';
type CreateStep = 'source' | 'quick-edit' | 'preview' | 'details';
type QuickEditTool = 'Trim' | 'Text' | 'Audio' | 'Speed' | 'Cover' | 'More';

const QUICK_EDIT_TOOLS: QuickEditTool[] = ['Trim', 'Text', 'Audio', 'Speed', 'Cover', 'More'];
const SPEEDS: IgpatPlaybackRate[] = [0.5, 0.75, 1, 1.25, 1.5, 2];
const DRAFT_AUTOSAVE_DELAY_MS = 350;

type IgpatDraft = {
  uri: string;
  persistedMediaUri: string;
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

function routeParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '');
}

function inferMime(asset: any): string {
  const direct = String(asset?.mimeType ?? '').toLowerCase();
  if (direct === 'video/mp4' || direct === 'video/quicktime' || direct === 'video/webm') return direct;
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
          player.pause();
          onTimeChange?.(start);
          return;
        }
        onTimeChange?.(current);
      } catch {}
    }, 120);

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

function TrimTimeline({
  edit,
  durationSeconds,
  currentSeconds,
  onChange,
  onSeek,
  onInteractionStart,
  onInteractionEnd,
}: {
  edit: IgpatQuickEditState;
  durationSeconds: number;
  currentSeconds: number;
  onChange: (next: IgpatQuickEditState) => void;
  onSeek: (seconds: number) => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
}) {
  const [width, setWidth] = useState(1);
  const targetRef = useRef<'start' | 'end' | 'scrub'>('scrub');
  const normalized = normalizeIgpatQuickEdit(edit, durationSeconds);
  const start = normalized.trimStartSeconds;
  const end = Number(normalized.trimEndSeconds ?? durationSeconds);
  const current = Math.max(start, Math.min(end, currentSeconds));
  const pctNumber = (value: number) =>
    Math.max(0, Math.min(100, durationSeconds ? (value / durationSeconds) * 100 : 0));
  const pct = (value: number) => `${pctNumber(value)}%` as const;

  const updateFromX = (x: number, target: 'start' | 'end' | 'scrub') => {
    const seconds = Math.max(0, Math.min(durationSeconds, (x / Math.max(1, width)) * durationSeconds));
    if (target === 'start') {
      const nextStart = Math.min(seconds, end - IGPAT_MIN_OUTPUT_SECONDS);
      const next = normalizeIgpatQuickEdit({ ...normalized, trimStartSeconds: nextStart }, durationSeconds);
      onChange(next);
      onSeek(next.trimStartSeconds);
      return;
    }
    if (target === 'end') {
      const nextEnd = Math.max(seconds, start + IGPAT_MIN_OUTPUT_SECONDS);
      const next = normalizeIgpatQuickEdit({ ...normalized, trimEndSeconds: nextEnd }, durationSeconds);
      onChange(next);
      onSeek(Number(next.trimEndSeconds ?? durationSeconds));
      return;
    }
    onSeek(Math.max(start, Math.min(end, seconds)));
  };

  const finishInteraction = () => {
    if (targetRef.current !== 'scrub') onInteractionEnd();
    targetRef.current = 'scrub';
  };

  const responder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: event => {
        const x = Number(event.nativeEvent.locationX ?? 0);
        const startX = durationSeconds ? (start / durationSeconds) * width : 0;
        const endX = durationSeconds ? (end / durationSeconds) * width : width;
        if (Math.abs(x - startX) <= 26) targetRef.current = 'start';
        else if (Math.abs(x - endX) <= 26) targetRef.current = 'end';
        else targetRef.current = 'scrub';
        if (targetRef.current !== 'scrub') onInteractionStart();
        updateFromX(x, targetRef.current);
      },
      onPanResponderMove: event => updateFromX(Number(event.nativeEvent.locationX ?? 0), targetRef.current),
      onPanResponderRelease: finishInteraction,
      onPanResponderTerminate: finishInteraction,
      onPanResponderTerminationRequest: () => false,
    }),
    [durationSeconds, end, normalized, onInteractionEnd, onInteractionStart, start, width]
  );

  return (
    <View style={styles.timelineSection}>
      <View style={styles.timelineHeader}>
        <Text style={styles.timelineLabel}>TRIM · DRAG HANDLES OR SCRUB</Text>
        <Text style={styles.timelineTime}>{formatClock(start)} – {formatClock(end)}</Text>
      </View>
      <View style={styles.timelineTrack} onLayout={event => setWidth(Math.max(1, event.nativeEvent.layout.width))} {...responder.panHandlers}>
        {Array.from({ length: 12 }).map((_, index) => <View key={index} style={styles.timelineFrame} />)}
        <View pointerEvents="none" style={[styles.trimWindow, { left: pct(start), right: `${100 - pctNumber(end)}%` }]} />
        <View pointerEvents="none" style={[styles.trimHandle, styles.trimHandleStart, { left: pct(start) }]} />
        <View pointerEvents="none" style={[styles.trimHandle, styles.trimHandleEnd, { left: pct(end) }]} />
        <View pointerEvents="none" style={[styles.timelinePlayhead, { left: pct(current) }]} />
      </View>
      <View style={styles.trimStats}>
        <Text style={styles.trimStat}>START {formatClock(start)}</Text>
        <Text style={styles.trimStatStrong}>OUTPUT {formatClock(igpatOutputDurationSeconds(normalized, durationSeconds))}</Text>
        <Text style={styles.trimStat}>END {formatClock(end)}</Text>
      </View>
    </View>
  );
}

export default function IgpatCreateScreen() {
  const params = useLocalSearchParams<{
    relayParentPostId?: string | string[];
    relayPrompt?: string | string[];
    relayParentAuthor?: string | string[];
  }>();
  const routeRelayParentPostId = routeParam(params.relayParentPostId).trim();
  const routeRelayPrompt = normalizeIgpatRelayPrompt(routeParam(params.relayPrompt));
  const routeRelayParentAuthor = routeParam(params.relayParentAuthor).trim().slice(0, 120);
  const { user, profile } = useAuth();
  const [draft, setDraft] = useState<IgpatDraft | null>(null);
  const [step, setStep] = useState<CreateStep>('source');
  const [creationMode, setCreationMode] = useState<IgpatCreationMode>('standard');
  const [relayParentPostId, setRelayParentPostId] = useState<string | null>(
    routeRelayParentPostId && routeRelayPrompt ? routeRelayParentPostId : null
  );
  const [relayPrompt, setRelayPrompt] = useState<IgpatRelayPrompt | null>(
    routeRelayParentPostId ? routeRelayPrompt : null
  );
  const [relayParentAuthor, setRelayParentAuthor] = useState<string | null>(
    routeRelayParentPostId && routeRelayPrompt && routeRelayParentAuthor ? routeRelayParentAuthor : null
  );
  const [activeTool, setActiveTool] = useState<QuickEditTool>('Trim');
  const {
    edit,
    canUndo,
    canRedo,
    reset: resetEditHistory,
    commit: commitEdit,
    commitPatch: patchEdit,
    beginTransaction: beginEditTransaction,
    updateTransaction: updateEditTransaction,
    updateTransactionPatch: updatePatchTransaction,
    endTransaction: endEditTransaction,
    undo: undoEdit,
    redo: redoEdit,
  } = useIgpatQuickEditHistory(draft?.durationSeconds);
  const [previewTime, setPreviewTime] = useState(0);
  const [seekSeconds, setSeekSeconds] = useState<number | null>(null);
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
  const draftRecoveryUserRef = useRef<string | null>(null);
  const latestDraftSaveRef = useRef<IgpatDraftSaveInput | null>(null);
  const pendingCreationModeRef = useRef<IgpatCreationMode>('standard');

  useEffect(() => {
    if (!draft && routeRelayParentPostId && routeRelayPrompt) {
      setRelayParentPostId(routeRelayParentPostId);
      setRelayPrompt(routeRelayPrompt);
      setRelayParentAuthor(routeRelayParentAuthor || null);
    }
  }, [draft, routeRelayParentAuthor, routeRelayParentPostId, routeRelayPrompt]);

  useEffect(() => () => {
    mountedRef.current = false;
    pickerBusyRef.current = false;
    const pending = latestDraftSaveRef.current;
    if (pending) void saveNativeIgpatDraft(pending).catch(() => undefined);
  }, []);

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
        setGroupId(current => current && options.some(row => row.group_id === current) ? current : options[0]?.group_id ?? null);
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

  useEffect(() => {
    if (!user?.id || draftRecoveryUserRef.current === user.id) return;
    draftRecoveryUserRef.current = user.id;
    let cancelled = false;

    void loadNativeIgpatDraft(user.id)
      .then(snapshot => {
        if (cancelled || !snapshot) return;
        Alert.alert(
          'BUKLOD IGPAT Draft',
          'You have a saved IGPAT draft on this device.',
          [
            {
              text: 'DISCARD DRAFT',
              style: 'destructive',
              onPress: () => {
                latestDraftSaveRef.current = null;
                void clearNativeIgpatDraft(user.id);
              },
            },
            {
              text: 'CONTINUE EDITING',
              onPress: () => {
                if (cancelled) return;
                const restoredMode: IgpatCreationMode = snapshot.creationMode === 'quick-capture' ? 'quick-capture' : 'standard';
                setDraft({
                  uri: snapshot.mediaUri,
                  persistedMediaUri: snapshot.mediaUri,
                  durationSeconds: snapshot.durationSeconds,
                  sizeBytes: snapshot.sizeBytes,
                  mimeType: snapshot.mimeType,
                  fileName: snapshot.fileName,
                });
                setCreationMode(restoredMode);
                setRelayParentPostId(snapshot.relayParentPostId ?? null);
                setRelayPrompt(normalizeIgpatRelayPrompt(snapshot.relayPrompt));
                setRelayParentAuthor(snapshot.relayParentAuthor ?? null);
                pendingCreationModeRef.current = restoredMode;
                resetEditHistory(snapshot.edit, snapshot.durationSeconds);
                setCaption(snapshot.caption);
                setAudience(snapshot.audience);
                setGroupId(snapshot.groupId);
                setPreviewTime(snapshot.edit.trimStartSeconds);
                setSeekSeconds(snapshot.edit.trimStartSeconds);
                setActiveTool('Trim');
                setStep(restoredMode === 'quick-capture' ? 'preview' : 'quick-edit');
              },
            },
          ],
          { cancelable: false }
        );
      })
      .catch(error => console.warn('BUKLOD IGPAT draft recovery:', String(error?.message ?? error)));

    return () => { cancelled = true; };
  }, [resetEditHistory, user?.id]);

  useEffect(() => {
    if (!user?.id || !draft) return;
    const input: IgpatDraftSaveInput = {
      userId: user.id,
      mediaUri: draft.persistedMediaUri,
      durationSeconds: draft.durationSeconds,
      sizeBytes: draft.sizeBytes,
      mimeType: draft.mimeType,
      fileName: draft.fileName,
      edit: normalizeIgpatQuickEdit(edit, draft.durationSeconds),
      caption,
      audience,
      groupId,
      creationMode,
      relayParentPostId,
      relayPrompt,
      relayParentAuthor,
    };
    latestDraftSaveRef.current = input;
    const timer = setTimeout(() => {
      void saveNativeIgpatDraft(input).catch(error =>
        console.warn('BUKLOD IGPAT draft autosave:', String(error?.message ?? error))
      );
    }, DRAFT_AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [audience, caption, creationMode, draft, edit, groupId, relayParentAuthor, relayParentPostId, relayPrompt, user?.id]);

  const acceptVideo = async (asset: any) => {
    try {
      if (!user?.id) {
        Alert.alert('BUKLOD IGPAT', 'Sign in again before preparing an IGPAT.');
        return;
      }
      if (!asset?.uri) {
        Alert.alert('BUKLOD IGPAT', 'The selected video could not be read.');
        return;
      }
      const durationSeconds = Math.ceil(Number(asset?.duration ?? 0) / 1000);
      if (!durationSeconds || durationSeconds < 1) {
        Alert.alert('BUKLOD IGPAT', 'Could not determine the video duration.');
        return;
      }
      if (durationSeconds > BUKLOD_REEL_MAX_DURATION_SECONDS) {
        Alert.alert('Maximum 60 Seconds', `This video is ${durationSeconds} seconds. IGPAT videos may be up to 60 seconds only.`);
        return;
      }

      const sizeBytes = await readVideoSizeBytes(asset, async (uri, options) => FileSystem.getInfoAsync(uri, options as any));
      const validationError = validateCommunityVideoUpload({ durationSeconds, sizeBytes, isReel: true });
      if (validationError) {
        Alert.alert('BUKLOD IGPAT', validationError);
        return;
      }

      const mimeType = inferMime(asset);
      const mode = pendingCreationModeRef.current;
      const durableUri = await prepareNativeIgpatDraftMedia({ userId: user.id, sourceUri: asset.uri, mimeType });
      const initialEdit = { ...DEFAULT_IGPAT_QUICK_EDIT, trimEndSeconds: durationSeconds };
      const baseDraft: IgpatDraftSaveInput = {
        userId: user.id,
        mediaUri: durableUri,
        durationSeconds,
        sizeBytes,
        mimeType,
        fileName: String(asset.fileName ?? `igpat.${extensionForMime(mimeType)}`),
        edit: initialEdit,
        caption,
        audience,
        groupId,
        creationMode: mode,
        relayParentPostId,
        relayPrompt,
        relayParentAuthor,
      };
      await saveNativeIgpatDraft(baseDraft);
      latestDraftSaveRef.current = baseDraft;

      if (!mountedRef.current) return;
      setDraft({
        uri: durableUri,
        persistedMediaUri: durableUri,
        durationSeconds,
        sizeBytes,
        mimeType,
        fileName: baseDraft.fileName,
      });
      setCreationMode(mode);
      resetEditHistory(initialEdit, durationSeconds);
      setPreviewTime(0);
      setSeekSeconds(0);
      setActiveTool('Trim');
      setStep(mode === 'quick-capture' ? 'preview' : 'quick-edit');
      pendingCreationModeRef.current = 'standard';
    } catch (error: any) {
      console.warn('BUKLOD IGPAT accept video:', String(error?.message ?? error));
      if (mountedRef.current) {
        Alert.alert('Could Not Prepare Video', error?.message ?? 'The video could not be prepared safely. Please try again.');
      }
    }
  };

  const resetDraft = () => {
    if (busy || pickerBusy) return;
    latestDraftSaveRef.current = null;
    if (user?.id) void clearNativeIgpatDraft(user.id);
    setDraft(null);
    setCreationMode('standard');
    pendingCreationModeRef.current = 'standard';
    resetEditHistory({ ...DEFAULT_IGPAT_QUICK_EDIT });
    setPreviewTime(0);
    setSeekSeconds(null);
    setActiveTool('Trim');
    setStep('source');
  };

  const handlePickerResult = async (result: any) => {
    if (!result) return;
    if (result?.code) {
      console.warn('BUKLOD IGPAT picker result:', String(result?.message ?? result?.code));
      if (mountedRef.current) {
        Alert.alert('Camera Result Could Not Be Restored', result?.message ?? 'Please record or select the video again.');
      }
      return;
    }
    if (!result.canceled && result.assets?.length) await acceptVideo(result.assets[0]);
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
    pendingCreationModeRef.current = 'standard';
    if (!beginPicker()) return;
    try {
      const ImagePicker = await import('expo-image-picker');
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Media Permission', 'Photo and video library access is required to select an IGPAT.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsEditing: false });
      await handlePickerResult(result);
    } catch (error: any) {
      console.warn('BUKLOD IGPAT library picker:', String(error?.message ?? error));
      Alert.alert('Could Not Open Videos', error?.message ?? 'Video selection is not available in this installed app version. Please update the app before trying again.');
    } finally {
      endPicker();
    }
  };

  const recordVideo = async (mode: IgpatCreationMode = 'standard') => {
    pendingCreationModeRef.current = mode;
    if (!beginPicker()) return;
    try {
      const ImagePicker = await import('expo-image-picker');
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera Permission', 'Camera access is required to record an IGPAT.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], videoMaxDuration: 60, allowsEditing: false });
      await handlePickerResult(result);
    } catch (error: any) {
      console.warn('BUKLOD IGPAT camera picker:', String(error?.message ?? error));
      Alert.alert('Could Not Record Video', error?.message ?? 'Camera video recording is not available in this installed app version. Please update the app before trying again.');
    } finally {
      endPicker();
    }
  };

  const publish = async () => {
    if (!user?.id || !draft || busy || pickerBusy) return;
    if (audience === 'group' && (!groupId || !groups.some(row => row.group_id === groupId))) {
      return Alert.alert('BUKLOD IGPAT', 'Choose an active BUKLOD Cluster first.');
    }
    if ((audience === 'local' || audience === 'public') && !profile?.church_id) {
      return Alert.alert('BUKLOD IGPAT', 'A Local Church assignment is required for this audience.');
    }
    const hasRelay = Boolean(relayParentPostId || relayPrompt);
    if (hasRelay && (!relayParentPostId || !relayPrompt)) {
      return Alert.alert('IGPAT Relay', 'The Relay source is incomplete. Return to the IGPAT and start Relay again.');
    }

    const normalizedEdit = normalizeIgpatQuickEdit(edit, draft.durationSeconds);
    const outputDuration = igpatOutputDurationSeconds(normalizedEdit, draft.durationSeconds);
    if (outputDuration < IGPAT_MIN_OUTPUT_SECONDS || outputDuration > BUKLOD_REEL_MAX_DURATION_SECONDS) {
      return Alert.alert('BUKLOD IGPAT', 'The edited IGPAT must be between 1 and 60 seconds.');
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

      const payload: Record<string, unknown> = {
        p_audience: audience,
        p_group_id: audience === 'group' ? groupId : null,
        p_body: caption.trim(),
        p_media_path: uploadedPath,
        p_media_mime_type: draft.mimeType,
        p_media_size_bytes: draft.sizeBytes,
        p_duration_seconds: draft.durationSeconds,
        p_edit_meta: serializeIgpatQuickEdit(normalizedEdit, draft.durationSeconds),
      };
      if (hasRelay) {
        payload.p_relay_parent_post_id = relayParentPostId;
        payload.p_relay_prompt = relayPrompt;
      }

      const { error } = await (supabase as any).rpc(
        hasRelay ? 'create_buklod_reel_v3' : 'create_buklod_reel_v2',
        payload
      );
      if (error) throw error;

      latestDraftSaveRef.current = null;
      await clearNativeIgpatDraft(user.id);
      Alert.alert(
        hasRelay ? 'IGPAT Relay Published' : 'IGPAT Published',
        hasRelay
          ? 'Your video response is now part of the IGPAT Relay chain.'
          : 'Your IGPAT is now available to the selected audience.'
      );
      router.replace('/igpat' as any);
    } catch (error: any) {
      if (uploadedPath) await supabase.storage.from('community-media').remove([uploadedPath]);
      const message = String(error?.message ?? 'Please try again.');
      Alert.alert(
        hasRelay ? 'Could Not Publish IGPAT Relay' : 'Could Not Publish IGPAT',
        hasRelay && /create_buklod_reel_v3|function.*does not exist/i.test(message)
          ? 'The IGPAT Relay server update still needs to be applied before Relay responses can publish.'
          : message
      );
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const renderRelayContext = () => {
    if (!relayParentPostId || !relayPrompt) return null;
    return (
      <View style={styles.relayContext}>
        <View style={styles.relayContextCopy}>
          <Text style={styles.relayEyebrow}>IGPAT RELAY · {igpatRelayPromptLabel(relayPrompt).toUpperCase()}</Text>
          <Text style={styles.relayTitle} numberOfLines={2}>
            {relayParentAuthor ? `Responding to ${relayParentAuthor}` : 'Video response to an IGPAT'}
          </Text>
          <Text style={styles.relayHint}>Your post will be linked to the original Relay chain after publish.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel IGPAT Relay"
          style={styles.relayCancel}
          disabled={busy || pickerBusy}
          onPress={() => {
            setRelayParentPostId(null);
            setRelayPrompt(null);
            setRelayParentAuthor(null);
          }}
        >
          <Text style={styles.relayCancelText}>CANCEL RELAY</Text>
        </Pressable>
      </View>
    );
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
          <Pressable onPress={resetDraft} disabled={busy || pickerBusy}>
            <Text style={styles.change}>CHANGE</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderToolPanel = () => {
    if (!draft) return null;
    const normalized = normalizeIgpatQuickEdit(edit, draft.durationSeconds);
    if (activeTool === 'Trim') {
      return (
        <TrimTimeline
          edit={normalized}
          durationSeconds={draft.durationSeconds}
          currentSeconds={previewTime}
          onChange={updateEditTransaction}
          onSeek={seconds => {
            setPreviewTime(seconds);
            setSeekSeconds(seconds);
          }}
          onInteractionStart={beginEditTransaction}
          onInteractionEnd={endEditTransaction}
        />
      );
    }
    if (activeTool === 'Text') {
      return (
        <View style={styles.editorPanel}>
          <Text style={styles.panelTitle}>TEXT OVERLAY</Text>
          <TextInput
            value={normalized.textOverlay}
            onFocus={beginEditTransaction}
            onChangeText={value => updatePatchTransaction({ textOverlay: value.slice(0, 160) })}
            onBlur={endEditTransaction}
            placeholder="Add short on-video text"
            placeholderTextColor="rgba(255,255,255,0.36)"
            maxLength={160}
            style={styles.overlayInput}
            editable={!busy && !pickerBusy}
          />
          <Text style={styles.panelHint}>Kept intentionally clean and readable. Drag/resize stays hidden until a safe rendered-composition path exists.</Text>
        </View>
      );
    }
    if (activeTool === 'Audio') {
      return (
        <View style={styles.editorPanel}>
          <Text style={styles.panelTitle}>ORIGINAL AUDIO</Text>
          <View style={styles.choiceRow}>
            <Pressable style={[styles.choiceChip, !normalized.muted && styles.choiceSelected]} onPress={() => patchEdit({ muted: false })} disabled={busy || pickerBusy}>
              <Text style={[styles.choiceText, !normalized.muted && styles.choiceTextSelected]}>ON</Text>
            </Pressable>
            <Pressable style={[styles.choiceChip, normalized.muted && styles.choiceSelected]} onPress={() => patchEdit({ muted: true })} disabled={busy || pickerBusy}>
              <Text style={[styles.choiceText, normalized.muted && styles.choiceTextSelected]}>MUTE</Text>
            </Pressable>
          </View>
          <Text style={styles.panelHint}>Music mixing and cleanup stay hidden until a safe media-processing path exists.</Text>
        </View>
      );
    }
    if (activeTool === 'Speed') {
      return (
        <View style={styles.editorPanel}>
          <Text style={styles.panelTitle}>PLAYBACK SPEED</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceRow}>
            {SPEEDS.map(value => {
              const selected = normalized.speed === value;
              return (
                <Pressable key={value} style={[styles.choiceChip, selected && styles.choiceSelected]} onPress={() => patchEdit({ speed: value })} disabled={busy || pickerBusy}>
                  <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{value}×</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      );
    }
    if (activeTool === 'Cover') {
      return (
        <View style={styles.editorPanel}>
          <Text style={styles.panelTitle}>COVER FRAME</Text>
          <Text style={styles.panelValue}>Current frame · {formatClock(previewTime)}</Text>
          <Pressable style={styles.panelAction} onPress={() => patchEdit({ coverSeconds: previewTime })} disabled={busy || pickerBusy}>
            <Text style={styles.panelActionText}>USE CURRENT FRAME</Text>
          </Pressable>
          <Text style={styles.panelHint}>Selected · {formatClock(normalized.coverSeconds)}</Text>
        </View>
      );
    }

    return (
      <View style={styles.editorPanel}>
        <Text style={styles.panelTitle}>AUTO IMPROVE</Text>
        <Pressable
          style={styles.panelAction}
          onPress={() => {
            const suggestion = suggestIgpatAutoImprove(normalized, draft.durationSeconds);
            if (!suggestion.changes.length) {
              Alert.alert('Auto Improve', 'No additional safe metadata-only improvements were found for this clip.');
              return;
            }
            commitEdit(suggestion.edit);
            setPreviewTime(suggestion.edit.coverSeconds);
            setSeekSeconds(suggestion.edit.coverSeconds);
            Alert.alert(
              'Auto Improve Applied',
              `${suggestion.changes.join('\n')}\n\nUse Undo to reverse these changes.`
            );
          }}
          disabled={busy || pickerBusy}
        >
          <Text style={styles.panelActionText}>AUTO IMPROVE</Text>
        </Pressable>
        <Text style={styles.panelHint}>
          Safe and reversible: 9:16 framing plus a cover-frame suggestion. Brightness, audio normalization, captions, and auto-trim stay unchanged until a reliable processing engine exists.
        </Text>
        <Text style={styles.panelLabel}>REFRAME</Text>
        <View style={styles.choiceRow}>
          {(['contain', 'cover'] as const).map(value => {
            const selected = normalized.contentFit === value;
            return (
              <Pressable key={value} style={[styles.choiceChip, selected && styles.choiceSelected]} onPress={() => patchEdit({ contentFit: value })} disabled={busy || pickerBusy}>
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
              <Pressable key={value} style={[styles.choiceChip, selected && styles.choiceSelected]} onPress={() => patchEdit({ rotation: value })} disabled={busy || pickerBusy}>
                <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{value}°</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          style={styles.restoreAction}
          onPress={() => {
            commitEdit({ ...DEFAULT_IGPAT_QUICK_EDIT, trimEndSeconds: draft.durationSeconds });
            setPreviewTime(0);
            setSeekSeconds(0);
          }}
          disabled={busy || pickerBusy}
        >
          <Text style={styles.restoreActionText}>RESTORE ORIGINAL</Text>
        </Pressable>
      </View>
    );
  };

  const renderQuickEditShell = () => {
    if (!draft) return null;
    return (
      <>
        <View style={styles.historyRow}>
          <Text style={styles.historyLabel}>EDIT HISTORY</Text>
          <View style={styles.historyActions}>
            <Pressable accessibilityRole="button" accessibilityLabel="Undo last IGPAT edit" style={[styles.historyButton, !canUndo && styles.historyButtonDisabled]} disabled={!canUndo || busy || pickerBusy} onPress={() => { undoEdit(); setSeekSeconds(null); }}>
              <Text style={[styles.historyButtonText, !canUndo && styles.historyButtonTextDisabled]}>UNDO</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Redo IGPAT edit" style={[styles.historyButton, !canRedo && styles.historyButtonDisabled]} disabled={!canRedo || busy || pickerBusy} onPress={() => { redoEdit(); setSeekSeconds(null); }}>
              <Text style={[styles.historyButtonText, !canRedo && styles.historyButtonTextDisabled]}>REDO</Text>
            </Pressable>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolRail} style={styles.toolScroller}>
          {QUICK_EDIT_TOOLS.map(tool => {
            const selected = activeTool === tool;
            return (
              <Pressable key={tool} style={[styles.toolChip, selected && styles.toolChipSelected]} onPress={() => setActiveTool(tool)} disabled={busy || pickerBusy}>
                <Text style={[styles.toolText, selected && styles.toolTextSelected]}>{tool}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {renderToolPanel()}
      </>
    );
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>BUKLOD IGPAT</Text>
      <Text style={styles.title}>Create an Instant Bond</Text>
      <Text style={styles.subtitle}>Record or choose a short video, review it, then publish.</Text>
      {renderRelayContext()}

      {!draft || step === 'source' ? (
        <View>
          <View style={styles.sourceRow}>
            <Pressable style={[styles.sourceButton, pickerBusy && styles.sourceButtonDisabled]} onPress={() => void recordVideo('standard')} disabled={busy || pickerBusy}>
              {pickerBusy ? <ActivityIndicator color="#FFFFFF" /> : null}
              <Text style={styles.sourceTitle}>RECORD</Text>
              <Text style={styles.sourceCopy}>{pickerBusy ? 'Opening…' : 'Record then edit'}</Text>
            </Pressable>
            <Pressable style={[styles.sourceButton, pickerBusy && styles.sourceButtonDisabled]} onPress={() => void chooseVideo()} disabled={busy || pickerBusy}>
              <Text style={styles.sourceTitle}>SELECT</Text>
              <Text style={styles.sourceCopy}>From device</Text>
            </Pressable>
          </View>
          <Pressable style={[styles.quickCaptureButton, pickerBusy && styles.sourceButtonDisabled]} onPress={() => void recordVideo('quick-capture')} disabled={busy || pickerBusy}>
            <Text style={styles.quickCaptureTitle}>QUICK CAPTURE</Text>
            <Text style={styles.quickCaptureCopy}>Record → preview → caption → post. No edit required.</Text>
          </Pressable>
        </View>
      ) : step === 'quick-edit' ? (
        <View>
          <Text style={styles.stepTitle}>QUICK EDIT</Text>
          <Text style={styles.stepCopy}>Non-destructive edits. Your draft is saved automatically on this device.</Text>
          {renderDraftPreview()}
          {renderQuickEditShell()}
          <View style={styles.actionStack}>
            <Pressable style={styles.primaryAction} onPress={() => setStep('preview')} disabled={busy || pickerBusy}>
              <Text style={styles.primaryActionText}>PREVIEW</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryAction}
              onPress={() => {
                resetEditHistory({ ...DEFAULT_IGPAT_QUICK_EDIT, trimEndSeconds: draft.durationSeconds }, draft.durationSeconds);
                setPreviewTime(0);
                setSeekSeconds(0);
                setStep('details');
              }}
              disabled={busy || pickerBusy}
            >
              <Text style={styles.secondaryActionText}>SKIP EDITING / POST AS IS</Text>
            </Pressable>
          </View>
        </View>
      ) : step === 'preview' ? (
        <View>
          <Text style={styles.stepTitle}>{creationMode === 'quick-capture' ? 'QUICK CAPTURE PREVIEW' : 'PREVIEW'}</Text>
          <Text style={styles.stepCopy}>
            {creationMode === 'quick-capture'
              ? 'Check the recording, then continue straight to caption and audience.'
              : 'Watch the edited IGPAT before adding its caption and audience.'}
          </Text>
          {renderDraftPreview()}
          <View style={styles.actionStack}>
            <Pressable style={styles.primaryAction} onPress={() => setStep('details')} disabled={busy || pickerBusy}>
              <Text style={styles.primaryActionText}>CONTINUE</Text>
            </Pressable>
            {creationMode === 'standard' ? (
              <Pressable style={styles.secondaryAction} onPress={() => setStep('quick-edit')} disabled={busy || pickerBusy}>
                <Text style={styles.secondaryActionText}>BACK TO QUICK EDIT</Text>
              </Pressable>
            ) : null}
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
            editable={!busy && !pickerBusy}
          />

          <Text style={styles.label}>AUDIENCE</Text>
          <View style={styles.audienceRow}>
            {(['public', 'local', 'group'] as Audience[]).map(value => {
              const disabled = value === 'group' ? groupsLoading || !groups.length : !profile?.church_id;
              return (
                <Pressable key={value} style={[styles.audienceButton, audience === value && styles.audienceSelected, disabled && styles.audienceDisabled]} onPress={() => {
                  if (disabled) return;
                  setAudience(value);
                  if (value === 'group' && !groupId) setGroupId(groups[0]?.group_id ?? null);
                }} disabled={busy || pickerBusy || disabled}>
                  <Text style={[styles.audienceText, audience === value && styles.audienceSelectedText]}>{value === 'group' ? 'CLUSTER' : value.toUpperCase()}</Text>
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
                    <Pressable key={option.group_id} style={[styles.clusterChip, selected && styles.clusterChipSelected]} onPress={() => setGroupId(option.group_id)} disabled={busy || pickerBusy}>
                      <Text style={[styles.clusterText, selected && styles.clusterTextSelected]} numberOfLines={1}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {busy && (
            <View style={styles.progressRow}>
              <ActivityIndicator color="#FFFFFF" />
              <Text style={styles.progressText}>Uploading {progress == null ? '' : `${Math.round(progress * 100)}%`}</Text>
            </View>
          )}

          <Pressable style={[styles.publish, (!draft || busy || pickerBusy) && styles.publishDisabled]} disabled={!draft || busy || pickerBusy} onPress={() => void publish()}>
            <Text style={styles.publishText}>{busy ? 'PUBLISHING...' : relayParentPostId && relayPrompt ? 'PUBLISH RELAY' : 'PUBLISH IGPAT'}</Text>
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
  relayContext: { marginTop: 14, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(217,255,105,0.28)', backgroundColor: '#10150D', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  relayContextCopy: { flex: 1 },
  relayEyebrow: { color: '#D9FF69', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8 },
  relayTitle: { marginTop: 4, color: '#FFFFFF', fontSize: 12, lineHeight: 17, fontWeight: '900' },
  relayHint: { marginTop: 4, color: 'rgba(255,255,255,0.50)', fontSize: 9, lineHeight: 14 },
  relayCancel: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  relayCancelText: { color: '#FFFFFF', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.6 },
  stepTitle: { marginTop: 24, color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 1.1 },
  stepCopy: { marginTop: 6, color: 'rgba(255,255,255,0.55)', fontSize: 11, lineHeight: 17 },
  sourceRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  sourceButton: { flex: 1, minHeight: 116, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101512' },
  sourceButtonDisabled: { opacity: 0.58 },
  sourceTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  sourceCopy: { marginTop: 5, color: 'rgba(255,255,255,0.48)', fontSize: 10 },
  quickCaptureButton: { marginTop: 12, minHeight: 64, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(217,255,105,0.38)', backgroundColor: '#11170D', paddingHorizontal: 16, alignItems: 'flex-start', justifyContent: 'center' },
  quickCaptureTitle: { color: '#D9FF69', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  quickCaptureCopy: { marginTop: 4, color: 'rgba(255,255,255,0.58)', fontSize: 9.5 },
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
  timelineSection: { marginTop: 14 },
  timelineHeader: { marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  timelineLabel: { flex: 1, color: 'rgba(255,255,255,0.48)', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  timelineTime: { color: 'rgba(255,255,255,0.62)', fontSize: 9, fontWeight: '800' },
  timelineTrack: { height: 56, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0B100D', flexDirection: 'row', overflow: 'hidden', padding: 4, gap: 2, position: 'relative' },
  timelineFrame: { flex: 1, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.10)' },
  trimWindow: { position: 'absolute', top: 0, bottom: 0, borderTopWidth: 2, borderBottomWidth: 2, borderColor: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.08)' },
  trimHandle: { position: 'absolute', top: 0, bottom: 0, width: 8, marginLeft: -4, backgroundColor: '#FFFFFF' },
  trimHandleStart: { borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  trimHandleEnd: { borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
  timelinePlayhead: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1, backgroundColor: '#D9FF69' },
  trimStats: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  trimStat: { color: 'rgba(255,255,255,0.44)', fontSize: 8, fontWeight: '800' },
  trimStatStrong: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '900' },
  historyRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  historyLabel: { color: 'rgba(255,255,255,0.42)', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  historyActions: { flexDirection: 'row', gap: 8 },
  historyButton: { minHeight: 34, minWidth: 66, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D120F' },
  historyButtonDisabled: { opacity: 0.34 },
  historyButtonText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
  historyButtonTextDisabled: { color: 'rgba(255,255,255,0.55)' },
  toolScroller: { marginTop: 12 },
  toolRail: { gap: 8, paddingRight: 18 },
  toolChip: { minWidth: 68, minHeight: 38, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#0D120F', alignItems: 'center', justifyContent: 'center' },
  toolChipSelected: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  toolText: { color: 'rgba(255,255,255,0.76)', fontSize: 10, fontWeight: '800' },
  toolTextSelected: { color: '#060908' },
  editorPanel: { marginTop: 14, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0B100D' },
  panelTitle: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  panelLabel: { marginTop: 13, marginBottom: 7, color: 'rgba(255,255,255,0.48)', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  panelHint: { marginTop: 10, color: 'rgba(255,255,255,0.46)', fontSize: 9.5, lineHeight: 15 },
  panelValue: { marginTop: 9, color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: '800' },
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
  progressText: { color: 'rgba(255,255,255,0.70)', fontSize: 11, fontWeight: '700' },
  publish: { marginTop: 24, minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  publishDisabled: { opacity: 0.36 },
  publishText: { color: '#060908', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
});
