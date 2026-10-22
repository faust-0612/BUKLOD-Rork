import { useBuklodMediaRecovery } from '@/hooks/useBuklodMediaRecovery';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { usePathname } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import type { VideoThumbnail } from 'expo-video';
import BuklodImaVideo, {
  isBuklodImaNativeAvailable,
} from '@/components/BuklodImaVideo';
import {
  buildBuklodImaAdTagUrl,
  shouldUseBuklodImaForVideo,
} from '@/lib/buklodVideoMonetization';
import { recordBuklodAdEvent } from '@/lib/buklodAdDiagnostics';
import {
  cacheCommunityVideoPoster,
  communityVideoStillKey,
  readCachedCommunityVideoStill,
} from '@/lib/buklodCommunityVideoStill';
import {
  peekCommunityMediaUrl,
  resolveCommunityMediaUrl,
} from '@/lib/buklodMediaUrl';

type Props = {
  uri: string;
  height?: number;
  autoPlay?: boolean;
  expectedDurationSeconds?: number;
  fullscreen?: boolean;
  edgeToEdge?: boolean;
  active?: boolean;
  cacheKey?: string;
  posterPath?: string;
  controlsBottomInset?: number;
  onOpenFullscreen?: () => void;
  onPlaybackError?: () => void;
};

/*
 * Community post player.
 * The visible video autoplays. It stops when it leaves the screen
 * or when another video starts. One player only, with pause/play.
 */
export function enableCommunityVideoSound() {}

const previews = new Map<string, VideoThumbnail | string>();

type StillSource = VideoThumbnail | string;

function useSavedStill(
  uri: string,
  cacheKey?: string,
  posterPath?: string,
) {
  const key = communityVideoStillKey(cacheKey || uri);
  const cached = readCachedCommunityVideoStill(cacheKey || uri);
  const remembered = previews.get(key) ?? null;
  const [remote, setRemote] = useState<string | null>(() =>
    posterPath ? peekCommunityMediaUrl(posterPath, null) : null,
  );
  const [remoteFailed, setRemoteFailed] = useState(false);

  useEffect(() => {
    if (cached || remembered || !posterPath || remoteFailed) return;
    let cancelled = false;
    void resolveCommunityMediaUrl(posterPath).then((url) => {
      if (!cancelled && url) setRemote(url);
    });
    return () => {
      cancelled = true;
    };
  }, [cached, remembered, posterPath, remoteFailed]);

  useEffect(() => {
    if (!remote || cached) return;
    void cacheCommunityVideoPoster(cacheKey || uri, remote);
  }, [cacheKey, cached, remote, uri]);

  const still: StillSource | null =
    remembered || cached || (remoteFailed ? null : remote);

  return {
    key,
    still,
    clearRemote: () => {
      setRemote(null);
      setRemoteFailed(true);
    },
  };
}

function StillCover({
  source,
  fullscreen,
  onError,
}: {
  source: StillSource;
  fullscreen: boolean;
  onError?: () => void;
}) {
  return (
    <Image
      source={typeof source === 'string' ? { uri: source } : source}
      style={styles.preview}
      contentFit={fullscreen ? 'contain' : 'cover'}
      onError={onError}
    />
  );
}

export function CommunityVideo(props: Props) {
  const imaEligible =
    props.active !== false &&
    !props.fullscreen &&
    Platform.OS === 'android' &&
    isBuklodImaNativeAvailable() &&
    shouldUseBuklodImaForVideo(props.expectedDurationSeconds);

  if (imaEligible) {
    return <ImaCommunityVideo {...props} />;
  }

  if (props.active === false) {
    return <PausedCommunityVideo {...props} />;
  }

  return <ExpoCommunityVideo {...props} />;
}

function PausedCommunityVideo({
  uri,
  height = 380,
  expectedDurationSeconds,
  fullscreen = false,
  edgeToEdge = false,
  cacheKey,
  posterPath,
}: Props) {
  const knownDuration = Number(expectedDurationSeconds ?? 0) || 0;
  const { still, clearRemote } = useSavedStill(uri, cacheKey, posterPath);
  // The native IMA player reserves its existing 90px companion below the video.
  // The inactive poster must reserve the same height to prevent feed-row jumps.
  // This does not mount an ad or change ad placement/delivery.
  const companionHeight =
    !fullscreen &&
    Platform.OS === 'android' &&
    isBuklodImaNativeAvailable() &&
    shouldUseBuklodImaForVideo(expectedDurationSeconds)
      ? 90
      : 0;

  return (
    <View
      style={[
        styles.wrap,
        edgeToEdge && styles.edgeToEdgeWrap,
        fullscreen && styles.fullscreenWrap,
        { height: height + companionHeight },
      ]}
    >
      <View style={{ height, position: 'relative' }}>
        <View style={styles.video} />
        {still ? (
          <StillCover
            source={still}
            fullscreen={fullscreen}
            onError={clearRemote}
          />
        ) : null}
        <View pointerEvents="none" style={styles.centerButton}>
          <MaterialCommunityIcons name="play" size={34} color="#FFFFFF" />
        </View>
        {knownDuration > 0 ? (
          <View pointerEvents="none" style={styles.durationChip}>
            <Text style={styles.durationText}>{formatDuration(knownDuration)}</Text>
          </View>
        ) : null}
      </View>
      {companionHeight > 0 ? <View style={{ height: companionHeight }} /> : null}
    </View>
  );
}

function ImaCommunityVideo({
  uri,
  height = 380,
  autoPlay = false,
  expectedDurationSeconds,
  fullscreen = false,
  edgeToEdge = false,
  active = true,
  onOpenFullscreen,
  onPlaybackError,
}: Props) {
  const [appForeground, setAppForeground] = useState(
    AppState.currentState !== 'background' && AppState.currentState !== 'inactive',
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      setAppForeground(state !== 'background' && state !== 'inactive');
    });
    return () => subscription.remove();
  }, []);
  const pathname = usePathname();
  const adTagUrl = buildBuklodImaAdTagUrl(expectedDurationSeconds);
  const companionHeight = 90;

  return (
    <View
      style={[
        styles.wrap,
        edgeToEdge && styles.edgeToEdgeWrap,
        fullscreen && styles.fullscreenWrap,
        { height: height + companionHeight },
      ]}
    >
      <BuklodImaVideo
        contentUrl={uri}
        adTagUrl={adTagUrl}
        autoPlay={autoPlay}
        active={active && appForeground}
        contentFit={fullscreen ? 'contain' : 'cover'}
        showCompanion
        style={styles.video}
        onPlaybackError={() => {
          onPlaybackError?.();
        }}
        onAdEvent={(event) => {
          const type = String(event.nativeEvent?.type ?? '').toUpperCase();
          const context = {
            route: pathname,
            provider: 'GOOGLE_IMA' as const,
            placementId: 'wall_video_instream',
          };

          if (type === 'LOADED') {
            recordBuklodAdEvent('video_instream', 'ad_loaded', undefined, context);
          } else if (type === 'IMPRESSION') {
            recordBuklodAdEvent('video_instream', 'ad_impression', undefined, context);
          } else if (type === 'STARTED') {
            recordBuklodAdEvent('video_instream', 'ad_rendered', undefined, context);
          } else if (type === 'CLICKED') {
            recordBuklodAdEvent('video_instream', 'ad_opened', undefined, context);
          } else if (type === 'AD_ERROR') {
            recordBuklodAdEvent(
              'video_instream',
              'ad_failed',
              event.nativeEvent?.message,
              context,
            );
          }
        }}
      />

      {onOpenFullscreen && !fullscreen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open video full screen"
          onPress={onOpenFullscreen}
          style={[styles.fullscreenButton, { bottom: companionHeight + 10 }]}
        >
          <MaterialCommunityIcons name="fullscreen" size={24} color="#FFFFFF" />
        </Pressable>
      ) : null}

      {Number(expectedDurationSeconds ?? 0) > 0 ? (
        <View pointerEvents="none" style={styles.durationChip}>
          <Text style={styles.durationText}>
            {formatDuration(Number(expectedDurationSeconds))}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function ExpoCommunityVideo({
  uri,
  autoPlay = false,
  height = 380,
  expectedDurationSeconds,
  fullscreen = false,
  edgeToEdge = false,
  onOpenFullscreen,
  onPlaybackError,
  cacheKey,
  posterPath,
}: Props) {
  const userPausedRef = useRef(!autoPlay);
  const appActiveRef = useRef(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const [userPaused,setUserPaused]=useState(!autoPlay);
  const [isPlaying, setIsPlaying] = useState(false);
  const [startupFailed, setStartupFailed] = useState(false);
  const [frameReady, setFrameReady] = useState(false);
  const frameReadyRef = useRef(false);
  const startPendingRef = useRef(false);
  const startAttemptsRef = useRef(0);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPlaybackRef = useRef<() => void>(() => undefined);
  const clearStartTimer = () => {
    if (startTimerRef.current) clearTimeout(startTimerRef.current);
    startTimerRef.current = null;
  };
  const { still: savedStill, clearRemote } = useSavedStill(
    uri,
    cacheKey,
    posterPath,
  );
  // Never create a second decoder/thumbnails while a visible video starts.
  // Saved upload posters remain available without competing with playback.
  const still = savedStill;
  const knownDuration = Number(expectedDurationSeconds ?? 0) || 0;
  // Repeat playback and video scrolling share Expo's bounded Android disk cache.
  // The existing native IMA-ad player is untouched.
  const source = useMemo(() => ({ uri, useCaching: Platform.OS !== 'web' }), [uri]);
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = !fullscreen;
    instance.muted = false;
  });

  const retryErroredPlayer = useBuklodMediaRecovery(player, source, cacheKey, () =>
    appActiveRef.current && !userPausedRef.current, () => {
      frameReadyRef.current = false;
      setFrameReady(false);
      startAttemptsRef.current = 0;
      startPendingRef.current = false;
      clearStartTimer();
      setStartupFailed(false);
    });

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {
        // The view is already gone.
      }
    };
  }, [player]);

  const playbackErrorCallback = useRef(onPlaybackError);
  playbackErrorCallback.current = onPlaybackError;
  useEffect(() => {
    let reported = false;
    const subscription = player.addListener('statusChange', (event: { status?: string }) => {
      if (event.status === 'error' && !reported) {
        reported = true;
        playbackErrorCallback.current?.();
      }
    });
    return () => subscription.remove();
  }, [player]);

  useEffect(() => {
    const clearTimer = () => {
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    };
    let readyStatus = player.status;
    const apply = () => {
      try {
        if (!appActiveRef.current || userPausedRef.current) {
          if (player.playing) player.pause();
          startPendingRef.current = false;
          clearTimer();
          return;
        }
        if (readyStatus === 'error') {
          setStartupFailed(true);
          startPendingRef.current = false;
          clearTimer();
          return;
        }
        if (readyStatus !== 'readyToPlay' || player.playing || startPendingRef.current) return;
        if (startAttemptsRef.current >= 3) {
          setStartupFailed(true);
          return;
        }
        startAttemptsRef.current += 1;
        startPendingRef.current = true;
        try { player.play(); }
        catch {
          startPendingRef.current = false;
          setStartupFailed(true);
          return;
        }
        clearTimer();
        startTimerRef.current = setTimeout(() => {
          startTimerRef.current = null;
          if (frameReadyRef.current || !appActiveRef.current || userPausedRef.current) return;
          if (player.status === 'readyToPlay' && !player.playing) {
            startPendingRef.current = false;
            startPlaybackRef.current();
          } else if (player.status === 'readyToPlay' && player.playing) {
            setStartupFailed(true);
          } else {
            // Network buffering is not a reason to release or restart Media3.
            startPendingRef.current = false;
          }
        }, 3000);
      } catch { startPendingRef.current = false; }
    };
    startPlaybackRef.current = apply;
    const ready = player.addListener('statusChange', event => {
      readyStatus = event.status;
      if (event.status === 'loading') {
        startPendingRef.current = false;
        clearTimer();
      }
      if (event.status === 'error') setStartupFailed(true);
      apply();
    });
    const playing = player.addListener('playingChange', event => {
      setIsPlaying(event.isPlaying);
      if (event.isPlaying && frameReadyRef.current) {
        clearTimer();
        startPendingRef.current = false;
        startAttemptsRef.current = 0;
        setStartupFailed(false);
      } else if (!event.isPlaying && !frameReadyRef.current &&
                 appActiveRef.current && !userPausedRef.current &&
                 !startTimerRef.current) {
        startPendingRef.current = false;
        startPlaybackRef.current();
      }
    });
    apply();
    const sub = AppState.addEventListener('change', state => {
      appActiveRef.current = state !== 'background' && state !== 'inactive';
      if (!appActiveRef.current) {
        startPendingRef.current = false;
        startAttemptsRef.current = 0;
        clearTimer();
      }
      apply();
    });
    return () => {
      startPlaybackRef.current = () => undefined;
      clearTimer();
      ready.remove(); playing.remove(); sub.remove();
    };
  }, [player]);

  function togglePlayback() {
    if (isPlaying && frameReadyRef.current && !userPausedRef.current) {
      userPausedRef.current = true;
      setUserPaused(true);
      try { player.pause(); } catch { /* player already released */ }
      return;
    }

    userPausedRef.current = false;
    setUserPaused(false);
    setStartupFailed(false);
    startAttemptsRef.current = 0;
    startPendingRef.current = false;
    clearStartTimer();
    try {
      player.muted = false;
      if (player.playing && !frameReadyRef.current) player.pause();
    } catch { /* wait until video is ready */ }
    if (player.status === 'error') void retryErroredPlayer();
    else startPlaybackRef.current();
  }

  return (
    <View
      style={[
        styles.wrap,
        edgeToEdge && styles.edgeToEdgeWrap,
        fullscreen && styles.fullscreenWrap,
        { height },
      ]}
    >
      <VideoView
          player={player}
          style={styles.video}
          nativeControls={false}
          surfaceType="textureView"
          useExoShutter={false}
          contentFit={fullscreen ? 'contain' : 'cover'}
          allowsPictureInPicture={false}
          onFirstFrameRender={() => {
            frameReadyRef.current = true;
            startAttemptsRef.current = 0;
            startPendingRef.current = false;
            clearStartTimer();
            setStartupFailed(false);
            setFrameReady(true);
          }}
        />

      {!still && !frameReady && <View pointerEvents="none" style={[styles.preview,{justifyContent:'center',alignItems:'center'}]}><Text style={{color:'#FFFFFF'}}>{startupFailed ? 'Video not started — tap Play to retry' : 'Waiting for video...'}</Text></View>}
      {still && !frameReady ? (
        <StillCover
          source={still}
          fullscreen={fullscreen}
          onError={clearRemote}
        />
      ) : null}

      {!still && !frameReady ? (
        <View pointerEvents="none" style={styles.loading}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isPlaying && frameReady && !userPaused ? 'Pause video' : 'Play or retry video'}
        onPress={togglePlayback}
        style={styles.centerButton}
      >
        <MaterialCommunityIcons
          name={isPlaying && frameReady && !userPaused ? 'pause' : 'play'}
          size={34}
          color="#FFFFFF"
        />
      </Pressable>

      {onOpenFullscreen && !fullscreen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open video full screen"
          onPress={() => {
            userPausedRef.current = true;
            try {
              player.pause();
            } catch {
              // Opening fullscreen still continues.
            }
            onOpenFullscreen();
          }}
          style={styles.fullscreenButton}
        >
          <MaterialCommunityIcons name="fullscreen" size={24} color="#FFFFFF" />
        </Pressable>
      ) : null}

      {knownDuration > 0 ? (
        <View pointerEvents="none" style={styles.durationChip}>
          <Text style={styles.durationText}>{formatDuration(knownDuration)}</Text>
        </View>
      ) : null}
    </View>
  );
}

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#111',
    marginTop: 12,
  },
  edgeToEdgeWrap: {
    borderRadius: 0,
  },
  fullscreenWrap: {
    marginTop: 0,
    borderRadius: 0,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  preview: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 2,
  },
  loading: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  centerButton: {
    position: 'absolute',
    left: '50%',
    marginLeft: -32,
    top: '42%',
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 4,
  },
  fullscreenButton: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.62)',
    zIndex: 4,
  },
  durationChip: {
    position: 'absolute',
    right: 10,
    top: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.68)',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
});

export default CommunityVideo;
