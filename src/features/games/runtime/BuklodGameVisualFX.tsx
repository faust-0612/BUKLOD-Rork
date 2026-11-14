import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import type { BuklodGameBiome } from './quality';

const biomeFx: Record<BuklodGameBiome, { particle: string; haze: string; beam: string }> = {
  forest: { particle: '#baf2c7', haze: 'rgba(71,141,95,0.14)', beam: 'rgba(205,245,215,0.08)' },
  playground: { particle: '#ffd6f0', haze: 'rgba(183,111,205,0.15)', beam: 'rgba(255,224,244,0.09)' },
  city: { particle: '#bceaff', haze: 'rgba(66,131,161,0.14)', beam: 'rgba(196,235,255,0.08)' },
  farm: { particle: '#f3e6a0', haze: 'rgba(130,138,54,0.14)', beam: 'rgba(250,238,167,0.08)' },
  academy: { particle: '#f8df9c', haze: 'rgba(84,112,173,0.14)', beam: 'rgba(240,225,174,0.08)' },
  music: { particle: '#f6b8e8', haze: 'rgba(133,63,157,0.15)', beam: 'rgba(255,206,244,0.08)' },
  strategy: { particle: '#c6d8ed', haze: 'rgba(92,113,144,0.14)', beam: 'rgba(222,235,250,0.07)' },
  art: { particle: '#ffd1b8', haze: 'rgba(170,88,106,0.15)', beam: 'rgba(255,221,201,0.08)' },
  mission: { particle: '#d9e8b5', haze: 'rgba(99,130,84,0.14)', beam: 'rgba(230,241,197,0.08)' },
  treasury: { particle: '#ffe6a0', haze: 'rgba(165,115,43,0.16)', beam: 'rgba(255,231,166,0.09)' },
  agriculture: { particle: '#e9e29b', haze: 'rgba(120,135,56,0.14)', beam: 'rgba(243,235,165,0.08)' },
  highlands: { particle: '#d7ece2', haze: 'rgba(98,129,121,0.14)', beam: 'rgba(224,244,235,0.08)' },
  discovery: { particle: '#d3d9ff', haze: 'rgba(82,103,176,0.15)', beam: 'rgba(220,225,255,0.08)' },
};

const PARTICLES = [
  { left: '8%', top: '17%', size: 5, delay: 0 },
  { left: '21%', top: '64%', size: 3, delay: 420 },
  { left: '38%', top: '30%', size: 4, delay: 840 },
  { left: '56%', top: '74%', size: 5, delay: 1260 },
  { left: '72%', top: '22%', size: 3, delay: 1680 },
  { left: '87%', top: '55%', size: 4, delay: 2100 },
] as const;

export function BuklodGameVisualFX({ biome, enabled = true }: { biome: BuklodGameBiome; enabled?: boolean }) {
  const drift = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const fx = biomeFx[biome];

  useEffect(() => {
    // Android Expo Router keeps hidden game screens mounted. Stop loops on blur,
    // background or Reduce Motion instead of consuming GPU frames offscreen.
    if (!enabled) {
      drift.stopAnimation();
      pulse.stopAnimation();
      drift.setValue(0);
      pulse.setValue(0);
      return;
    }
    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 6500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 6500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    driftLoop.start();
    pulseLoop.start();
    return () => {
      driftLoop.stop();
      pulseLoop.stop();
    };
  }, [drift, pulse, enabled]);

  const translateX = drift.interpolate({ inputRange: [0, 1], outputRange: [-18, 18] });
  const translateY = drift.interpolate({ inputRange: [0, 1], outputRange: [10, -14] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.42] });
  const particleOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.26, 0.78] });

  const particles = useMemo(() => PARTICLES, []);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.hazeA,
          { backgroundColor: fx.haze, opacity: glowOpacity, transform: [{ translateX }, { translateY }] },
        ]}
      />
      <Animated.View
        style={[
          styles.hazeB,
          { backgroundColor: fx.haze, opacity: glowOpacity, transform: [{ translateX: Animated.multiply(translateX, -0.7) }] },
        ]}
      />
      <Animated.View
        style={[
          styles.lightBeam,
          { backgroundColor: fx.beam, opacity: glowOpacity, transform: [{ translateX }, { rotate: '-13deg' }] },
        ]}
      />
      {particles.map((item, index) => (
        <Animated.View
          key={index}
          style={[
            styles.particle,
            {
              left: item.left,
              top: item.top,
              width: item.size,
              height: item.size,
              borderRadius: item.size / 2,
              backgroundColor: fx.particle,
              opacity: particleOpacity,
              transform: [
                { translateY: Animated.add(translateY, index % 2 === 0 ? -4 : 4) },
                { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.35] }) },
              ],
            },
          ]}
        />
      ))}
      <View style={styles.cinematicTop} />
      <View style={styles.cinematicBottom} />
    </View>
  );
}

export function BuklodGameEntrance({ children }: { children: React.ReactNode }) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(value, {
      toValue: 1,
      damping: 18,
      stiffness: 135,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  }, [value]);

  return (
    <Animated.View
      style={[
        styles.entrance,
        {
          opacity: value,
          transform: [
            { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
            { scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  entrance: { flex: 1 },
  hazeA: { position: 'absolute', width: 360, height: 360, borderRadius: 180, top: -130, left: -110 },
  hazeB: { position: 'absolute', width: 420, height: 420, borderRadius: 210, bottom: -190, right: -150 },
  lightBeam: { position: 'absolute', width: 120, height: '125%', top: '-10%', left: '52%', borderRadius: 60 },
  particle: { position: 'absolute', shadowColor: '#ffffff', shadowOpacity: 0.55, shadowRadius: 6 },
  cinematicTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  cinematicBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
});
