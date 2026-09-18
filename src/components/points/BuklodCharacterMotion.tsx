import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

export type BuklodCharacterReaction =
  | 'hello'
  | 'celebrate'
  | 'nod'
  | 'left'
  | 'right'
  | 'move'
  | 'collect'
  | 'impact'
  | 'success'
  | 'failure'
  | 'unlock';

export type BuklodCharacterReactionSignal = {
  id: number;
  type: BuklodCharacterReaction;
};

type Props = {
  children: React.ReactNode;
  interactive?: boolean;
  reaction?: BuklodCharacterReactionSignal | null;
  accessibilityLabel?: string;
  mode?: 'home' | 'game';
  style?: any;
};

export default function BuklodCharacterMotion({
  children,
  interactive = false,
  reaction = null,
  accessibilityLabel = 'BUKLOD Character',
  mode = 'home',
  style,
}: Props) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const entry = useRef(new Animated.Value(0)).current;
  const idle = useRef(new Animated.Value(0)).current;
  const x = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const lastTapRef = useRef(0);
  const reactionRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(Boolean(enabled));
    }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (enabled) => {
      if (mounted) setReduceMotion(Boolean(enabled));
    });
    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      entry.setValue(1);
      return;
    }
    Animated.spring(entry, {
      toValue: 1,
      damping: 18,
      stiffness: 150,
      mass: 0.78,
      useNativeDriver: true,
    }).start();
  }, [entry, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) {
      idle.stopAnimation();
      idle.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(idle, {
          toValue: 1,
          duration: mode === 'game' ? 1250 : 1900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(idle, {
          toValue: 0,
          duration: mode === 'game' ? 1250 : 1900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [idle, mode, reduceMotion]);

  const resetPose = useCallback((duration = 180) => {
    return Animated.parallel([
      Animated.timing(x, { toValue: 0, duration, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(rotate, { toValue: 0, duration, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]);
  }, [rotate, scale, x, y]);

  const runReaction = useCallback((type: BuklodCharacterReaction) => {
    reactionRef.current?.stop();
    if (reduceMotion) {
      if (type === 'left') x.setValue(-4);
      else if (type === 'right') x.setValue(4);
      else if (type === 'impact' || type === 'failure') rotate.setValue(-2);
      else if (type === 'celebrate' || type === 'success' || type === 'unlock') scale.setValue(1.03);
      resetPose(120).start();
      return;
    }

    x.setValue(0);
    y.setValue(0);
    scale.setValue(1);
    rotate.setValue(0);

    let animation: Animated.CompositeAnimation;

    switch (type) {
      case 'celebrate':
      case 'success':
      case 'unlock':
        animation = Animated.sequence([
          Animated.parallel([
            Animated.spring(y, { toValue: -15, damping: 8, stiffness: 210, mass: 0.58, useNativeDriver: true }),
            Animated.spring(scale, { toValue: 1.10, damping: 8, stiffness: 210, mass: 0.58, useNativeDriver: true }),
            Animated.timing(rotate, { toValue: type === 'unlock' ? 5 : -4, duration: 150, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(rotate, { toValue: type === 'unlock' ? -5 : 4, duration: 130, useNativeDriver: true }),
            Animated.timing(y, { toValue: -5, duration: 130, useNativeDriver: true }),
          ]),
          resetPose(230),
        ]);
        break;
      case 'hello':
        animation = Animated.sequence([
          Animated.parallel([
            Animated.timing(rotate, { toValue: -7, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(y, { toValue: -5, duration: 140, useNativeDriver: true }),
          ]),
          Animated.timing(rotate, { toValue: 7, duration: 170, useNativeDriver: true }),
          Animated.timing(rotate, { toValue: -4, duration: 130, useNativeDriver: true }),
          resetPose(180),
        ]);
        break;
      case 'nod':
        animation = Animated.sequence([
          Animated.timing(y, { toValue: 5, duration: 120, useNativeDriver: true }),
          Animated.timing(y, { toValue: -2, duration: 120, useNativeDriver: true }),
          Animated.timing(y, { toValue: 4, duration: 110, useNativeDriver: true }),
          resetPose(170),
        ]);
        break;
      case 'left':
      case 'right': {
        const direction = type === 'left' ? -1 : 1;
        animation = Animated.sequence([
          Animated.parallel([
            Animated.spring(x, { toValue: direction * 13, damping: 12, stiffness: 220, useNativeDriver: true }),
            Animated.spring(rotate, { toValue: direction * 6, damping: 12, stiffness: 220, useNativeDriver: true }),
          ]),
          resetPose(210),
        ]);
        break;
      }
      case 'move':
      case 'collect':
        animation = Animated.sequence([
          Animated.parallel([
            Animated.timing(y, { toValue: type === 'collect' ? -9 : -5, duration: 100, useNativeDriver: true }),
            Animated.timing(scale, { toValue: type === 'collect' ? 1.07 : 1.035, duration: 100, useNativeDriver: true }),
          ]),
          resetPose(150),
        ]);
        break;
      case 'impact':
      case 'failure':
        animation = Animated.sequence([
          Animated.parallel([
            Animated.timing(x, { toValue: -8, duration: 65, useNativeDriver: true }),
            Animated.timing(rotate, { toValue: -5, duration: 65, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(x, { toValue: 8, duration: 70, useNativeDriver: true }),
            Animated.timing(rotate, { toValue: 5, duration: 70, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(x, { toValue: -5, duration: 60, useNativeDriver: true }),
            Animated.timing(rotate, { toValue: -3, duration: 60, useNativeDriver: true }),
          ]),
          resetPose(170),
        ]);
        break;
      default:
        animation = resetPose(150);
    }

    reactionRef.current = animation;
    animation.start(() => {
      if (reactionRef.current === animation) reactionRef.current = null;
    });
  }, [reduceMotion, resetPose, rotate, scale, x, y]);

  useEffect(() => {
    if (reaction) runReaction(reaction.type);
  }, [reaction, runReaction]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) =>
      interactive &&
      Math.abs(gesture.dx) > 12 &&
      Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderRelease: (_, gesture) => {
      if (!interactive) return;
      if (gesture.dx <= -30) runReaction('left');
      else if (gesture.dx >= 30) runReaction('right');
    },
    onPanResponderTerminate: () => resetPose(140).start(),
  }), [interactive, resetPose, runReaction]);

  const handlePress = useCallback(() => {
    const now = Date.now();
    const isDouble = now - lastTapRef.current <= 300;
    lastTapRef.current = now;
    runReaction(isDouble ? 'celebrate' : 'hello');
  }, [runReaction]);

  const idleTranslateY = idle.interpolate({ inputRange: [0, 1], outputRange: [0, mode === 'game' ? -2 : -3] });
  const idleScale = idle.interpolate({ inputRange: [0, 1], outputRange: [1, mode === 'game' ? 1.01 : 1.018] });
  const idleRotate = idle.interpolate({ inputRange: [0, 1], outputRange: ['-0.6deg', '0.6deg'] });
  const reactionRotate = rotate.interpolate({ inputRange: [-10, 10], outputRange: ['-10deg', '10deg'] });

  const animatedCharacter = (
    <Animated.View
      style={[
        styles.motion,
        style,
        {
          transform: [
            { translateX: x },
            {
              translateY: Animated.add(
                Animated.add(y, idleTranslateY),
                entry.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }),
              ),
            },
            {
              scale: Animated.multiply(
                Animated.multiply(scale, idleScale),
                entry.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }),
              ),
            },
            { rotate: reactionRotate },
            { rotateZ: idleRotate },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );

  if (!interactive) {
    return <View pointerEvents="none" style={styles.host}>{animatedCharacter}</View>;
  }

  return (
    <View style={styles.host} {...panResponder.panHandlers}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Tap to greet, double tap to celebrate, hold to nod, or swipe left and right."
        onPress={handlePress}
        onLongPress={() => runReaction('nod')}
        delayLongPress={420}
        style={styles.pressable}
      >
        {animatedCharacter}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  pressable: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  motion: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
});
