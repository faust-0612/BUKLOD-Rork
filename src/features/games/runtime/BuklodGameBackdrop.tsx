import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { getRorkGameMedia } from './rorkMedia';

type Props = {
  gameId?: string;
  opacity?: number;
  thumbnail?: boolean;
};

export default function BuklodGameBackdrop({ gameId, opacity = 0.34, thumbnail = false }: Props) {
  const media = getRorkGameMedia(gameId);
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (thumbnail || !media) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 9000, useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 9000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [drift, media, thumbnail]);

  if (!media) return null;

  const scale = thumbnail
    ? 1
    : drift.interpolate({ inputRange: [0, 1], outputRange: [1.03, 1.075] });
  const translateY = thumbnail
    ? 0
    : drift.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });

  return (
    <View pointerEvents="none" style={styles.fill}>
      <Animated.View style={[styles.fill, { transform: [{ scale }, { translateY }] }]}>
        <Image source={media.background} contentFit="cover" transition={thumbnail ? 0 : 180} style={[styles.fill, { opacity }]} />
      </Animated.View>
      {!thumbnail ? (
        <LinearGradient
          colors={['rgba(5,12,20,0.08)', 'rgba(5,12,20,0.18)', 'rgba(5,12,20,0.44)']}
          locations={[0, 0.58, 1]}
          style={styles.fill}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
});
