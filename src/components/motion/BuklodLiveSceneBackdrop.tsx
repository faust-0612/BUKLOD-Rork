import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useFocusEffect } from 'expo-router';
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
 * BUKLOD_PERF_DELTA_LIVE_BACKDROP_R1
 * - procedural motion runs only while the owning route is focused
 * - web keeps a static procedural layer (the HTML shell already owns web motion)
 * - shimmer and sparkles stay visual but no longer add their own infinite loops
 * - optional approved video still plays only while the backdrop is focused/visible
 *
 * No progression, points, rank, inventory, or entitlement state is read here.
 */
export default function BuklodLiveSceneBackdrop({
  videoUrl,
  visible = true,
  intensity = 1,
}: Props) {
  const reduceMotion = useBuklodReduceMotion();
  const [focused, setFocused] = useState(false);
  const drift = useRef(new Animated.Value(0.45)).current;
  const pulse = useRef(new Animated.Value(0.35)).current;

  const normalizedVideoUrl = String(videoUrl ?? '').trim();
  const safeIntensity = Math.max(0, Math.min(intensity, 1.35));

  useFocusEffect(
    useCallback(() => {
      setFocused(true);

      return () => {
        setFocused(false);
      };
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      drift.stopAnimation();
      pulse.stopAnimation();

      if (
        !visible ||
        reduceMotion ||
        Platform.OS === 'web'
      ) {
        drift.setValue(0.45);
        pulse.setValue(0.35);
        return;
      }

      const driftLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(drift, {
            toValue: 1,
            duration: 9200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(drift, {
            toValue: 0,
            duration: 9200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );

      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 3600,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: 3600,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );

      driftLoop.start();
      pulseLoop.start();

      return () => {
        driftLoop.stop();
        pulseLoop.stop();
        drift.stopAnimation();
        pulse.stopAnimation();
      };
    }, [drift, pulse, reduceMotion, visible])
  );

  const driftX = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, 20],
  });
  const driftY = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [10, -13],
  });
  const reverseX = Animated.multiply(driftX, -0.72);
  const glowScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.97, 1.06],
  });
  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.16 * safeIntensity, 0.31 * safeIntensity],
  });

  const sparkleOpacity = 0.4 * safeIntensity;
  const shimmerOpacity = 0.055 * safeIntensity;
  const videoActive =
    focused &&
    visible &&
    !reduceMotion;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {normalizedVideoUrl && videoActive ? (
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
              {
                translateY:
                  Animated.multiply(
                    driftY,
                    -0.55
                  ),
              },
              { scale: glowScale },
            ],
          },
        ]}
      />

      <View
        style={[
          styles.shimmer,
          {
            opacity: shimmerOpacity,
            transform: [{ rotate: '-13deg' }],
          },
        ]}
      />

      {SPARKLES.map((sparkle) => (
        <View
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
    left: '44%',
    width: 72,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  sparkle: {
    position: 'absolute',
    backgroundColor: 'rgba(236,255,245,0.95)',
  },
});
