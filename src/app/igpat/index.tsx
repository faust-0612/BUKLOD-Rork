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
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import { supabase } from '@/lib/supabase';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';
import { parseIgpatQuickEdit } from '@/lib/igpat/quickEdit';
import { IGPAT_RELAY_OPTIONS, type IgpatRelayPrompt } from '@/lib/igpat/relay';
import { useAuth } from '@/providers/AuthProvider';

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
  igpat_edit_meta?: unknown;
  media_url?: string | null;
};

type FeedMode = 'for-you' | 'following' | 'latest';
type PulseKey = 'inspired' | 'amen' | 'happy' | 'curious' | 'support' | 'pray';
type PulseOption = {
  key: PulseKey;
  label: string;
  storedReaction: 'love' | 'amen' | 'haha' | 'with_you' | 'care' | 'praying';
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};
type BondMoment = {
  userId: string;
  name: string;
};

const NORMAL_LIMIT = 16;
const DATA_SAVER_LIMIT = 8;
const SIGNED_URL_TTL_SECONDS = 1200;
const SIGN_CONCURRENCY = 4;
const DATA_SAVER_KEY = '@buklod_igpat_data_saver_v1';
const SAVED_IGPAT_KEY = '@buklod_igpat_saved_ids_v1';
const PULSE_OPTIONS: PulseOption[] = [
  { key: 'inspired', label: 'Inspired', storedReaction: 'love', icon: 'lightbulb-outline' },
  { key: 'amen', label: 'Amen', storedReaction: 'amen', icon: 'check-circle-outline' },
  { key: 'happy', label: 'Happy', storedReaction: 'haha', icon: 'emoticon-happy-outline' },
  { key: 'curious', label: 'Curious', storedReaction: 'with_you', icon: 'help-circle-outline' },
  { key: 'support', label: 'Support', storedReaction: 'care', icon: 'hand-heart' },
  { key: 'pray', label: 'Pray', storedReaction: 'praying', icon: 'hands-pray' },
];

function pulseOptionForStoredReaction(reaction?: string | null): PulseOption | null {
  if (!reaction) return null;
  return PULSE_OPTIONS.find(option => option.storedReaction === reaction) ?? null;
}

async function mapWithConcurrency<T, R>(
  values: T[],
  limit: number,
  worker: (value: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;

  async function runWorker() {
    while (true) {
      const index = cursor++;
      if (index >= values.length) return;
      results[index] = await worker(values[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, () => runWorker())
  );

  return results;
}

function IgpatVideo({
  uri,
  active,
  durationSeconds,
  editMeta,
}: {
  uri: string;
  active: boolean;
  durationSeconds: number;
  editMeta?: unknown;
}) {
  const [pausedByUser, setPausedByUser] = useState(false);
  const hasEditMeta = Boolean(editMeta && typeof editMeta === 'object');
  const safeDuration = durationSeconds > 0 ? durationSeconds : 60;
  const edit = useMemo(
    () => parseIgpatQuickEdit(editMeta, safeDuration),
    [editMeta, safeDuration]
  );
  const trimStart = hasEditMeta ? edit.trimStartSeconds : 0;
  const trimEnd = hasEditMeta ? Number(edit.trimEndSeconds ?? safeDuration) : safeDuration;
  const baseRate = hasEditMeta ? edit.speed : 1;

  const player = useVideoPlayer(uri, instance => {
    instance.loop = !hasEditMeta;
    instance.muted = hasEditMeta ? edit.muted : false;
    instance.playbackRate = baseRate;
  });

  useEffect(() => {
    try {
      player.loop = !hasEditMeta;
      player.muted = hasEditMeta ? edit.muted : false;
      player.playbackRate = baseRate;
      if (hasEditMeta && (player.currentTime < trimStart || player.currentTime >= trimEnd)) {
        player.currentTime = trimStart;
      }
      if (active && !pausedByUser) player.play();
      else player.pause();
    } catch {}
  }, [active, baseRate, edit.muted, hasEditMeta, pausedByUser, player, trimEnd, trimStart]);

  useEffect(() => {
    if (!active) setPausedByUser(false);
  }, [active]);

  useEffect(() => {
    if (!active || !hasEditMeta) return undefined;

    const timer = setInterval(() => {
      try {
        const current = Number(player.currentTime ?? 0);
        if (current >= trimEnd - 0.04 || current < trimStart - 0.04) {
          player.currentTime = trimStart;
          if (!pausedByUser) player.play();
        }
      } catch {}
    }, 120);

    return () => clearInterval(timer);
  }, [active, hasEditMeta, pausedByUser, player, trimEnd, trimStart]);

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
      player.playbackRate = baseRate;
      if (pausedByUser) player.pause();
    } catch {}
  };

  return (
    <Pressable
      style={StyleSheet.absoluteFill}
      onPress={() => active && setPausedByUser(current => !current)}
      onLongPress={startFastPlayback}
      onPressOut={stopFastPlayback}
      delayLongPress={220}
      accessibilityRole="button"
      accessibilityLabel={pausedByUser ? 'Play IGPAT video' : 'Pause IGPAT video'}
    >
      <VideoView
        player={player}
        style={[
          StyleSheet.absoluteFill,
          hasEditMeta && edit.rotation !== 0
            ? { transform: [{ rotate: `${edit.rotation}deg` }] }
            : null,
        ]}
        nativeControls={false}
        contentFit={hasEditMeta ? edit.contentFit : 'cover'}
      />
      {hasEditMeta && !!edit.textOverlay.trim() && (
        <View pointerEvents="none" style={styles.editTextWrap}>
          <Text style={styles.editText}>{edit.textOverlay.trim()}</Text>
        </View>
      )}
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
  onLongPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  active?: boolean;
  count?: number | null;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const longPressedRef = useRef(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPressIn={() => { longPressedRef.current = false; }}
      onPress={() => {
        if (longPressedRef.current) {
          longPressedRef.current = false;
          return;
        }
        onPress();
      }}
      onLongPress={onLongPress ? () => {
        longPressedRef.current = true;
        onLongPress();
      } : undefined}
      delayLongPress={280}
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
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<IgpatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [feedMode, setFeedMode] = useState<FeedMode>('for-you');
  const [dataSaver, setDataSaver] = useState(false);
  const [prefsReady, setPrefsReady] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [followBusy, setFollowBusy] = useState<Set<string>>(new Set());
  const [reactionBusy, setReactionBusy] = useState<Set<string>>(new Set());
  const [pulsePickerPostId, setPulsePickerPostId] = useState<string | null>(null);
  const [relayPickerPostId, setRelayPickerPostId] = useState<string | null>(null);
  const [bondMoments, setBondMoments] = useState<Record<string, BondMoment>>({});
  const viewportHeight = Dimensions.get('window').height;

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
    if (!prefsReady) return;
    if (!user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const limit = dataSaver ? DATA_SAVER_LIMIT : NORMAL_LIMIT;
      const { data, error } = await (supabase as any).rpc('get_buklod_igpat_feed_v3', {
        p_mode: feedMode,
        p_limit: limit,
      });
      if (error) throw error;

      const source = ((data ?? []) as IgpatRow[])
        .filter(row => Boolean(row.media_path))
        .slice(0, limit);

      const signed = await mapWithConcurrency(
        source,
        SIGN_CONCURRENCY,
        async row => {
          const { data: mediaData, error: signError } = await supabase.storage
            .from('community-media')
            .createSignedUrl(row.media_path, SIGNED_URL_TTL_SECONDS);

          if (signError) {
            console.warn('BUKLOD IGPAT sign:', signError.message);
            return { ...row, media_url: null };
          }

          return { ...row, media_url: mediaData?.signedUrl ?? null };
        }
      );

      setRows(signed.filter(row => Boolean(row.media_url)));
      setActiveIndex(0);
    } catch (error) {
      const message = String((error as any)?.message ?? error);
      console.warn('BUKLOD IGPAT load:', message);
      setRows([]);
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [dataSaver, feedMode, prefsReady, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadBondMoments = useCallback(async () => {
    if (!user?.id || !rows.length || !followedIds.size) {
      setBondMoments({});
      return;
    }

    const postIds = rows.map(row => row.id);
    const followedUserIds = Array.from(followedIds);

    try {
      const { data: reactionRows, error: reactionError } = await supabase
        .from('reactions')
        .select('post_id,user_id')
        .in('post_id', postIds)
        .in('user_id', followedUserIds);
      if (reactionError) throw reactionError;

      const firstBondUserByPost = new Map<string, string>();
      for (const row of reactionRows ?? []) {
        const postId = String(row.post_id ?? '');
        const bondUserId = String(row.user_id ?? '');
        if (postId && bondUserId && bondUserId !== user.id && !firstBondUserByPost.has(postId)) {
          firstBondUserByPost.set(postId, bondUserId);
        }
      }

      const bondUserIds = Array.from(new Set(firstBondUserByPost.values()));
      if (!bondUserIds.length) {
        setBondMoments({});
        return;
      }

      const { data: profileRows, error: profileError } = await supabase
        .from('profiles')
        .select('id,full_name,first_name,username')
        .in('id', bondUserIds);
      if (profileError) throw profileError;

      const names = new Map<string, string>();
      for (const profileRow of profileRows ?? []) {
        const id = String(profileRow.id ?? '');
        const rawName = profileRow.full_name || profileRow.first_name || profileRow.username || 'Someone you follow';
        if (id) names.set(id, resolvePersonDisplayName(String(rawName), id));
      }

      const next: Record<string, BondMoment> = {};
      firstBondUserByPost.forEach((bondUserId, postId) => {
        next[postId] = {
          userId: bondUserId,
          name: names.get(bondUserId) ?? 'Someone you follow',
        };
      });
      setBondMoments(next);
    } catch (error) {
      console.warn('BUKLOD IGPAT bond moment:', String((error as any)?.message ?? error));
      setBondMoments({});
    }
  }, [followedIds, rows, user?.id]);

  useEffect(() => {
    void loadBondMoments();
  }, [loadBondMoments]);

  useEffect(() => {
    setActiveIndex(0);
    setPulsePickerPostId(null);
    setRelayPickerPostId(null);
  }, [feedMode]);

  useEffect(() => {
    setPulsePickerPostId(null);
    setRelayPickerPostId(null);
  }, [activeIndex]);

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

  const setPulseReaction = useCallback(async (postId: string, storedReaction: string) => {
    const row = rows.find(item => item.id === postId);
    if (!row || reactionBusy.has(postId)) return;

    const sameReaction = row.my_reaction === storedReaction;
    const nextReaction = sameReaction ? null : storedReaction;
    const previousCount = Number(row.reaction_count ?? 0);
    const nextCount = sameReaction
      ? Math.max(0, previousCount - 1)
      : row.my_reaction
        ? previousCount
        : previousCount + 1;

    setPulsePickerPostId(null);
    setReactionBusy(current => new Set(current).add(postId));
    setRows(current =>
      current.map(item =>
        item.id === postId
          ? { ...item, my_reaction: nextReaction, reaction_count: nextCount }
          : item
      )
    );

    try {
      let result = await (supabase as any).rpc('set_buklod_post_reaction_v4', {
        p_post_id: postId,
        p_reaction: storedReaction,
      });

      if (result?.error) {
        result = await (supabase as any).rpc('set_buklod_post_reaction_v3', {
          p_post_id: postId,
          p_reaction: storedReaction,
        });
      }

      if (result?.error) throw result.error;
      const persistedReaction = result?.data == null ? null : String(result.data);
      setRows(current =>
        current.map(item =>
          item.id === postId ? { ...item, my_reaction: persistedReaction } : item
        )
      );
    } catch (error) {
      console.warn('BUKLOD IGPAT pulse:', String((error as any)?.message ?? error));
      setRows(current =>
        current.map(item =>
          item.id === postId
            ? {
                ...item,
                my_reaction: row.my_reaction ?? null,
                reaction_count: previousCount,
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

  const pulse = useCallback((postId: string) => {
    const row = rows.find(item => item.id === postId);
    if (!row) return;
    const currentOption = pulseOptionForStoredReaction(row.my_reaction);
    void setPulseReaction(postId, currentOption?.storedReaction ?? 'love');
  }, [rows, setPulseReaction]);

  const shareIgpat = useCallback(async (postId: string) => {
    try {
      await Share.share({
        message: `BUKLOD IGPAT — An Instant Bond.\nhttps://buklod.expo.app/post/${postId}`,
      });
    } catch (error) {
      console.warn('BUKLOD IGPAT share:', String((error as any)?.message ?? error));
    }
  }, []);

  const beginRelay = useCallback((row: IgpatRow, prompt: IgpatRelayPrompt) => {
    const author = resolvePersonDisplayName(row.author_name, row.user_id);
    setRelayPickerPostId(null);
    setPulsePickerPostId(null);
    router.push({
      pathname: '/igpat/create',
      params: {
        relayParentPostId: row.id,
        relayPrompt: prompt,
        relayParentAuthor: author,
      },
    } as any);
  }, []);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<ViewToken<IgpatRow>> }) => {
      const first = viewableItems.find(item => item.isViewable && typeof item.index === 'number');
      if (typeof first?.index === 'number') setActiveIndex(first.index);
    }
  ).current;

  const viewabilityConfig = useMemo(
    () => ({ itemVisiblePercentThreshold: 82, minimumViewTime: 100 }),
    []
  );

  if (!prefsReady || loading) {
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
        data={rows}
        extraData={`${activeIndex}:${pulsePickerPostId ?? ''}:${relayPickerPostId ?? ''}:${Object.keys(bondMoments).length}`}
        key={`${feedMode}:${dataSaver ? 'saver' : 'normal'}`}
        keyExtractor={item => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        updateCellsBatchingPeriod={80}
        windowSize={2}
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
          const creatorId = item.user_id ? String(item.user_id) : '';
          const isSelf = creatorId === user?.id;
          const isFollowing = Boolean(creatorId && followedIds.has(creatorId));
          const currentPulse = pulseOptionForStoredReaction(item.my_reaction);
          const showPulsePicker = pulsePickerPostId === item.id && index === activeIndex;
          const showRelayPicker = relayPickerPostId === item.id && index === activeIndex;
          const bondMoment = item.my_reaction ? bondMoments[item.id] : null;

          return (
            <View style={[styles.page, { height: viewportHeight }]}>
              {!!item.media_url && index === activeIndex ? (
                <IgpatVideo
                  uri={item.media_url}
                  active
                  durationSeconds={Number(item.media_duration_seconds ?? 0)}
                  editMeta={item.igpat_edit_meta}
                />
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

              {showPulsePicker ? (
                <View style={[styles.pulsePicker, { bottom: Math.max(insets.bottom + 84, 92) }]}>
                  <View style={styles.pickerHeader}>
                    <View>
                      <Text style={styles.pickerTitle}>IGPAT PULSE</Text>
                      <Text style={styles.pickerHint}>Choose how this bond felt.</Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Close IGPAT Pulse choices"
                      onPress={() => setPulsePickerPostId(null)}
                      style={styles.pickerClose}
                    >
                      <MaterialCommunityIcons name="close" size={17} color="#FFFFFF" />
                    </Pressable>
                  </View>
                  <View style={styles.pulseChoices}>
                    {PULSE_OPTIONS.map(option => {
                      const selected = item.my_reaction === option.storedReaction;
                      return (
                        <Pressable
                          key={option.key}
                          disabled={reactionBusy.has(item.id)}
                          accessibilityRole="button"
                          accessibilityLabel={`${option.label} IGPAT Pulse`}
                          onPress={() => void setPulseReaction(item.id, option.storedReaction)}
                          style={[styles.pulseChoice, selected && styles.pulseChoiceSelected]}
                        >
                          <MaterialCommunityIcons
                            name={option.icon}
                            size={18}
                            color={selected ? '#07100B' : '#FFFFFF'}
                          />
                          <Text style={[styles.pulseChoiceText, selected && styles.pulseChoiceTextSelected]}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {showRelayPicker ? (
                <View style={[styles.relayPicker, { bottom: Math.max(insets.bottom + 82, 90) }]}>
                  <View style={styles.pickerHeader}>
                    <View style={styles.pickerHeaderCopy}>
                      <Text style={styles.pickerTitle}>IGPAT RELAY</Text>
                      <Text style={styles.pickerHint}>Reply with a video, or open the existing chain.</Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Close IGPAT Relay choices"
                      onPress={() => setRelayPickerPostId(null)}
                      style={styles.pickerClose}
                    >
                      <MaterialCommunityIcons name="close" size={17} color="#FFFFFF" />
                    </Pressable>
                  </View>
                  <View style={styles.relayChoices}>
                    {IGPAT_RELAY_OPTIONS.map(option => (
                      <Pressable
                        key={option.key}
                        accessibilityRole="button"
                        accessibilityLabel={`${option.label} IGPAT Relay`}
                        onPress={() => beginRelay(item, option.key)}
                        style={styles.relayChoice}
                      >
                        <Text style={styles.relayChoiceTitle}>{option.label}</Text>
                        <Text style={styles.relayChoiceHelper} numberOfLines={2}>{option.helper}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="View IGPAT Relay chain"
                    onPress={() => {
                      setRelayPickerPostId(null);
                      router.push(`/igpat/relay/${item.id}` as any);
                    }}
                    style={styles.relayChainButton}
                  >
                    <MaterialCommunityIcons name="source-branch" size={16} color="#D9FF69" />
                    <Text style={styles.relayChainText}>VIEW RELAY CHAIN</Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={[styles.actions, { bottom: Math.max(insets.bottom + 34, 42) }]}>
                <ActionButton
                  icon={currentPulse ? currentPulse.icon : 'heart-outline'}
                  label={currentPulse ? `${currentPulse.label} Pulse. Long press to change.` : 'Pulse this IGPAT. Long press for choices.'}
                  active={Boolean(currentPulse)}
                  count={item.reaction_count}
                  onPress={() => pulse(item.id)}
                  onLongPress={() => {
                    setRelayPickerPostId(null);
                    setPulsePickerPostId(item.id);
                  }}
                />
                <ActionButton
                  icon="comment-outline"
                  label="Open comments"
                  count={item.comment_count}
                  onPress={() => router.push(`/post/${item.id}` as any)}
                />
                <ActionButton
                  icon="share-variant-outline"
                  label="Share IGPAT. Long press for Relay."
                  onPress={() => void shareIgpat(item.id)}
                  onLongPress={() => {
                    setPulsePickerPostId(null);
                    setRelayPickerPostId(item.id);
                  }}
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
                {bondMoment ? (
                  <View style={styles.bondMoment} accessibilityLabel={`You and ${bondMoment.name} connected with this IGPAT`}>
                    <MaterialCommunityIcons name="link-variant" size={13} color="#D9FF69" />
                    <Text numberOfLines={1} style={styles.bondMomentText}>
                      You and {bondMoment.name} connected with this.
                    </Text>
                  </View>
                ) : null}
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
  pulsePicker: {
    position: 'absolute',
    left: 16,
    right: 72,
    zIndex: 5,
    padding: 13,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(5,8,7,0.94)',
  },
  relayPicker: {
    position: 'absolute',
    left: 16,
    right: 72,
    zIndex: 5,
    padding: 13,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(217,255,105,0.22)',
    backgroundColor: 'rgba(5,8,7,0.96)',
  },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  pickerHeaderCopy: { flex: 1 },
  pickerTitle: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  pickerHint: { marginTop: 3, color: 'rgba(255,255,255,0.50)', fontSize: 8.5 },
  pickerClose: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.09)' },
  pulseChoices: { marginTop: 11, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  pulseChoice: {
    minWidth: '30%',
    flexGrow: 1,
    minHeight: 43,
    paddingHorizontal: 9,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  pulseChoiceSelected: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  pulseChoiceText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '900' },
  pulseChoiceTextSelected: { color: '#07100B' },
  relayChoices: { marginTop: 11, gap: 7 },
  relayChoice: { minHeight: 49, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 11, paddingVertical: 8, justifyContent: 'center' },
  relayChoiceTitle: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '900' },
  relayChoiceHelper: { marginTop: 2, color: 'rgba(255,255,255,0.48)', fontSize: 8.2, lineHeight: 12 },
  relayChainButton: { marginTop: 10, minHeight: 39, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(217,255,105,0.24)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  relayChainText: { color: '#D9FF69', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
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
  bondMoment: {
    marginTop: 8,
    maxWidth: '100%',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(217,255,105,0.25)',
  },
  bondMomentText: { flexShrink: 1, color: 'rgba(255,255,255,0.82)', fontSize: 9, fontWeight: '800' },
  saverHint: { marginTop: 8, color: 'rgba(255,255,255,0.50)', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  editTextWrap: {
    position: 'absolute',
    left: 22,
    right: 78,
    bottom: '18%',
    alignItems: 'center',
  },
  editText: {
    maxWidth: '100%',
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.86)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
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
