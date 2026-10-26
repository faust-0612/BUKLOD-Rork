import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

export type SceneEffect = 'none' | 'rain' | 'fog' | 'fireflies' | 'embers' | 'lightning';
export function KlSceneEffect({ effect, intensity = 30, active = true }: {
  effect: SceneEffect; intensity?: number; active?: boolean;
}) {
  const phase = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active || effect === 'none' || intensity <= 0) { phase.stopAnimation(); phase.setValue(0); return; }
    const cycle = Animated.loop(Animated.timing(phase, {
      toValue: 1, duration: effect === 'rain' ? 1800 : effect === 'lightning' ? 4300 : 6200,
      easing: Easing.linear, useNativeDriver: true,
    }));
    cycle.start();
    return () => { cycle.stop(); phase.stopAnimation(); phase.setValue(0); };
  }, [active, effect, intensity, phase]);
  const count = Math.min(26, Math.max(3, Math.round(intensity / 4)));
  const particles = useMemo(() => Array.from({ length: count }, (_, i) => ({
    x: ((i * 37 + 13) % 97) + '%',
    delay: ((i * 17) % 100) / 100,
    size: 2 + (i % 3),
  })), [count]);
  if (!active || effect === 'none' || intensity <= 0) return null;
  if (effect === 'lightning') return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {
    backgroundColor: '#e3edff',
    opacity: phase.interpolate({ inputRange: [0, .75, .78, .8, .83, 1], outputRange: [0, 0, intensity / 180, 0, intensity / 260, 0] }),
  }]} />;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
    {particles.map((p, i) => {
      const falling = effect === 'rain' || effect === 'embers';
      const movement = phase.interpolate({
        inputRange: [0, 1],
        outputRange: falling ? [-150 + p.delay * 250, 320 + p.delay * 250] : [18, -25],
      });
      return <Animated.View key={i} style={{
        position: 'absolute', left: p.x as any, top: falling ? -20 : ((i * 29) % 90) + '%',
        width: effect === 'rain' ? 1.5 : p.size,
        height: effect === 'rain' ? 17 : p.size,
        borderRadius: 8,
        backgroundColor: effect === 'rain' ? '#cfe7ff' : effect === 'fog' ? '#e0e6ed' : effect === 'embers' ? '#ff9b41' : '#d8f8a1',
        opacity: Math.min(.8, intensity / 150),
        transform: [{ translateY: movement }],
      }} />;
    })}
  </View>;
}
