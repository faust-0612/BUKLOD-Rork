import React, { useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
  VideoView,
  useVideoPlayer,
} from 'expo-video';

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

export function CommunityVideo({
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
  /*
   * PATCH_173F_R11_COMMUNITY_VIDEO_AUTOPLAY
   * Autoplay is opt-in. Native controls stay available.
   */
  useEffect(() => {
    const subscription = player.addListener(
      'statusChange',
      (event: any) => {
        if (event?.status === 'error') {
          onPlaybackError?.();
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, [onPlaybackError, player]);

  /* BUKLOD_COMMUNITY_VIDEO_RETRY_R6 */
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
        edgeToEdge && styles.edgeToEdgeWrap,
        fullscreen && styles.fullscreenWrap,
        { height },
      ]}
    >
      <VideoView
        player={player}
        style={styles.video}
        nativeControls
        contentFit={fullscreen ? "contain" : "cover"}
      />
      {onOpenFullscreen && !fullscreen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open video full screen"
          onPress={() => {
            try {
              player.pause();
            } catch {}
            onOpenFullscreen();
          }}
          style={styles.fullscreenButton}
        >
          <MaterialCommunityIcons
            name="fullscreen"
            size={24}
            color="#FFFFFF"
          />
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

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

/* BUKLOD_COMMUNITY_NATIVE_VIDEO_DURATION_R3 */
/* BUKLOD_COMMUNITY_VIDEO_FULLSCREEN_R4 */
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