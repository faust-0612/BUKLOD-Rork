import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

const CLOUDS = [
  { top: 72, width: 190, height: 52, delay: 0, duration: 18000, opacity: 0.34 },
  { top: 155, width: 138, height: 42, delay: 2800, duration: 22000, opacity: 0.24 },
  { top: 640, width: 210, height: 58, delay: 5200, duration: 26000, opacity: 0.18 },
] as const;

function DriftingCloud({
  top,
  width,
  height,
  delay,
  duration,
  opacity,
}: (typeof CLOUDS)[number]) {
  const travel = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(travel, {
          toValue: 1,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(travel, {
          toValue: 0,
          duration: 1,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, duration, travel]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.cloud,
        {
          top,
          width,
          height,
          borderRadius: height / 2,
          opacity,
          transform: [
            {
              translateX: travel.interpolate({
                inputRange: [0, 1],
                outputRange: [-240, 1280],
              }),
            },
          ],
        },
      ]}
    >
      <View style={[styles.cloudLobe, { width: height * 0.78, height: height * 0.78, borderRadius: height, left: width * 0.16, top: -height * 0.26 }]} />
      <View style={[styles.cloudLobe, { width: height, height, borderRadius: height, right: width * 0.16, top: -height * 0.35 }]} />
    </Animated.View>
  );
}

export default function BuklodKingdomAtmosphere({ stage }: { stage: number }) {
  const shimmer = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const motes = useMemo(
    () => Array.from({ length: 10 }, (_, index) => ({
      left: 90 + ((index * 103) % 1000),
      top: 220 + ((index * 67) % 490),
      size: 2 + (index % 3),
    })),
    [],
  );

  useEffect(() => {
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 4600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 4600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 2100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    shimmerLoop.start();
    pulseLoop.start();
    return () => {
      shimmerLoop.stop();
      pulseLoop.stop();
    };
  }, [pulse, shimmer]);

  const waterOpacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.20] });
  const moteOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, stage >= 3 ? 0.66 : 0.38] });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {CLOUDS.map((cloud, index) => <DriftingCloud key={index} {...cloud} />)}

      <Animated.View
        style={[
          styles.waterShimmer,
          {
            opacity: waterOpacity,
            transform: [
              { translateX: shimmer.interpolate({ inputRange: [0, 1], outputRange: [-120, 260] }) },
              { rotate: '-14deg' },
            ],
          },
        ]}
      />

      {motes.map((mote, index) => (
        <Animated.View
          key={index}
          style={[
            styles.mote,
            {
              left: mote.left,
              top: mote.top,
              width: mote.size,
              height: mote.size,
              borderRadius: mote.size,
              opacity: moteOpacity,
              transform: [
                { translateY: pulse.interpolate({ inputRange: [0, 1], outputRange: [4 + index % 4, -6 - index % 5] }) },
                { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.35] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cloud: {
    position: 'absolute',
    left: 0,
    zIndex: 7,
    backgroundColor: '#ffffff',
    shadowColor: '#ffffff',
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  cloudLobe: {
    position: 'absolute',
    backgroundColor: '#ffffff',
  },
  waterShimmer: {
    position: 'absolute',
    left: -140,
    bottom: 35,
    width: 620,
    height: 74,
    borderRadius: 60,
    backgroundColor: '#ffffff',
  },
  mote: {
    position: 'absolute',
    zIndex: 12,
    backgroundColor: '#fff1a1',
    shadowColor: '#ffe36b',
    shadowOpacity: 0.8,
    shadowRadius: 5,
  },
});
