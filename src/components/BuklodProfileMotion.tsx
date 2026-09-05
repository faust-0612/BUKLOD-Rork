import React, {
  useCallback,
  useRef,
} from 'react';

import { useFocusEffect } from 'expo-router';

import {
  Animated,
  Easing,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import BuklodPressable from '@/components/BuklodPressable';
import {
  BuklodFocusAvatar,
  BuklodFocusFadeUp,
  useBuklodReduceMotion,
} from '@/components/HomeMotion';
import { useFacultyEntitlement } from '@/hooks/useFacultyEntitlement';

const FOCUS_EASING = Easing.out(Easing.cubic);

export function ProfileMotionCover({
  active,
  children,
  style,
}: {
  active: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useBuklodReduceMotion();
  const opacity = useRef(
    new Animated.Value(1)
  ).current;

  useFocusEffect(
    useCallback(() => {
      if (!active || reduceMotion) {
        opacity.setValue(1);
        return;
      }

      opacity.setValue(0.85);

      const motion = Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: FOCUS_EASING,
        useNativeDriver: true,
      });

      motion.start();

      return () => {
        motion.stop();
        opacity.setValue(1);
      };
    }, [active, opacity, reduceMotion])
  );

  return (
    <Animated.View
      pointerEvents="none"
      collapsable={false}
      style={[{ opacity }, style]}
    >
      {children}
    </Animated.View>
  );
}

export function ProfileMotionAvatar({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <BuklodFocusAvatar style={style}>
      {children}
    </BuklodFocusAvatar>
  );
}

export function ProfileMotionFadeUp({
  delay = 0,
  duration = 240,
  fromY = 10,
  fromOpacity = 0,
  children,
  style,
}: {
  delay?: number;
  duration?: number;
  fromY?: number;
  fromOpacity?: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <BuklodFocusFadeUp
      delay={delay}
      duration={duration}
      fromY={fromY}
      fromOpacity={fromOpacity}
      style={style}
    >
      {children}
    </BuklodFocusFadeUp>
  );
}

type ProfilePressableProps = PressableProps & {
  children: React.ReactNode;
  wrapStyle?: StyleProp<ViewStyle>;
};

function nodeContainsText(node: React.ReactNode, target: string): boolean {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node).trim() === target;
  }

  if (Array.isArray(node)) {
    return node.some(child => nodeContainsText(child, target));
  }

  if (React.isValidElement(node)) {
    return nodeContainsText((node.props as { children?: React.ReactNode }).children, target);
  }

  return false;
}

function ProfilePressableBase({
  onPressIn,
  onPressOut,
  style,
  wrapStyle,
  children,
  ...rest
}: ProfilePressableProps) {
  const reduceMotion = useBuklodReduceMotion();
  const scale = useRef(
    new Animated.Value(1)
  ).current;

  const pressTo = (
    value: number,
    duration: number
  ) => {
    if (reduceMotion) {
      return;
    }

    Animated.timing(scale, {
      toValue: value,
      duration,
      easing: FOCUS_EASING,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      collapsable={false}
      style={[{ transform: [{ scale }] }, wrapStyle]}
    >
      <BuklodPressable
        {...rest}
        onPressIn={(event) => {
          pressTo(0.97, 70);
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          pressTo(1, 145);
          onPressOut?.(event);
        }}
        style={style}
      >
        {children}
      </BuklodPressable>
    </Animated.View>
  );
}

function ClassroomLauncherProfilePressable(props: ProfilePressableProps) {
  const { show_launcher: showLauncher, loading } = useFacultyEntitlement();

  if (loading || !showLauncher) {
    return null;
  }

  return <ProfilePressableBase {...props} />;
}

export function ProfilePressable(props: ProfilePressableProps) {
  /* BUKLOD_CLASSROOM_LAUNCHER_GATE_R2
   * The legacy Profile quick-action list still owns the visual placement of
   * “My Classrooms”. Gate only that compatibility door here so ordinary users
   * never see it while avoiding a risky rewrite of the large Profile screen.
   * Classroom itself remains authorized server-side as well.
   */
  if (nodeContainsText(props.children, 'My Classrooms')) {
    return <ClassroomLauncherProfilePressable {...props} />;
  }

  return <ProfilePressableBase {...props} />;
}
