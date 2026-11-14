/** OTA-safe native Kingdom FX: one Reanimated UI-thread clock feeds Skia.
 * Decorative only: no points, no requests, and no intercepted touches. */
import React, { memo, useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, AppState, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { BlurMask, Canvas, Circle, Group, Path } from '@shopify/react-native-skia';
import {
  cancelAnimation, Easing, useDerivedValue, useSharedValue,
  withRepeat, withTiming, type SharedValue,
} from 'react-native-reanimated';
import type { KingdomLivingFXProps } from './BuklodKingdomLivingFX.types';

const TAU = Math.PI * 2;
const STARS = Array.from({ length: 16 }, (_, i) => ({
  x: 105 + ((i * 163) % 980), y: 175 + ((i * 137) % 575),
  seed: i * 1.73, size: 2 + (i % 3),
}));

function Firefly({ point, phase, scale, stage }: {
  point: (typeof STARS)[number]; phase: SharedValue<number>; scale: number; stage: number;
}) {
  const cx = useDerivedValue(() => (point.x + Math.sin(phase.value * TAU + point.seed) * 7) * scale);
  const cy = useDerivedValue(() => (point.y - Math.cos(phase.value * TAU + point.seed) * 9) * scale);
  const radius = useDerivedValue(() => (point.size + (1 + Math.sin(phase.value * TAU * 2 + point.seed)) * .75) * scale);
  const opacity = useDerivedValue(() => .2 + (stage >= 3 ? .55 : .39) * (1 + Math.sin(phase.value * TAU + point.seed)) / 2);
  return <Group opacity={opacity}>
    <Circle cx={cx} cy={cy} r={radius} color={point.seed % 2 < 1 ? '#fff1b0' : '#b2ffef'} />
  </Group>;
}

function LivingFX({ stage, mapWidth, mapHeight, scale, selected, cleared, cinematic }: KingdomLivingFXProps) {
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [reduceMotion, setReduceMotion] = useState(false);
  const phase = useSharedValue(0);
  const selectedX = useSharedValue(selected.x);
  const selectedY = useSharedValue(selected.y);
  const running = cinematic && focused && active && !reduceMotion;

  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted) setReduceMotion(Boolean(value));
    }).catch(() => undefined);
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      if (mounted) setReduceMotion(Boolean(value));
    });
    const app = AppState.addEventListener('change', value => {
      if (mounted) setActive(value === 'active');
    });
    return () => { mounted = false; motion.remove(); app.remove(); };
  }, []);

  useEffect(() => {
    cancelAnimation(phase);
    if (running) phase.value = withRepeat(withTiming(1, { duration: 13000, easing: Easing.linear }), -1, false);
    else phase.value = 0.12;
    return () => cancelAnimation(phase);
  }, [running, phase]);
  useEffect(() => {
    selectedX.value = withTiming(selected.x, { duration: reduceMotion ? 0 : 350 });
    selectedY.value = withTiming(selected.y, { duration: reduceMotion ? 0 : 350 });
    return () => { cancelAnimation(selectedX); cancelAnimation(selectedY); };
  }, [selected.x, selected.y, selectedX, selectedY, reduceMotion]);

  const scaledX = useDerivedValue(() => selectedX.value * scale);
  const scaledY = useDerivedValue(() => selectedY.value * scale);
  const ringRadius = useDerivedValue(() => (30 + 7 * (1 + Math.sin(phase.value * TAU)) / 2) * scale);
  const ringOpacity = useDerivedValue(() => .26 + .28 * (1 + Math.sin(phase.value * TAU)) / 2);
  const castleOpacity = useDerivedValue(() => .3 + (stage >= 3 ? .3 : .16) * (1 + Math.sin(phase.value * TAU + 1)) / 2);
  const seaShift = useDerivedValue(() => [{ translateX: Math.sin(phase.value * TAU) * 18 * scale }]);
  const seaOpacity = useDerivedValue(() => .16 + .12 * (1 + Math.sin(phase.value * TAU)) / 2);

  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { width: mapWidth, height: mapHeight }]}>
    <Canvas style={{ width: mapWidth, height: mapHeight }}>
      <Group opacity={seaOpacity} transform={seaShift}>
        <Path path={`M ${25 * scale} ${515 * scale} Q ${110 * scale} ${505 * scale} ${215 * scale} ${535 * scale}`}
          color="#9bf6ee" style="stroke" strokeWidth={8 * scale} strokeCap="round" />
        <Path path={`M ${18 * scale} ${728 * scale} Q ${128 * scale} ${690 * scale} ${290 * scale} ${720 * scale}`}
          color="#dcfaff" style="stroke" strokeWidth={5 * scale} strokeCap="round" />
      </Group>
      {STARS.map((point, index) => (
        <Firefly key={index} point={point} phase={phase} scale={scale} stage={stage} />
      ))}
      <Group opacity={castleOpacity}>
        {cleared.map((station, index) => (
          <Circle key={`${station.x}-${station.y}-${index}`} cx={station.x * scale} cy={station.y * scale}
            r={22 * scale} color={station.accent} style="stroke" strokeWidth={3 * scale} />
        ))}
        <Circle cx={612 * scale} cy={384 * scale} r={(stage >= 3 ? 32 : 21) * scale} color="#fff0a2">
          <BlurMask blur={14 * scale} style="normal" />
        </Circle>
      </Group>
      <Group opacity={ringOpacity}>
        <Circle cx={scaledX} cy={scaledY} r={ringRadius} color={selected.accent}
          style="stroke" strokeWidth={4 * scale} />
      </Group>
    </Canvas>
  </View>;
}
export default memo(LivingFX);
