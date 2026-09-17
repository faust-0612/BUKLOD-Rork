import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
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

import BuklodReelsInlineAd from '@/components/BuklodReelsInlineAd';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';
import { parseIgpatQuickEdit } from '@/lib/igpat/quickEdit';
import { supabase } from '@/lib/supabase';
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

const NORMAL_LIMIT = 16;
const DATA_SAVER_LIMIT = 8;
const DEEP_LINK_LIMIT = 50;
const SIGNED_URL_TTL_SECONDS = 1200;
const SIGN_CONCURRENCY = 4;
const WEB_BANNER_INTERVAL = 9;
const DATA_SAVER_KEY = '@buklod_igpat_data_saver_v1';
const SAVED_IGPAT_KEY = '@buklod_igpat_saved_ids_v1';

async function mapWithConcurrency<T, R>(
  values: T[],
  limit: number,
  worker: (value: T) => Promise<R>,
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
    Array.from({ length: Math.min(limit, values.length) }, () => runWorker()),
  );

  return results;
}

async function fetchExactIgpatRow(postId: string): Promise<IgpatRow | null> {
  if (!postId) return null;

  const { data, error } = await (supabase as any)
    .from('community_posts')
    .select(
      'id,user_id,body,created_at,media_path,media_mime_type,media_duration_seconds,igpat_edit_meta,is_reel,is_hidden,deleted_at',
    )
    .eq('id', postId)
    .maybeSingle();

  if (error || !data) return null;

  const mime = String(data.media_mime_type ?? '').toLowerCase();
  if (
    data.is_reel !== true ||
    data.is_hidden === true ||
    data.deleted_at ||
    !mime.startsWith('video/') ||
    !data.media_path
  ) {
    return null;
  }

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('full_name')
    .eq('id', data.user_id)
    .maybeSingle();

  return {
    id: String(data.id),
    user_id: data.user_id ? String(data.user_id) : null,
    author_name: String(profile?.full_name ?? 'BUKLOD Member'),
    body: String(data.body ?? ''),
    created_at: String(data.created_at ?? new Date().toISOString()),
    media_path: String(data.media_path),
    media_duration_seconds: Number(data.media_duration_seconds ?? 0),
    reaction_count: null,
    comment_count: null,
    my_reaction: null,
    igpat_edit_meta: data.igpat_edit_meta ?? null,
  };
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
    [editMeta, safeDuration],
  );
  const trimStart = hasEditMeta ? edit.trimStartSeconds : 0;
  const trimEnd = hasEditMeta
    ? Number(edit.trimEndSeconds ?? safeDuration)
    : safeDuration;
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
      if (
        hasEditMeta &&
        (Number(player.currentTime ?? 0) < trimStart ||
          Number(player.currentTime ?? 0) >= trimEnd)
      ) {
        player.currentTime = trimStart;
      }
      if (active && !pausedByUser) player.play();
      else player.pause();
    } catch {}
  }, [
    active,
    baseRate,
    edit.muted,
    hasEditMeta,
    pausedByUser,
    player,
    trimEnd,
    trimStart,
  ]);

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
      accessibilityHint="Long press temporarily plays at two times speed."
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
        contentFit={hasEditMeta ? edit.contentFit : 'contain'}
      />

      {hasEditMeta && !!edit.textOverlay.trim() ? (
        <View pointerEvents="none" style={styles.editTextWrap}>
          <Text style={styles.editText}>{edit.textOverlay.trim()}</Text>
        </View>
      ) : null}

      {active && pausedByUser ? (
        <View pointerEvents="none" style={styles.pausedBadge}>
          <MaterialCommunityIcons name="play" size={18} color="#FFFFFF" />
          <Text style={styles.pausedBadgeText}>PAUSED</Text>
        </View>
      ) : null}
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

export default function IgpatWebScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ post?: string | string[] }>();
  const targetPostId = useMemo(() => {
    const raw = Array.isArray(params.post) ? params.post[0] : params.post;
    return String(raw ?? '').trim();
  }, [params.post]);
  const initialTargetRef = useRef(targetPostId);

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
      const normalLimit = dataSaver ? DATA_SAVER_LIMIT : NORMAL_LIMIT;
      const exactTarget = initialTargetRef.current;
      const requestLimit = exactTarget ? DEEP_LINK_LIMIT : normalLimit;
      const { data, error } = await (supabase as any).rpc('get_buklod_igpat_feed_v3', {
        p_mode: feedMode,
        p_limit: requestLimit,
      });
      if (error) throw error;

      let source = ((data ?? []) as IgpatRow[])
        .filter(row => Boolean(row.media_path))
        .slice(0, requestLimit);

      if (exactTarget) {
        const existing = source.find(row => String(row.id) === exactTarget) ?? null;
        let targetRow = existing;

        if (!targetRow) {
          targetRow = await fetchExactIgpatRow(exactTarget);
        }

        if (targetRow) {
          source = [
            targetRow,
            ...source.filter(row => String(row.id) !== exactTarget),
          ].slice(0, requestLimit);
        }
      }

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
        },
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

  useEffect(() => {
    setActiveIndex(0);
  }, [feedMode]);

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
          : item,
      ),
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
            : item,
        ),
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
        message: `BUKLOD IGPAT — An Instant Bond.\nhttps://buklod.expo.app/igpat?post=${encodeURIComponent(postId)}`,
      });
    } catch (error) {
      console.warn('BUKLOD IGPAT share:', String((error as any)?.message ?? error));
    }
  }, []);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<ViewToken<IgpatRow>> }) => {
      const first = viewableItems.find(
        item => item.isViewable && typeof item.index === 'number',
      );
      if (typeof first?.index === 'number') setActiveIndex(first.index);
    },
  ).current;

  const viewabilityConfig = useMemo(
    () => ({ itemVisiblePercentThreshold: 82, minimumViewTime: 100 }),
    [],
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
        extraData={activeIndex}
        key={`${feedMode}:${dataSaver ? 'saver' : 'normal'}`}
        keyExtractor={item => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        updateCellsBatchingPeriod={80}
        windowSize={3}
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
          const shouldMountVideo = Math.abs(index - activeIndex) <= 1;
          const showInlineBanner = (index + 1) % WEB_BANNER_INTERVAL === 0;

          return (
            <View style={[styles.page, { height: viewportHeight }]}>
              <View style={styles.stage}>
                {!!item.media_url && shouldMountVideo ? (
                  <IgpatVideo
                    uri={item.media_url}
                    active={index === activeIndex}
                    durationSeconds={Number(item.media_duration_seconds ?? 60)}
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
                      onPress={() => {
                        initialTargetRef.current = '';
                        setFeedMode(mode);
                      }}
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
                    onPress={() => router.push(`/post/${item.id}` as any)}
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

                {showInlineBanner ? (
                  <View
                    style={[
                      styles.inlineAdWrap,
                      { bottom: Math.max(insets.bottom + 126, 134) },
                    ]}
                  >
                    <BuklodReelsInlineAd
                      slotId={`web-igpat-${item.id}`}
                      active={index === activeIndex}
                    />
                  </View>
                ) : null}

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
                  {!!item.body ? (
                    <Text numberOfLines={2} style={styles.caption}>
                      {item.body}
                    </Text>
                  ) : null}
                  {dataSaver ? <Text style={styles.saverHint}>DATA SAVER ON</Text> : null}
                </View>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#020504' },
  page: {
    width: '100%',
    backgroundColor: '#020504',
    overflow: 'hidden',
    alignItems: 'center',
  },
  stage: {
    width: '100%',
    maxWidth: 560,
    height: '100%',
    alignSelf: 'center',
    backgroundColor: '#050807',
    overflow: 'hidden',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050807',
    paddingHorizontal: 28,
  },
  loadingTitle: {
    marginTop: 16,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  loadingTagline: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.62)',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '900', letterSpacing: 1.1 },
  emptyCopy: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.62)',
    fontSize: 12,
    textAlign: 'center',
  },
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
    backgroundColor: 'rgba(0,0,0,0.08)',
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
  brandTagline: {
    marginTop: 1,
    color: 'rgba(255,255,255,0.66)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
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
  inlineAdWrap: {
    position: 'absolute',
    left: 18,
    right: 18,
    alignItems: 'center',
  },
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
  caption: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.90)',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  saverHint: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.50)',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  editTextWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '48%',
    alignItems: 'center',
  },
  editText: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.78)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
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
