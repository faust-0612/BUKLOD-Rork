import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  Platform,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer, type VideoSource } from 'expo-video';
import { recordCommunityFeedMetric } from '@/lib/communityFeedTelemetry';
import BuklodReelsInlineAd, {
  type BuklodReelsAdLoadState,
} from '@/components/BuklodReelsInlineAd';
import {
  buildReelsFeedWithInlineAds,
  isReelsFeedInlineAdRow,
  type ReelsFeedInlineAdRow,
} from '@/lib/buklodAdPlacements';
import { supabase } from '@/lib/supabase';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';
import { useAuth } from '@/providers/AuthProvider';
import { useScreenFocused } from '@/hooks/useScreenFocused';
import { useNetwork } from '@/providers/NetworkProvider';
import { classifyNetworkQuality } from '@/lib/buklodNetworkQuality';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { signIgpatRowsInBatch } from '@/lib/igpat/signBatch';
import {
  getIgpatWarmFeed,
  igpatFeedKey,
  isIgpatWarmFeedFresh,
  rememberIgpatWarmFeed,
  updateIgpatWarmFeedRow,
} from '@/lib/igpat/warmFeed';

type IgpatRow = {
  id: string;
  user_id?: string | null;
  author_name: string;
  body: string;
  created_at: string;
  media_path: string;
  media_duration_seconds?: number | null;
  reaction_count?: number | null;
  comment_count?: number | null;
  my_reaction?: string | null;
  media_url?: string | null;
};

type IgpatFeedRow = IgpatRow | ReelsFeedInlineAdRow;
type FeedMode = 'for-you' | 'following' | 'latest';

const NORMAL_LIMIT = 16;
const DATA_SAVER_LIMIT = 8;
const SIGNED_URL_TTL_SECONDS = 1200;
const DATA_SAVER_KEY = '@buklod_igpat_data_saver_v1';
const SAVED_IGPAT_KEY = '@buklod_igpat_saved_ids_v1';

function IgpatVideo({
  uri,
  active,
  conservativeBuffer,
}: { uri: string; active: boolean; conservativeBuffer: boolean }) {
  const [pausedByUser, setPausedByUser] = useState(false);
  const [firstFrameUri, setFirstFrameUri] = useState<string | null>(null);
  const [showTapHint, setShowTapHint] = useState(false);
  const playbackActivatedAtRef = useRef(Date.now());
  const firstFrameReportedRef = useRef(false);
  // Native cache and HLS auto-ABR when the backend supplies a playlist.
  // The next (paused) row mounts a player ahead of time to fill its initial buffer.
  const source = useMemo<VideoSource>(() => ({
    uri,
    useCaching: true,
    ...(uri.split('?')[0].split('#')[0].toLowerCase().endsWith('.m3u8') ? { contentType: 'hls' as const } : {}),
  }), [uri]);
  const player = useVideoPlayer(source, instance => {
    instance.loop = true;
    instance.muted = false;
    // Passive PTT monitoring must not pause an already playing reel.
    instance.audioMixingMode = 'mixWithOthers';
    if (Platform.OS !== 'web') {
      // Start quickly on healthy connections; weak networks retain a larger
      // safety buffer. Never start another offscreen playback.
      instance.bufferOptions = conservativeBuffer
        ? { minBufferForPlayback: 1.5, preferredForwardBufferDuration: 16 }
        : { minBufferForPlayback: 0.75, preferredForwardBufferDuration: 12 };
    }
  });
  useEffect(() => {
    if (!active) return;
    const startedAt = Date.now();
    let played = false;
    let bufferingSince = 0;
    const playing = player.addListener('playingChange', event => {
      if (!event.isPlaying) return;
      if (!played) played = true; // Actual startup is measured at the first rendered frame.
      if (bufferingSince) {
        recordCommunityFeedMetric({
          stage: 'video_rebuffer',
          elapsedMs: Date.now() - bufferingSince,
          status: 'ok',
          player: 'expo-video',
        });
        bufferingSince = 0;
      }
    });
    const status = player.addListener('statusChange', event => {
      if (event.status === 'loading' && played && !bufferingSince) {
        bufferingSince = Date.now();
      }
      if (event.status === 'error') {
        recordCommunityFeedMetric({
          stage: played ? 'video_rebuffer' : 'video_startup',
          elapsedMs: Date.now() - (bufferingSince || startedAt),
          status: 'error',
          player: 'expo-video',
        });
        bufferingSince = 0;
      }
    });
    return () => {
      playing.remove();
      status.remove();
    };
  }, [active, player, uri]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      player.bufferOptions = conservativeBuffer
        ? { minBufferForPlayback: 1.5, preferredForwardBufferDuration: 16 }
        : { minBufferForPlayback: 0.75, preferredForwardBufferDuration: 12 };
    }
  }, [conservativeBuffer, player]);

  useEffect(() => {
    if (active) {
      playbackActivatedAtRef.current = Date.now();
      firstFrameReportedRef.current = false;
    } else {
      setFirstFrameUri(null);
    }
  }, [active, uri]);

  useEffect(() => {
    setShowTapHint(false);
    if (!active || firstFrameUri === uri) return;
    const timeout = setTimeout(() => setShowTapHint(true), 3000);
    return () => clearTimeout(timeout);
  }, [active, firstFrameUri, uri]);

  const handleFirstFrameRender = () => {
    setFirstFrameUri(uri);
    if (active && !firstFrameReportedRef.current) {
      firstFrameReportedRef.current = true;
      recordCommunityFeedMetric({
        stage: 'video_startup',
        elapsedMs: Date.now() - playbackActivatedAtRef.current,
        status: 'ok',
        player: 'expo-video',
      });
    }
  };

  useEffect(() => {
    try {
      if (active && !pausedByUser) player.play();
      else player.pause();
    } catch {}
  }, [active, pausedByUser, player]);

  useEffect(() => {
    if (!active) setPausedByUser(false);
  }, [active]);

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {}
    };
  }, [player]);

  const startFastPlayback = () => {
    if (!active) return;
    try {
      player.playbackRate = 2;
      player.play();
    } catch {}
  };

  const stopFastPlayback = () => {
    try {
      player.playbackRate = 1;
      if (pausedByUser) player.pause();
    } catch {}
  };

  return (
    <Pressable
      style={StyleSheet.absoluteFill}
      onPress={() => {
        if (!active) return;
        if (firstFrameUri !== uri) {
          setPausedByUser(false);
          try { player.play(); } catch {}
        } else {
          setPausedByUser(current => !current);
        }
      }}
      onLongPress={startFastPlayback}
      onPressOut={stopFastPlayback}
      delayLongPress={220}
      accessibilityRole="button"
      accessibilityLabel={pausedByUser ? 'Play IGPAT video' : 'Pause IGPAT video'}
    >
      {active ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          nativeControls={false}
          contentFit="contain"
          onFirstFrameRender={handleFirstFrameRender}
        />
      ) : null}
      {active && firstFrameUri !== uri ? (
        <View pointerEvents="none" style={styles.videoLoading}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.videoLoadingText}>{showTapHint ? 'TAP TO PLAY' : 'OPENING VIDEO'}</Text>
        </View>
      ) : null}
      {active && pausedByUser && (
        <View pointerEvents="none" style={styles.pausedBadge}>
          <MaterialCommunityIcons name="play" size={18} color="#FFFFFF" />
          <Text style={styles.pausedBadgeText}>PAUSED</Text>
        </View>
      )}
    </Pressable>
  );
}

function ActionButton({
  icon,
  label,
  active = false,
  count,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  active?: boolean;
  count?: number | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed]}
    >
      <View style={[styles.actionOrb, active && styles.actionOrbActive]}>
        <MaterialCommunityIcons
          name={icon}
          size={22}
          color={active ? '#07100B' : '#FFFFFF'}
        />
      </View>
      {typeof count === 'number' && count > 0 ? (
        <Text style={styles.actionCount}>{count > 999 ? '999+' : count}</Text>
      ) : null}
    </Pressable>
  );
}

export default function IgpatScreen() {
  const { user } = useAuth();
  const screenFocused = useScreenFocused();
  const { status: networkStatus } = useNetwork();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<IgpatRow[]>([]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const loadGenerationRef = useRef(0);
  const visibleFeedKeyRef = useRef<string | null>(null);
  const previousNetworkStatusRef = useRef(networkStatus);
  const networkStatusRef = useRef(networkStatus);
  networkStatusRef.current = networkStatus;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const reelsListRef = useRef<FlatList<IgpatFeedRow>>(null);
  const [reelsAdStates,setReelsAdStates] = useState<Record<string,BuklodReelsAdLoadState>>({});
  const [feedMode, setFeedMode] = useState<FeedMode>('for-you');
  const [dataSaver, setDataSaver] = useState(false);
  const [prefsReady, setPrefsReady] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [followBusy, setFollowBusy] = useState<Set<string>>(new Set());
  const [reactionBusy, setReactionBusy] = useState<Set<string>>(new Set());
  // Preserve visible playback and avoid offscreen preload on weak connections.
  const weakSignal = networkStatus === 'offline' || networkStatus === 'degraded' ||
    classifyNetworkQuality() !== 'normal';
  const weakSignalRef = useRef(weakSignal);
  weakSignalRef.current = weakSignal;
  const currentFeedKey = igpatFeedKey(user?.id, feedMode, dataSaver);
  const viewportHeight = Dimensions.get('window').height;
  useEffect(() => { setReelsAdStates({}); }, [feedMode]);
  const feedRows = useMemo(() => {
    const feed=buildReelsFeedWithInlineAds(rows);
    // No reel session should end on a sponsored placeholder.
    return isReelsFeedInlineAdRow(feed[feed.length-1]) ? feed.slice(0,-1) : feed;
  }, [rows]);
  useEffect(() => {
    const row=feedRows[activeIndex];
    if(!screenFocused || !isReelsFeedInlineAdRow(row))return;
    const status=reelsAdStates[row.id]??'loading';
    if(status==='ready')return;
    const timer=setTimeout(()=>{
      const next=feedRows.findIndex((candidate,index)=>
        index>activeIndex && !isReelsFeedInlineAdRow(candidate));
      const target=next>=0?next:Math.max(0,activeIndex-1);
      if(target===activeIndex)return;
      try{
        reelsListRef.current?.scrollToIndex({index:target,animated:false});
        setActiveIndex(target);
      }catch{
        // A recycled feed item must not freeze or crash scrolling.
      }
    },status==='unavailable'?120:3000);
    return()=>clearTimeout(timer);
  },[feedRows,activeIndex,reelsAdStates,screenFocused]);

  useEffect(() => {
    let mounted = true;
    void Promise.all([
      AsyncStorage.getItem(DATA_SAVER_KEY),
      AsyncStorage.getItem(SAVED_IGPAT_KEY),
    ]).then(([dataSaverValue, savedValue]) => {
      if (!mounted) return;
      setDataSaver(dataSaverValue === '1');
      try {
        const parsed = JSON.parse(savedValue ?? '[]');
        setSavedIds(new Set(Array.isArray(parsed) ? parsed.map(String) : []));
      } catch {
        setSavedIds(new Set());
      }
      setPrefsReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const loadFollows = useCallback(async () => {
    if (!user?.id) {
      setFollowedIds(new Set());
      return;
    }

    const { data, error } = await supabase
      .from('buklod_user_follows')
      .select('followed_user_id')
      .eq('follower_id', user.id);

    if (error) {
      console.warn('BUKLOD IGPAT follows:', error.message);
      return;
    }

    setFollowedIds(new Set((data ?? []).map(row => String(row.followed_user_id))));
  }, [user?.id]);

  useEffect(() => {
    void loadFollows();
  }, [loadFollows]);

  const load = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    if (!prefsReady) return;
    if (!user?.id) {
      visibleFeedKeyRef.current = null;
      rowsRef.current = [];
      setRows([]);
      setLoading(false);
      return;
    }

    const key = igpatFeedKey(user.id, feedMode, dataSaver);
    const matchingFeed = visibleFeedKeyRef.current === key;
    const warmRows = getIgpatWarmFeed<IgpatRow>(user.id, feedMode, dataSaver);
    const retainedRows = matchingFeed && rowsRef.current.length ? rowsRef.current : warmRows;
    visibleFeedKeyRef.current = key;
    if (!matchingFeed) {
      rowsRef.current = warmRows;
      setRows(warmRows);
      setActiveIndex(0);
    }
    // Never replace a usable, account/mode-scoped feed with a loading screen.
    setLoading(retainedRows.length === 0);
    setLoadError(null);
    // Reuse the recently signed page on a rapid navigation return. The
    // existing same-screen Retry path still performs a real refresh.
    if (!matchingFeed && warmRows.length &&
        isIgpatWarmFeedFresh(user.id, feedMode, dataSaver)) {
      setLoading(false);
      return;
    }
    if (networkStatusRef.current === 'offline') {
      setLoadError('Offline: showing recently loaded videos when available.');
      setLoading(false);
      return;
    }

    try {
      const limit = dataSaver || weakSignalRef.current ? DATA_SAVER_LIMIT : NORMAL_LIMIT;
      const { data, error } = await (supabase as any).rpc('get_buklod_igpat_feed_v2', {
        p_mode: feedMode,
        p_limit: limit,
      });
      if (error) throw error;
      if (generation !== loadGenerationRef.current) return;

      const source = ((data ?? []) as IgpatRow[])
        .filter(row => Boolean(row.media_path))
        .slice(0, limit);

      // Paint authorized feed text and controls as soon as the RPC returns.
      // Video access is signed independently; keep the first surface loading.
      const pendingFirstMedia = retainedRows.length === 0 && source.length > 0;
      if (pendingFirstMedia) {
        const pending = source.map(row => ({ ...row, media_url: undefined }));
        rowsRef.current = pending;
        setRows(pending);
        setLoading(false);
      }

      // Sign the first video first: do not block first paint on every URL.
      // Keep stable row IDs/order while the remaining signed URLs arrive.
      const sign = async (row: IgpatRow): Promise<IgpatRow> => {
        try {
          const { data: signed, error: signError } = await withBuklodTimeout(
            supabase.storage
              .from('community-media')
              .createSignedUrl(row.media_path, SIGNED_URL_TTL_SECONDS),
            9000,
            'IGPAT video access',
          );
          if (signError) throw signError;
          return { ...row, media_url: signed?.signedUrl ?? null };
        } catch (error) {
          console.warn('BUKLOD IGPAT sign:', String((error as any)?.message ?? error));
          return { ...row, media_url: null };
        }
      };
      const first = source.length ? await sign(source[0]) : null;
      if (generation !== loadGenerationRef.current) return;
      const seeded = source.map((row, index) =>
        index === 0 ? first! : { ...row, media_url: undefined },
      );
      if (first?.media_url || retainedRows.length === 0 || source.length === 0) {
        const alreadyShown = pendingFirstMedia
          ? new Map(rowsRef.current.map(row => [row.id, row]))
          : null;
        const readyRows = pendingFirstMedia
          ? seeded.map(row => {
              const displayed = alreadyShown?.get(row.id);
              if (!displayed || displayed.media_path !== row.media_path) return row;
              return {
                ...row,
                my_reaction: displayed.my_reaction,
                reaction_count: displayed.reaction_count,
                comment_count: displayed.comment_count,
                media_url: row.media_url !== undefined ? row.media_url : displayed.media_url,
              };
            })
          : seeded;
        rowsRef.current = readyRows;
        setRows(readyRows);
        if (first?.media_url) {
          rememberIgpatWarmFeed(user.id, feedMode, dataSaver, readyRows);
        }
      }
      // The user's swipe position must not jump back to page one after signing.
      setLoading(false);
      // Background signing never shifts the list or overrides a later feed request.
      // The next clip gets first priority; all later clips share a single
      // Storage signing request instead of triggering one React render each.
      // Never overwrite rows from a newer feed or a different media path.
      const applySignedRows = (signedRows: IgpatRow[]) => {
        if (generation !== loadGenerationRef.current || !signedRows.length) return;
        const byId = new Map(signedRows.map(row => [row.id, row]));
        let changed = false;
        const next = rowsRef.current.map(item => {
          const signed = byId.get(item.id);
          if (!signed || signed.media_path !== item.media_path) return item;
          const usableUrl = signed.media_url || item.media_url || null;
          if (item.media_url === usableUrl) return item;
          changed = true;
          return { ...item, media_url: usableUrl };
        });
        if (changed) {
          rowsRef.current = next;
          setRows(next);
        }
        const available = signedRows.filter(row => Boolean(row.media_url));
        if (!available.length) return;
        if (getIgpatWarmFeed<IgpatRow>(user.id, feedMode, dataSaver).length) {
          for (const row of available) {
            updateIgpatWarmFeedRow(user.id, feedMode, dataSaver, row);
          }
        } else {
          rememberIgpatWarmFeed(user.id, feedMode, dataSaver, next);
        }
      };
      if (source.length > 1) {
        void sign(source[1]).then(row => applySignedRows([row]))
          .catch(() => console.warn('BUKLOD IGPAT next video sign failed'));
      }
      if (source.length > 2) {
        void signIgpatRowsInBatch(
          source.slice(2),
          paths => withBuklodTimeout(
            supabase.storage.from('community-media')
              .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS),
            9000,
            'IGPAT background sign batch',
          ),
          sign,
          () => generation === loadGenerationRef.current,
          applySignedRows,
        ).then(applySignedRows)
          .catch(() => console.warn('BUKLOD IGPAT batch sign failed'));
      }
    } catch (error) {
      const message = String((error as any)?.message ?? error);
      console.warn('BUKLOD IGPAT load:', message);
      if (generation === loadGenerationRef.current) {
        // Keep cached/previously signed media playable through a failed refresh.
        rowsRef.current = retainedRows;
        setRows(retainedRows);
        setLoadError(message);
      }
    } finally {
      if (generation === loadGenerationRef.current) setLoading(false);
    }
  }, [dataSaver, feedMode, prefsReady, user?.id]);

  useEffect(() => {
    void load();
    return () => { loadGenerationRef.current += 1; };
  }, [load]);

  useEffect(() => {
    setActiveIndex(0);
  }, [feedMode]);

  useEffect(() => {
    const previous = previousNetworkStatusRef.current;
    previousNetworkStatusRef.current = networkStatus;
    if ((previous === 'offline' || previous === 'degraded') &&
        networkStatus === 'online' && prefsReady && loadError) {
      void load(); // one recovery attempt on the actual network transition
    }
  }, [networkStatus, prefsReady, loadError, load]);

  const toggleDataSaver = useCallback(() => {
    setDataSaver(current => {
      const next = !current;
      void AsyncStorage.setItem(DATA_SAVER_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  const toggleSaved = useCallback((postId: string) => {
    setSavedIds(current => {
      const next = new Set(current);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      void AsyncStorage.setItem(SAVED_IGPAT_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  const toggleFollow = useCallback(async (creatorId: string) => {
    if (!user?.id || creatorId === user.id || followBusy.has(creatorId)) return;

    const wasFollowing = followedIds.has(creatorId);
    setFollowBusy(current => new Set(current).add(creatorId));
    setFollowedIds(current => {
      const next = new Set(current);
      if (wasFollowing) next.delete(creatorId);
      else next.add(creatorId);
      return next;
    });

    try {
      const request = wasFollowing
        ? supabase
            .from('buklod_user_follows')
            .delete()
            .eq('follower_id', user.id)
            .eq('followed_user_id', creatorId)
        : supabase
            .from('buklod_user_follows')
            .insert({ follower_id: user.id, followed_user_id: creatorId });

      const { error } = await request;
      if (error) throw error;
    } catch (error) {
      console.warn('BUKLOD IGPAT follow:', String((error as any)?.message ?? error));
      setFollowedIds(current => {
        const next = new Set(current);
        if (wasFollowing) next.add(creatorId);
        else next.delete(creatorId);
        return next;
      });
    } finally {
      setFollowBusy(current => {
        const next = new Set(current);
        next.delete(creatorId);
        return next;
      });
    }
  }, [followBusy, followedIds, user?.id]);

  const pulse = useCallback(async (postId: string) => {
    const row = rows.find(item => item.id === postId);
    if (!row || row.my_reaction === 'love' || reactionBusy.has(postId)) return;

    setReactionBusy(current => new Set(current).add(postId));
    setRows(current =>
      current.map(item =>
        item.id === postId
          ? {
              ...item,
              my_reaction: 'love',
              reaction_count:
                Number(item.reaction_count ?? 0) + (item.my_reaction ? 0 : 1),
            }
          : item
      )
    );

    try {
      let result = await (supabase as any).rpc('set_buklod_post_reaction_v4', {
        p_post_id: postId,
        p_reaction: 'love',
      });

      if (result?.error) {
        result = await (supabase as any).rpc('set_buklod_post_reaction_v3', {
          p_post_id: postId,
          p_reaction: 'love',
        });
      }

      if (result?.error) throw result.error;
    } catch (error) {
      console.warn('BUKLOD IGPAT pulse:', String((error as any)?.message ?? error));
      setRows(current =>
        current.map(item =>
          item.id === postId
            ? {
                ...item,
                my_reaction: row.my_reaction ?? null,
                reaction_count: Number(row.reaction_count ?? 0),
              }
            : item
        )
      );
    } finally {
      setReactionBusy(current => {
        const next = new Set(current);
        next.delete(postId);
        return next;
      });
    }
  }, [reactionBusy, rows]);

  const shareIgpat = useCallback(async (postId: string) => {
    try {
      await Share.share({
        message: `BUKLOD IGPAT — An Instant Bond.\nhttps://buklod.expo.app/post/${postId}`,
      });
    } catch (error) {
      console.warn('BUKLOD IGPAT share:', String((error as any)?.message ?? error));
    }
  }, []);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<ViewToken<IgpatFeedRow>> }) => {
      const first = viewableItems.find(item => item.isViewable && typeof item.index === 'number');
      if (typeof first?.index === 'number') setActiveIndex(first.index);
    }
  ).current;

  const viewabilityConfig = useMemo(
    () => ({ itemVisiblePercentThreshold: 82, minimumViewTime: 100 }),
    []
  );

  const nextPlayableIndex = (dataSaver || weakSignal) ? -1 : feedRows.findIndex((item, index) =>
    index > activeIndex && !isReelsFeedInlineAdRow(item));

  if (!prefsReady || (loading && !rows.length) || visibleFeedKeyRef.current !== currentFeedKey) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingTitle}>BUKLOD IGPAT</Text>
        <Text style={styles.loadingTagline}>An Instant Bond.</Text>
      </View>
    );
  }

  if (!rows.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>BUKLOD IGPAT</Text>
        <Text style={styles.emptyCopy}>
          {loadError
            ? 'IGPAT could not load right now.'
            : feedMode === 'following'
              ? 'Follow IGPAT creators to see them here.'
              : feedMode === 'latest'
                ? 'No latest IGPAT videos yet.'
                : 'No available IGPAT videos yet.'}
        </Text>
        <View style={styles.emptyActions}>
          {feedMode === 'following' ? (
            <Pressable style={styles.retryButton} onPress={() => setFeedMode('for-you')}>
              <Text style={styles.retryText}>FOR YOU</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.retryButton} onPress={() => void load()}>
            <Text style={styles.retryText}>RETRY</Text>
          </Pressable>
          <Pressable style={styles.retryButton} onPress={() => router.push('/igpat/create' as any)}>
            <Text style={styles.retryText}>CREATE</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        ref={reelsListRef}
        data={feedRows}
        extraData={`${activeIndex}:${screenFocused}`}
        key={`${feedMode}:${dataSaver ? 'saver' : 'normal'}`}
        keyExtractor={item => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        initialNumToRender={2}
        maxToRenderPerBatch={3}
        updateCellsBatchingPeriod={40}
        windowSize={5}
        removeClippedSubviews
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: viewportHeight,
          offset: viewportHeight * index,
          index,
        })}
        renderItem={({ item, index }) => {
          if (isReelsFeedInlineAdRow(item)) {
            const active=screenFocused && index===activeIndex;
            const state=reelsAdStates[item.id]??'loading';
            return (
              <View style={[styles.page, { height: viewportHeight }]}>
                {active && state!=='ready' ? (
                  <View style={styles.center}>
                    <ActivityIndicator color="#FFFFFF" size="small"/>
                    <Text style={styles.loadingTagline}>Preparing sponsored content…</Text>
                  </View>
                ) : null}
                {screenFocused ? (
                  <BuklodReelsInlineAd
                    slotId={item.id}
                    active={active}
                    prepare={!weakSignal && index===activeIndex+1}
                    onLoadStateChange={next=>{
                      setReelsAdStates(current=>current[item.id]===next
                        ? current:{...current,[item.id]:next});
                    }}
                  />
                ) : null}
              </View>
            );
          }

          const creatorId = item.user_id ? String(item.user_id) : '';
          const isSelf = creatorId === user?.id;
          const isFollowing = Boolean(creatorId && followedIds.has(creatorId));

          return (
            <View style={[styles.page, { height: viewportHeight }]}>
              {screenFocused && !!item.media_url && (index === activeIndex || index === nextPlayableIndex) ? (
                <IgpatVideo
                  uri={item.media_url}
                  active={index === activeIndex}
                  conservativeBuffer={dataSaver || weakSignal}
                />
              ) : null}
              {index === activeIndex && !item.media_url ? (
                <View style={styles.center}>
                  {item.media_url === undefined ? <ActivityIndicator color="#FFFFFF" /> : (
                    <Pressable onPress={() => void load()} style={styles.retryButton}>
                      <Text style={styles.retryText}>RETRY VIDEO</Text>
                    </Pressable>
                  )}
                </View>
              ) : null}
              <View pointerEvents="none" style={styles.scrim} />

              <View style={[styles.topBar, { top: insets.top + 10 }]}>
                <View pointerEvents="none">
                  <Text style={styles.brandTitle}>IGPAT</Text>
                  <Text style={styles.brandTagline}>An Instant Bond.</Text>
                </View>
                <View style={styles.topActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={dataSaver ? 'Turn Data Saver off' : 'Turn Data Saver on'}
                    onPress={toggleDataSaver}
                    style={[styles.utilityButton, dataSaver && styles.utilityButtonActive]}
                  >
                    <MaterialCommunityIcons
                      name="leaf"
                      size={17}
                      color={dataSaver ? '#07100B' : '#FFFFFF'}
                    />
                    <Text style={[styles.utilityText, dataSaver && styles.utilityTextActive]}>
                      {dataSaver ? 'SAVER' : 'DATA'}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Create IGPAT"
                    onPress={() => router.push('/igpat/create' as any)}
                    style={styles.createButton}
                  >
                    <MaterialCommunityIcons name="plus" size={21} color="#07100B" />
                  </Pressable>
                </View>
              </View>

              <View style={[styles.feedTabs, { top: insets.top + 58 }]}>
                {([
                  ['for-you', 'For You'],
                  ['following', 'Following'],
                  ['latest', 'Latest'],
                ] as Array<[FeedMode, string]>).map(([mode, label]) => (
                  <Pressable
                    key={mode}
                    onPress={() => setFeedMode(mode)}
                    style={[styles.feedTab, feedMode === mode && styles.feedTabActive]}
                  >
                    <Text style={[styles.feedTabText, feedMode === mode && styles.feedTabTextActive]}>
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={[styles.actions, { bottom: Math.max(insets.bottom + 34, 42) }]}>
                <ActionButton
                  icon={item.my_reaction === 'love' ? 'heart' : 'heart-outline'}
                  label="Pulse this IGPAT"
                  active={item.my_reaction === 'love'}
                  count={item.reaction_count}
                  onPress={() => void pulse(item.id)}
                />
                <ActionButton
                  icon="comment-outline"
                  label="Open comments"
                  count={item.comment_count}
                  onPress={() => router.push(`/post/${item.id}?openComments=1` as any)}
                />
                <ActionButton
                  icon="share-variant-outline"
                  label="Share IGPAT"
                  onPress={() => void shareIgpat(item.id)}
                />
                <ActionButton
                  icon={savedIds.has(item.id) ? 'bookmark' : 'bookmark-outline'}
                  label={savedIds.has(item.id) ? 'Remove saved IGPAT' : 'Save IGPAT'}
                  active={savedIds.has(item.id)}
                  onPress={() => toggleSaved(item.id)}
                />
              </View>

              <View style={[styles.meta, { bottom: Math.max(insets.bottom + 30, 38) }]}>
                <View style={styles.authorRow}>
                  <Text numberOfLines={1} style={styles.author}>
                    {resolvePersonDisplayName(item.author_name, item.user_id)}
                  </Text>
                  {!isSelf && creatorId ? (
                    <Pressable
                      disabled={followBusy.has(creatorId)}
                      onPress={() => void toggleFollow(creatorId)}
                      style={[styles.followButton, isFollowing && styles.followingButton]}
                    >
                      <Text style={[styles.followText, isFollowing && styles.followingText]}>
                        {isFollowing ? 'FOLLOWING' : 'FOLLOW'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                {!!item.body && (
                  <Text numberOfLines={2} style={styles.caption}>
                    {item.body}
                  </Text>
                )}
                {dataSaver ? <Text style={styles.saverHint}>DATA SAVER ON</Text> : null}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050807' },
  videoLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#050807',
  },
  videoLoadingText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  page: { width: '100%', backgroundColor: '#050807', overflow: 'hidden' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050807',
    paddingHorizontal: 28,
  },
  loadingTitle: { marginTop: 16, color: '#FFFFFF', fontSize: 17, fontWeight: '900', letterSpacing: 1.2 },
  loadingTagline: { marginTop: 4, color: 'rgba(255,255,255,0.62)', fontSize: 11, fontWeight: '700' },
  emptyTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '900', letterSpacing: 1.1 },
  emptyModeTitle: { marginTop: 12, color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  emptyCopy: { marginTop: 8, color: 'rgba(255,255,255,0.62)', fontSize: 12, textAlign: 'center' },
  emptyActions: { marginTop: 18, flexDirection: 'row', gap: 10 },
  retryButton: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.42)',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  retryText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.9 },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.10)',
  },
  topBar: {
    position: 'absolute',
    left: 18,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  brandTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '900', letterSpacing: 1.4 },
  brandTagline: { marginTop: 1, color: 'rgba(255,255,255,0.66)', fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  utilityButton: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
    backgroundColor: 'rgba(0,0,0,0.36)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  utilityButtonActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  utilityText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  utilityTextActive: { color: '#07100B' },
  createButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  feedTabs: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    padding: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  feedTab: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  feedTabActive: { backgroundColor: 'rgba(255,255,255,0.16)' },
  feedTabText: { color: 'rgba(255,255,255,0.62)', fontSize: 9, fontWeight: '800' },
  feedTabTextActive: { color: '#FFFFFF' },
  actions: {
    position: 'absolute',
    right: 12,
    alignItems: 'center',
    gap: 11,
  },
  actionButton: { alignItems: 'center', minWidth: 48 },
  actionPressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  actionOrb: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  actionOrbActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  actionCount: { marginTop: 3, color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  meta: { position: 'absolute', left: 18, right: 76 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  author: { maxWidth: '68%', color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  followButton: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: 'rgba(0,0,0,0.24)',
  },
  followingButton: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  followText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  followingText: { color: '#07100B' },
  caption: { marginTop: 6, color: 'rgba(255,255,255,0.90)', fontSize: 12, lineHeight: 17, fontWeight: '600' },
  saverHint: { marginTop: 8, color: 'rgba(255,255,255,0.50)', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  pausedBadge: {
    position: 'absolute',
    alignSelf: 'center',
    top: '47%',
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.48)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pausedBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
});