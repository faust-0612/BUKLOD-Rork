import { useBuklodMediaRecovery } from '@/hooks/useBuklodMediaRecovery';
import { useBuklodVideoCallBusy } from '@/hooks/useBuklodVideoCallBusy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Dimensions,
  FlatList,
  Platform,
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
import {
  buildReelsFeedWithInlineAds,
  isReelsFeedInlineAdRow,
  type ReelsFeedInlineAdRow,
} from '@/lib/buklodAdPlacements';
import { Image } from 'expo-image';
import { useNetwork } from '@/providers/NetworkProvider';
import { readOfflineCacheSync, readOfflineCache, writeOfflineCache } from '@/lib/buklodOfflineSync';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { peekCommunityMediaUrl, resolveCommunityMediaUrl, resignCommunityMediaUrl } from '@/lib/buklodMediaUrl';
import { readCachedCommunityVideoStill, persistCommunityVideoStill } from '@/lib/buklodCommunityVideoStill';
import { supabase } from '@/lib/supabase';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';
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
  media_url?: string | null;
};

type IgpatFeedRow = IgpatRow | ReelsFeedInlineAdRow;
type FeedMode = 'for-you' | 'following' | 'latest';

const NORMAL_LIMIT = 16;
const DATA_SAVER_LIMIT = 8;
const SIGNED_URL_TTL_SECONDS = 1200;
const SIGN_CONCURRENCY = 4;
const DATA_SAVER_KEY = '@buklod_igpat_data_saver_v1';
const SAVED_IGPAT_KEY = '@buklod_igpat_saved_ids_v1';

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

function IgpatPoster({ path }: { path: string }) {
  const still = readCachedCommunityVideoStill(path);
  return still ? <Image source={{uri:still}} style={StyleSheet.absoluteFill} contentFit="contain" /> : <View style={StyleSheet.absoluteFill}><Text style={{color:'#fff',textAlign:'center',marginTop:140}}>Video preview</Text></View>;
}

function IgpatVideo({ uri, path, active, onRetryUrl }: { uri: string; path: string; active: boolean; onRetryUrl?: () => void }) {
  const [pausedByUser, setPausedByUser] = useState(false);
  const [firstFrame, setFirstFrame] = useState(false);
  const [startupFailed, setStartupFailed] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const activeRef = useRef(active); activeRef.current = active;
  const frameReady = useRef(false);
  const startupRecoveryUsed = useRef(false);
  useEffect(() => { startupRecoveryUsed.current = false; }, [uri]);
  const paused = useRef(false); paused.current = pausedByUser;
  // Android can report null AppState before the first event; it is not background.
  const foreground = useRef(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const videoSource = useMemo(() => ({ uri, useCaching: Platform.OS !== 'web' }), [uri]);
  const player = useVideoPlayer(videoSource, instance => { instance.loop = true; instance.muted = false; });
  const retryErroredPlayer = useBuklodMediaRecovery(player, videoSource, path, () =>
    activeRef.current && !paused.current && foreground.current, () => {
      frameReady.current = false;
      setFirstFrame(false);
      setStartupFailed(false);
    });
  useEffect(() => {
    let readyStatus = player.status;
    let pending = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const clear = () => { if (timer) clearTimeout(timer); timer = null; };
    const sync = () => {
      try {
        if (!active || paused.current || !foreground.current) {
          clear(); pending = false;
          if (player.playing) player.pause();
          return;
        }
        if (readyStatus === 'error') { clear(); pending = false; setStartupFailed(true); return; }
        if (readyStatus !== 'readyToPlay' || player.playing || pending) return;
        if (attempts >= 3) { setStartupFailed(true); return; }
        pending = true; attempts += 1;
        player.play();
        clear();
        timer = setTimeout(() => {
          timer = null; pending = false;
          if (!active || paused.current || !foreground.current || frameReady.current) return;
          if (player.playing) {
            if (!startupRecoveryUsed.current) {
              startupRecoveryUsed.current = true;
              void retryErroredPlayer(true);
            } else setStartupFailed(true);
          } else sync();
        }, 3000);
      } catch { pending = false; setStartupFailed(true); }
    };
    const status = player.addListener('statusChange', event => {
      readyStatus = event.status;
      if (event.status === 'loading') { clear(); pending = false; }
      sync();
    });
    const playing = player.addListener('playingChange', event => {
      if (event.isPlaying) { pending = false; if (frameReady.current) { clear(); attempts = 0; setStartupFailed(false); } }
      else if (!timer) { pending = false; sync(); }
    });
    const state = AppState.addEventListener('change', next => {
      foreground.current = next === 'active';
      if (!foreground.current) { clear(); pending = false; attempts = 0; }
      sync();
    });
    if (retryTick && !frameReady.current) {
      // The visible retry button must also recover a stalled READY player;
      // a repeated play() on the original black surface is not a retry.
      void retryErroredPlayer(player.status !== 'error').then(() => {
        readyStatus = player.status;
        sync();
      }).catch(() => setStartupFailed(true));
    } else sync();
    return () => { clear(); status.remove(); playing.remove(); state.remove(); try { player.pause(); } catch {} };
  }, [active, pausedByUser, player, retryTick, uri, retryErroredPlayer]);
  useEffect(() => {
    if (!firstFrame || readCachedCommunityVideoStill(path)) return;
    let alive = true;
    void player.generateThumbnailsAsync(0, {maxWidth:360}).then(shots => {
      if (alive && shots[0]) void persistCommunityVideoStill(path, shots[0]);
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [path,player,firstFrame]);
  return <Pressable style={StyleSheet.absoluteFill} onPress={() => { if (startupFailed) { setStartupFailed(false); setPausedByUser(false); paused.current = false; setRetryTick(v => v + 1); } else setPausedByUser(v => !v); }} accessibilityRole="button" accessibilityLabel={startupFailed ? 'Retry IGPAT video' : pausedByUser?'Play IGPAT video':'Pause IGPAT video'}>
    <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls={false} contentFit="contain" onFirstFrameRender={() => { frameReady.current = true; setStartupFailed(false); setFirstFrame(true); }} useExoShutter={false} surfaceType="textureView" />
    {!firstFrame && <IgpatPoster path={path} />}
    {startupFailed && <View pointerEvents="none" style={styles.pausedBadge}><Text style={styles.pausedBadgeText}>Tap to retry video</Text></View>}
    {pausedByUser && <View pointerEvents="none" style={styles.pausedBadge}><Text style={styles.pausedBadgeText}>PAUSED</Text></View>}
  </Pressable>;
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
  const callBusy=useBuklodVideoCallBusy();
  const insets = useSafeAreaInsets();
  const {isConnected,isInternetReachable} = useNetwork();
  const online = isConnected && isInternetReachable !== false;
  const [screenActive,setScreenActive] = useState(false);
  useFocusEffect(useCallback(()=>{setScreenActive(true);return()=>setScreenActive(false);},[]));
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
  const identity = 'igpat:'+String(user?.id??'')+':'+feedMode+':'+String(dataSaver);
  const rowsRef=useRef(rows);rowsRef.current=rows;
  const [hasMore,setHasMore]=useState(true);
  const pageBusyRef=useRef(false);
  const identityRef=useRef(identity);identityRef.current=identity;
  const [rowsIdentity,setRowsIdentity]=useState('');
  const rowsIdentityRef = useRef(rowsIdentity); rowsIdentityRef.current = rowsIdentity;
  const requestRef=useRef<{key:string;task:Promise<void>}|null>(null);
  const retryingMediaRef = useRef(new Set<string>());
  const safeRows=rowsIdentity===identity ? rows : [];
  const [viewportHeight, setViewportHeight] = useState(Dimensions.get('window').height);
  const feedRows = useMemo(() => buildReelsFeedWithInlineAds(safeRows), [safeRows]);

  useEffect(() => {
    let mounted = true;
    void Promise.all([
      AsyncStorage.getItem(DATA_SAVER_KEY),
      AsyncStorage.getItem(SAVED_IGPAT_KEY+':'+String(user?.id??'anonymous')),
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
  }, [user?.id]);

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
    if (!prefsReady || !user?.id) { if(!user?.id) {setRows([]);setLoading(false);} return; }
    if (requestRef.current?.key === identity) return requestRef.current.task;
    const requestedIdentity = identity;
    const task = (async () => {
      const warm = readOfflineCacheSync<IgpatRow[]>(identity);
      if (warm && identityRef.current === requestedIdentity) { setRows(current => rowsIdentityRef.current === requestedIdentity && current.length ? current : warm);setRowsIdentity(identity);setLoading(false); }
      else { setLoading(true); }
      setLoadError(null);
      try {
        const disk = await readOfflineCache<IgpatRow[]>(identity);
        if(identityRef.current !== requestedIdentity) return;
        if(disk && !warm) { setRows(current => rowsIdentityRef.current === requestedIdentity && current.length ? current : disk);setRowsIdentity(identity);setLoading(false); }
        if(!online) { if(!disk&&!warm)setLoadError('Offline - no saved videos yet.');return; }
        const limit = dataSaver ? DATA_SAVER_LIMIT : NORMAL_LIMIT;
        const {data,error} = await withBuklodTimeout<any>((supabase as any).rpc('get_buklod_igpat_feed_v4',{p_mode:feedMode,p_limit:limit,p_before_created_at:null,p_before_id:null}),8000,'IGPAT feed');
        if(error)throw error;
        const source = ((data??[]) as IgpatRow[]).filter(row=>row?.id&&row.media_path).slice(0,limit);
        if(identityRef.current !== requestedIdentity) return;
        // Row content appears immediately; signing does not block the entire feed.
        const initial = source.map(row=>({...row,media_url:peekCommunityMediaUrl(row.media_path)}));
        setRows(initial);setRowsIdentity(identity);setLoading(false);if(rowsIdentity!==identity)setActiveIndex(0);setHasMore(source.length>=limit);
        const signed = await mapWithConcurrency(initial,SIGN_CONCURRENCY,async row=>({...row,media_url:await resolveCommunityMediaUrl(row.media_path)}));
        if(identityRef.current !== requestedIdentity) return;
        setRows(signed); await writeOfflineCache(identity,signed,'network');
      } catch(e) {
        if(identityRef.current === requestedIdentity)setLoadError(String((e as any)?.message??'IGPAT unavailable.'));
      } finally { if(identityRef.current === requestedIdentity)setLoading(false); }
    })();
    requestRef.current={key:identity,task};
    try { await task; } finally { if(requestRef.current?.task===task)requestRef.current=null; }
  }, [dataSaver,feedMode,prefsReady,user?.id,identity,online]);
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setActiveIndex(0);
  }, [feedMode]);

  const loadMore = useCallback(async () => {
    if(!online||!user?.id||!hasMore||pageBusyRef.current||requestRef.current||rowsIdentity!==identity)return;
    const cursor=rowsRef.current[rowsRef.current.length-1];if(!cursor)return;
    pageBusyRef.current=true;const owner=identity;
    try {
      const limit=dataSaver?DATA_SAVER_LIMIT:NORMAL_LIMIT;
      const {data,error}=await withBuklodTimeout<any>((supabase as any).rpc('get_buklod_igpat_feed_v4',{p_mode:feedMode,p_limit:limit,p_before_created_at:cursor.created_at,p_before_id:cursor.id}),8000,'IGPAT next page');
      if(error)throw error;
      const source=((data??[]) as IgpatRow[]).filter(row=>row?.id&&row.media_path);
      const signed=await mapWithConcurrency(source,SIGN_CONCURRENCY,async row=>({...row,media_url:await resolveCommunityMediaUrl(row.media_path)}));
      if(identityRef.current!==owner)return;
      const known=new Set(rowsRef.current.map(row=>row.id));
      const merged=[...rowsRef.current,...signed.filter(row=>!known.has(row.id))];
      setRows(merged);setHasMore(source.length>=limit);
      await writeOfflineCache(identity,merged.slice(0,48),'network');
    } catch(e){if(identityRef.current===owner)setLoadError(String((e as any)?.message??'Next page unavailable.'));}
    finally{pageBusyRef.current=false;}
  },[identity,rowsIdentity,online,user?.id,hasMore,dataSaver,feedMode]);

  const retryIgpatUrl = useCallback(async (row: IgpatRow) => {
    const path = String(row.media_path ?? '').trim();
    if (!online || !path || retryingMediaRef.current.has(row.id)) return;
    const owner = identityRef.current;
    retryingMediaRef.current.add(row.id);
    try {
      // A failed media request must bypass an earlier cached signed URL.
      const fresh = await resignCommunityMediaUrl(path);
      if (!fresh || identityRef.current !== owner) return;
      setRows(current => current.map(item =>
        item.id === row.id && item.media_path === path
          ? { ...item, media_url: fresh }
          : item
      ));
    } catch {
      // Keep cached feed/poster visible; explicit retry remains available.
    } finally {
      retryingMediaRef.current.delete(row.id);
    }
  }, [online]);

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
      void AsyncStorage.setItem(SAVED_IGPAT_KEY+':'+String(user?.id??'anonymous'), JSON.stringify(Array.from(next)));
      return next;
    });
  }, [user?.id]);

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
    if (!user?.id || !row || row.my_reaction === 'love' || reactionBusy.has(postId)) return;

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
        message: `BUKLOD IGPAT - An Instant Bond.\nhttps://buklod.expo.app/post/${postId}`,
      });
    } catch (error) {
      console.warn('BUKLOD IGPAT share:', String((error as any)?.message ?? error));
    }
  }, []);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<ViewToken<IgpatFeedRow>> }) => {
      const first = viewableItems.find(item => item.isViewable && typeof item.index === 'number');
      setActiveIndex(typeof first?.index === 'number' ? first.index : -1);
    }
  ).current;

  const viewabilityConfig = useMemo(
    () => ({ itemVisiblePercentThreshold: 82, minimumViewTime: 100 }),
    []
  );

  if (!prefsReady || (loading && !safeRows.length)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingTitle}>BUKLOD IGPAT</Text>
        <Text style={styles.loadingTagline}>An Instant Bond.</Text>
      </View>
    );
  }

  if (!safeRows.length) {
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
    <View style={styles.root} onLayout={event => {
      const height = event.nativeEvent.layout.height;
      if (height > 0) setViewportHeight(height);
    }}>
      <FlatList
        data={feedRows}
        extraData={`${activeIndex}:${screenActive}:${callBusy}:${online}:${viewportHeight}`}
        key={`${feedMode}:${dataSaver ? 'saver' : 'normal'}`}
        keyExtractor={item => item.id}
        pagingEnabled
        onEndReached={()=>void loadMore()}
        onEndReachedThreshold={0.4}
        showsVerticalScrollIndicator={false}
        initialNumToRender={1}
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
          if (isReelsFeedInlineAdRow(item)) {
            return (
              <View style={[styles.page, { height: viewportHeight }]}>
                <BuklodReelsInlineAd slotId={item.id} active={index === activeIndex} />
              </View>
            );
          }

          const creatorId = item.user_id ? String(item.user_id) : '';
          const isSelf = creatorId === user?.id;
          const isFollowing = Boolean(creatorId && followedIds.has(creatorId));

          return (
            <View style={[styles.page, { height: viewportHeight }]}>
              {!!item.media_url && index === activeIndex && screenActive && !callBusy ? (
                <IgpatVideo key={item.id+':'+item.media_url} uri={item.media_url} path={item.media_path} active={screenActive && !callBusy} onRetryUrl={() => void retryIgpatUrl(item)} />
              ) : (
                <View style={StyleSheet.absoluteFill}>
                  <IgpatPoster path={item.media_path} />
                  {!item.media_url && index === activeIndex && screenActive && !callBusy ? (
                    <Pressable
                      style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}
                      accessibilityRole="button"
                      accessibilityLabel={online ? 'Retry IGPAT video URL' : 'IGPAT video requires internet or cached video'}
                      disabled={!online}
                      onPress={() => void retryIgpatUrl(item)}
                    >
                      <Text style={{ color: '#FFFFFF', backgroundColor: '#19291FCB', padding: 12, borderRadius: 8 }}>
                        {online ? 'Video unavailable · Tap to retry' : 'Offline · Video not available from cache'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              )}
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
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
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