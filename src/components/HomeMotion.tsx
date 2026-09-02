import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useFocusEffect } from 'expo-router';

import {
  AccessibilityInfo,
  Animated,
  Easing,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import BuklodPressable from '@/components/BuklodPressable';
import * as Haptics from 'expo-haptics';

const FOCUS_EASING = Easing.out(Easing.cubic);

export function useBuklodReduceMotion() {
  const [reduceMotion, setReduceMotion] =
    useState(false);

  useEffect(() => {
    let active = true;

    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) {
          setReduceMotion(Boolean(enabled));
        }
      })
      .catch(() => undefined);

    const subscription =
      AccessibilityInfo.addEventListener(
        'reduceMotionChanged',
        (enabled) => {
          if (active) {
            setReduceMotion(Boolean(enabled));
          }
        }
      );

    return () => {
      active = false;
      subscription?.remove?.();
    };
  }, []);

  return reduceMotion;
}

/**
 * Replays whenever this screen becomes the active tab.
 * Persistent Expo Router tabs stay mounted, so mount-only
 * useEffect cannot drive visible entrance motion.
 *
 * Default: no focus replay — instant tab switches.
 * Set replayOnFocus=true only where entrance motion is desired.
 */
export function BuklodFocusFadeUp({
  delay = 0,
  duration = 240,
  fromY = 10,
  fromOpacity = 0.78,
  replayOnFocus = false,
  children,
  style,
}: {
  delay?: number;
  duration?: number;
  fromY?: number;
  fromOpacity?: number;
  replayOnFocus?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useBuklodReduceMotion();
  const opacity = useRef(
    new Animated.Value(1)
  ).current;
  const translateY = useRef(
    new Animated.Value(0)
  ).current;

  useFocusEffect(
    useCallback(() => {
      if (!replayOnFocus || reduceMotion) {
        opacity.setValue(1);
        translateY.setValue(0);
        return;
      }

      opacity.setValue(fromOpacity);
      translateY.setValue(fromY);

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
    }, [
      delay,
      duration,
      fromOpacity,
      fromY,
      opacity,
      reduceMotion,
      replayOnFocus,
      translateY,
    ])
  );

  if (!replayOnFocus) {
    return (
      <View style={style}>
        {children}
      </View>
    );
  }

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

export function BuklodFocusScaleIn({
  delay = 0,
  duration = 270,
  fromOpacity = 0.68,
  fromScale = 0.95,
  replayOnFocus = false,
  children,
  style,
}: {
  delay?: number;
  duration?: number;
  fromOpacity?: number;
  fromScale?: number;
  replayOnFocus?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useBuklodReduceMotion();
  const opacity = useRef(
    new Animated.Value(1)
  ).current;
  const scale = useRef(
    new Animated.Value(1)
  ).current;

  useFocusEffect(
    useCallback(() => {
      if (!replayOnFocus || reduceMotion) {
        opacity.setValue(1);
        scale.setValue(1);
        return;
      }

      opacity.setValue(fromOpacity);
      scale.setValue(fromScale);

      const motion = Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration,
          delay,
          easing: FOCUS_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
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
        scale.setValue(1);
      };
    }, [
      delay,
      duration,
      fromOpacity,
      fromScale,
      opacity,
      reduceMotion,
      replayOnFocus,
      scale,
    ])
  );

  if (!replayOnFocus) {
    return (
      <View style={style}>
        {children}
      </View>
    );
  }

  return (
    <Animated.View
      collapsable={false}
      style={[
        {
          opacity,
          transform: [{ scale }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function BuklodFocusAvatar({
  replayOnFocus = false,
  children,
  style,
}: {
  replayOnFocus?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useBuklodReduceMotion();
  const opacity = useRef(
    new Animated.Value(1)
  ).current;
  const scale = useRef(
    new Animated.Value(1)
  ).current;
  const translateY = useRef(
    new Animated.Value(0)
  ).current;

  useFocusEffect(
    useCallback(() => {
      if (!replayOnFocus || reduceMotion) {
        opacity.setValue(1);
        scale.setValue(1);
        translateY.setValue(0);
        return;
      }

      opacity.setValue(0.65);
      scale.setValue(0.92);
      translateY.setValue(10);

      const motion = Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 280,
          easing: FOCUS_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 280,
          easing: FOCUS_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 280,
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
    }, [opacity, reduceMotion, replayOnFocus, scale, translateY])
  );

  if (!replayOnFocus) {
    return (
      <View style={style}>
        {children}
      </View>
    );
  }

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

const FIRST_VISIBLE_ROWS = 6;

export function BuklodFocusVisibleRow({
  index,
  children,
}: {
  index: number;
  children: React.ReactNode;
}) {
  if (index >= FIRST_VISIBLE_ROWS) {
    return <>{children}</>;
  }

  return (
    <BuklodFocusFadeUp
      delay={index * 35}
      duration={240}
      fromY={10}
      fromOpacity={0.78}
    >
      {children}
    </BuklodFocusFadeUp>
  );
}

/**
 * Tab-focus entrance for Home sections.
 * Opacity 0.75 → 1, translateY 10 → 0, ~260ms ease-out.
 */
export function HomeMotionSection({
  delay = 0,
  children,
  style,
}: {
  delay?: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <BuklodFocusFadeUp
      delay={delay}
      duration={260}
      fromY={10}
      fromOpacity={0.75}
      style={style}
    >
      {children}
    </BuklodFocusFadeUp>
  );
}

type HomePressableProps = PressableProps & {
  haptic?: boolean;
  wrapStyle?: StyleProp<ViewStyle>;
};

export function HomePressable({
  haptic = true,
  onPress,
  onPressIn,
  onPressOut,
  style,
  wrapStyle,
  children,
  ...rest
}: HomePressableProps) {
  const reduceMotion = useBuklodReduceMotion();

  return (
    <View style={wrapStyle}>
      <BuklodPressable
        {...rest}
        instant={false}
        onPress={(event) => {
          if (haptic && !reduceMotion) {
            void Haptics.selectionAsync().catch(
              () => undefined
            );
          }

          onPress?.(event);
        }}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={style}
      >
        {children}
      </BuklodPressable>
    </View>
  );
}
