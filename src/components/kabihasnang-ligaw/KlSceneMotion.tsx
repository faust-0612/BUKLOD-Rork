import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import type { LivingLayerKind } from '@/lib/kabihasnang-ligaw/types';

type Props = {
  animate: boolean;
  layers: LivingLayerKind[];
};

/** Subtle motion for an already-visible scene. Rain is never drawn. No characters. */
export default function KlSceneMotion({ animate, layers }: Props) {
  const drift = useRef(new Animated.Value(0)).current;
  const allowed = layers.filter((layer) => layer !== 'rain');
  const running = animate && allowed.length > 0;

  useEffect(() => {
    if (!running) {
      drift.stopAnimation();
      drift.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(drift, {
        toValue: 1,
        duration: 4200,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [drift, running]);

  if (!running) return null;

  return (
    <View pointerEvents="none" style={styles.overlay} accessibilityElementsHidden>
      {allowed.includes('wind_foliage') ? <Animated.View style={[styles.leaf, { opacity: drift }]} /> : null}
      {allowed.includes('dust') ? (
        <Animated.View
          style={[styles.dust, { transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) }] }]}
        />
      ) : null}
      {allowed.includes('magical_glow') ? <Animated.View style={[styles.glow, { opacity: drift }]} /> : null}
      {allowed.includes('water_ripples') ? <Animated.View style={[styles.ripple, { opacity: drift }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { height: 18, marginTop: 4, overflow: 'hidden' },
  leaf: { width: 14, height: 3, borderRadius: 2, backgroundColor: '#6f8f78' },
  dust: { width: 3, height: 3, borderRadius: 3, backgroundColor: '#d9d2c5', marginTop: 6 },
  glow: { height: 8, borderRadius: 8, backgroundColor: '#9dbea4', marginTop: 4 },
  ripple: { height: 2, marginTop: 8, backgroundColor: '#8fb4c4' },
});
