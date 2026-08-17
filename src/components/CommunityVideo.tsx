import React, { useEffect } from 'react';
import {
  StyleSheet,
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
};

export function CommunityVideo({
  uri,
  height = 380,
  autoPlay = false,
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
        { height },
      ]}
    >
      <VideoView
        player={player}
        style={styles.video}
        nativeControls
        contentFit="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#111',
    marginTop: 12,
  },

  video: {
    width: '100%',
    height: '100%',
  },
});