import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import {
  BUKLOD_MAX_ACTIVE_MICRO_MOTIONS,
  subscribeBuklodMicroMotion,
  type BuklodMicroMotionSignal,
} from '@/lib/buklodMicroMotion';

type Burst = BuklodMicroMotionSignal & { id: number; x: number; y: number };

function MotionBurst({ burst, onComplete }: {
  burst: Burst;
  onComplete: (id: number) => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const duration = burst.kind === 'reaction' ? 1050 : burst.kind === 'tap' ? 560 : 900;
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) onCompleteRef.current(burst.id);
    });
    return () => animation.stop();
  }, [burst.id, burst.kind, progress]);

  const ringOpacity = progress.interpolate({
    inputRange: [0, 0.15, 0.55, 1],
    outputRange: [0.05, 0.5, 0.22, 0],
  });
  const ringScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.65, 2.2],
  });
  const particleOpacity = progress.interpolate({
    inputRange: [0, 0.1, 0.7, 1],
    outputRange: [0, 1, 0.9, 0],
  });
  const particleScale = progress.interpolate({
    inputRange: [0, 0.18, 1],
    outputRange: [0.45, 1.15, 0.85],
  });
  const isReaction = burst.kind === 'reaction';
  const symbol = isReaction
    ? burst.emoji || '💚'
    : burst.kind === 'reward'
      ? '✦'
      : burst.kind === 'success'
        ? '✓'
        : '✧';
  const tone = burst.kind === 'reward' ? '#E7AE30' : '#63D994';
  const particleCount = isReaction ? 3 : burst.kind === 'reward' ? 4 : 2;

  return (
    <View pointerEvents="none" style={[styles.anchor, { left: burst.x - 30, top: burst.y - 30 }]}>
      <Animated.View
        style={[styles.ring, {
          borderColor: tone,
          opacity: ringOpacity,
          transform: [{ scale: ringScale }],
        }]}
      />
      {Array.from({ length: particleCount }, (_, index) => {
        const offset = (index - (particleCount - 1) / 2) * (isReaction ? 22 : 17);
        const rise = isReaction ? -86 - index * 10 : burst.kind === 'reward' ? -72 : -34;
        return (
          <Animated.Text
            key={index}
            accessible={false}
            style={[styles.particle, {
              color: tone,
              fontSize: isReaction ? (index === 1 ? 24 : 18) : burst.kind === 'tap' ? 11 : 19,
              opacity: particleOpacity,
              transform: [
                { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, rise] }) },
                { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, offset] }) },
                { scale: particleScale },
              ],
            }]}
          >
            {symbol}
          </Animated.Text>
        );
      })}
    </View>
  );
}

/**
 * Single app-wide pointer-transparent animation host. No idle loops or timers;
 * only three concurrent bursts, with native-driver transform/opacity updates.
 * Hidden in background or when OS Reduce Motion is enabled.
 */
export default function BuklodMicroMotionHost() {
  const { width, height } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [foreground, setForeground] = useState(
    AppState.currentState !== 'background' && AppState.currentState !== 'inactive',
  );
  const [bursts, setBursts] = useState<Burst[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (mounted) setReduceMotion(Boolean(enabled));
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', enabled => {
      if (mounted) setReduceMotion(Boolean(enabled));
    });
    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      const active = state !== 'background' && state !== 'inactive';
      setForeground(active);
      if (!active) setBursts([]);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion || !foreground) {
      setBursts([]);
      return;
    }
    return subscribeBuklodMicroMotion(signal => {
      const x = Math.max(30, Math.min(width - 30, signal.pageX));
      const y = Math.max(30, Math.min(height - 30, signal.pageY));
      nextId.current += 1;
      const burst: Burst = { ...signal, id: nextId.current, x, y };
      setBursts(current => [...current.slice(-(BUKLOD_MAX_ACTIVE_MICRO_MOTIONS - 1)), burst]);
    });
  }, [foreground, height, reduceMotion, width]);

  const complete = (id: number) => {
    setBursts(current => current.filter(burst => burst.id !== id));
  };

  if (reduceMotion || !foreground || bursts.length === 0) return null;

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      {bursts.map(burst => (
        <MotionBurst key={burst.id} burst={burst} onComplete={complete} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
  },
  particle: {
    position: 'absolute',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.18)',
    textShadowRadius: 2,
  },
});
