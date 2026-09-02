import React, {
  useCallback,
  useEffect,
  useRef,
} from 'react';

import { useFocusEffect } from 'expo-router';

import {
  Animated,
  Easing,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useBuklodReduceMotion } from '@/components/HomeMotion';

const FOCUS_EASING = Easing.out(Easing.cubic);

/** Environment backdrop — opacity 0 → 1, 240ms on tab focus. */
export function PointsFocusEnvironment({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useBuklodReduceMotion();
  const opacity = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    useCallback(() => {
      if (reduceMotion) {
        opacity.setValue(1);
        return;
      }

      opacity.setValue(0);

      const motion = Animated.timing(opacity, {
        toValue: 1,
        duration: 240,
        easing: FOCUS_EASING,
        useNativeDriver: true,
      });

      const frame = requestAnimationFrame(() => {
        motion.start();
      });

      return () => {
        cancelAnimationFrame(frame);
        motion.stop();
        opacity.setValue(1);
      };
    }, [opacity, reduceMotion])
  );

  return (
    <Animated.View
      collapsable={false}
      style={[{ opacity }, style]}
    >
      {children}
    </Animated.View>
  );
}

/** Character entrance — opacity 0.4→1, scale 0.88→1, Y 16→0, 320ms. */
export function PointsFocusCharacter({
  children,
  style,
  animate = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  animate?: boolean;
}) {
  const reduceMotion = useBuklodReduceMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      if (!animate || reduceMotion) {
        opacity.setValue(1);
        scale.setValue(1);
        translateY.setValue(0);
        return;
      }

      opacity.setValue(0.4);
      scale.setValue(0.88);
      translateY.setValue(16);

      const motion = Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 320,
          easing: FOCUS_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 320,
          easing: FOCUS_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 320,
          easing: FOCUS_EASING,
          useNativeDriver: true,
        }),
      ]);

      const frame = requestAnimationFrame(() => {
        motion.start();
      });

      return () => {
        cancelAnimationFrame(frame);
        motion.stop();
        opacity.setValue(1);
        scale.setValue(1);
        translateY.setValue(0);
      };
    }, [animate, opacity, reduceMotion, scale, translateY])
  );

  return (
    <Animated.View
      collapsable={false}
      style={[
        {
          opacity,
          transform: [{ scale }, { translateY }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** HUD / progress — opacity 0→1, Y 10→0 (220–240ms). */
export function PointsFocusFadeUp({
  delay = 0,
  duration = 220,
  children,
  style,
}: {
  delay?: number;
  duration?: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useBuklodReduceMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      if (reduceMotion) {
        opacity.setValue(1);
        translateY.setValue(0);
        return;
      }

      opacity.setValue(0);
      translateY.setValue(10);

      const motion = Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration,
          delay,
          easing: FOCUS_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration,
          delay,
          easing: FOCUS_EASING,
          useNativeDriver: true,
        }),
      ]);

      const frame = requestAnimationFrame(() => {
        motion.start();
      });

      return () => {
        cancelAnimationFrame(frame);
        motion.stop();
        opacity.setValue(1);
        translateY.setValue(0);
      };
    }, [delay, duration, opacity, reduceMotion, translateY])
  );

  return (
    <Animated.View
      collapsable={false}
      style={[
        {
          opacity,
          transform: [{ translateY }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Staggered card entrance — 40ms steps, Y 12→0, 220ms. */
export function PointsFocusCard({
  index,
  children,
  style,
}: {
  index: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <PointsFocusFadeUp
      delay={index * 40}
      duration={220}
      style={style}
    >
      {children}
    </PointsFocusFadeUp>
  );
}

/** Pauses looping animation when screen loses focus. */
export function usePointsScreenFocused() {
  const focusedRef = useRef(true);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;

      return () => {
        focusedRef.current = false;
      };
    }, [])
  );

  return focusedRef;
}

/** Idle breathing — scaleY + translateY, 2200–3000ms, low amplitude. */
export function useCharacterBreathing(
  reduceMotion: boolean
) {
  const breathScaleY = useRef(new Animated.Value(1)).current;
  const breathY = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(
    null
  );

  useFocusEffect(
    useCallback(() => {
      if (reduceMotion) {
        breathScaleY.setValue(1);
        breathY.setValue(0);
        return;
      }

      const duration =
        2200 + Math.floor(Math.random() * 800);

      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(breathScaleY, {
              toValue: 1.018,
              duration: duration / 2,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(breathY, {
              toValue: -2,
              duration: duration / 2,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(breathScaleY, {
              toValue: 1,
              duration: duration / 2,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(breathY, {
              toValue: 0,
              duration: duration / 2,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ])
      );

      loopRef.current.start();

      return () => {
        loopRef.current?.stop();
        breathScaleY.setValue(1);
        breathY.setValue(0);
      };
    }, [breathScaleY, breathY, reduceMotion])
  );

  return { breathScaleY, breathY };
}

/** Happy reaction after successful claim — 500–700ms. */
export function useCharacterHappyReaction(
  reduceMotion: boolean
) {
  const happyScale = useRef(new Animated.Value(1)).current;

  const triggerHappy = useCallback(() => {
    if (reduceMotion) {
      return;
    }

    happyScale.setValue(1);

    Animated.sequence([
      Animated.timing(happyScale, {
        toValue: 1.08,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(happyScale, {
        toValue: 1,
        duration: 420,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [happyScale, reduceMotion]);

  return { happyScale, triggerHappy };
}

/** Irregular blink — eyelid scaleY 0→1, 110–160ms. */
export function useCharacterBlink(reduceMotion: boolean) {
  const lidScale = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const scheduleBlink = useCallback(() => {
    if (reduceMotion) {
      return;
    }

    const delay = 2200 + Math.floor(Math.random() * 3800);

    timerRef.current = setTimeout(() => {
      const duration = 110 + Math.floor(Math.random() * 50);

      Animated.sequence([
        Animated.timing(lidScale, {
          toValue: 1,
          duration: duration / 2,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(lidScale, {
          toValue: 0,
          duration: duration / 2,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        scheduleBlink();
      });
    }, delay);
  }, [lidScale, reduceMotion]);

  useFocusEffect(
    useCallback(() => {
      if (reduceMotion) {
        lidScale.setValue(0);
        return;
      }

      scheduleBlink();

      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        lidScale.setValue(0);
      };
    }, [lidScale, reduceMotion, scheduleBlink])
  );

  return lidScale;
}

/** Occasional weight shift — low-amplitude rotate + translateX. */
export function useCharacterSway(reduceMotion: boolean) {
  const swayX = useRef(new Animated.Value(0)).current;
  const swayRotate = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const scheduleSway = useCallback(() => {
    if (reduceMotion) {
      return;
    }

    const delay = 4000 + Math.floor(Math.random() * 5000);
    const direction = Math.random() > 0.5 ? 1 : -1;

    timerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.sequence([
          Animated.timing(swayX, {
            toValue: direction * 2.5,
            duration: 600,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(swayX, {
            toValue: 0,
            duration: 700,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(swayRotate, {
            toValue: direction * 1.8,
            duration: 600,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(swayRotate, {
            toValue: 0,
            duration: 700,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        scheduleSway();
      });
    }, delay);
  }, [reduceMotion, swayRotate, swayX]);

  useFocusEffect(
    useCallback(() => {
      if (reduceMotion) {
        swayX.setValue(0);
        swayRotate.setValue(0);
        return;
      }

      scheduleSway();

      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        swayX.setValue(0);
        swayRotate.setValue(0);
      };
    }, [reduceMotion, scheduleSway, swayRotate, swayX])
  );

  const rotateStr = swayRotate.interpolate({
    inputRange: [-3, 3],
    outputRange: ['-3deg', '3deg'],
  });

  return { swayX, rotateStr };
}

/** Celebration hop — 600–900ms bounce for dev proof / claim reuse. */
export function useCharacterCelebration(
  reduceMotion: boolean
) {
  const hopY = useRef(new Animated.Value(0)).current;
  const hopScale = useRef(new Animated.Value(1)).current;
  const celebrating = useRef(false);

  const triggerCelebration = useCallback(() => {
    if (reduceMotion || celebrating.current) {
      return;
    }

    celebrating.current = true;
    hopY.setValue(0);
    hopScale.setValue(1);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(hopY, {
          toValue: -18,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(hopScale, {
          toValue: 1.06,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(hopY, {
          toValue: -6,
          duration: 180,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(hopScale, {
          toValue: 1.03,
          duration: 180,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(hopY, {
          toValue: 0,
          duration: 320,
          easing: Easing.in(Easing.bounce),
          useNativeDriver: true,
        }),
        Animated.timing(hopScale, {
          toValue: 1,
          duration: 320,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      celebrating.current = false;
    });
  }, [hopScale, hopY, reduceMotion]);

  return { hopY, hopScale, triggerCelebration };
}

/** Count-up display value over ~500ms. */
export function useCountUpValue(
  target: number,
  duration = 500
) {
  const reduceMotion = useBuklodReduceMotion();
  const animated = useRef(new Animated.Value(target)).current;
  const previous = useRef(target);
  const [display, setDisplay] = React.useState(target);

  useEffect(() => {
    if (reduceMotion) {
      animated.setValue(target);
      previous.current = target;
      setDisplay(target);
      return;
    }

    animated.setValue(previous.current);

    const listenerId = animated.addListener(
      ({ value }) => {
        setDisplay(Math.round(value));
      }
    );

    Animated.timing(animated, {
      toValue: target,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        previous.current = target;
        setDisplay(target);
      }
    });

    return () => {
      animated.removeListener(listenerId);
    };
  }, [animated, duration, reduceMotion, target]);

  return display;
}

/** Glowing claim button loop — scale 1→1.025→1, glow 0.28→0.55→0.28, 1900ms. */
export function useClaimButtonGlow(
  active: boolean,
  reduceMotion: boolean
) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.28)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(
    null
  );

  useFocusEffect(
    useCallback(() => {
      loopRef.current?.stop();

      if (!active || reduceMotion) {
        scale.setValue(1);
        glow.setValue(0.28);
        return;
      }

      loopRef.current = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(scale, {
              toValue: 1.025,
              duration: 950,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 1,
              duration: 950,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(glow, {
              toValue: 0.55,
              duration: 950,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(glow, {
              toValue: 0.28,
              duration: 950,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
        ])
      );

      loopRef.current.start();

      return () => {
        loopRef.current?.stop();
        scale.setValue(1);
        glow.setValue(0.28);
      };
    }, [active, glow, reduceMotion, scale])
  );

  return { scale, glow };
}
