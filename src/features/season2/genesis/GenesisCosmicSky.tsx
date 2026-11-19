/** Genesis cosmic visual layer: creation, first light and star fields.
 * Decorative only. Bounded transform loops stop when the scene is hidden. */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient as SvgLinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useGenesisMotionAllowed } from './GenesisVisuals';

type Props = { active: boolean; minimal?: boolean };

const FRAGMENTS = [
  { left: '12%', top: '15%', width: 58, rotate: '-24deg', lag: -14 },
  { left: '67%', top: '25%', width: 85, rotate: '19deg', lag: 11 },
  { left: '26%', top: '76%', width: 70, rotate: '-38deg', lag: 19 },
  { left: '76%', top: '83%', width: 44, rotate: '32deg', lag: -8 },
] as const;

export default function GenesisCosmicSky({ active, minimal = false }: Props) {
  const allowed = useGenesisMotionAllowed(active, minimal ? 'minimal' : 'balanced');
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    drift.stopAnimation();
    drift.setValue(0);
    if (!allowed) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration: 6200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(drift, { toValue: 0, duration: 6200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [allowed, drift]);

  return <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <Svg width="100%" height="100%" viewBox="0 0 420 300" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <RadialGradient id="genesisFirstLight" cx="65%" cy="35%" rx="75%" ry="85%">
          <Stop offset="0" stopColor="#E5BC73" stopOpacity=".48"/>
          <Stop offset=".26" stopColor="#4F927F" stopOpacity=".21"/>
          <Stop offset=".7" stopColor="#10294A" stopOpacity=".08"/>
          <Stop offset="1" stopColor="#010715" stopOpacity="0"/>
        </RadialGradient>
        <RadialGradient id="genesisNebula" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor="#248CA5" stopOpacity=".45"/>
          <Stop offset=".7" stopColor="#13605E" stopOpacity=".13"/>
          <Stop offset="1" stopColor="#061426" stopOpacity="0"/>
        </RadialGradient>
        <SvgLinearGradient id="genesisOrbit" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#8DE4DC" stopOpacity="0"/>
          <Stop offset=".52" stopColor="#DCE1C1" stopOpacity=".6"/>
          <Stop offset="1" stopColor="#F3D995" stopOpacity="0"/>
        </SvgLinearGradient>
      </Defs>
      <Rect width="420" height="300" fill="#030D1E"/>
      <Rect width="420" height="300" fill="url(#genesisFirstLight)"/>
      <Ellipse cx="42" cy="210" rx="185" ry="120" fill="url(#genesisNebula)"/>
      <Path d="M -90 240 C 35 0 245 -70 480 36" stroke="url(#genesisOrbit)" strokeWidth="1.4" fill="none" opacity=".68"/>
      <Path d="M -80 250 C 70 40 280 -34 515 70" stroke="url(#genesisOrbit)" strokeWidth=".58" fill="none" opacity=".38"/>
      <Path d="M -40 290 C 122 90 315 90 485 155" stroke="#75B7C2" strokeWidth=".55" fill="none" opacity=".25"/>
      <Path d="M 185 300 L 288 0 M 212 300 L 311 0" stroke="#EED69F" strokeWidth=".48" opacity=".28"/>
      <Path d="M 325 15 L 329 37 M 318 26 L 337 26 M 97 206 L 102 218 M 96 212 L 109 211 M 348 254 L 351 271" stroke="#FFECBC" strokeWidth=".9" opacity=".68"/>
    </Svg>
    {!minimal ? FRAGMENTS.map((fragment, i) =>
      <Animated.View key={i} style={[
        styles.fragment,
        { left: fragment.left, top: fragment.top, width: fragment.width,
          opacity: drift.interpolate({ inputRange: [0, 1], outputRange: [.26, .68] }),
          transform: [
            { rotate: fragment.rotate },
            { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, fragment.lag] }) },
            { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [8, -9] }) },
          ],
        },
      ]}>
        <View style={styles.fragmentInner}/>
      </Animated.View>
    ) : null}
  </View>;
}
const styles = StyleSheet.create({
  fragment: { position: 'absolute', height: 2, backgroundColor: 'rgba(225,228,191,.18)', overflow: 'hidden' },
  fragmentInner: { height: 1, width: '72%', backgroundColor: '#F4D8A2', shadowColor: '#FFE6A1',
    shadowOpacity: .8, shadowRadius: 8 },
});
