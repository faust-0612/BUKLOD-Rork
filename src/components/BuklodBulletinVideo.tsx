import React from 'react';

import {
  StyleSheet,
  View,
} from 'react-native';

import {
  VideoView,
  useVideoPlayer,
} from 'expo-video';

export default function
BuklodBulletinVideo({
  uri,
}: {
  uri: string;
}) {
  const player =
    useVideoPlayer(
      uri,
      instance => {
        instance.loop =
          false;
      }
    );

  return (
    <View
      style={
        styles.wrap
      }
    >
      <VideoView
        style={
          styles.video
        }
        player={player}
        nativeControls
        contentFit="cover"
      />
    </View>
  );
}

const styles =
  StyleSheet.create({
    wrap: {
      width: '100%',
      aspectRatio:
        16 / 9,
      overflow: 'hidden',
      borderRadius: 14,
      backgroundColor:
        '#0B0F0D',
      marginBottom: 12,
    },

    video: {
      width: '100%',
      height: '100%',
    },
  });
