import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
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
import { useAuth } from '@/providers/AuthProvider';
import { BuklodTappableAvatar } from '@/components/BuklodTappableAvatar';
import BuklodPostInternalShare from '@/components/BuklodPostInternalShare';
import { useBuklodContentReport } from '@/components/BuklodContentReportSheet';
import IgpatAdSlot from '@/components/igpat/IgpatAdSlot';
import {
  createIgpatBond,
  getIgpatFeedback,
  getIgpatSavedIds,
  igpatCanonicalUrl,
  setIgpatFeedback,
  setIgpatSaved,
  trackIgpatEvent,
  type IgpatBondKind,
  type IgpatFeedbackKind,
} from '@/lib/igpat/igpatRuntime';

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

type FeedMode = 'for-you' | 'following' | 'latest';

const NORMAL_LIMIT = 18;
const DATA_SAVER_LIMIT = 8;
const SIGNED_URL_TTL_SECONDS = 1200;
const SIGN_CONCURRENCY = 4;
const DATA_SAVER_KEY = '@buklod_igpat_data_saver_v2';

async function mapWithConcurrency<T, R>(values: T[], limit: number, worker: (value: T) => Promise<R>) {
  const results = new Array<R>(values.length);
  let cursor = 0;
  async function runWorker() {
    while (true) {
      const index = cursor++;
      if (index >= values.length) return;
      results[index] = await worker(values[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, runWorker));
  return results;
}

function IgpatVideo({
  uri,
  active,
  onStarted,
  onWatchTick,
}: {
  uri: string;
  active: boolean;
  onStarted: () => void;
  onWatchTick: (watchMs: number) => void;
}) {
  const [pausedByUser, setPausedByUser] = useState(false);
  const startedAt = useRef<number | null>(null);
  const player = useVideoPlayer(uri, instance => {
    instance.loop = true;
    instance.muted = false;
  });

  useEffect(() => {
    if (active && !pausedByUser) {
      try {
        player.play();
        if (startedAt.current == null) {
          startedAt.current = Date.now();
          onStarted();
        }
      } catch {}
    } else {
      try { player.pause(); } catch {}
      if (startedAt.current != null) {
        onWatchTick(Date.now() - startedAt.current);
        startedAt.current = null;
      }
    }
  }, [active, onStarted, onWatchTick, pausedByUser, player]);

  useEffect(() => () => {
    try { player.pause(); } catch {}
    if (startedAt.current != null) onWatchTick(Date.now() - startedAt.current);
  }, [onWatchTick, player]);

  return (
    <Pressable
      style={StyleSheet.absoluteFill}
      onPress={() => active && setPausedByUser(value => !value)}
      onLongPress={() => {
        if (!active) return;
        try { player.playbackRate = 2; player.play(); } catch {}
      }}
      onPressOut={() => {
        try { player.playbackRate = 1; if (pausedByUser) player.pause(); } catch {}
      }}
      delayLongPress={220}
      accessibilityRole="button"
      accessibilityLabel={pausedByUser ? 'Play IGPAT video' : 'Pause IGPAT video'}
    >
      <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls={false} contentFit="cover" />
      {active && pausedByUser ? (
        <View pointerEvents="none" style={styles.pausedBadge}>
          <MaterialCommunityIcons name="play" size={18} color="#fff" />
          <Text style={styles.pausedText}>PAUSED</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function RailButton({ icon, label, active, count, onPress }: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  active?: boolean;
  count?: number | null;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.railButton}>
      <View style={[styles.railOrb, active && styles.railOrbOn]}>
        <MaterialCommunityIcons name={icon} size={22} color={active ? '#07140D' : '#fff'} />
      </View>
      {typeof count === 'number' && count > 0 ? <Text style={styles.railCount}>{count > 999 ? '999+' : count}</Text> : null}
    </Pressable>
  );
}

export default function IgpatExperience() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { openReport, reportSheet } = useBuklodContentReport();
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
  const [feedback, setFeedback] = useState<Array<{ kind: IgpatFeedbackKind; postId?: string | null; creatorId?: string | null }>>([]);
  const [menuRow, setMenuRow] = useState<IgpatRow | null>(null);
  const [bondRow, setBondRow] = useState<IgpatRow | null>(null);
  const viewportHeight = Dimensions.get('window').height;

  useEffect(() => {
    let alive = true;
    void Promise.all([
      AsyncStorage.getItem(DATA_SAVER_KEY),
      getIgpatSavedIds(),
      getIgpatFeedback(),
    ]).then(([saver, saved, nextFeedback]) => {
      if (!alive) return;
      setDataSaver(saver === '1');
      setSavedIds(new Set(saved));
      setFeedback(nextFeedback);
      setPrefsReady(true);
    });
    return () => { alive = false; };
  }, []);

  const loadFollows = useCallback(async () => {
    if (!user?.id) return setFollowedIds(new Set());
    const { data, error } = await supabase
      .from('buklod_user_follows')
      .select('followed_user_id')
      .eq('follower_id', user.id);
    if (!error) setFollowedIds(new Set((data ?? []).map(row => String(row.followed_user_id))));
  }, [user?.id]);

  useEffect(() => { void loadFollows(); }, [loadFollows]);

  const load = useCallback(async () => {
    if (!prefsReady) return;
    if (!user?.id) { setRows([]); setLoading(false); return; }
    setLoading(true);
    setLoadError(null);
    try {
      const limit = dataSaver ? DATA_SAVER_LIMIT : NORMAL_LIMIT;
      const { data, error } = await (supabase as any).rpc('get_buklod_reels_v1', { p_limit: limit });
      if (error) throw error;
      const source = ((data ?? []) as IgpatRow[]).filter(row => Boolean(row.media_path)).slice(0, limit);
      const signed = await mapWithConcurrency(source, SIGN_CONCURRENCY, async row => {
        const { data: mediaData, error: signError } = await supabase.storage
          .from('community-media')
          .createSignedUrl(row.media_path, SIGNED_URL_TTL_SECONDS);
        if (signError) return { ...row, media_url: null };
        return { ...row, author_name: resolvePersonDisplayName(row.author_name) || 'BUKLOD Member', media_url: mediaData?.signedUrl ?? null };
      });
      setRows(signed.filter(row => Boolean(row.media_url)));
      setActiveIndex(0);
    } catch (error) {
      const message = String((error as any)?.message ?? error);
      setLoadError(message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [dataSaver, prefsReady, user?.id]);

  useEffect(() => { void load(); }, [load]);

  const hiddenPosts = useMemo(() => new Set(feedback.filter(x => x.kind === 'hide' || x.kind === 'not_interested').map(x => String(x.postId ?? ''))), [feedback]);
  const hiddenCreators = useMemo(() => new Set(feedback.filter(x => x.kind === 'dont_recommend_creator').map(x => String(x.creatorId ?? ''))), [feedback]);

  const visibleRows = useMemo(() => {
    let result = rows.filter(row => !hiddenPosts.has(row.id) && !hiddenCreators.has(String(row.user_id ?? '')));
    if (feedMode === 'following') result = result.filter(row => Boolean(row.user_id && followedIds.has(row.user_id)));
    if (feedMode === 'latest') result = [...result].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return result;
  }, [feedMode, followedIds, hiddenCreators, hiddenPosts, rows]);

  useEffect(() => { setActiveIndex(0); }, [feedMode]);

  const toggleSaved = useCallback(async (postId: string) => {
    const nextValue = !savedIds.has(postId);
    setSavedIds(current => {
      const next = new Set(current);
      if (nextValue) next.add(postId); else next.delete(postId);
      return next;
    });
    try { await setIgpatSaved(postId, nextValue); } catch {}
  }, [savedIds]);

  const toggleFollow = useCallback(async (creatorId: string) => {
    if (!user?.id || creatorId === user.id || followBusy.has(creatorId)) return;
    const wasFollowing = followedIds.has(creatorId);
    setFollowBusy(current => new Set(current).add(creatorId));
    setFollowedIds(current => {
      const next = new Set(current);
      if (wasFollowing) next.delete(creatorId); else next.add(creatorId);
      return next;
    });
    try {
      const request = wasFollowing
        ? supabase.from('buklod_user_follows').delete().eq('follower_id', user.id).eq('followed_user_id', creatorId)
        : supabase.from('buklod_user_follows').insert({ follower_id: user.id, followed_user_id: creatorId });
      const { error } = await request;
      if (error) throw error;
      await trackIgpatEvent({ event: 'follow', creatorId, meta: { following: !wasFollowing } });
    } catch {
      setFollowedIds(current => {
        const next = new Set(current);
        if (wasFollowing) next.add(creatorId); else next.delete(creatorId);
        return next;
      });
    } finally {
      setFollowBusy(current => { const next = new Set(current); next.delete(creatorId); return next; });
    }
  }, [followBusy, followedIds, user?.id]);

  const pulse = useCallback(async (postId: string) => {
    const row = rows.find(item => item.id === postId);
    if (!row || row.my_reaction === 'love' || reactionBusy.has(postId)) return;
    setReactionBusy(current => new Set(current).add(postId));
    setRows(current => current.map(item => item.id === postId ? {
      ...item, my_reaction: 'love', reaction_count: Number(item.reaction_count ?? 0) + 1,
    } : item));
    try {
      let result = await (supabase as any).rpc('set_buklod_post_reaction_v4', { p_post_id: postId, p_reaction: 'love' });
      if (result?.error) result = await (supabase as any).rpc('set_buklod_post_reaction_v3', { p_post_id: postId, p_reaction: 'love' });
      if (result?.error) throw result.error;
      await trackIgpatEvent({ event: 'pulse', postId });
    } catch {
      setRows(current => current.map(item => item.id === postId ? {
        ...item, my_reaction: null, reaction_count: Math.max(0, Number(item.reaction_count ?? 1) - 1),
      } : item));
    } finally {
      setReactionBusy(current => { const next = new Set(current); next.delete(postId); return next; });
    }
  }, [reactionBusy, rows]);

  const applyFeedback = useCallback(async (kind: IgpatFeedbackKind, row: IgpatRow) => {
    const entry = { kind, postId: row.id, creatorId: row.user_id ?? null };
    setFeedback(current => [entry, ...current]);
    setMenuRow(null);
    try { await setIgpatFeedback(entry); } catch {}
  }, []);

  const shareExternal = useCallback(async (row: IgpatRow) => {
    try {
      await Share.share({ message: `BUKLOD IGPAT — An Instant Bond.\n${igpatCanonicalUrl(row.id)}` });
      await trackIgpatEvent({ event: 'share', postId: row.id, creatorId: row.user_id });
    } catch {}
  }, []);

  const runBond = useCallback(async (kind: IgpatBondKind, row: IgpatRow) => {
    try {
      await createIgpatBond({ kind, postId: row.id });
      setBondRow(null);
      Alert.alert('BUKLOD IGPAT', `${kind.replaceAll('_', ' ').toUpperCase()} created.`);
    } catch (error) {
      Alert.alert('BUKLOD IGPAT', String((error as any)?.message ?? error));
    }
  }, []);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<ViewToken<IgpatRow>> }) => {
    const first = viewableItems.find(item => item.isViewable && typeof item.index === 'number');
    if (typeof first?.index === 'number') setActiveIndex(first.index);
  }).current;

  if (!prefsReady || loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#fff" /><Text style={styles.title}>BUKLOD IGPAT</Text><Text style={styles.tagline}>An Instant Bond.</Text></View>;
  }

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
        <View style={styles.brandBlock}>
          <Text style={styles.brand}>BUKLOD IGPAT</Text>
          <Text style={styles.brandTag}>An Instant Bond.</Text>
        </View>
        <View style={styles.modeRow}>
          {(['for-you','following','latest'] as FeedMode[]).map(mode => (
            <Pressable key={mode} onPress={() => setFeedMode(mode)} style={[styles.modeChip, feedMode === mode && styles.modeChipOn]}>
              <Text style={[styles.modeText, feedMode === mode && styles.modeTextOn]}>{mode === 'for-you' ? 'For You' : mode === 'following' ? 'Following' : 'Latest'}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => router.push('/igpat/arena' as any)} style={styles.modeChip}>
            <Text style={styles.modeText}>Arena</Text>
          </Pressable>
        </View>
      </View>

      {visibleRows.length ? (
        <FlatList
          data={visibleRows}
          key={`${feedMode}:${dataSaver ? 'saver' : 'normal'}`}
          keyExtractor={item => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 82, minimumViewTime: 100 }}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews
          renderItem={({ item, index }) => {
            const active = index === activeIndex;
            const following = Boolean(item.user_id && followedIds.has(item.user_id));
            return (
              <View style={[styles.page, { height: viewportHeight }]}>
                <IgpatVideo
                  uri={item.media_url!}
                  active={active}
                  onStarted={() => void trackIgpatEvent({ event: 'start', postId: item.id, creatorId: item.user_id, feedSource: feedMode })}
                  onWatchTick={watchMs => void trackIgpatEvent({ event: 'watch', postId: item.id, creatorId: item.user_id, feedSource: feedMode, watchMs })}
                />
                <View pointerEvents="box-none" style={styles.gradientShade} />

                <View style={styles.creatorBlock}>
                  <BuklodTappableAvatar userId={item.user_id} name={item.author_name} size={42} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.creatorRow}>
                      <Text style={styles.creatorName} numberOfLines={1}>{item.author_name || 'BUKLOD Member'}</Text>
                      {item.user_id && item.user_id !== user?.id ? (
                        <Pressable disabled={followBusy.has(item.user_id)} onPress={() => void toggleFollow(item.user_id!)} style={[styles.followButton, following && styles.followButtonOn]}>
                          <Text style={styles.followText}>{following ? 'FOLLOWING' : 'FOLLOW'}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                    {!!item.body && <Text style={styles.caption} numberOfLines={3}>{item.body}</Text>}
                  </View>
                </View>

                <View style={styles.rail}>
                  <RailButton icon={item.my_reaction === 'love' ? 'heart' : 'heart-outline'} label="Pulse" active={item.my_reaction === 'love'} count={Number(item.reaction_count ?? 0)} onPress={() => void pulse(item.id)} />
                  <RailButton icon="comment-outline" label="Comments" count={Number(item.comment_count ?? 0)} onPress={() => { void trackIgpatEvent({ event: 'comment', postId: item.id }); router.push(`/post/${item.id}` as any); }} />
                  <RailButton icon={savedIds.has(item.id) ? 'bookmark' : 'bookmark-outline'} label="Save" active={savedIds.has(item.id)} onPress={() => void toggleSaved(item.id)} />
                  <RailButton icon="share-variant-outline" label="External share" onPress={() => void shareExternal(item)} />
                  <RailButton icon="link-variant" label="Bond" onPress={() => setBondRow(item)} />
                  <RailButton icon="dots-horizontal" label="More" onPress={() => setMenuRow(item)} />
                </View>

                <View style={styles.internalShareWrap}>
                  <BuklodPostInternalShare postId={item.id} compact iconOnly />
                </View>

                {active && index > 0 && index % 6 === 0 && !dataSaver ? <IgpatAdSlot active slotId={item.id} /> : null}
              </View>
            );
          }}
        />
      ) : (
        <View style={styles.center}>
          <Text style={styles.title}>BUKLOD IGPAT</Text>
          <Text style={styles.empty}>{loadError ? 'IGPAT could not load right now.' : feedMode === 'following' ? 'Follow creators to build your Following feed.' : 'No available IGPAT videos yet.'}</Text>
          <View style={styles.emptyActions}>
            <Pressable style={styles.primary} onPress={() => void load()}><Text style={styles.primaryText}>RETRY</Text></Pressable>
            <Pressable style={styles.primary} onPress={() => router.push('/igpat/create' as any)}><Text style={styles.primaryText}>CREATE</Text></Pressable>
          </View>
        </View>
      )}

      <View style={[styles.utilityBar, { bottom: Math.max(insets.bottom, 8) + 8 }]}>
        <Pressable onPress={() => { const next = !dataSaver; setDataSaver(next); void AsyncStorage.setItem(DATA_SAVER_KEY, next ? '1' : '0'); }} style={styles.utilityButton}>
          <MaterialCommunityIcons name="leaf" size={17} color="#fff" />
          <Text style={styles.utilityText}>{dataSaver ? 'TIPID DATA ON' : 'TIPID DATA'}</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/igpat/create' as any)} style={styles.createButton}>
          <MaterialCommunityIcons name="plus" size={18} color="#07140D" />
          <Text style={styles.createText}>CREATE</Text>
        </Pressable>
      </View>

      <Modal transparent visible={Boolean(menuRow)} animationType="fade" onRequestClose={() => setMenuRow(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setMenuRow(null)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Tune your IGPAT</Text>
            {menuRow ? (
              <>
                <Pressable style={styles.sheetAction} onPress={() => void applyFeedback('not_interested', menuRow)}><Text style={styles.sheetActionText}>Not Interested</Text></Pressable>
                <Pressable style={styles.sheetAction} onPress={() => void applyFeedback('show_fewer', menuRow)}><Text style={styles.sheetActionText}>Show Fewer Like This</Text></Pressable>
                <Pressable style={styles.sheetAction} onPress={() => void applyFeedback('dont_recommend_creator', menuRow)}><Text style={styles.sheetActionText}>Don’t Recommend This Creator</Text></Pressable>
                <Pressable style={styles.sheetAction} onPress={() => void applyFeedback('hide', menuRow)}><Text style={styles.sheetActionText}>Hide</Text></Pressable>
                <Pressable style={styles.sheetAction} onPress={() => { openReport('post', menuRow.id); setMenuRow(null); void trackIgpatEvent({ event: 'report', postId: menuRow.id }); }}><Text style={[styles.sheetActionText, { color: '#ff9b9b' }]}>Report</Text></Pressable>
              </>
            ) : null}
          </View>
        </Pressable>
      </Modal>

      <Modal transparent visible={Boolean(bondRow)} animationType="fade" onRequestClose={() => setBondRow(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setBondRow(null)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Create a Bond</Text>
            <Text style={styles.sheetHint}>Connection tools stay separate from Pure Watch.</Text>
            {([
              ['relay','Relay'],['pass','Pass IGPAT'],['capsule','Capsule'],['mosaic','Moment Mosaic'],['memory_echo','Memory Echo'],
            ] as Array<[IgpatBondKind,string]>).map(([kind,label]) => (
              <Pressable key={kind} style={styles.sheetAction} onPress={() => bondRow && void runBond(kind, bondRow)}>
                <Text style={styles.sheetActionText}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {reportSheet}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#070A08', alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { marginTop: 12, color: '#fff', fontSize: 22, fontWeight: '900' },
  tagline: { marginTop: 4, color: '#a7b1aa', fontSize: 12, fontWeight: '700' },
  empty: { marginTop: 8, color: '#a7b1aa', textAlign: 'center', lineHeight: 18 },
  emptyActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  primary: { minHeight: 42, paddingHorizontal: 18, borderRadius: 12, backgroundColor: '#fff', justifyContent: 'center' },
  primaryText: { color: '#07140D', fontWeight: '900' },
  page: { width: '100%', backgroundColor: '#000', overflow: 'hidden' },
  gradientShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.08)' },
  topBar: { position: 'absolute', zIndex: 20, top: 0, left: 0, right: 0, paddingHorizontal: 12, paddingBottom: 8, backgroundColor: 'rgba(0,0,0,0.18)' },
  brandBlock: { alignItems: 'center' },
  brand: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  brandTag: { marginTop: 1, color: '#d4d9d6', fontSize: 9, fontWeight: '700' },
  modeRow: { marginTop: 7, flexDirection: 'row', justifyContent: 'center', gap: 5, flexWrap: 'wrap' },
  modeChip: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(20,20,20,.56)' },
  modeChipOn: { backgroundColor: '#fff' },
  modeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  modeTextOn: { color: '#07140D' },
  pausedBadge: { position: 'absolute', alignSelf: 'center', top: '44%', flexDirection: 'row', gap: 5, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(0,0,0,.52)' },
  pausedText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  creatorBlock: { position: 'absolute', left: 14, right: 88, bottom: 82, flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  creatorName: { color: '#fff', fontSize: 14, fontWeight: '900', maxWidth: 180 },
  followButton: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: '#fff' },
  followButtonOn: { backgroundColor: 'rgba(255,255,255,.18)' },
  followText: { color: '#fff', fontSize: 8, fontWeight: '900' },
  caption: { marginTop: 5, color: '#fff', fontSize: 12, lineHeight: 17 },
  rail: { position: 'absolute', right: 10, bottom: 104, gap: 12, alignItems: 'center' },
  railButton: { alignItems: 'center', minWidth: 50 },
  railOrb: { width: 43, height: 43, borderRadius: 22, backgroundColor: 'rgba(0,0,0,.45)', alignItems: 'center', justifyContent: 'center' },
  railOrbOn: { backgroundColor: '#fff' },
  railCount: { marginTop: 3, color: '#fff', fontSize: 9, fontWeight: '900' },
  internalShareWrap: { position: 'absolute', right: 8, bottom: 68 },
  utilityBar: { position: 'absolute', zIndex: 24, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', pointerEvents: 'box-none' as any },
  utilityButton: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 38, paddingHorizontal: 10, borderRadius: 12, backgroundColor: 'rgba(0,0,0,.55)' },
  utilityText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  createButton: { flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 38, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#fff' },
  createText: { color: '#07140D', fontSize: 10, fontWeight: '900' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.55)' },
  sheet: { padding: 18, paddingBottom: 30, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: '#111512' },
  sheetTitle: { color: '#fff', fontSize: 18, fontWeight: '900', marginBottom: 4 },
  sheetHint: { color: '#9ea7a1', fontSize: 11, marginBottom: 8 },
  sheetAction: { minHeight: 48, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#303731' },
  sheetActionText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
