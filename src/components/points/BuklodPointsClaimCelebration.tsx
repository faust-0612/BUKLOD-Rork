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
  Text,
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
  points?: number | null;
  onComplete?: () => void;
};

function buildStars(): StarSpec[] {
  return Array.from({ length: STAR_COUNT }).map(
    (_, index) => ({
      id: index,
      x: (Math.random() - 0.5) * 180,
      y: -(40 + Math.random() * 90),
      size: 6 + Math.random() * 8,
      rotation: Math.random() * 360,
      delay: index * 35,
    })
  );
}

/** Inline celebration — stars burst + flying points. No modal auto-popup. */
export default function BuklodPointsClaimCelebration({
  active,
  points,
  onComplete,
}: Props) {
  const { theme } = useBuklodPresentation();
  const reduceMotion = useBuklodReduceMotion();
  const stars = useMemo(() => buildStars(), [active]);
  const pool = useRef(
    Array.from({ length: POOL_SIZE }).map(
      () => ({
        opacity: new Animated.Value(0),
        translateX: new Animated.Value(0),
        translateY: new Animated.Value(0),
        scale: new Animated.Value(0.4),
        rotate: new Animated.Value(0),
      })
    )
  ).current;

  const flyOpacity = useRef(new Animated.Value(0)).current;
  const flyY = useRef(new Animated.Value(24)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const runCelebration = useCallback(() => {
    if (reduceMotion) {
      overlayOpacity.setValue(0);
      onComplete?.();
      return;
    }

    overlayOpacity.setValue(1);
    flyOpacity.setValue(0);
    flyY.setValue(24);

    pool.forEach((star) => {
      star.opacity.setValue(0);
      star.translateX.setValue(0);
      star.translateY.setValue(0);
      star.scale.setValue(0.4);
      star.rotate.setValue(0);
    });

    const starAnimations = stars.map((spec, index) => {
      const slot = pool[index % POOL_SIZE];

      return Animated.sequence([
        Animated.delay(spec.delay),
        Animated.parallel([
          Animated.timing(slot.opacity, {
            toValue: 1,
            duration: 120,
            useNativeDriver: true,
          }),
          Animated.timing(slot.scale, {
            toValue: 1,
            duration: 280,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(slot.translateX, {
            toValue: spec.x,
            duration: 720,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(slot.translateY, {
            toValue: spec.y,
            duration: 720,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(slot.rotate, {
            toValue: spec.rotation,
            duration: 720,
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

    const fly = Animated.parallel([
      Animated.timing(flyOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(flyY, {
        toValue: -72,
        duration: 680,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    Animated.parallel([
      Animated.stagger(20, starAnimations),
      Animated.sequence([
        Animated.delay(120),
        fly,
        Animated.timing(flyOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          onComplete?.();
        }
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    flyOpacity,
    flyY,
    onComplete,
    overlayOpacity,
    pool,
    reduceMotion,
    stars,
  ]);

  useEffect(() => {
    if (!active) {
      return;
    }

    const cleanup = runCelebration();
    return cleanup;
  }, [active, runCelebration]);

  if (!active) {
    return null;
  }

  const styles = StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 20,
    },
    burst: {
      width: 220,
      height: 160,
      alignItems: 'center',
      justifyContent: 'center',
    },
    star: {
      position: 'absolute',
      backgroundColor: theme.warning,
      transform: [{ rotate: '45deg' }],
    },
    flyPoints: {
      position: 'absolute',
      top: '38%',
      fontSize: 22,
      fontWeight: '900',
      color: theme.warning,
    },
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.overlay, { opacity: overlayOpacity }]}
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
                  borderRadius: 2,
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

        {Number(points ?? 0) > 0 && (
          <Animated.Text
            style={[
              styles.flyPoints,
              {
                opacity: flyOpacity,
                transform: [{ translateY: flyY }],
              },
            ]}
          >
            +◉ {Number(points).toLocaleString('en-PH')}
          </Animated.Text>
        )}
      </View>
    </Animated.View>
  );
}
