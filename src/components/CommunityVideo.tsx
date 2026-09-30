import React, {
  useEffect,
  useState,
} from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

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
  const [
    muted,
    setMuted,
  ] = useState(autoPlay);

  const player = useVideoPlayer(
    uri,
    (instance) => {
      instance.loop = false;
      instance.muted = autoPlay;
    }
  );

  /*
   * BUKLOD_COMMUNITY_VIDEO_FB_LIKE_R1
   *
   * Feed autoplay is opt-in from the parent list's viewport state:
   * - visible feed video starts muted
   * - leaving the active viewport pauses it
   * - native controls remain available for play/pause/scrub/fullscreen
   * - the explicit sound button lets the user opt in to audio
   *
   * Non-feed callers keep their existing manual-play behavior because
   * autoPlay defaults to false.
   */
  useEffect(
    () => {
      if (autoPlay) {
        player.muted = true;
        setMuted(true);
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

  const toggleMuted = () => {
    const next =
      !player.muted;

    player.muted = next;
    setMuted(next);
  };

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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          muted
            ? 'Turn video sound on'
            : 'Mute video'
        }
        hitSlop={8}
        onPress={toggleMuted}
        style={styles.soundButton}
      >
        <MaterialCommunityIcons
          name={
            muted
              ? 'volume-off'
              : 'volume-high'
          }
          size={19}
          color="#FFFFFF"
        />
      </Pressable>
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

  soundButton: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor:
      'rgba(0,0,0,0.62)',
  },
});
