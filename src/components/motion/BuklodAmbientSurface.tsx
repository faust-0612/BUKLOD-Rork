import React, { useEffect, useRef } from 'react';

import {
  Animated,
  Easing,
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
 * Low-cost transparent motion layer for cards/HUD surfaces.
 * It never owns business state and is safe to remove without changing layout.
 */
export default function BuklodAmbientSurface({
  visible = true,
  intensity = 1,
  tone = 'surface',
}: Props) {
  const reduceMotion = useBuklodReduceMotion();
  const drift = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const safeIntensity = Math.max(0, Math.min(intensity, 1.25));

  useEffect(() => {
    drift.stopAnimation();
    pulse.stopAnimation();

    if (!visible || reduceMotion) {
      drift.setValue(0.4);
      pulse.setValue(0.35);
      return;
    }

    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 7200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 7200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 2800,
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
    };
  }, [drift, pulse, reduceMotion, visible]);

  const translateX = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [-16, 18],
  });
  const translateY = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [8, -10],
  });
  const reverseX = Animated.multiply(translateX, -0.7);
  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.12 * safeIntensity, 0.26 * safeIntensity],
  });
  const sparkleOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2 * safeIntensity, 0.62 * safeIntensity],
  });
  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1.06],
  });

  const palette =
    tone === 'dark'
      ? DARK_PALETTE
      : SURFACE_PALETTE;

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
              { translateY: Animated.multiply(translateY, -0.55) },
              { scale },
            ],
          },
        ]}
      />

      {SPARKLES.map((item, index) => (
        <Animated.View
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
              transform: [
                {
                  translateY: Animated.add(
                    translateY,
                    index % 2 === 0 ? -2 : 3
                  ),
                },
              ],
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
