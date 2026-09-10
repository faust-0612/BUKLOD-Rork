import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
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
import { getIgpatPostMetadata } from '@/lib/igpat/igpatMetadata';
import type { IgpatQuickEditState } from '@/components/igpat/IgpatQuickEditPanel';
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

type Row = {
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

const DATA_SAVER_KEY = '@buklod_igpat_data_saver_v2';
const SIGNED_URL_TTL_SECONDS = 1200;
const URL_CACHE_MS = 15 * 60_000;
const urlCache = new Map<string, { url: string; expiresAt: number }>();
const DEFAULT_EDIT: IgpatQuickEditState = {
  trimStartSeconds: 0,
  trimEndSeconds: null,
  speed: 1,
  textOverlay: '',
  captionsEnabled: false,
  audioLabel: '',
  coverSeconds: 0,
};

async function signedUrlFor(path: string) {
  const cached = urlCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  const { data, error } = await supabase.storage.from('community-media').createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  urlCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + URL_CACHE_MS });
  return data.signedUrl;
}

async function mapLimited<T, R>(items: T[], concurrency: number, work: (item: T) => Promise<R>) {
  const out = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await work(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return out;
}

function VideoCell({
  uri,
  active,
  edit,
  onStart,
  onWatch,
  onComplete,
  onReplay,
}: {
  uri: string;
  active: boolean;
  edit: IgpatQuickEditState;
  onStart: () => void;
  onWatch: (ms: number) => void;
  onComplete: () => void;
  onReplay: () => void;
}) {
  const [paused, setPaused] = useState(false);
  const startedAt = useRef<number | null>(null);
  const wasActive = useRef(false);
  const completed = useRef(false);
  const player = useVideoPlayer(uri, p => {
    p.loop = true;
    p.muted = false;
    p.playbackRate = edit.speed || 1;
  });

  useEffect(() => {
    try { player.playbackRate = edit.speed || 1; } catch {}
  }, [edit.speed, player]);

  useEffect(() => {
    if (active && !wasActive.current) {
      setPaused(false);
      completed.current = false;
      try { player.currentTime = Math.max(0, edit.trimStartSeconds || 0); } catch {}
    }
    wasActive.current = active;

    if (active && !paused) {
      try { player.play(); } catch {}
      if (startedAt.current == null) {
        startedAt.current = Date.now();
        onStart();
      }
    } else {
      try { player.pause(); } catch {}
      if (startedAt.current != null) {
        onWatch(Date.now() - startedAt.current);
        startedAt.current = null;
      }
    }
  }, [active, edit.trimStartSeconds, onStart, onWatch, paused, player]);

  useEffect(() => {
    const sub = player.addListener('timeUpdate', ({ currentTime }: any) => {
      const start = Math.max(0, edit.trimStartSeconds || 0);
      const end = edit.trimEndSeconds == null ? null : Math.max(start, edit.trimEndSeconds);
      if (end != null && currentTime >= end) {
        if (!completed.current) {
          completed.current = true;
          onComplete();
        } else {
          onReplay();
        }
        try { player.currentTime = start; } catch {}
      }
    });
    return () => { try { sub.remove(); } catch {} };
  }, [edit.trimEndSeconds, edit.trimStartSeconds, onComplete, onReplay, player]);

  useEffect(() => () => {
    try { player.pause(); } catch {}
    if (startedAt.current != null) onWatch(Date.now() - startedAt.current);
  }, [onWatch, player]);

  return (
    <Pressable
      style={StyleSheet.absoluteFill}
      onPress={() => active && setPaused(v => !v)}
      onLongPress={() => {
        if (!active) return;
        try { player.playbackRate = 2; player.play(); } catch {}
      }}
      onPressOut={() => {
        try {
          player.playbackRate = edit.speed || 1;
          if (paused) player.pause();
        } catch {}
      }}
      delayLongPress={220}
      accessibilityRole="button"
      accessibilityLabel={paused ? 'Play IGPAT video' : 'Pause IGPAT video'}
    >
      <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls={false} contentFit="cover" />
      {!!edit.textOverlay && <Text pointerEvents="none" style={styles.overlayText}>{edit.textOverlay}</Text>}
      {!!edit.audioLabel && <View pointerEvents="none" style={styles.audioPill}><MaterialCommunityIcons name="music-note" size={12} color="#fff" /><Text style={styles.audioText}>{edit.audioLabel}</Text></View>}
      {active && paused ? <View pointerEvents="none" style={styles.paused}><MaterialCommunityIcons name="play" size={20} color="#fff" /><Text style={styles.pausedText}>PAUSED</Text></View> : null}
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
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.railButton}>
    <View style={[styles.railOrb, active && styles.railOrbOn]}><MaterialCommunityIcons name={icon} size={22} color={active ? '#07140D' : '#fff'} /></View>
    {typeof count === 'number' && count > 0 ? <Text style={styles.railCount}>{count > 999 ? '999+' : count}</Text> : null}
  </Pressable>;
}

export default function IgpatExperienceComplete() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { openReport, reportSheet } = useBuklodContentReport();
  const [rows, setRows] = useState<Row[]>([]);
  const [metadata, setMetadata] = useState<Record<string, IgpatQuickEditState>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [feedMode, setFeedMode] = useState<FeedMode>('for-you');
  const [dataSaver, setDataSaver] = useState(false);
  const [prefsReady, setPrefsReady] = useState(false);
  const [fetchLimit, setFetchLimit] = useState(18);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<Array<{ kind: IgpatFeedbackKind; postId?: string | null; creatorId?: string | null }>>([]);
  const [menuRow, setMenuRow] = useState<Row | null>(null);
  const [bondRow, setBondRow] = useState<Row | null>(null);
  const reactionBusy = useRef(new Set<string>());
  const seenImpression = useRef(new Set<string>());
  const seenComplete = useRef(new Set<string>());

  useEffect(() => {
    let alive = true;
    void Promise.all([AsyncStorage.getItem(DATA_SAVER_KEY), getIgpatSavedIds(), getIgpatFeedback()]).then(([saver, saved, fb]) => {
      if (!alive) return;
      setDataSaver(saver === '1');
      setSavedIds(new Set(saved));
      setFeedback(fb);
      setPrefsReady(true);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    void supabase.from('buklod_user_follows').select('followed_user_id').eq('follower_id', user.id).then(({ data }) => {
      setFollowedIds(new Set((data ?? []).map((x: any) => String(x.followed_user_id))));
    });
  }, [user?.id]);

  const load = useCallback(async () => {
    if (!prefsReady) return;
    if (!user?.id) { setRows([]); setLoading(false); return; }
    setLoading(true);
    setLoadError(null);
    try {
      const limit = dataSaver ? Math.min(8, fetchLimit) : Math.min(50, fetchLimit);
      const { data, error } = await (supabase as any).rpc('get_buklod_reels_v1', { p_limit: limit });
      if (error) throw error;
      const source = ((data ?? []) as Row[]).filter(x => x.media_path).slice(0, limit);
      const signed = await mapLimited(source, 4, async row => ({
        ...row,
        author_name: resolvePersonDisplayName(row.author_name) || 'BUKLOD Member',
        media_url: await signedUrlFor(row.media_path),
      }));
      const good = signed.filter(x => Boolean(x.media_url));
      setRows(good);
      const meta = await getIgpatPostMetadata(good.map(x => x.id));
      setMetadata(meta);
      setActiveId(good[0]?.id ?? null);
    } catch (error: any) {
      setLoadError(String(error?.message ?? error));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [dataSaver, fetchLimit, prefsReady, user?.id]);

  useEffect(() => { void load(); }, [load]);

  const hiddenPosts = useMemo(() => new Set(feedback.filter(x => x.kind === 'hide' || x.kind === 'not_interested').map(x => String(x.postId ?? ''))), [feedback]);
  const hiddenCreators = useMemo(() => new Set(feedback.filter(x => x.kind === 'dont_recommend_creator').map(x => String(x.creatorId ?? ''))), [feedback]);
  const fewer = useMemo(() => new Set(feedback.filter(x => x.kind === 'show_fewer').map(x => String(x.postId ?? ''))), [feedback]);

  const visibleRows = useMemo(() => {
    let result = rows.filter(x => !hiddenPosts.has(x.id) && !hiddenCreators.has(String(x.user_id ?? '')));
    if (feedMode === 'following') result = result.filter(x => Boolean(x.user_id && followedIds.has(x.user_id)));
    if (feedMode === 'latest') result = [...result].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    if (feedMode === 'for-you' && fewer.size) result = [...result.filter(x => !fewer.has(x.id)), ...result.filter(x => fewer.has(x.id))];
    return result;
  }, [feedMode, followedIds, hiddenCreators, hiddenPosts, fewer, rows]);

  useEffect(() => { setActiveId(visibleRows[0]?.id ?? null); }, [feedMode]);

  const setActive = useCallback((id: string | null) => {
    if (!id) return;
    setActiveId(id);
    if (!seenImpression.current.has(id)) {
      seenImpression.current.add(id);
      void trackIgpatEvent({ event: 'impression', postId: id, feedSource: feedMode });
    }
  }, [feedMode]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<ViewToken<Row>> }) => {
    const first = viewableItems.find(x => x.isViewable && x.item?.id);
    if (first?.item?.id) setActiveId(first.item.id);
  }).current;

  const onMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.max(0, Math.min(visibleRows.length - 1, Math.round(event.nativeEvent.contentOffset.y / Math.max(1, height))));
    setActive(visibleRows[index]?.id ?? null);
  };

  const toggleSaved = async (id: string) => {
    const next = !savedIds.has(id);
    setSavedIds(current => { const s = new Set(current); next ? s.add(id) : s.delete(id); return s; });
    try { await setIgpatSaved(id, next); } catch {}
  };

  const toggleFollow = async (creatorId: string) => {
    if (!user?.id || creatorId === user.id) return;
    const was = followedIds.has(creatorId);
    setFollowedIds(current => { const s = new Set(current); was ? s.delete(creatorId) : s.add(creatorId); return s; });
    const req = was
      ? supabase.from('buklod_user_follows').delete().eq('follower_id', user.id).eq('followed_user_id', creatorId)
      : supabase.from('buklod_user_follows').insert({ follower_id: user.id, followed_user_id: creatorId });
    const { error } = await req;
    if (error) setFollowedIds(current => { const s = new Set(current); was ? s.add(creatorId) : s.delete(creatorId); return s; });
    else void trackIgpatEvent({ event: 'follow', creatorId, meta: { following: !was } });
  };

  const pulse = async (id: string) => {
    if (reactionBusy.current.has(id)) return;
    const row = rows.find(x => x.id === id);
    if (!row || row.my_reaction === 'love') return;
    reactionBusy.current.add(id);
    setRows(current => current.map(x => x.id === id ? { ...x, my_reaction: 'love', reaction_count: Number(x.reaction_count ?? 0) + 1 } : x));
    let result = await (supabase as any).rpc('set_buklod_post_reaction_v4', { p_post_id: id, p_reaction: 'love' });
    if (result?.error) result = await (supabase as any).rpc('set_buklod_post_reaction_v3', { p_post_id: id, p_reaction: 'love' });
    if (result?.error) setRows(current => current.map(x => x.id === id ? { ...x, my_reaction: null, reaction_count: Math.max(0, Number(x.reaction_count ?? 1) - 1) } : x));
    else void trackIgpatEvent({ event: 'pulse', postId: id });
    reactionBusy.current.delete(id);
  };

  const applyFeedback = async (kind: IgpatFeedbackKind, row: Row) => {
    const entry = { kind, postId: row.id, creatorId: row.user_id ?? null };
    setFeedback(current => [entry, ...current]);
    setMenuRow(null);
    try { await setIgpatFeedback(entry); } catch {}
  };

  if (!prefsReady || loading) return <View style={styles.center}><ActivityIndicator size="large" color="#fff" /><Text style={styles.title}>BUKLOD IGPAT</Text><Text style={styles.tagline}>An Instant Bond.</Text></View>;

  return <View style={styles.root}>
    <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
      <Text style={styles.brand}>BUKLOD IGPAT</Text><Text style={styles.brandTag}>An Instant Bond.</Text>
      <View style={styles.modeRow}>
        {(['for-you', 'following', 'latest'] as FeedMode[]).map(mode => <Pressable key={mode} onPress={() => setFeedMode(mode)} style={[styles.modeChip, feedMode === mode && styles.modeChipOn]}><Text style={[styles.modeText, feedMode === mode && styles.modeTextOn]}>{mode === 'for-you' ? 'For You' : mode === 'following' ? 'Following' : 'Latest'}</Text></Pressable>)}
        <Pressable onPress={() => router.push('/igpat/arena' as any)} style={styles.modeChip}><Text style={styles.modeText}>Arena</Text></Pressable>
      </View>
    </View>

    {visibleRows.length ? <FlatList
      data={visibleRows}
      key={`${feedMode}:${dataSaver ? 'saver' : 'normal'}`}
      keyExtractor={x => x.id}
      pagingEnabled
      showsVerticalScrollIndicator={false}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={{ itemVisiblePercentThreshold: 60, minimumViewTime: 50 }}
      onMomentumScrollEnd={onMomentumEnd}
      initialNumToRender={2}
      maxToRenderPerBatch={3}
      windowSize={5}
      onEndReached={() => { if (!dataSaver && fetchLimit < 50) setFetchLimit(v => Math.min(50, v + 12)); }}
      onEndReachedThreshold={1.2}
      renderItem={({ item, index }) => {
        const active = item.id === activeId;
        const following = Boolean(item.user_id && followedIds.has(item.user_id));
        const edit = metadata[item.id] ?? DEFAULT_EDIT;
        return <View style={[styles.page, { height }]}>
          <VideoCell
            uri={item.media_url!}
            active={active}
            edit={edit}
            onStart={() => void trackIgpatEvent({ event: 'start', postId: item.id, creatorId: item.user_id, feedSource: feedMode })}
            onWatch={watchMs => void trackIgpatEvent({ event: 'watch', postId: item.id, creatorId: item.user_id, feedSource: feedMode, watchMs })}
            onComplete={() => {
              if (seenComplete.current.has(item.id)) return;
              seenComplete.current.add(item.id);
              void trackIgpatEvent({ event: 'complete', postId: item.id, creatorId: item.user_id, feedSource: feedMode });
            }}
            onReplay={() => void trackIgpatEvent({ event: 'replay', postId: item.id, creatorId: item.user_id, feedSource: feedMode })}
          />
          <View pointerEvents="none" style={styles.shade} />
          <View style={styles.creatorBlock}>
            <BuklodTappableAvatar userId={item.user_id} name={item.author_name} size={42} />
            <View style={{ flex: 1 }}><View style={styles.creatorRow}><Text style={styles.creatorName} numberOfLines={1}>{item.author_name}</Text>{item.user_id && item.user_id !== user?.id ? <Pressable onPress={() => void toggleFollow(item.user_id!)} style={styles.follow}><Text style={styles.followText}>{following ? 'FOLLOWING' : 'FOLLOW'}</Text></Pressable> : null}</View>{!!item.body && <Text style={styles.caption} numberOfLines={3}>{item.body}</Text>}{edit.captionsEnabled ? <Text style={styles.captionState}>CC · Captions enabled</Text> : null}</View>
          </View>
          <View style={styles.rail}>
            <RailButton icon={item.my_reaction === 'love' ? 'heart' : 'heart-outline'} label="Pulse" active={item.my_reaction === 'love'} count={Number(item.reaction_count ?? 0)} onPress={() => void pulse(item.id)} />
            <RailButton icon="comment-outline" label="Comments" count={Number(item.comment_count ?? 0)} onPress={() => router.push(`/post/${item.id}` as any)} />
            <RailButton icon={savedIds.has(item.id) ? 'bookmark' : 'bookmark-outline'} label="Save" active={savedIds.has(item.id)} onPress={() => void toggleSaved(item.id)} />
            <RailButton icon="share-variant-outline" label="Share" onPress={() => void Share.share({ message: `BUKLOD IGPAT — An Instant Bond.\n${igpatCanonicalUrl(item.id)}` })} />
            <RailButton icon="link-variant" label="Bond" onPress={() => setBondRow(item)} />
            <RailButton icon="dots-horizontal" label="More" onPress={() => setMenuRow(item)} />
          </View>
          <View style={styles.internalShare}><BuklodPostInternalShare postId={item.id} compact iconOnly /></View>
          {active && index > 0 && index % 6 === 0 && !dataSaver ? <IgpatAdSlot active slotId={item.id} /> : null}
        </View>;
      }}
    /> : <View style={styles.center}><Text style={styles.title}>BUKLOD IGPAT</Text><Text style={styles.empty}>{loadError ? `Could not load: ${loadError}` : 'No available IGPAT videos yet.'}</Text><Pressable style={styles.primary} onPress={() => void load()}><Text style={styles.primaryText}>RETRY</Text></Pressable></View>}

    <View pointerEvents="box-none" style={[styles.utilityBar, { bottom: Math.max(insets.bottom, 8) + 8 }]}><Pressable onPress={() => { const next = !dataSaver; setDataSaver(next); void AsyncStorage.setItem(DATA_SAVER_KEY, next ? '1' : '0'); }} style={styles.utilityButton}><MaterialCommunityIcons name="leaf" size={17} color="#fff" /><Text style={styles.utilityText}>{dataSaver ? 'TIPID DATA ON' : 'TIPID DATA'}</Text></Pressable><Pressable onPress={() => router.push('/igpat/create' as any)} style={styles.createButton}><MaterialCommunityIcons name="plus" size={18} color="#07140D" /><Text style={styles.createText}>CREATE</Text></Pressable></View>

    <Modal transparent visible={Boolean(menuRow)} animationType="fade" onRequestClose={() => setMenuRow(null)}><Pressable style={styles.backdrop} onPress={() => setMenuRow(null)}><View style={styles.sheet}><Text style={styles.sheetTitle}>Tune your IGPAT</Text>{menuRow ? <>{(['not_interested', 'show_fewer', 'dont_recommend_creator', 'hide'] as IgpatFeedbackKind[]).map(kind => <Pressable key={kind} style={styles.sheetAction} onPress={() => void applyFeedback(kind, menuRow)}><Text style={styles.sheetActionText}>{kind.replaceAll('_', ' ')}</Text></Pressable>)}<Pressable style={styles.sheetAction} onPress={() => { openReport('post', menuRow.id); setMenuRow(null); }}><Text style={[styles.sheetActionText, { color: '#ff9b9b' }]}>Report</Text></Pressable></> : null}</View></Pressable></Modal>

    <Modal transparent visible={Boolean(bondRow)} animationType="fade" onRequestClose={() => setBondRow(null)}><Pressable style={styles.backdrop} onPress={() => setBondRow(null)}><View style={styles.sheet}><Text style={styles.sheetTitle}>Create a Bond</Text>{([['relay','Relay'],['pass','Pass IGPAT'],['capsule','Capsule'],['mosaic','Moment Mosaic'],['memory_echo','Memory Echo']] as Array<[IgpatBondKind,string]>).map(([kind,label]) => <Pressable key={kind} style={styles.sheetAction} onPress={() => bondRow && void createIgpatBond({ kind, postId: bondRow.id }).then(() => setBondRow(null)).catch(() => undefined)}><Text style={styles.sheetActionText}>{label}</Text></Pressable>)}</View></Pressable></Modal>
    {reportSheet}
  </View>;
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:'#000'},center:{flex:1,backgroundColor:'#070A08',alignItems:'center',justifyContent:'center',padding:24},title:{marginTop:12,color:'#fff',fontSize:22,fontWeight:'900'},tagline:{marginTop:4,color:'#a7b1aa',fontSize:12,fontWeight:'700'},empty:{marginTop:8,color:'#a7b1aa',textAlign:'center'},primary:{marginTop:14,minHeight:42,paddingHorizontal:18,borderRadius:12,backgroundColor:'#fff',justifyContent:'center'},primaryText:{color:'#07140D',fontWeight:'900'},page:{width:'100%',backgroundColor:'#000',overflow:'hidden'},shade:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,.08)'},topBar:{position:'absolute',zIndex:20,top:0,left:0,right:0,paddingHorizontal:12,paddingBottom:8,backgroundColor:'rgba(0,0,0,.18)'},brand:{color:'#fff',fontSize:14,fontWeight:'900',letterSpacing:1,textAlign:'center'},brandTag:{marginTop:1,color:'#d4d9d6',fontSize:9,fontWeight:'700',textAlign:'center'},modeRow:{marginTop:7,flexDirection:'row',justifyContent:'center',gap:5,flexWrap:'wrap'},modeChip:{paddingHorizontal:9,paddingVertical:6,borderRadius:999,backgroundColor:'rgba(20,20,20,.56)'},modeChipOn:{backgroundColor:'#fff'},modeText:{color:'#fff',fontSize:10,fontWeight:'900'},modeTextOn:{color:'#07140D'},overlayText:{position:'absolute',left:18,right:76,top:'32%',color:'#fff',fontSize:22,fontWeight:'900',textShadowColor:'#000',textShadowRadius:5},audioPill:{position:'absolute',left:14,bottom:148,flexDirection:'row',gap:5,alignItems:'center',paddingHorizontal:9,paddingVertical:5,borderRadius:999,backgroundColor:'rgba(0,0,0,.55)'},audioText:{color:'#fff',fontSize:9,fontWeight:'800'},paused:{position:'absolute',alignSelf:'center',top:'44%',flexDirection:'row',gap:5,alignItems:'center',paddingHorizontal:12,paddingVertical:8,borderRadius:999,backgroundColor:'rgba(0,0,0,.52)'},pausedText:{color:'#fff',fontSize:10,fontWeight:'900'},creatorBlock:{position:'absolute',left:14,right:88,bottom:82,flexDirection:'row',gap:10,alignItems:'flex-end'},creatorRow:{flexDirection:'row',alignItems:'center',gap:8},creatorName:{color:'#fff',fontSize:14,fontWeight:'900',maxWidth:180},follow:{paddingHorizontal:8,paddingVertical:4,borderRadius:999,borderWidth:1,borderColor:'#fff'},followText:{color:'#fff',fontSize:8,fontWeight:'900'},caption:{marginTop:5,color:'#fff',fontSize:12,lineHeight:17},captionState:{marginTop:4,color:'#d4d9d6',fontSize:9,fontWeight:'800'},rail:{position:'absolute',right:10,bottom:104,gap:12,alignItems:'center'},railButton:{alignItems:'center',minWidth:50},railOrb:{width:43,height:43,borderRadius:22,backgroundColor:'rgba(0,0,0,.45)',alignItems:'center',justifyContent:'center'},railOrbOn:{backgroundColor:'#fff'},railCount:{marginTop:3,color:'#fff',fontSize:9,fontWeight:'900'},internalShare:{position:'absolute',right:8,bottom:68},utilityBar:{position:'absolute',zIndex:24,left:12,right:12,flexDirection:'row',justifyContent:'space-between'},utilityButton:{flexDirection:'row',alignItems:'center',gap:5,minHeight:38,paddingHorizontal:10,borderRadius:12,backgroundColor:'rgba(0,0,0,.55)'},utilityText:{color:'#fff',fontSize:9,fontWeight:'900'},createButton:{flexDirection:'row',alignItems:'center',gap:3,minHeight:38,paddingHorizontal:12,borderRadius:12,backgroundColor:'#fff'},createText:{color:'#07140D',fontSize:10,fontWeight:'900'},backdrop:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.55)'},sheet:{padding:18,paddingBottom:30,borderTopLeftRadius:22,borderTopRightRadius:22,backgroundColor:'#111512'},sheetTitle:{color:'#fff',fontSize:18,fontWeight:'900',marginBottom:4},sheetAction:{minHeight:48,justifyContent:'center',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#303731'},sheetActionText:{color:'#fff',fontSize:14,fontWeight:'800',textTransform:'capitalize'},
});