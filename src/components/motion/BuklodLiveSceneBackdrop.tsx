import React, { useEffect, useMemo, useRef } from 'react';

import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
} from 'react-native';

import { useBuklodReduceMotion } from '@/components/HomeMotion';

type Props = {
  videoUrl?: string | null;
  visible?: boolean;
  intensity?: number;
};

type VideoProps = {
  url: string;
};

function RemoteVideoLayer({ url }: VideoProps) {
  const source = useMemo(
    () => ({
      uri: url,
      useCaching: Platform.OS !== 'web',
    }),
    [url]
  );

  const player = useVideoPlayer(source, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.volume = 0;
    instance.playbackRate = 0.82;
  });

  useEffect(() => {
    player.muted = true;
    player.volume = 0;
    player.play();

    return () => {
      player.pause();
    };
  }, [player]);

  return (
    <VideoView
      player={player}
      nativeControls={false}
      contentFit="cover"
      playsInline
      surfaceType="textureView"
      style={StyleSheet.absoluteFill}
    />
  );
}

/**
 * Shared cinematic backdrop for BUKLOD character/reward surfaces.
 *
 * The procedural layer is always available and does not require network media.
 * A BUKLOD-owned remote MP4/WebM may be supplied as progressive enhancement.
 * No progression, points, rank, inventory, or entitlement state is read here.
 */
export default function BuklodLiveSceneBackdrop({
  videoUrl,
  visible = true,
  intensity = 1,
}: Props) {
  const reduceMotion = useBuklodReduceMotion();
  const drift = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  const normalizedVideoUrl = String(videoUrl ?? '').trim();
  const safeIntensity = Math.max(0, Math.min(intensity, 1.35));

  useEffect(() => {
    drift.stopAnimation();
    pulse.stopAnimation();
    shimmer.stopAnimation();

    if (!visible || reduceMotion) {
      drift.setValue(0.45);
      pulse.setValue(0.35);
      shimmer.setValue(0);
      return;
    }

    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 8800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 8800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 3300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 3300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 5200,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(1100),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    driftLoop.start();
    pulseLoop.start();
    shimmerLoop.start();

    return () => {
      driftLoop.stop();
      pulseLoop.stop();
      shimmerLoop.stop();
    };
  }, [drift, pulse, reduceMotion, shimmer, visible]);

  const driftX = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [-24, 24],
  });
  const driftY = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [12, -16],
  });
  const reverseX = Animated.multiply(driftX, -0.72);
  const glowScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1.08],
  });
  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.16 * safeIntensity, 0.34 * safeIntensity],
  });
  const sparkleOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.24 * safeIntensity, 0.82 * safeIntensity],
  });
  const shimmerX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-260, 360],
  });
  const shimmerOpacity = shimmer.interpolate({
    inputRange: [0, 0.1, 0.82, 1],
    outputRange: [0, 0.18 * safeIntensity, 0.1 * safeIntensity, 0],
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {normalizedVideoUrl && visible && !reduceMotion ? (
        <View style={[StyleSheet.absoluteFill, styles.videoLayer]}>
          <RemoteVideoLayer url={normalizedVideoUrl} />
        </View>
      ) : null}

      <LinearGradient
        colors={[
          'rgba(5,18,14,0.02)',
          'rgba(18,70,53,0.12)',
          'rgba(3,10,8,0.26)',
        ]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        style={[
          styles.orb,
          styles.orbA,
          {
            opacity: glowOpacity,
            transform: [
              { translateX: driftX },
              { translateY: driftY },
              { scale: glowScale },
            ],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.orb,
          styles.orbB,
          {
            opacity: glowOpacity,
            transform: [
              { translateX: reverseX },
              { translateY: Animated.multiply(driftY, -0.55) },
              { scale: glowScale },
            ],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.shimmer,
          {
            opacity: shimmerOpacity,
            transform: [
              { translateX: shimmerX },
              { rotate: '-13deg' },
            ],
          },
        ]}
      />

      {SPARKLES.map((sparkle, index) => (
        <Animated.View
          key={sparkle.key}
          style={[
            styles.sparkle,
            {
              left: sparkle.left,
              top: sparkle.top,
              width: sparkle.size,
              height: sparkle.size,
              borderRadius: sparkle.size / 2,
              opacity: sparkleOpacity,
              transform: [
                {
                  translateY: Animated.add(
                    driftY,
                    index % 2 === 0 ? -4 : 5
                  ),
                },
                {
                  scale: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange:
                      index % 2 === 0
                        ? [0.72, 1.28]
                        : [1.16, 0.78],
                  }),
                },
              ],
            },
          ]}
        />
      ))}

      <LinearGradient
        colors={[
          'rgba(255,255,255,0.045)',
          'rgba(255,255,255,0)',
          'rgba(0,0,0,0.16)',
        ]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const SPARKLES = [
  { key: 'a', left: '10%', top: '18%', size: 3 },
  { key: 'b', left: '26%', top: '61%', size: 4 },
  { key: 'c', left: '43%', top: '26%', size: 2 },
  { key: 'd', left: '61%', top: '68%', size: 3 },
  { key: 'e', left: '77%', top: '21%', size: 4 },
  { key: 'f', left: '89%', top: '52%', size: 2 },
] as const;

const styles = StyleSheet.create({
  videoLayer: {
    opacity: 0.46,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbA: {
    width: 260,
    height: 260,
    left: -94,
    top: -92,
    backgroundColor: 'rgba(94,211,151,0.48)',
  },
  orbB: {
    width: 300,
    height: 300,
    right: -128,
    bottom: -118,
    backgroundColor: 'rgba(58,176,205,0.36)',
  },
  shimmer: {
    position: 'absolute',
    top: '-14%',
    bottom: '-14%',
    left: '18%',
    width: 72,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  sparkle: {
    position: 'absolute',
    backgroundColor: 'rgba(236,255,245,0.95)',
    shadowColor: '#E8FFF2',
    shadowOpacity: 0.72,
    shadowRadius: 7,
  },
});
