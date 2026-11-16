/* Flat-art idle only. Individual limbs or facial features require segmented approved art. */
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, View } from 'react-native';

export default function BuklodCharacterIdleMotion({ active, children }: { active: boolean; children: React.ReactNode }) {
  const progress = useRef(new Animated.Value(0)).current;
  const [reduced, setReduced] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted) setReduced(value);
    }).catch(() => { if (mounted) setReduced(true); });
    const accessibility = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      if (mounted) setReduced(value);
    });
    const app = AppState.addEventListener('change', state => {
      if (mounted) setForeground(state === 'active');
    });
    return () => { mounted = false; accessibility.remove(); app.remove(); };
  }, []);
  useEffect(() => {
    if (!active || reduced || !foreground) {
      progress.stopAnimation();
      progress.setValue(0);
      return;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(progress, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(progress, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    animation.start();
    return () => { animation.stop(); progress.setValue(0); };
  }, [active, reduced, foreground, progress]);
  return (
    <View>
      <Animated.View style={{ transform: [
        { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -2.5] }) },
        { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.008] }) },
      ] }}>
        {children}
      </Animated.View>
    </View>
  );
}
