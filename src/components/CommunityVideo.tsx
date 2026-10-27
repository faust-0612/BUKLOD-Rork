import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';

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
import {
  COMMUNITY_VIDEO_CACHE_BUDGET_BYTES,
  shouldMountCommunityVideoPlayer,
} from '@/lib/communityVideoPlayback';

type Props = {
  uri: string;
  height?: number;
  autoPlay?: boolean;
  expectedDurationSeconds?: number;
  fullscreen?: boolean;
  edgeToEdge?: boolean;
  active?: boolean;
  controlsBottomInset?: number;
  onOpenFullscreen?: () => void;
  onPlaybackError?: () => void;
  onRequestPlay?: () => void;
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
  const [playIntent, setPlayIntent] = useState(false);

  useEffect(() => {
    if (props.active === false) setPlayIntent(false);
  }, [props.active]);

  const mountPlayer = shouldMountCommunityVideoPlayer({
    active: props.active !== false,
    fullscreen: Boolean(props.fullscreen),
    degraded,
    playIntent,
  });

  const requestPlay = () => {
    setPlayIntent(true);
    props.onRequestPlay?.();
  };

  if (!mountPlayer) {
    return (
      <InactiveCommunityVideo
        {...props}
        onRequestPlay={requestPlay}
      />
    );
  }

  const imaEligible =
    props.active !== false &&
    !props.fullscreen &&
    Platform.OS === 'android' &&
    isBuklodImaNativeAvailable() &&
    shouldUseBuklodImaForVideo(
      props.expectedDurationSeconds,
    );

  if (imaEligible) {
    return (
      <ImaCommunityVideo
        {...props}
      />
    );
  }

  return (
    <ExpoCommunityVideo
      {...props}
    />
  );
}

function InactiveCommunityVideo({
  height = 380,
  expectedDurationSeconds,
  fullscreen = false,
  edgeToEdge = false,
  controlsBottomInset = 0,
  onOpenFullscreen,
  onRequestPlay,
}: Props) {
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
        <MaterialCommunityIcons
          name="play-circle-outline"
          size={58}
          color="#B7E4D5"
        />
        <Text style={styles.inactiveLabel}>
          Video · I-tap para i-play
        </Text>
        <Text style={styles.inactiveHint}>
          Data saver sa mahinang signal
        </Text>
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
        contentFit={
          fullscreen
            ? 'contain'
            : 'cover'
        }
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
  height = 380,
  autoPlay = false,
  expectedDurationSeconds,
  fullscreen = false,
  edgeToEdge = false,
  active = true,
  controlsBottomInset = 0,
  onOpenFullscreen,
  onPlaybackError,
}: Props) {
  const soundOn = useSessionSound();
  const userPausedRef = useRef(false);
  const activeRef = useRef(active);
  const autoPlayRef = useRef(autoPlay);
  activeRef.current = active;
  autoPlayRef.current = autoPlay;
  const barWidthRef = useRef(1);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(
    Number(expectedDurationSeconds ?? 0) || 0,
  );
  const [showCenter, setShowCenter] = useState(false);
  const [playerStatus, setPlayerStatus] = useState<
    'idle' | 'loading' | 'readyToPlay' | 'error'
  >('idle');
  const replayAttemptsRef = useRef(0);
  const centerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyStartedAtRef = useRef(Date.now());
  const readyReportedRef = useRef(false);

  useEffect(() => {
    readyStartedAtRef.current = Date.now();
    readyReportedRef.current = false;
  }, [uri]);

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
      instance.audioMixingMode = instance.muted
        ? 'mixWithOthers'
        : 'doNotMix';
    },
  );

  useEffect(() => {
    const muted = fullscreen ? false : !soundOn;
    try {
      player.loop = !fullscreen;
      player.muted = muted;
      player.audioMixingMode = muted
        ? 'mixWithOthers'
        : 'doNotMix';
    } catch {
      // Player can already be released while the feed row recycles.
    }
  }, [fullscreen, player, soundOn]);

  useEffect(() => {
    const subscription = player.addListener(
      'statusChange',
      (event: { status?: string }) => {
        const nextStatus = event?.status;
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
          // Keep the same URI mounted. A transient fault must not
          // immediately rotate the signed URL and discard cached bytes.
          return;
        }

        if (nextStatus === 'readyToPlay') {
          if (!readyReportedRef.current) {
            readyReportedRef.current = true;
            recordCommunityFeedMetric({
              stage: 'video_player',
              elapsedMs: Date.now() - readyStartedAtRef.current,
              status: 'ok',
              player: 'expo-video',
            });
          }
          const known = Number(player.duration || 0);
          if (known > 0) setDuration(known);

          const saved = playbackTimeByUri.get(uri) ?? 0;
          if (
            saved > 0.35 &&
            (known <= 0 || saved < known - 0.4)
          ) {
            try {
              player.currentTime = saved;
            } catch {
              // Seek before the surface is ready is safe to ignore.
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

    const playingSub = player.addListener(
      'playingChange',
      (event: { isPlaying?: boolean }) => {
        setPlaying(Boolean(event?.isPlaying));
      },
    );

    const timeSub = player.addListener(
      'timeUpdate',
      (event: { currentTime?: number }) => {
        const next = Number(event?.currentTime ?? 0);
        playbackTimeByUri.set(uri, next);
        setCurrentTime(next);
        const known = Number(player.duration || 0);
        if (known > 0) setDuration(known);
      },
    );

    return () => {
      subscription.remove();
      playingSub.remove();
      timeSub.remove();
    };
  }, [onPlaybackError, player, uri]);

  useEffect(() => {
    if (!active) {
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
    if (replayAttemptsRef.current < 1) {
      replayAttemptsRef.current += 1;
      setPlayerStatus('loading');
      try {
        player.replay();
      } catch {
        onPlaybackError?.();
      }
      return;
    }

    onPlaybackError?.();
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
    playbackTimeByUri.set(uri, next);
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
  const centerVisible = !playing || showCenter;
  const chromeVisible = !fullscreen || !playing || showCenter;
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
        { height },
      ]}
    >
      <VideoView
        player={player}
        style={styles.video}
        nativeControls={false}
        surfaceType="textureView"
        contentFit={fullscreen ? 'contain' : 'cover'}
        allowsPictureInPicture={false}
      />

      {playerStatus === 'loading' ? (
        <View pointerEvents="none" style={styles.bufferChip}>
          <Text style={styles.durationText}>Buffering…</Text>
        </View>
      ) : null}

      {playerStatus === 'error' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry video"
          onPress={retryPlayback}
          style={styles.bufferChip}
        >
          <Text style={styles.durationText}>Retry</Text>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          playing ? 'Pause video' : 'Play video'
        }
        onPress={togglePlayback}
        style={styles.tapLayer}
      />

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
                      uri,
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

    inactiveVideo: {
      width: '100%',
      height: '100%',
      backgroundColor: '#142D31',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
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
