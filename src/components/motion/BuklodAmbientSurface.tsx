import React, { useCallback, useRef } from 'react';

import { useFocusEffect } from 'expo-router';

import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
} from 'react-native';

import { useBuklodReduceMotion } from '@/components/HomeMotion';

type Props = {
  visible?: boolean;
  intensity?: number;
  tone?: 'surface' | 'dark';
};

/**
 * Low-cost transparent atmosphere for cards/HUD surfaces.
 *
 * BUKLOD_PERF_DELTA_AMBIENT_R1
 * - web is static (the HTML shell already owns web atmosphere)
 * - native uses one shared animation phase instead of two independent loops
 * - sparkles are static decoration instead of four extra animated layers
 * - native animation runs only while the owning route is focused
 *
 * Presentation only: no business state, layout authority, points, Character
 * progression, navigation, or persistence behavior lives here.
 */
export default function BuklodAmbientSurface({
  visible = true,
  intensity = 1,
  tone = 'surface',
}: Props) {
  const reduceMotion = useBuklodReduceMotion();
  const phase = useRef(new Animated.Value(0.35)).current;
  const safeIntensity = Math.max(0, Math.min(intensity, 1.25));

  useFocusEffect(
    useCallback(() => {
      phase.stopAnimation();

      if (
        !visible ||
        reduceMotion ||
        Platform.OS === 'web'
      ) {
        phase.setValue(0.35);
        return;
      }

      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(phase, {
            toValue: 1,
            duration: 6200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(phase, {
            toValue: 0,
            duration: 6200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );

      loop.start();

      return () => {
        loop.stop();
        phase.stopAnimation();
      };
    }, [phase, reduceMotion, visible])
  );

  const translateX = phase.interpolate({
    inputRange: [0, 1],
    outputRange: [-14, 16],
  });
  const translateY = phase.interpolate({
    inputRange: [0, 1],
    outputRange: [7, -9],
  });
  const reverseX = Animated.multiply(translateX, -0.7);
  const opacity = phase.interpolate({
    inputRange: [0, 1],
    outputRange: [
      0.14 * safeIntensity,
      0.24 * safeIntensity,
    ],
  });
  const scale = phase.interpolate({
    inputRange: [0, 1],
    outputRange: [0.97, 1.04],
  });

  const palette =
    tone === 'dark'
      ? DARK_PALETTE
      : SURFACE_PALETTE;

  const sparkleOpacity =
    0.36 * safeIntensity;

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        styles.clip,
      ]}
    >
      <Animated.View
        style={[
          styles.glow,
          styles.glowA,
          {
            backgroundColor: palette.glowA,
            opacity,
            transform: [
              { translateX },
              { translateY },
              { scale },
            ],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.glow,
          styles.glowB,
          {
            backgroundColor: palette.glowB,
            opacity,
            transform: [
              { translateX: reverseX },
              {
                translateY:
                  Animated.multiply(
                    translateY,
                    -0.55
                  ),
              },
              { scale },
            ],
          },
        ]}
      />

      {SPARKLES.map((item) => (
        <View
          key={item.key}
          style={[
            styles.sparkle,
            {
              left: item.left,
              top: item.top,
              width: item.size,
              height: item.size,
              borderRadius: item.size / 2,
              backgroundColor: palette.sparkle,
              opacity: sparkleOpacity,
            },
          ]}
        />
      ))}
    </View>
  );
}

const SURFACE_PALETTE = {
  glowA: 'rgba(57,164,102,0.78)',
  glowB: 'rgba(51,152,187,0.62)',
  sparkle: 'rgba(255,255,255,0.92)',
};

const DARK_PALETTE = {
  glowA: 'rgba(105,220,158,0.72)',
  glowB: 'rgba(79,195,224,0.58)',
  sparkle: 'rgba(235,255,244,0.96)',
};

const SPARKLES = [
  { key: 'a', left: '13%', top: '24%', size: 3 },
  { key: 'b', left: '34%', top: '72%', size: 2 },
  { key: 'c', left: '58%', top: '16%', size: 3 },
  { key: 'd', left: '82%', top: '66%', size: 2 },
] as const;

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    borderRadius: 999,
  },
  glowA: {
    width: 190,
    height: 190,
    left: -86,
    top: -94,
  },
  glowB: {
    width: 220,
    height: 220,
    right: -108,
    bottom: -126,
  },
  sparkle: {
    position: 'absolute',
  },
});
