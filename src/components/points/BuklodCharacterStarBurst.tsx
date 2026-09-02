import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import {
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';

import { useBuklodReduceMotion } from '@/components/HomeMotion';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';

const STAR_COUNT = 10;
const POOL_SIZE = 14;

type StarSpec = {
  id: number;
  x: number;
  y: number;
  size: number;
  rotation: number;
  delay: number;
};

type Props = {
  active: boolean;
  /** Center offset from parent center. */
  centerY?: number;
  onComplete?: () => void;
};

function buildStars(): StarSpec[] {
  return Array.from({ length: STAR_COUNT }).map(
    (_, index) => ({
      id: index,
      x: (Math.random() - 0.5) * 160,
      y: -(30 + Math.random() * 100),
      size: 7 + Math.random() * 9,
      rotation: Math.random() * 360,
      delay: index * 30,
    })
  );
}

/** Pooled star particles — opacity / scale / translate / rotation burst. */
export default function BuklodCharacterStarBurst({
  active,
  centerY = 0,
  onComplete,
}: Props) {
  const { theme } = useBuklodPresentation();
  const reduceMotion = useBuklodReduceMotion();
  const stars = useMemo(
    () => (active ? buildStars() : []),
    [active]
  );

  const pool = useRef(
    Array.from({ length: POOL_SIZE }).map(() => ({
      opacity: new Animated.Value(0),
      translateX: new Animated.Value(0),
      translateY: new Animated.Value(0),
      scale: new Animated.Value(0.3),
      rotate: new Animated.Value(0),
    }))
  ).current;

  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const runBurst = useCallback(() => {
    if (reduceMotion) {
      onComplete?.();
      return;
    }

    overlayOpacity.setValue(1);

    pool.forEach((star) => {
      star.opacity.setValue(0);
      star.translateX.setValue(0);
      star.translateY.setValue(0);
      star.scale.setValue(0.3);
      star.rotate.setValue(0);
    });

    const animations = stars.map((spec, index) => {
      const slot = pool[index % POOL_SIZE];

      return Animated.sequence([
        Animated.delay(spec.delay),
        Animated.parallel([
          Animated.timing(slot.opacity, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(slot.scale, {
            toValue: 1.15,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(slot.translateX, {
            toValue: spec.x,
            duration: 750,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(slot.translateY, {
            toValue: spec.y,
            duration: 750,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(slot.rotate, {
            toValue: spec.rotation,
            duration: 750,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(slot.opacity, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]);
    });

    Animated.parallel(animations).start();

    const timer = setTimeout(() => {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          onComplete?.();
        }
      });
    }, 850);

    return () => clearTimeout(timer);
  }, [onComplete, overlayOpacity, pool, reduceMotion, stars]);

  useEffect(() => {
    if (!active) {
      return;
    }

    const cleanup = runBurst();
    return cleanup;
  }, [active, runBurst]);

  if (!active) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.overlay,
        { opacity: overlayOpacity, top: centerY },
      ]}
    >
      <View style={styles.burst}>
        {stars.map((spec, index) => {
          const slot = pool[index % POOL_SIZE];
          const spin = slot.rotate.interpolate({
            inputRange: [0, 360],
            outputRange: ['0deg', '360deg'],
          });

          return (
            <Animated.View
              key={spec.id}
              style={[
                styles.star,
                {
                  width: spec.size,
                  height: spec.size,
                  backgroundColor: theme.warning,
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  burst: {
    width: 200,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  star: {
    position: 'absolute',
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
});
