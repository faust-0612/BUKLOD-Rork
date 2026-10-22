import React from 'react';

import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  VideoView,
  useVideoPlayer,
} from 'expo-video';

export default function
BuklodBulletinVideo({
  uri,
  style,
}: {
  uri: string;
  style?: StyleProp<ViewStyle>;
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
      style={[
        styles.wrap,
        style,
      ]}
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
