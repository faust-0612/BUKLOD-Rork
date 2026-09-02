import React, { useEffect, useMemo, useRef } from 'react';

import {
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';

import { useBuklodReduceMotion } from '@/components/HomeMotion';
import { MOTION } from '@/lib/character-lab-core/motion';
import {
  makeBurst,
  type ParticleSpec,
  type ParticleTone,
} from '@/lib/character-lab-core/particles';

const TONE_COLORS: Record<ParticleTone, string> = {
  gold: '#F5C651',
  star: '#FFF3D0',
  mint: '#58A87C',
  teal: '#5FC8CE',
};

type Props = {
  active: boolean;
  particleCount?: number;
  seed?: number;
  spread?: number;
  onComplete?: () => void;
};

/** Deterministic star/particle burst from Rork particle specs. */
export default function BuklodCharacterCelebrationLayer({
  active,
  particleCount = 12,
  seed = 1,
  spread = 118,
  onComplete,
}: Props) {
  const reduceMotion = useBuklodReduceMotion();
  const specs = useMemo<readonly ParticleSpec[]>(
    () =>
      active
        ? makeBurst({ count: particleCount, seed, spread, upwardBias: 0.5 })
        : [],
    [active, particleCount, seed, spread]
  );

  const pool = useRef(
    Array.from({ length: 24 }).map(() => ({
      opacity: new Animated.Value(0),
      translateX: new Animated.Value(0),
      translateY: new Animated.Value(0),
      scale: new Animated.Value(0.4),
      rotate: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (!active || reduceMotion || specs.length === 0) {
      onComplete?.();
      return;
    }

    const animations = specs.map((spec, index) => {
      const slot = pool[index % pool.length];
      const rad = (spec.angleDeg * Math.PI) / 180;
      const targetX = Math.sin(rad) * spec.distance + spec.drift;
      const targetY = -Math.cos(rad) * spec.distance - spec.lift;

      slot.opacity.setValue(0);
      slot.translateX.setValue(0);
      slot.translateY.setValue(0);
      slot.scale.setValue(0.4);
      slot.rotate.setValue(0);

      return Animated.sequence([
        Animated.delay(spec.delayMs + MOTION.claim.burstDelayMs),
        Animated.parallel([
          Animated.timing(slot.opacity, {
            toValue: 1,
            duration: 120,
            useNativeDriver: true,
          }),
          Animated.timing(slot.scale, {
            toValue: 1,
            duration: spec.durationMs * 0.35,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(slot.translateX, {
            toValue: targetX,
            duration: spec.durationMs,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(slot.translateY, {
            toValue: targetY,
            duration: spec.durationMs,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(slot.rotate, {
            toValue: spec.spinDeg,
            duration: spec.durationMs,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(slot.opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]);
    });

    Animated.parallel(animations).start();
    const timer = setTimeout(() => onComplete?.(), 920);
    return () => clearTimeout(timer);
  }, [active, onComplete, pool, reduceMotion, specs]);

  if (!active || reduceMotion) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.overlay}>
      {specs.map((spec, index) => {
        const slot = pool[index % pool.length];
        const spin = slot.rotate.interpolate({
          inputRange: [-360, 360],
          outputRange: ['-360deg', '360deg'],
        });

        return (
          <Animated.View
            key={spec.id}
            style={[
              styles.particle,
              {
                width: spec.size,
                height: spec.size,
                backgroundColor: TONE_COLORS[spec.tone],
                opacity: slot.opacity,
                transform: [
                  { translateX: slot.translateX },
                  { translateY: slot.translateY },
                  { scale: slot.scale },
                  { rotate: spin },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
  },
  particle: {
    position: 'absolute',
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
});
