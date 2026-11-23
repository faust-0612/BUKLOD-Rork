import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useBuklodReduceMotion } from '@/components/HomeMotion';

type Props = {
  /** Increment sequence for every distinct server-confirmed award. */
  award: { points: number; sequence: number } | null;
};

/**
 * Reusable, noninteractive reward feedback shown on EARN (not on CLAIM).
 * Call only after the server returns an idempotent, newly credited award.
 * Never animate or claim points on an optimistic tap or ad interaction.
 */
export default function BuklodEarnedStarsFeedback({ award }: Props) {
  const reduceMotion = useBuklodReduceMotion();
  const lift = useRef(new Animated.Value(0)).current;
  const visible = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!award || award.points <= 0) return;
    lift.stopAnimation();
    visible.stopAnimation();
    lift.setValue(0);
    visible.setValue(0);
    if (reduceMotion) {
      visible.setValue(1);
      return;
    }
    const animation = Animated.sequence([
      Animated.parallel([
        Animated.timing(lift, { toValue: 1, duration: 480, useNativeDriver: true }),
        Animated.timing(visible, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]),
      Animated.delay(850),
      Animated.timing(visible, { toValue: 0, duration: 360, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [award?.sequence, award?.points, lift, visible, reduceMotion]);
  if (!award || award.points <= 0) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityLabel={`You earned ${award.points} BUKLOD Points, pending claim`}
      style={[styles.overlay, {
        opacity: visible,
        transform: [{
          translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [8, -24] }),
        }],
      }]}>
      <View style={styles.burst}>
        <Text style={styles.stars}>✦ ✧ ✦</Text>
        <Text style={styles.points}>+{award.points} BP</Text>
        <Text style={styles.status}>EARNED · PENDING CLAIM</Text>
      </View>
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 8,
    zIndex: 9,
    alignItems: 'flex-end',
  },
  burst: {
    borderRadius: 12,
    backgroundColor: '#17644B',
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: 'center',
  },
  stars: { fontSize: 17, color: '#FFE69A', fontWeight: '900' },
  points: { fontSize: 20, color: '#FFFFFF', fontWeight: '900' },
  status: { color: '#ECFAE8', fontSize: 9, fontWeight: '700' },
});
