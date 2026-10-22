/**
 * BUKLOD IGPAT: inline landscape watch card above Smart Drawer.
 * This is intentionally NOT the separate fullscreen /igpat Pure Watch screen.
 * One active decoder, no off-screen players, saved rows first, no ad code touched.
 */
import { useBuklodMediaRecovery } from '@/hooks/useBuklodMediaRecovery';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState, PanResponder, Platform, Pressable, Share, StyleSheet,
  Text, View,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodOfflineCache } from '@/hooks/useBuklodOfflineCache';
import { readCachedCommunityVideoStill } from '@/lib/buklodCommunityVideoStill';
import { peekCommunityMediaUrl, resolveCommunityMediaUrl } from '@/lib/buklodMediaUrl';
import { supabase } from '@/lib/supabase';

type IgpatItem = {
  id: string;
  user_id?: string | null;
  media_path: string;
  author_name?: string | null;
  body?: string | null;
  created_at?: string;
  reaction_count?: number | null;
  comment_count?: number | null;
  my_reaction?: string | null;
};
type Props = {
  active?: boolean;
  onComment?: (post: IgpatItem) => void;
};
const PAGE_SIZE = 8;
const SAVE_KEY = '@buklod_igpat_saved_ids_v1:';

/** Hook stays inside the mounted active-video child; inactive slides are posters only. */
function InlinePlayer({ uri, mediaPath, poster, active }: {
  uri: string;
  mediaPath: string;
  poster: any;
  active: boolean;
}) {
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [firstFrame, setFirstFrame] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerError, setPlayerError] = useState(false);
  // AppState.currentState can be null/unknown during first launch on Android.
  const foreground = useRef(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const requestedPlay = useRef(false);
  const firstFrameRef = useRef(false);
  const startAttempts = useRef(0);
  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearStartTimer = useCallback(() => {
    if (startTimer.current) clearTimeout(startTimer.current);
    startTimer.current = null;
  }, []);
  const source = useMemo(() => ({ uri, useCaching: Platform.OS !== 'web' }), [uri]);
  const player = useVideoPlayer(source, instance => {
    instance.loop = true;
    instance.muted = true;
  });
  // Stable event listeners: visibility/paused changes must never tear down the
  // listener effect and release a healthy native player.
  const activeRef = useRef(active);
  const pausedRef = useRef(paused);
  const syncRef = useRef<() => void>(() => undefined);
  const retryErroredPlayer = useBuklodMediaRecovery(player, source, mediaPath, () =>
    activeRef.current && !pausedRef.current && foreground.current, () => {
      firstFrameRef.current = false;
      setFirstFrame(false);
      requestedPlay.current = false;
      startAttempts.current = 0;
      clearStartTimer();
      setPlayerError(false);
    });
  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);
  useEffect(() => {
    activeRef.current = active;
    pausedRef.current = paused;
    syncRef.current();
  }, [active, paused]);
  useEffect(() => {
    // Native status events can precede the JS status getter update.
    let readyStatus = player.status;
    const sync = () => {
      try {
        if (!activeRef.current || pausedRef.current || !foreground.current) {
          if (player.playing) player.pause();
          requestedPlay.current = false;
          startAttempts.current = 0;
          clearStartTimer();
          return;
        }
        if (readyStatus === 'error') {
          requestedPlay.current = false;
          clearStartTimer();
          setPlayerError(true);
          return;
        }
        // A poor connection may keep the source in 'loading'. Wait rather than
        // restarting the player, resetting its native cache, or counting a retry.
        if (readyStatus !== 'readyToPlay' || player.playing || requestedPlay.current) return;
        if (startAttempts.current >= 3) {
          setPlayerError(true);
          return;
        }
        startAttempts.current += 1;
        requestedPlay.current = true;
        try {
          player.play();
        } catch {
          requestedPlay.current = false;
          setPlayerError(true);
          return;
        }
        clearStartTimer();
        startTimer.current = setTimeout(() => {
          startTimer.current = null;
          if (firstFrameRef.current || !activeRef.current || pausedRef.current || !foreground.current) return;
          // Retry only a genuinely stalled READY player. Buffering needs time,
          // not a new MediaCodec instance or a fresh signed URL.
          if (readyStatus === 'readyToPlay' && !player.playing) {
            requestedPlay.current = false;
            syncRef.current();
          } else if (readyStatus === 'readyToPlay' && player.playing) {
            // Media3 accepted play(), but no decoded frame arrived. Leave the
            // player intact and expose manual Retry instead of churn.
            setPlayerError(true);
          } else {
            requestedPlay.current = false;
          }
        }, 3000);
      } catch {
        requestedPlay.current = false;
      }
    };
    syncRef.current = sync;
    const ready = player.addListener('statusChange', event => {
      readyStatus = event.status;
      if (event.status === 'loading') { requestedPlay.current = false; clearStartTimer(); }
      if (event.status === 'error') {
        setPlayerError(true);
        requestedPlay.current = false;
        clearStartTimer();
      }
      sync();
    });
    const playing = player.addListener('playingChange', event => {
      setIsPlaying(event.isPlaying);
      if (event.isPlaying && firstFrameRef.current) {
        setPlayerError(false);
        requestedPlay.current = false;
        startAttempts.current = 0;
        clearStartTimer();
      } else if (!event.isPlaying && !firstFrameRef.current &&
                 activeRef.current && !pausedRef.current && foreground.current &&
                 !startTimer.current) {
        // A manual Retry may pause a hung PLAYING-at-position-zero session.
        // Resume once Media3 acknowledges the pause, without replacing it.
        requestedPlay.current = false;
        syncRef.current();
      }
    });
    const app = AppState.addEventListener('change', state => {
      foreground.current = state !== 'background' && state !== 'inactive';
      sync();
    });
    sync();
    return () => {
      syncRef.current = () => undefined;
      clearStartTimer();
      ready.remove(); playing.remove(); app.remove();
      try { player.pause(); } catch { /* Native owner may have released it. */ }
    };
  }, [player, clearStartTimer]);
  const toggle = useCallback(() => {
    if (isPlaying && firstFrameRef.current && !paused) {
      setPaused(true);
      return;
    }
    // Manual retry works even when a lost play request previously said PLAYING
    // but Media3 never delivered a decoded first frame.
    clearStartTimer();
    startAttempts.current = 0;
    requestedPlay.current = false;
    setPlayerError(false);
    setPaused(false);
    pausedRef.current = false;
    if (active && foreground.current) {
      if (player.status === 'error') { void retryErroredPlayer(); return; }
      try {
        if (player.playing && !firstFrameRef.current) player.pause();
      } catch { /* source is still loading */ }
      syncRef.current();
    }
  }, [active, isPlaying, paused, player, clearStartTimer, retryErroredPlayer]);
  return <View style={styles.videoSurface}>
    {poster ? <Image source={poster} blurRadius={19} contentFit="cover" style={StyleSheet.absoluteFill} /> : null}
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls={false}
      fullscreenOptions={{ enable: false }}
      allowsPictureInPicture={false}
      pointerEvents="none"
      surfaceType="textureView"
      useExoShutter={false}
      onFirstFrameRender={() => {
        firstFrameRef.current = true;
        startAttempts.current = 0;
        requestedPlay.current = false;
        clearStartTimer();
        setPlayerError(false);
        setFirstFrame(true);
      }}
    />
    {!firstFrame && poster ? <Image source={poster} style={StyleSheet.absoluteFill} contentFit="contain" /> : null}
    {!firstFrame || playerError ? <View style={styles.playerState} pointerEvents="none"><Text style={styles.playerStateText}>{playerError ? 'Video failed — tap Play to retry' : 'Preparing video…'}</Text></View> : null}
    <View style={styles.videoControls}>
      <Pressable style={styles.control} accessibilityRole="button" accessibilityLabel={isPlaying && firstFrame && !paused ? 'Pause IGPAT' : 'Play or retry IGPAT'} onPress={toggle}>
        <MaterialCommunityIcons name={isPlaying && firstFrame && !paused ? 'pause' : 'play'} size={24} color="#fff" />
      </Pressable>
      <Pressable style={styles.control} accessibilityRole="button" accessibilityLabel={muted ? 'Unmute IGPAT' : 'Mute IGPAT'} onPress={() => setMuted(value => !value)}>
        <MaterialCommunityIcons name={muted ? 'volume-off' : 'volume-high'} size={21} color="#fff" />
      </Pressable>
    </View>
  </View>;
}

export default function BuklodIgpatMiniFeed({active = false, onComment}: Props) {
  const {user} = useAuth();
  const [index, setIndex] = useState(0);
  const [pages, setPages] = useState<IgpatItem[]>([]);
  const [mediaSource, setMediaSource] = useState<{ postId: string; path: string; uri: string } | null>(null);
  // Short visibility fluctuations must not recreate ExoPlayer/MediaCodec.
  // The retained player is immediately paused when active=false.
  const [keepPlayerMounted, setKeepPlayerMounted] = useState(active);
  useEffect(() => {
    if (active) { setKeepPlayerMounted(true); return; }
    const release = setTimeout(() => setKeepPlayerMounted(false), 650);
    return () => clearTimeout(release);
  }, [active]);
  const [mediaError, setMediaError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [following, setFollowing] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [nextBusy, setNextBusy] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const mounted = useRef(true);
  const pageBusy = useRef(false);
  const {data, loading, error, online} = useBuklodOfflineCache<IgpatItem[]>({
    cacheKey: user?.id ? `igpat:drawer:${user.id}:for-you` : '',
    enabled: Boolean(user?.id),
    fetcher: async () => {
      const response = await (supabase as any).rpc('get_buklod_igpat_feed_v4', {
        p_mode:'for-you', p_limit:PAGE_SIZE, p_before_created_at:null, p_before_id:null,
      });
      if (response.error) throw response.error;
      return ((response.data ?? []) as IgpatItem[]).filter(x => x?.id && x.media_path);
    },
  });
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    setPages([]);
    setIndex(0);
    setMediaSource(null);
    setHasMore(true);
  }, [user?.id]);
  useEffect(() => {
    if (!data) return;
    setHasMore(data.length >= PAGE_SIZE);
    setPages(current => {
      const seen = new Set(data.map(row=>row.id));
      return [...data, ...current.filter(row=>!seen.has(row.id))];
    });
  }, [data]);
  const current = pages[Math.min(index, Math.max(0, pages.length-1))];
  const currentId = current?.id;
  const currentPath = current?.media_path;
  // A newly selected row must never mount with the previous row's URL.
  const mediaUrl = mediaSource && mediaSource.postId === currentId && mediaSource.path === currentPath ? mediaSource.uri : '';
  const poster = currentPath ? readCachedCommunityVideoStill(currentPath) : null;
  const posterSource = poster ? (typeof poster === 'string' ? {uri:poster} : poster) : null;

  // URL signing is delayed until a visible card needs it. A signed URL is never
  // continuously replaced while the same video plays.
  useEffect(() => {
    let cancelled = false;
    setMediaSource(null);
    setMediaError(false);
    if (!currentPath) return;
    const warm = peekCommunityMediaUrl(currentPath);
    if (warm) {setMediaSource({postId:currentId || '',path:currentPath,uri:warm}); return;}
    void resolveCommunityMediaUrl(currentPath).then(url => {
      if (!cancelled && url) setMediaSource({postId:currentId || '',path:currentPath,uri:url});
      if (!cancelled && !url) setMediaError(true);
    }).catch(() => { if(!cancelled)setMediaError(true); });
    return () => { cancelled = true; };
  }, [currentId, currentPath]);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id || !currentId) return;
    void Promise.all([
      AsyncStorage.getItem(SAVE_KEY + user.id),
      current?.user_id && current.user_id !== user.id
        ? supabase.from('buklod_user_follows').select('followed_user_id').eq('follower_id',user.id).eq('followed_user_id',current.user_id).maybeSingle()
        : Promise.resolve(null),
    ]).then(([raw, follow]) => {
      if(cancelled) return;
      try {setSaved(JSON.parse(raw??'[]').includes(currentId));} catch {setSaved(false);}
      setFollowing(Boolean((follow as any)?.data?.followed_user_id));
    }).catch(() => undefined);
    return () => { cancelled=true; };
  }, [user?.id, currentId, current?.user_id]);

  const nextPage = useCallback(async () => {
    const last = pages[pages.length - 1];
    if (!user?.id || !last?.created_at || !online || !hasMore || pageBusy.current || nextBusy) return;
    pageBusy.current = true;
    setNextBusy(true);
    try {
      const response = await (supabase as any).rpc('get_buklod_igpat_feed_v4', {
        p_mode:'for-you', p_limit:PAGE_SIZE,
        p_before_created_at:last.created_at, p_before_id:last.id,
      });
      if (response.error) throw response.error;
      const incoming = ((response.data ?? []) as IgpatItem[]).filter(r => r?.id && r.media_path);
      if (incoming.length < PAGE_SIZE) setHasMore(false);
      if (!mounted.current) return;
      setPages(existing => {
        const seen = new Set(existing.map(r=>r.id));
        return [...existing, ...incoming.filter(r=>!seen.has(r.id))];
      });
    } catch { /* Retain cached videos when signal is weak. */ }
    finally { pageBusy.current = false; if(mounted.current)setNextBusy(false); }
  }, [user?.id,pages,online,nextBusy,hasMore]);

  const switchVideo = useCallback((direction: number) => {
    if (!pages.length) return;
    const next = Math.min(Math.max(index + direction, 0), pages.length-1);
    if (next !== index) setIndex(next);
    if (direction > 0 && next >= pages.length-2) void nextPage();
  }, [index,pages,nextPage]);
  const switchRef = useRef(switchVideo);
  switchRef.current = switchVideo;
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    // Claim only horizontal drags; vertical movement belongs to the Wall.
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 22 && Math.abs(gesture.dx) > Math.abs(gesture.dy)*1.3,
    onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dx) > 22 && Math.abs(gesture.dx) > Math.abs(gesture.dy)*1.3,
    onPanResponderRelease: (_, gesture) => {
      if (Math.abs(gesture.dx) <= Math.abs(gesture.dy)*1.3) return;
      if (gesture.dx < -50) switchRef.current(1);
      if (gesture.dx > 50) switchRef.current(-1);
    },
  }), []);

  const react = useCallback(async () => {
    if (!currentId || actionBusy) return;
    setActionBusy(true);
    try {
      let response = await (supabase as any).rpc('set_buklod_post_reaction_v4',{p_post_id:currentId,p_reaction:'love'});
      if (response.error) response = await (supabase as any).rpc('set_buklod_post_reaction_v3',{p_post_id:currentId,p_reaction:'love'});
      if (response.error) throw response.error;
      setPages(items=>items.map(item=>item.id===currentId ? {
        ...item, my_reaction:'love',reaction_count:Number(item.reaction_count??0)+(item.my_reaction?0:1),
      }:item));
    } catch { /* Keep real server counts if save fails. */ }
    finally {setActionBusy(false);}
  }, [currentId, actionBusy]);
  const save = useCallback(async () => {
    if (!user?.id || !currentId) return;
    const raw = await AsyncStorage.getItem(SAVE_KEY+user.id);
    let previous: string[] = [];
    try {previous=JSON.parse(raw??'[]');} catch { /* invalid older cache */ }
    const next = new Set(Array.isArray(previous)?previous:[]);
    if(next.has(currentId))next.delete(currentId); else next.add(currentId);
    await AsyncStorage.setItem(SAVE_KEY+user.id,JSON.stringify([...next]));
    setSaved(next.has(currentId));
  }, [user?.id,currentId]);
  const follow = useCallback(async () => {
    if (!user?.id || !current?.user_id || user.id === current.user_id || actionBusy) return;
    setActionBusy(true);
    const wasFollowing = following;
    try {
      const response = wasFollowing
        ? await supabase.from('buklod_user_follows').delete().eq('follower_id',user.id).eq('followed_user_id',current.user_id)
        : await supabase.from('buklod_user_follows').insert({follower_id:user.id,followed_user_id:current.user_id});
      if (response.error) throw response.error;
      setFollowing(!wasFollowing);
    } catch { /* Remain in previous state. */ }
    finally {setActionBusy(false);}
  }, [user?.id,current?.user_id,following,actionBusy]);
  const share = useCallback(() => {
    if (!currentId) return;
    void Share.share({message:`BUKLOD IGPAT - An Instant Bond.\nhttps://buklod.expo.app/post/${currentId}`});
  },[currentId]);

  return <View style={styles.card}>
    <View style={styles.header}>
      <View><Text style={styles.title}>BUKLOD IGPAT</Text><Text style={styles.subtitle}>An Instant Bond. • Swipe left or right to change video</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Upload IGPAT" onPress={()=>router.push('/igpat/create' as any)} style={styles.upload}>
        <MaterialCommunityIcons name="video-plus" size={17} color="#fff" /><Text style={styles.uploadText}>UPLOAD</Text>
      </Pressable>
    </View>
    <View style={styles.videoShell} {...responder.panHandlers}>
      {posterSource ? <Image source={posterSource} contentFit="cover" blurRadius={22} style={StyleSheet.absoluteFill} /> : null}
      {posterSource ? <Image source={posterSource} contentFit="contain" style={StyleSheet.absoluteFill} /> : null}
      {keepPlayerMounted && mediaUrl && current ? <InlinePlayer key={current.id+':'+mediaUrl} uri={mediaUrl} mediaPath={current.media_path} poster={posterSource} active={active} /> : null}
      {!current ? <View style={styles.center}><Text style={styles.placeholder}>{loading ? 'Preparing IGPAT…' : error ? 'IGPAT offline — saved posts remain available.' : 'No IGPAT available yet.'}</Text></View> : null}
      {current && !mediaUrl && active ? <View style={styles.previewBadge}><Text style={styles.previewText}>{mediaError ? 'Video unavailable. Swipe for next.' : 'Preparing video…'}</Text></View> : null}
      {current ? <View pointerEvents="none" style={styles.position}><Text style={styles.positionText}>{index+1} / {pages.length}</Text></View> : null}
    </View>
    <View style={styles.meta}>
      <Text numberOfLines={1} style={styles.author}>{current?.author_name || 'IGPAT Creator'}</Text>
      <Text numberOfLines={1} style={styles.caption}>{current?.body || ''}</Text>
    </View>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous video" onPress={()=>switchVideo(-1)} style={styles.action}><MaterialCommunityIcons name="chevron-left" size={23} color="#145437" /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Next video" onPress={()=>switchVideo(1)} style={styles.action}><MaterialCommunityIcons name="chevron-right" size={23} color="#145437" /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Like IGPAT" onPress={()=>void react()} style={styles.action} disabled={actionBusy}><MaterialCommunityIcons name={current?.my_reaction==='love'?'heart':'heart-outline'} size={20} color="#145437"/><Text style={styles.actionNumber}>{current?.reaction_count??0}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Comment and reply on IGPAT" onPress={()=>current && onComment?.(current)} style={styles.action}><MaterialCommunityIcons name="comment-outline" size={20} color="#145437"/><Text style={styles.actionNumber}>{current?.comment_count??0}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Share IGPAT" onPress={share} style={styles.action}><MaterialCommunityIcons name="share-variant-outline" size={21} color="#145437"/></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={saved?'Unsave IGPAT':'Save IGPAT'} onPress={()=>void save()} style={styles.action}><MaterialCommunityIcons name={saved?'bookmark':'bookmark-outline'} size={20} color="#145437"/></Pressable>
      {current?.user_id && current.user_id!==user?.id ? <Pressable accessibilityRole="button" accessibilityLabel={following?'Unfollow creator':'Follow creator'} onPress={()=>void follow()} disabled={actionBusy} style={styles.action}><MaterialCommunityIcons name={following?'account-check':'account-plus-outline'} size={21} color="#145437"/></Pressable> : null}
    </View>
  </View>;
}

const styles=StyleSheet.create({
  card:{marginVertical:8,borderRadius:16,backgroundColor:'#F4F9F5',overflow:'hidden',borderWidth:1,borderColor:'#DAE9DE'},
  header:{minHeight:56,paddingHorizontal:12,paddingVertical:9,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  title:{fontSize:15,fontWeight:'900',color:'#145437'},
  subtitle:{fontSize:10,color:'#557765',marginTop:3},
  upload:{minHeight:40,paddingHorizontal:10,gap:5,flexDirection:'row',alignItems:'center',backgroundColor:'#16633C',borderRadius:12},
  uploadText:{color:'#fff',fontSize:10,fontWeight:'900'},
  videoShell:{height:242,backgroundColor:'#111',position:'relative',overflow:'hidden'},
  videoSurface:{...StyleSheet.absoluteFillObject,backgroundColor:'#111'},
  center:{...StyleSheet.absoluteFillObject,alignItems:'center',justifyContent:'center',paddingHorizontal:20},
  placeholder:{color:'#fff',textAlign:'center',fontSize:13},
  previewBadge:{position:'absolute',bottom:12,left:12,backgroundColor:'#0009',borderRadius:8,padding:6},
  previewText:{color:'#fff',fontSize:11},
  playerState:{zIndex:2,elevation:2,position:'absolute',left:12,bottom:12,maxWidth:'67%',backgroundColor:'#000a',borderRadius:8,paddingHorizontal:8,paddingVertical:5},
  playerStateText:{color:'#fff',fontSize:11,fontWeight:'600'},
  videoControls:{zIndex:3,elevation:3,position:'absolute',bottom:10,right:9,flexDirection:'row',gap:9},
  control:{minWidth:42,minHeight:42,borderRadius:25,backgroundColor:'#0009',alignItems:'center',justifyContent:'center'},
  position:{position:'absolute',top:10,right:10,backgroundColor:'#0007',borderRadius:8,paddingHorizontal:8,paddingVertical:4},
  positionText:{color:'#fff',fontSize:11,fontWeight:'800'},
  meta:{paddingHorizontal:12,paddingTop:8,paddingBottom:4},
  author:{fontSize:12,fontWeight:'800',color:'#153F2A'},
  caption:{fontSize:11,color:'#416750',marginTop:3},
  actions:{flexDirection:'row',justifyContent:'space-around',alignItems:'center',paddingHorizontal:5,paddingBottom:8},
  action:{minHeight:44,minWidth:37,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:2},
  actionNumber:{fontSize:10,color:'#145437',fontWeight:'700'},
});
