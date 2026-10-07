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
};

export function CommunityVideo(props: Props) {
  const imaEligible =
    props.active !== false &&
    !props.fullscreen &&
    Platform.OS === 'android' &&
    isBuklodImaNativeAvailable() &&
    shouldUseBuklodImaForVideo(
      props.expectedDurationSeconds,
    );

  if (props.fullscreen && props.active === false) {
    return (
      <InactiveCommunityVideo
        {...props}
      />
    );
  }

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
      <View style={styles.video} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Play video"
        disabled={!onOpenFullscreen}
        onPress={() => {
          onOpenFullscreen?.();
        }}
        style={styles.tapLayer}
      />

      <View pointerEvents="none" style={styles.centerButton}>
        <MaterialCommunityIcons
          name="play"
          size={34}
          color="#FFFFFF"
        />
      </View>

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

type CommunityVideoPlaybackOwnerListener =
  (ownerId: string | null) => void;

let communityVideoPlaybackOwnerId: string | null = null;
let communityVideoInstanceSequence = 0;

const communityVideoPlaybackOwnerListeners =
  new Set<CommunityVideoPlaybackOwnerListener>();

function createCommunityVideoInstanceId() {
  communityVideoInstanceSequence += 1;
  return `community-video-${communityVideoInstanceSequence}`;
}

function claimCommunityVideoPlayback(ownerId: string) {
  if (communityVideoPlaybackOwnerId === ownerId) {
    return;
  }

  communityVideoPlaybackOwnerId = ownerId;
  communityVideoPlaybackOwnerListeners.forEach((listener) => {
    listener(ownerId);
  });
}

function releaseCommunityVideoPlayback(ownerId: string) {
  if (communityVideoPlaybackOwnerId !== ownerId) {
    return;
  }

  communityVideoPlaybackOwnerId = null;
  communityVideoPlaybackOwnerListeners.forEach((listener) => {
    listener(null);
  });
}

function subscribeCommunityVideoPlaybackOwner(
  listener: CommunityVideoPlaybackOwnerListener,
) {
  communityVideoPlaybackOwnerListeners.add(listener);
  listener(communityVideoPlaybackOwnerId);

  return () => {
    communityVideoPlaybackOwnerListeners.delete(listener);
  };
}

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
  const instanceIdRef = useRef<string | null>(null);
  if (!instanceIdRef.current) {
    instanceIdRef.current =
      createCommunityVideoInstanceId();
  }

  const userPausedRef = useRef(false);
  const playingRef = useRef(false);
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
  const centerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const source = useMemo(
    () => communityVideoSource(uri),
    [uri],
  );

  const player = useVideoPlayer(
    source,
    (instance) => {
      instance.loop = true;
      instance.muted = !sessionSoundOn;
      instance.timeUpdateEventInterval = 0.25;

      /*
       * BUKLOD_COMMUNITY_VIDEO_AUDIO_ISOLATION_R1
       *
       * Community post video must not request exclusive Android audio focus.
       * DZAS, PTT monitoring/RX/TX and other BUKLOD audio may coexist without
       * forcing this player into an accidental pause. Video-to-video
       * exclusivity is handled explicitly by the playback-owner coordinator
       * below instead of by the global OS audio session.
       */
      instance.audioMixingMode = 'mixWithOthers';
    },
  );

  useEffect(() => {
    const muted = !soundOn;
    try {
      player.muted = muted;
      player.audioMixingMode = 'mixWithOthers';
    } catch {
      // Player can already be released while the feed row recycles.
    }
  }, [player, soundOn]);

  const playIfEligible = () => {
    const ownerId = instanceIdRef.current;
    if (
      !ownerId ||
      !activeRef.current ||
      userPausedRef.current
    ) {
      return;
    }

    claimCommunityVideoPlayback(ownerId);

    try {
      player.play();
    } catch {
      // Player can be between native lifecycle states.
    }
  };

  useEffect(() => {
    const ownerId = instanceIdRef.current;
    if (!ownerId) {
      return undefined;
    }

    return subscribeCommunityVideoPlaybackOwner(
      (nextOwnerId) => {
        if (
          nextOwnerId &&
          nextOwnerId !== ownerId
        ) {
          try {
            player.pause();
          } catch {
            // Released player.
          }
        }
      },
    );
  }, [player]);

  useEffect(() => {
    const subscription = player.addListener(
      'statusChange',
      (event: { status?: string }) => {
        if (event?.status === 'error') {
          onPlaybackError?.();
          return;
        }

        if (event?.status === 'readyToPlay') {
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
            playIfEligible();
          }
        }
      },
    );

    const playingSub = player.addListener(
      'playingChange',
      (event: { isPlaying?: boolean }) => {
        const nextPlaying =
          Boolean(event?.isPlaying);

        playingRef.current = nextPlaying;
        setPlaying(nextPlaying);

        if (
          nextPlaying &&
          activeRef.current &&
          !userPausedRef.current
        ) {
          const ownerId = instanceIdRef.current;
          if (ownerId) {
            claimCommunityVideoPlayback(ownerId);
          }
        }
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
    const ownerId = instanceIdRef.current;

    if (!active) {
      if (ownerId) {
        releaseCommunityVideoPlayback(ownerId);
      }

      try {
        player.pause();
      } catch {
        // Released player.
      }
      return;
    }

    if (autoPlay && !userPausedRef.current) {
      playIfEligible();
    }
  }, [active, autoPlay, player]);

  /*
   * Some Android communication stacks can still transiently suspend a media
   * player while changing route/focus even when mixing is allowed. Recover
   * only the current Community-video owner. If another Community video has
   * taken ownership, or the user paused manually, this guard does nothing.
   */
  useEffect(() => {
    if (!active) {
      return undefined;
    }

    const timer = setInterval(() => {
      const ownerId = instanceIdRef.current;

      if (
        !ownerId ||
        communityVideoPlaybackOwnerId !== ownerId ||
        userPausedRef.current ||
        playingRef.current
      ) {
        return;
      }

      try {
        player.play();
      } catch {
        // Native audio focus can still be transitioning.
      }
    }, 1200);

    return () => clearInterval(timer);
  }, [active, player]);

  useEffect(() => {
    return () => {
      const ownerId = instanceIdRef.current;
      if (ownerId) {
        releaseCommunityVideoPlayback(ownerId);
      }

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

  function togglePlayback() {
    if (playing) {
      userPausedRef.current = true;

      const ownerId = instanceIdRef.current;
      if (ownerId) {
        releaseCommunityVideoPlayback(ownerId);
      }

      try {
        player.pause();
      } catch {
        // Ignore.
      }
      flashCenter(false);
      return;
    }

    userPausedRef.current = false;
    playIfEligible();
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

      {chromeVisible && knownDuration > 0 ? (
        <View
          pointerEvents="none"
          style={[
            styles.timeChip,
            { bottom: controlsBottomInset + 64 },
          ]}
        >
          <Text style={styles.durationText}>
            {fullscreen
              ? `${formatDuration(currentTime)} / ${formatDuration(knownDuration)}`
              : clock}
          </Text>
        </View>
      ) : null}

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

                    const ownerId =
                      instanceIdRef.current;
                    if (ownerId) {
                      releaseCommunityVideoPlayback(
                        ownerId,
                      );
                    }
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
  });
