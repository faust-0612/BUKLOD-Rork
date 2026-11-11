import React, { memo, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, StyleSheet, View } from 'react-native';

/**
 * Restores the existing illustrated-world atmosphere from the earlier Kingdom
 * R2 workstream. Adapted for R6 scalable SVG geometry and low-end Android:
 * just two native-driver cloud loops, one water shimmer and one shared
 * particles pulse. Never intercepts scroll, game station taps or map controls.
 * Reduced-motion and background states do not run decorative animations.
 */
const CLOUDS = [
  { top: 78, width: 206, height: 52, duration: 23000, opacity: .32 },
  { top: 575, width: 166, height: 43, duration: 28500, opacity: .22 },
] as const;
const PARTICLES = Array.from({ length: 6 }, (_, i) => ({
  left: 110 + ((i * 197) % 955),
  top: 215 + ((i * 173) % 490),
  diameter: 3 + (i % 2),
}));

function Cloud({ cloud, scale, running }: {
  cloud: (typeof CLOUDS)[number]; scale: number; running: boolean;
}) {
  const travel = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!running) {
      travel.stopAnimation();
      return;
    }
    const motion = Animated.loop(Animated.timing(travel, {
      toValue: 1, duration: cloud.duration, easing: Easing.linear,
      useNativeDriver: true,
    }));
    motion.start();
    return () => motion.stop();
  }, [cloud.duration, running, travel]);
  const w = cloud.width * scale;
  const h = cloud.height * scale;
  return (
    <Animated.View pointerEvents="none" style={[
      styles.cloud,
      { top: cloud.top * scale, left: -w, width: w, height: h,
        borderRadius: h / 2, opacity: cloud.opacity,
        transform: [{ translateX: travel.interpolate({
          inputRange: [0, 1],
          outputRange: [0, (1200 + cloud.width * 2) * scale],
        }) }],
      },
    ]}>
      <View style={[styles.lobe, { left: w * .14, top: -h * .24,
        width: h * .85, height: h * .85, borderRadius: h }]} />
      <View style={[styles.lobe, { right: w * .14, top: -h * .38,
        width: h * 1.12, height: h * 1.12, borderRadius: h }]} />
    </Animated.View>
  );
}

function BuklodKingdomAtmosphere({ stage, scale }: { stage: number; scale: number }) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const shimmer = useRef(new Animated.Value(0)).current;
  const sparkle = useRef(new Animated.Value(0)).current;
  const running = active && !reducedMotion;

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted) setReducedMotion(value);
    }).catch(() => undefined);
    const motionSub = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      setReducedMotion(value);
    });
    const stateSub = AppState.addEventListener('change', value => {
      setActive(value === 'active');
    });
    return () => { mounted = false; motionSub.remove(); stateSub.remove(); };
  }, []);

  useEffect(() => {
    if (!running) {
      shimmer.stopAnimation();
      sparkle.stopAnimation();
      return;
    }
    const wave = Animated.loop(Animated.sequence([
      Animated.timing(shimmer, { toValue: 1, duration: 4800,
        easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(shimmer, { toValue: 0, duration: 4800,
        easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const glitter = Animated.loop(Animated.sequence([
      Animated.timing(sparkle, { toValue: 1, duration: 2900,
        easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(sparkle, { toValue: 0, duration: 2900,
        easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    wave.start();
    glitter.start();
    return () => { wave.stop(); glitter.stop(); };
  }, [running, shimmer, sparkle]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {CLOUDS.map((cloud, index) => (
        <Cloud key={index} cloud={cloud} scale={scale} running={running} />
      ))}
      <Animated.View pointerEvents="none" style={[
        styles.shimmer,
        { left: -120 * scale, top: 844 * scale,
          width: 560 * scale, height: 12 * scale, borderRadius: 12 * scale,
          opacity: shimmer.interpolate({ inputRange: [0, 1], outputRange: [.05, .16] }),
          transform: [{ translateX: shimmer.interpolate({
            inputRange: [0, 1], outputRange: [0, 210 * scale],
          }) }, { rotate: '-9deg' }],
        },
      ]} />
      {PARTICLES.map((particle, index) => (
        <Animated.View key={index} pointerEvents="none" style={[
          styles.particle,
          { left: particle.left * scale, top: particle.top * scale,
            width: particle.diameter * scale, height: particle.diameter * scale,
            borderRadius: particle.diameter * scale,
            opacity: sparkle.interpolate({ inputRange: [0, 1],
              outputRange: [.13, stage >= 3 ? .58 : .32] }),
            transform: [{ translateY: sparkle.interpolate({
              inputRange: [0, 1], outputRange: [4 * scale, -6 * scale],
            }) }],
          },
        ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cloud: { position: 'absolute', backgroundColor: '#fffaf0',
    shadowColor: '#ffffff', shadowOpacity: .19, shadowRadius: 18 },
  lobe: { position: 'absolute', backgroundColor: '#fffaf0' },
  shimmer: { position: 'absolute', backgroundColor: '#e0ffff' },
  particle: { position: 'absolute', backgroundColor: '#fff3ae',
    shadowColor: '#fbe484', shadowOpacity: .7, shadowRadius: 5 },
});
export default memo(BuklodKingdomAtmosphere);
