import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, View } from 'react-native';
import type { BuklodPostMotionPreset } from '@/lib/buklodPostCreatives';

/**
 * Published post motion runs automatically whenever the Wall says its card is
 * visible. There is no per-post Play requirement. Off-screen cards and users
 * with reduced-motion enabled never run a background animation.
 */
export default function BuklodPostMotion({ preset, children, active = true }: {
  preset: BuklodPostMotionPreset; children: ReactNode; active?: boolean;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted) setReduceMotion(Boolean(value));
    }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription?.remove?.(); };
  }, []);
  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);
    if (!active || reduceMotion || preset === 'none') return;
    const config = {
      duration: preset === 'fade' ? 1600 : 3000,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: Platform.OS !== 'web',
    };
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(progress, { ...config, toValue: 1 }),
      Animated.timing(progress, { ...config, toValue: 0 }),
    ]));
    animation.start();
    return () => { animation.stop(); progress.stopAnimation(); };
  }, [active, preset, progress, reduceMotion]);
  if (preset === 'none' || reduceMotion || !active) return <>{children}</>;
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });
  const x = progress.interpolate({ inputRange: [0, 1], outputRange: [-4, 4] });
  const y = progress.interpolate({ inputRange: [0, 1], outputRange: [-3, 3] });
  const opacity = progress.interpolate({ inputRange: [0, 1], outputRange: [1, .78] });
  const style = preset === 'zoom' ? { transform: [{ scale }] } :
    preset === 'pan' ? { transform: [{ translateX: x }] } :
    preset === 'float' ? { transform: [{ translateY: y }] } : { opacity };
  return <Animated.View style={style}><View>{children}</View></Animated.View>;
}
