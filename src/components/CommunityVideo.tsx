import React, { useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

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
};

export function CommunityVideo({
  uri,
  height = 380,
  autoPlay = false,
  expectedDurationSeconds,
  fullscreen = false,
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
  useEffect(
    () => {
      if (autoPlay) {
        player.play();
      } else {
        player.pause();
      }
    },
    [
      autoPlay,
      player,
      uri,
    ],
  );

  return (
    <View
      style={[
        styles.wrap,
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

  fullscreenWrap: {
    marginTop: 0,
    borderRadius: 0,
  },
  video: {
    width: '100%',
    height: '100%',
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