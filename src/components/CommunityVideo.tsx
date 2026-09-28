import React, { useEffect } from 'react';
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
  onOpenFullscreen?: () => void;
  onPlaybackError?: () => void;
};

export function CommunityVideo(props: Props) {
  const useIma =
    !props.fullscreen &&
    Platform.OS === 'android' &&
    isBuklodImaNativeAvailable() &&
    shouldUseBuklodImaForVideo(
      props.expectedDurationSeconds,
    );

  if (useIma) {
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

function ExpoCommunityVideo({
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
  const player = useVideoPlayer(
    uri,
    (instance) => {
      instance.loop = false;
    }
  );

  useEffect(() => {
    const subscription =
      player.addListener(
        'statusChange',
        (event: any) => {
          if (
            event?.status ===
            'error'
          ) {
            onPlaybackError?.();
          }
        }
      );

    return () => {
      subscription.remove();
    };
  }, [
    onPlaybackError,
    player,
  ]);

  useEffect(
    () => {
      if (!active) {
        player.pause();
      } else if (autoPlay) {
        player.play();
      } else {
        player.pause();
      }
    },
    [
      active,
      autoPlay,
      player,
      uri,
    ],
  );

  return (
    <View
      style={[
        styles.wrap,
        edgeToEdge &&
          styles.edgeToEdgeWrap,
        fullscreen &&
          styles.fullscreenWrap,
        { height },
      ]}
    >
      <VideoView
        player={player}
        style={styles.video}
        nativeControls
        contentFit={
          fullscreen
            ? 'contain'
            : 'cover'
        }
      />

      {onOpenFullscreen &&
      !fullscreen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open video full screen"
          onPress={() => {
            try {
              player.pause();
            } catch {}
            onOpenFullscreen();
          }}
          style={
            styles.fullscreenButton
          }
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

    fullscreenButton: {
      position: 'absolute',
      right: 10,
      bottom: 10,
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        'rgba(0,0,0,0.62)',
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
