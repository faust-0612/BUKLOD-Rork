import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Image as ExpoImage } from 'expo-image';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  setVideoCacheSizeAsync,
  VideoView,
  useVideoPlayer,
} from 'expo-video';

import BuklodImaVideo, {
  isBuklodImaNativeAvailable,
} from '@/components/BuklodImaVideo';

import {
  buildBuklodImaAdTagUrl,
  shouldUseBuklodImaForVideo,
} from '@/lib/buklodVideoMonetization';

import {
  recordBuklodAdEvent,
} from '@/lib/buklodAdDiagnostics';
import {
  classifyNetworkQuality,
  subscribeNetworkQuality,
} from '@/lib/buklodNetworkQuality';
import { recordCommunityFeedMetric } from '@/lib/communityFeedTelemetry';
import { communityVideoFrameHeight } from '@/lib/communityMediaPresentation';
import {
  beginCommunityVideoPosterGeneration,
  getCommunityVideoPoster,
  publishCommunityVideoPoster,
  releaseCommunityVideoPosterGeneration,
  subscribeCommunityVideoPoster,
} from '@/lib/communityVideoPosterCache';
import {
  COMMUNITY_VIDEO_CACHE_BUDGET_BYTES,
  decideCommunityVideoErrorRecovery,
  shouldMountCommunityVideoPlayer,
} from '@/lib/communityVideoPlayback';
import { useAndroidCommunityVideoMemoryPolicy } from '@/hooks/useAndroidCommunityVideoMemoryPolicy';

type Props = {
  uri: string;
  /** Stable post identity across rotations of short-lived signed URLs. */
  playbackKey?: string;
  height?: number;
  autoPlay?: boolean;
  expectedDurationSeconds?: number;
  fullscreen?: boolean;
  edgeToEdge?: boolean;
  active?: boolean;
  /** Only the next near-viewport clip is prebuffered without autoplay. */
  preload?: boolean;
  controlsBottomInset?: number;
  onOpenFullscreen?: () => void;
  onPlaybackError?: () => void;
  onRequestPlay?: () => void;
  preserveAspectRatio?: boolean;
  /** Keep a fixed Wall/story frame height while fitting the complete source inside it. */
  fitFrame?: boolean;
  /** Optional server-generated poster; first-frame posters are cached in memory. */
  posterUri?: string | null;
  /** Cached first-frame source for an immediate transition from poster to playback. */
  posterSource?: any;
  /** Best-effort persistence callback for a frame from an already-mounted player. */
  onPosterGenerated?: (thumbnail: unknown) => void | Promise<unknown>;
};

let communityVideoCacheConfigured = false;

function configureCommunityVideoCacheBudget() {
  if (
    communityVideoCacheConfigured ||
    Platform.OS === 'web' ||
    typeof setVideoCacheSizeAsync !== 'function'
  ) {
    return;
  }
  communityVideoCacheConfigured = true;
  // SDK 57 default is 1 GB. 256 MB keeps replay of ordinary wall clips
  // without retaining every long upload. The call is a no-op when a player
  // already exists; the OS may still evict the LRU.
  try {
    void Promise.resolve(
      setVideoCacheSizeAsync(COMMUNITY_VIDEO_CACHE_BUDGET_BYTES),
    ).catch(() => {
      communityVideoCacheConfigured = false;
    });
  } catch {
    communityVideoCacheConfigured = false;
  }
}

configureCommunityVideoCacheBudget();

function useCommunityNetworkDegraded() {
  const [degraded, setDegraded] = useState(() => {
    const quality = classifyNetworkQuality();
    return quality === 'degraded' || quality === 'offline';
  });

  useEffect(() => {
    return subscribeNetworkQuality(() => {
      const quality = classifyNetworkQuality();
      setDegraded(quality === 'degraded' || quality === 'offline');
    });
  }, []);

  return degraded;
}

export function CommunityVideo(props: Props) {
  const degraded = useCommunityNetworkDegraded();
  const androidMemoryPolicy = useAndroidCommunityVideoMemoryPolicy();
  const [playIntent, setPlayIntent] = useState(false);
  const [recentlyActive, setRecentlyActive] = useState(props.active !== false);
  const [poster, setPoster] = useState<any>(() =>
    props.posterUri ? { uri: props.posterUri } : getCommunityVideoPoster(props.uri),
  );

  useEffect(() => {
    setPoster(props.posterUri ? { uri: props.posterUri } : getCommunityVideoPoster(props.uri));
    return subscribeCommunityVideoPoster(props.uri, next => {
      if (!props.posterUri) setPoster(next);
    });
  }, [props.uri, props.posterUri]);

  useEffect(() => {
    if (props.active === false) setPlayIntent(false);
  }, [props.active]);

  useEffect(() => {
    if (props.active !== false) {
      setRecentlyActive(true);
      return;
    }
    // On small Java heaps, discard the invisible decoder promptly.
    // Keep the original warm-scroll duration on other devices.
    if (Platform.OS === 'android' && !androidMemoryPolicy.allowKeepWarm) {
      setRecentlyActive(false);
      return;
    }
    const timer = setTimeout(() => setRecentlyActive(false), 1_400);
    return () => clearTimeout(timer);
  }, [props.active, props.uri, androidMemoryPolicy.allowKeepWarm]);

  const imaEligible =
    !props.fullscreen &&
    Platform.OS === 'android' &&
    isBuklodImaNativeAvailable() &&
    shouldUseBuklodImaForVideo(props.expectedDurationSeconds);
  const active = props.active !== false;
  const mountPlayer = shouldMountCommunityVideoPlayer({
    active,
    fullscreen: Boolean(props.fullscreen),
    degraded,
    playIntent,
    preload: !imaEligible && !degraded && props.preload === true &&
      (Platform.OS !== 'android' || androidMemoryPolicy.allowPreload),
    keepWarm: !imaEligible && recentlyActive &&
      (Platform.OS !== 'android' || androidMemoryPolicy.allowKeepWarm),
  });

  const requestPlay = () => {
    setPlayIntent(true);
    props.onRequestPlay?.();
  };

  if (!mountPlayer) {
    return (
      <InactiveCommunityVideo
        {...props}
        poster={poster}
        onRequestPlay={requestPlay}
      />
    );
  }

  // In-stream advertising retains its own native lifecycle: never
  // silently prebuffer eligible content with a separate expo player.
  if (imaEligible && active) {
    return (
      <ImaCommunityVideo
        {...props}
      />
    );
  }

  return (
    <ExpoCommunityVideo
      {...props}
      posterSource={poster}
    />
  );
}

function InactiveCommunityVideo({
  height = 380,
  poster,
  expectedDurationSeconds,
  fullscreen = false,
  edgeToEdge = false,
  preserveAspectRatio = true,
  controlsBottomInset = 0,
  onOpenFullscreen,
  onRequestPlay,
}: Props & { poster?: any }) {
  const knownDuration =
    Number(expectedDurationSeconds ?? 0) || 0;

  return (
    <View
      style={[
        styles.wrap,
        edgeToEdge && styles.edgeToEdgeWrap,
        fullscreen && styles.fullscreenWrap,
        { height },
      ]}
    >
      <View style={styles.inactiveVideo}>
        {poster ? (
          <>
            <ExpoImage
              source={poster}
              style={StyleSheet.absoluteFill}
              contentFit={preserveAspectRatio ? 'contain' : 'cover'}
              cachePolicy="memory-disk"
              transition={120}
            />
            <View style={styles.posterScrim} />
          </>
        ) : null}
        <MaterialCommunityIcons
          name={poster ? 'play' : 'play-circle-outline'}
          size={poster ? 32 : 58}
          color="#FFFFFF"
          style={poster ? styles.posterPlayBadge : undefined}
        />
        {!poster ? (
          <>
            <Text style={styles.inactiveLabel}>
              Video · I-tap para i-play
            </Text>
            <Text style={styles.inactiveHint}>
              Data saver sa mahinang signal
            </Text>
          </>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Play video"
        disabled={!onRequestPlay && !onOpenFullscreen}
        onPress={() => {
          if (onRequestPlay) {
            onRequestPlay();
            return;
          }
          onOpenFullscreen?.();
        }}
        style={styles.tapLayer}
      />

      {knownDuration > 0 ? (
        <View
          pointerEvents="none"
          style={[
            styles.timeChip,
            { bottom: controlsBottomInset + 64 },
          ]}
        >
          <Text style={styles.durationText}>
            {formatDuration(knownDuration)}
          </Text>
        </View>
      ) : null}
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
  preserveAspectRatio = true,
}: Props) {
  const pathname = usePathname();
  const adTagUrl =
    buildBuklodImaAdTagUrl(
      expectedDurationSeconds,
    );

  useEffect(() => {
    recordCommunityFeedMetric({
      stage: 'video_player',
      elapsedMs: 0,
      status: 'ok',
      player: 'google-ima',
    });
  }, [uri]);

  const companionHeight = 90;

  return (
    <View
      style={[
        styles.wrap,
        edgeToEdge && styles.edgeToEdgeWrap,
        fullscreen && styles.fullscreenWrap,
        {
          height:
            height +
            companionHeight,
        },
      ]}
    >
      <BuklodImaVideo
        contentUrl={uri}
        adTagUrl={adTagUrl}
        autoPlay={autoPlay}
        active={active}
        contentFit={fullscreen || preserveAspectRatio ? 'contain' : 'cover'}
        showCompanion
        style={styles.video}
        onPlaybackError={() => {
          onPlaybackError?.();
        }}
        onAdEvent={(event) => {
          const type =
            String(
              event.nativeEvent?.type ?? '',
            ).toUpperCase();

          const context = {
            route: pathname,
            provider:
              'GOOGLE_IMA' as const,
            placementId:
              'wall_video_instream',
          };

          if (type === 'LOADED') {
            recordBuklodAdEvent(
              'video_instream',
              'ad_loaded',
              undefined,
              context,
            );
          } else if (
            type === 'IMPRESSION'
          ) {
            recordBuklodAdEvent(
              'video_instream',
              'ad_impression',
              undefined,
              context,
            );
          } else if (
            type === 'STARTED'
          ) {
            recordBuklodAdEvent(
              'video_instream',
              'ad_rendered',
              undefined,
              context,
            );
          } else if (
            type === 'CLICKED'
          ) {
            recordBuklodAdEvent(
              'video_instream',
              'ad_opened',
              undefined,
              context,
            );
          } else if (
            type === 'AD_ERROR'
          ) {
            recordBuklodAdEvent(
              'video_instream',
              'ad_failed',
              event.nativeEvent?.message,
              context,
            );
          }
        }}
      />

      {onOpenFullscreen &&
      !fullscreen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open video full screen"
          onPress={onOpenFullscreen}
          style={[
            styles.fullscreenButton,
            {
              bottom:
                companionHeight + 10,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="fullscreen"
            size={24}
            color="#FFFFFF"
          />
        </Pressable>
      ) : null}

      {Number(
        expectedDurationSeconds ?? 0,
      ) > 0 ? (
        <View
          pointerEvents="none"
          style={styles.durationChip}
        >
          <Text
            style={styles.durationText}
          >
            {formatDuration(
              Number(
                expectedDurationSeconds,
              ),
            )}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const playbackTimeByUri = new Map<string, number>();

function communityVideoSource(uri: string) {
  // Same source shape as perf/community-video-fb-like-r1 @ 93259ff.
  // expo-video keeps a valid http(s) file in its cache instead of
  // downloading it again the next time this player is mounted.
  if (/^https?:\/\//i.test(uri)) {
    return {
      uri,
      useCaching: true,
      ...(uri.split('?')[0].split('#')[0].toLowerCase().endsWith('.m3u8') ? { contentType: 'hls' as const } : {}),
    };
  }

  return uri;
}
let sessionSoundOn = false;
const sessionSoundListeners = new Set<() => void>();

function setSessionSound(on: boolean) {
  if (sessionSoundOn === on) return;
  sessionSoundOn = on;
  sessionSoundListeners.forEach((listener) => listener());
}

export function enableCommunityVideoSound() {
  setSessionSound(true);
}

function useSessionSound() {
  const [on, setOn] = useState(sessionSoundOn);

  useEffect(() => {
    const sync = () => setOn(sessionSoundOn);
    sessionSoundListeners.add(sync);
    return () => {
      sessionSoundListeners.delete(sync);
    };
  }, []);

  return on;
}

function ExpoCommunityVideo({
  uri,
  playbackKey,
  height = 380,
  autoPlay = false,
  expectedDurationSeconds,
  fullscreen = false,
  edgeToEdge = false,
  active = true,
  controlsBottomInset = 0,
  onOpenFullscreen,
  onPlaybackError,
  preserveAspectRatio = true,
  fitFrame = false,
  posterUri,
  posterSource,
  onPosterGenerated,
}: Props) {
  const soundOn = useSessionSound();
  const viewerSafeInsets = useSafeAreaInsets();
  const playbackIdentity = playbackKey ? `post:${playbackKey}` : uri;
  const userPausedRef = useRef(false);
  const activeRef = useRef(active);
  const autoPlayRef = useRef(autoPlay);
  activeRef.current = active;
  autoPlayRef.current = autoPlay;
  const barWidthRef = useRef(1);
  const [videoAspectRatio, setVideoAspectRatio] = useState<number | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hasStartedPlayback, setHasStartedPlayback] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(
    Number(expectedDurationSeconds ?? 0) || 0,
  );
  const [showCenter, setShowCenter] = useState(false);
  // Keep portrait video fully visible by default; optionally fill the frame
  // without restarting the native player or creating another video download.
  const [fillFrame, setFillFrame] = useState(false);
  const [playerStatus, setPlayerStatus] = useState<
    'idle' | 'loading' | 'readyToPlay' | 'error'
  >('idle');
  const [autoRecovering, setAutoRecovering] = useState(false);
  const [showDelayedLoading, setShowDelayedLoading] = useState(false);
  const playerStatusRef = useRef('idle');
  const recoveryDeadlineRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const replayAttemptsRef = useRef(0);
  const replayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryNotBeforeRef = useRef(0);
  const errorReportedRef = useRef(false);
  const playbackErrorHandlerRef = useRef(onPlaybackError);
  playbackErrorHandlerRef.current = onPlaybackError;
  const centerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyStartedAtRef = useRef(Date.now());
  const readyReportedRef = useRef(false);
  const resumeAppliedRef = useRef(false);
  const playingRef = useRef(false);
  const posterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    readyStartedAtRef.current = Date.now();
    readyReportedRef.current = false;
    resumeAppliedRef.current = false;
    playingRef.current = false;
    if (posterTimerRef.current) {
      clearTimeout(posterTimerRef.current);
      posterTimerRef.current = null;
    }
    setVideoAspectRatio(null);
    setHasStartedPlayback(false);
    setAutoRecovering(false);
    setPlayerStatus('idle');
    playerStatusRef.current = 'idle';
    replayAttemptsRef.current = 0;
    retryNotBeforeRef.current = 0;
    errorReportedRef.current = false;
    if (replayTimerRef.current) {
      clearTimeout(replayTimerRef.current);
      replayTimerRef.current = null;
    }
    if (recoveryDeadlineRef.current) {
      clearTimeout(recoveryDeadlineRef.current);
      recoveryDeadlineRef.current = null;
    }
    return () => {
      if (replayTimerRef.current) {
        clearTimeout(replayTimerRef.current);
        replayTimerRef.current = null;
      }
      if (recoveryDeadlineRef.current) {
        clearTimeout(recoveryDeadlineRef.current);
        recoveryDeadlineRef.current = null;
      }
      if (posterTimerRef.current) {
        clearTimeout(posterTimerRef.current);
        posterTimerRef.current = null;
      }
    };
  }, [uri]);

  // Do not show a buffering alert for every ordinary, sub-second startup.
  useEffect(() => {
    if (!active || (playerStatus !== 'loading' && !autoRecovering)) {
      setShowDelayedLoading(false);
      return;
    }
    const timer = setTimeout(() => setShowDelayedLoading(true), 950);
    return () => clearTimeout(timer);
  }, [active, playerStatus, autoRecovering]);

  const source = useMemo(
    () => communityVideoSource(uri),
    [uri],
  );

  const player = useVideoPlayer(
    source,
    (instance) => {
      // AAB v28 full screen viewer plays the video once, with sound.
      instance.loop = !fullscreen;
      instance.muted = fullscreen ? false : !sessionSoundOn;
      instance.timeUpdateEventInterval = 0.25;
      if (Platform.OS === 'android') {
        instance.bufferOptions = {
          minBufferForPlayback: 1,
          preferredForwardBufferDuration: 18,
          prioritizeTimeOverSizeThreshold: true,
        };
      }
      // PTT voice and currently playing video should coexist; never seize
      // exclusive device audio focus just because this clip is audible.
      instance.audioMixingMode = 'mixWithOthers';
    },
  );

  useEffect(() => {
    const muted = fullscreen ? false : !soundOn;
    try {
      player.loop = !fullscreen;
      player.muted = muted;
      player.audioMixingMode = 'mixWithOthers';
    } catch {
      // Player can already be released while the feed row recycles.
    }
  }, [fullscreen, player, soundOn]);

  useEffect(() => {
    const subscription = player.addListener(
      'statusChange',
      (event: { status?: string }) => {
        const nextStatus = event?.status;
        if (nextStatus) playerStatusRef.current = nextStatus;
        if (
          nextStatus === 'loading' ||
          nextStatus === 'readyToPlay' ||
          nextStatus === 'error' ||
          nextStatus === 'idle'
        ) {
          setPlayerStatus(nextStatus);
        }

        if (nextStatus === 'error') {
          if (!readyReportedRef.current) {
            readyReportedRef.current = true;
            recordCommunityFeedMetric({
              stage: 'video_player',
              elapsedMs: Date.now() - readyStartedAtRef.current,
              status: 'error',
              player: 'expo-video',
            });
          }
          // Try the SAME URI once; it may be a transient decoder/buffer
          // failure and its already-cached ranges must not be discarded.
          const action = decideCommunityVideoErrorRecovery({
            active: activeRef.current,
            replayAttempts: replayAttemptsRef.current,
            retryNotBefore: retryNotBeforeRef.current,
            now: Date.now(),
            reported: errorReportedRef.current,
          });
          if (action === 'replay') {
            replayAttemptsRef.current = 1;
            retryNotBeforeRef.current = Date.now() + 2_500;
            setAutoRecovering(true);
            if (replayTimerRef.current) clearTimeout(replayTimerRef.current);
            if (recoveryDeadlineRef.current) clearTimeout(recoveryDeadlineRef.current);
            replayTimerRef.current = setTimeout(() => {
              replayTimerRef.current = null;
              if (!activeRef.current) return;
              try {
                player.replay();
              } catch {
                if (!errorReportedRef.current) {
                  errorReportedRef.current = true;
                  setAutoRecovering(false);
                  playbackErrorHandlerRef.current?.();
                }
              }
            }, 350);
            // expo-video may remain in error without emitting a second event.
            // This timeout guarantees one terminal recovery callback.
            recoveryDeadlineRef.current = setTimeout(() => {
              recoveryDeadlineRef.current = null;
              if (!activeRef.current || errorReportedRef.current ||
                  playerStatusRef.current === 'readyToPlay') return;
              errorReportedRef.current = true;
              setAutoRecovering(false);
              playbackErrorHandlerRef.current?.();
            }, 2_650);
            return;
          }
          // The recovery attempt itself may emit repeated error events.
          // Refresh signed access only after the bounded local retry fails.
          if (action === 'refresh') {
            errorReportedRef.current = true;
            setAutoRecovering(false);
            playbackErrorHandlerRef.current?.();
          }
          return;
        }

        if (nextStatus === 'readyToPlay') {
          setAutoRecovering(false);
          retryNotBeforeRef.current = 0;
          if (recoveryDeadlineRef.current) {
            clearTimeout(recoveryDeadlineRef.current);
            recoveryDeadlineRef.current = null;
          }
          if (replayTimerRef.current) {
            clearTimeout(replayTimerRef.current);
            replayTimerRef.current = null;
          }
          if (!readyReportedRef.current) {
            readyReportedRef.current = true;
            recordCommunityFeedMetric({
              stage: 'video_player',
              elapsedMs: Date.now() - readyStartedAtRef.current,
              status: 'ok',
              player: 'expo-video',
            });
          }
          const activeTrack = (player.availableVideoTracks ?? []).find(track =>
            Number(track?.size?.width) > 0 && Number(track?.size?.height) > 0
          );
          if (activeTrack) {
            const ratio = Number(activeTrack.size.width) / Number(activeTrack.size.height);
            if (Number.isFinite(ratio) && ratio > 0) setVideoAspectRatio(ratio);
          }
          const known = Number(player.duration || 0);
          if (known > 0) setDuration(known);

          // Resume only on initial media readiness. Seeking again after
          // every rebuffer causes backward jumps and unnecessary downloads.
          if (!resumeAppliedRef.current) {
            resumeAppliedRef.current = true;
            const saved = playbackTimeByUri.get(playbackIdentity) ?? 0;
            if (saved > 0.35 && (known <= 0 || saved < known - 0.4)) {
              try {
                player.currentTime = saved;
              } catch {
                // Initial seek is best effort; never block playback.
              }
            }
          }

          if (
            activeRef.current &&
            autoPlayRef.current &&
            !userPausedRef.current
          ) {
            try {
              player.play();
            } catch {
              // A released player can reject play during recycle.
            }
          }
        }
      },
    );

    const videoTrackSub = player.addListener(
      'videoTrackChange',
      (event: { videoTrack?: { size?: { width?: number; height?: number } } | null }) => {
        const width = Number(event.videoTrack?.size?.width ?? 0);
        const height = Number(event.videoTrack?.size?.height ?? 0);
        const ratio = width > 0 && height > 0 ? width / height : 0;
        if (Number.isFinite(ratio) && ratio > 0) setVideoAspectRatio(ratio);
      },
    );

    const playingSub = player.addListener(
      'playingChange',
      (event: { isPlaying?: boolean }) => {
        const isPlaying = Boolean(event?.isPlaying);
        playingRef.current = isPlaying;
        setPlaying(isPlaying);
        if (!isPlaying && posterTimerRef.current) {
          clearTimeout(posterTimerRef.current);
          posterTimerRef.current = null;
        }
        if (isPlaying && Platform.OS !== 'web' && !posterUri &&
            !getCommunityVideoPoster(uri) && !posterTimerRef.current) {
          // First decoded frame wins. Thumbnail extraction must never compete
          // with startup/visible playback or an offscreen cached video.
          posterTimerRef.current = setTimeout(() => {
            posterTimerRef.current = null;
            if (!activeRef.current || !playingRef.current ||
                getCommunityVideoPoster(uri) ||
                !beginCommunityVideoPosterGeneration(uri)) return;
            void Promise.resolve()
              .then(() => player.generateThumbnailsAsync(0.1, { maxWidth: 720, maxHeight: 720 }))
              .then(thumbnails => {
                const first = thumbnails?.[0];
                if (first) {
                  publishCommunityVideoPoster(uri, first);
                  void Promise.resolve()
                    .then(() => onPosterGenerated?.(first))
                    .catch(() => undefined);
                }
              })
              .catch(() => undefined)
              .finally(() => releaseCommunityVideoPosterGeneration(uri));
          }, 1500);
        }
        if (isPlaying) {
          setHasStartedPlayback(true);
          setAutoRecovering(false);
          if (recoveryDeadlineRef.current) {
            clearTimeout(recoveryDeadlineRef.current);
            recoveryDeadlineRef.current = null;
          }
        }
      },
    );

    const timeSub = player.addListener(
      'timeUpdate',
      (event: { currentTime?: number }) => {
        const next = Number(event?.currentTime ?? 0);
        playbackTimeByUri.set(playbackIdentity, next);
        // Keep the in-memory resume map bounded even across signed-URL churn.
        if (playbackTimeByUri.size > 120) {
          const oldest = playbackTimeByUri.keys().next().value;
          if (oldest) playbackTimeByUri.delete(oldest);
        }
        setCurrentTime(next);
        const known = Number(player.duration || 0);
        if (known > 0) setDuration(known);
      },
    );

    return () => {
      subscription.remove();
      videoTrackSub.remove();
      playingSub.remove();
      timeSub.remove();
      if (replayTimerRef.current) {
        clearTimeout(replayTimerRef.current);
        replayTimerRef.current = null;
      }
      if (recoveryDeadlineRef.current) {
        clearTimeout(recoveryDeadlineRef.current);
        recoveryDeadlineRef.current = null;
      }
      if (posterTimerRef.current) {
        clearTimeout(posterTimerRef.current);
        posterTimerRef.current = null;
      }
    };
  }, [player, uri, playbackIdentity]);

  useEffect(() => {
    if (!active) {
      userPausedRef.current = false;
      if (posterTimerRef.current) {
        clearTimeout(posterTimerRef.current);
        posterTimerRef.current = null;
      }
      try {
        player.pause();
      } catch {
        // Released player.
      }
      return;
    }

    if (autoPlay && !userPausedRef.current) {
      try {
        player.play();
      } catch {
        // Autoplay can fail before the source is ready.
      }
    }
  }, [active, autoPlay, player]);

  useEffect(() => {
    return () => {
      if (centerTimerRef.current) {
        clearTimeout(centerTimerRef.current);
      }
    };
  }, []);

  function flashCenter(willPlay: boolean) {
    setShowCenter(true);
    if (centerTimerRef.current) {
      clearTimeout(centerTimerRef.current);
    }
    if (willPlay) {
      centerTimerRef.current = setTimeout(() => {
        setShowCenter(false);
      }, fullscreen ? 2600 : 700);
    }
  }

  function retryPlayback() {
    // A manual tap always does useful work, even after the automatic replay
    // limit was reached or a previous URL-renewal request failed.
    userPausedRef.current = false;
    errorReportedRef.current = false;
    replayAttemptsRef.current = 1;
    retryNotBeforeRef.current = Date.now() + 1_500;
    setAutoRecovering(true);
    setPlayerStatus('loading');
    if (recoveryDeadlineRef.current) clearTimeout(recoveryDeadlineRef.current);
    try {
      player.replay();
    } catch {
      errorReportedRef.current = true;
      setAutoRecovering(false);
      setPlayerStatus('error');
      playbackErrorHandlerRef.current?.();
      return;
    }
    recoveryDeadlineRef.current = setTimeout(() => {
      recoveryDeadlineRef.current = null;
      if (!activeRef.current || errorReportedRef.current ||
          playerStatusRef.current === 'readyToPlay') return;
      errorReportedRef.current = true;
      setAutoRecovering(false);
      setPlayerStatus('error');
      playbackErrorHandlerRef.current?.();
    }, 2_650);
  }

  function togglePlayback() {
    if (playing) {
      userPausedRef.current = true;
      try {
        player.pause();
      } catch {
        // Ignore.
      }
      flashCenter(false);
      return;
    }

    userPausedRef.current = false;
    try {
      player.play();
    } catch {
      // Ignore.
    }
    flashCenter(true);
  }

  function seekTo(locationX: number) {
    const known = Number(player.duration || duration || 0);
    if (known <= 0) return;
    const ratio = Math.min(
      1,
      Math.max(0, locationX / Math.max(barWidthRef.current, 1)),
    );
    const next = ratio * known;
    try {
      player.currentTime = next;
    } catch {
      return;
    }
    playbackTimeByUri.set(playbackIdentity, next);
    setCurrentTime(next);
  }

  const knownDuration = Math.max(
    duration,
    Number(expectedDurationSeconds ?? 0) || 0,
  );
  const progress =
    knownDuration > 0
      ? Math.min(1, Math.max(0, currentTime / knownDuration))
      : 0;
  // Do not confuse automatic initialization with a manual Play state.
  const centerVisible = playerStatus !== 'error' &&
    (showCenter || (!playing && (!autoPlay || userPausedRef.current)));
  const chromeVisible = !fullscreen || !playing || showCenter;
  const frameHeight = !fullscreen && preserveAspectRatio && !fitFrame && videoAspectRatio && measuredWidth > 0
    ? communityVideoFrameHeight(measuredWidth, videoAspectRatio, height)
    : height;
  const clock = formatDuration(
    fullscreen
      ? currentTime
      : Math.max(0, knownDuration - currentTime),
  );

  return (
    <View
      style={[
        styles.wrap,
        edgeToEdge && styles.edgeToEdgeWrap,
        fullscreen && styles.fullscreenWrap,
        { height: frameHeight },
      ]}
      onLayout={event => {
        const nextWidth = Number(event.nativeEvent.layout.width ?? 0);
        if (nextWidth > 0 && Math.abs(nextWidth - measuredWidth) > 0.5) setMeasuredWidth(nextWidth);
      }}
    >
      <VideoView
        player={player}
        style={styles.video}
        nativeControls={false}
        surfaceType="textureView"
        contentFit={fullscreen || (preserveAspectRatio && !fillFrame) ? 'contain' : 'cover'}
        allowsPictureInPicture={false}
      />

      {(posterSource || posterUri) && !hasStartedPlayback ? (
        <ExpoImage
          source={posterSource || { uri: posterUri! }}
          style={StyleSheet.absoluteFillObject}
          contentFit={fullscreen || (preserveAspectRatio && !fillFrame) ? 'contain' : 'cover'}
          cachePolicy="memory-disk"
          transition={120}
          pointerEvents="none"
        />
      ) : null}

      {showDelayedLoading ? (
        <View pointerEvents="none" style={[
          styles.bufferChip,
          fullscreen && { top: Math.max(viewerSafeInsets.top + 16, 68) },
        ]}>
          <Text style={styles.durationText}>
            {hasStartedPlayback ? 'Reconnecting…' : 'Preparing video…'}
          </Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          playing ? 'Pause video' : 'Play video'
        }
        onPress={togglePlayback}
        style={styles.tapLayer}
      />

      {playerStatus === 'error' && !autoRecovering ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry video"
          onPress={retryPlayback}
          style={[
            styles.retryButton,
            fullscreen && { top: '42%' },
          ]}
        >
          <Text style={styles.retryText}>Retry video</Text>
        </Pressable>
      ) : null}

      {!fullscreen && preserveAspectRatio ? (
        <Pressable accessibilityRole="button"
          accessibilityLabel={fillFrame ? 'Fit full video inside frame' : 'Fill video frame, cropping edges'}
          onPress={() => setFillFrame(current => !current)}
          style={styles.fitChoice}
        >
          <MaterialCommunityIcons name={fillFrame ? 'arrow-collapse' : 'arrow-expand'} size={15} color="#FFFFFF" />
          <Text style={styles.fitChoiceText}>{fillFrame ? 'Fit' : 'Fill'}</Text>
        </Pressable>
      ) : null}

      {centerVisible ? (
        <View pointerEvents="none" style={styles.centerButton}>
          <MaterialCommunityIcons
            name={playing ? 'pause' : 'play'}
            size={34}
            color="#FFFFFF"
          />
        </View>
      ) : null}

      {fullscreen && knownDuration > 0 ? (
        <View
          pointerEvents="none"
          style={styles.fullscreenDurationChip}
        >
          <Text style={styles.durationText}>
            {formatDuration(knownDuration)}
          </Text>
        </View>
      ) : null}

      {!fullscreen && chromeVisible && knownDuration > 0 ? (
        <View
          pointerEvents="none"
          style={[
            styles.timeChip,
            { bottom: controlsBottomInset + 64 },
          ]}
        >
          <Text style={styles.durationText}>
            {clock}
          </Text>
        </View>
      ) : null}

      {fullscreen ? null : (
      <View
        pointerEvents="box-none"
        style={[
          styles.bottomChrome,
          { bottom: controlsBottomInset },
        ]}
      >
        {chromeVisible ? (
          <View style={styles.cornerRow}>
            {onOpenFullscreen && !fullscreen ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open video full screen"
                onPress={() => {
                  try {
                    playbackTimeByUri.set(
                      playbackIdentity,
                      Number(player.currentTime || currentTime || 0),
                    );
                    player.pause();
                  } catch {
                    // Opening fullscreen still continues from the saved time.
                  }
                  onOpenFullscreen();
                }}
                style={styles.roundButton}
              >
                <MaterialCommunityIcons
                  name="fullscreen"
                  size={22}
                  color="#FFFFFF"
                />
              </Pressable>
            ) : (
              <View />
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                soundOn ? 'Turn sound off' : 'Turn sound on'
              }
              onPress={() => setSessionSound(!soundOn)}
              style={styles.roundButton}
            >
              <MaterialCommunityIcons
                name={soundOn ? 'volume-high' : 'volume-off'}
                size={20}
                color="#FFFFFF"
              />
            </Pressable>
          </View>
        ) : (
          <View />
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Seek video"
          onPress={(event) => {
            seekTo(event.nativeEvent.locationX);
          }}
          onLayout={(event) => {
            barWidthRef.current = event.nativeEvent.layout.width;
          }}
          style={styles.seekHit}
        >
          <View style={styles.seekTrack}>
            <View
              style={[
                styles.seekFill,
                { width: `${Math.round(progress * 1000) / 10}%` },
              ]}
            />
          </View>
        </Pressable>
      </View>
      )}
    </View>
  );
}

function formatDuration(
  seconds: number,
) {
  const total =
    Math.max(
      0,
      Math.round(
        Number(seconds) || 0,
      ),
    );

  const minutes =
    Math.floor(total / 60);

  const rest =
    total % 60;

  return `${minutes}:${String(
    rest,
  ).padStart(2, '0')}`;
}

const styles =
  StyleSheet.create({
    wrap: {
      width: '100%',
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: '#111',
      marginTop: 12,
    },

    edgeToEdgeWrap: {
      marginTop: 0,
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

    fitChoice: {
      position: 'absolute',
      top: 10,
      right: 10,
      minHeight: 34,
      paddingHorizontal: 9,
      flexDirection: 'row',
      gap: 5,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.60)',
    },
    fitChoiceText: {
      color: '#FFFFFF',
      fontWeight: '800',
      fontSize: 11,
    },

    inactiveVideo: {
      width: '100%',
      height: '100%',
      backgroundColor: '#151515',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
    },
    posterScrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.22)',
    },
    posterPlayBadge: {
      width: 68,
      height: 68,
      borderRadius: 34,
      textAlign: 'center',
      textAlignVertical: 'center',
      overflow: 'hidden',
      backgroundColor: 'rgba(0,0,0,0.62)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.72)',
    },
    inactiveLabel: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
      marginTop: 8,
      textAlign: 'center',
    },
    inactiveHint: {
      color: '#B7D0CD',
      fontSize: 12,
      marginTop: 4,
      textAlign: 'center',
    },

    tapLayer: {
      ...StyleSheet.absoluteFillObject,
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
    },

    bottomChrome: {
      position: 'absolute',
      left: 0,
      right: 0,
    },

    seekHit: {
      height: 18,
      justifyContent: 'flex-end',
    },

    seekTrack: {
      height: 3,
      backgroundColor: 'rgba(255,255,255,0.35)',
    },

    seekFill: {
      height: 3,
      backgroundColor: '#FFFFFF',
    },

    cornerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      paddingBottom: 6,
    },

    roundButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.55)',
    },

    timeChip: {
      position: 'absolute',
      left: 10,
      borderRadius: 8,
      backgroundColor: 'rgba(0,0,0,0.68)',
      paddingHorizontal: 7,
      paddingVertical: 4,
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
    },

    fullscreenDurationChip: {
      position: 'absolute',
      left: 12,
      top: 56,
      borderRadius: 8,
      backgroundColor: 'rgba(0,0,0,0.68)',
      paddingHorizontal: 7,
      paddingVertical: 4,
    },

    durationChip: {
      position: 'absolute',
      right: 10,
      top: 10,
      borderRadius: 8,
      backgroundColor:
        'rgba(0,0,0,0.68)',
      paddingHorizontal: 7,
      paddingVertical: 4,
    },

    durationText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '800',
    },

    retryButton: {
      position: 'absolute',
      top: '43%',
      alignSelf: 'center',
      zIndex: 4,
      minHeight: 44,
      paddingHorizontal: 18,
      borderRadius: 24,
      backgroundColor: 'rgba(0,0,0,0.82)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.45)',
    },
    retryText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
    },
    bufferChip: {
      position: 'absolute',
      left: 10,
      top: 10,
      borderRadius: 8,
      backgroundColor: 'rgba(0,0,0,0.68)',
      paddingHorizontal: 7,
      paddingVertical: 4,
    },
  });
