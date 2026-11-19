/** Genesis cosmic visual layer: creation, first light and star fields.
 * Decorative only. Bounded transform loops stop when the scene is hidden. */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient as SvgLinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useGenesisMotionAllowed } from './GenesisVisuals';
import { getGenesisDeviceQuality } from './genesisDeviceQuality';

type Props = { active: boolean; minimal?: boolean; transparent?: boolean };

const FRAGMENTS = [
  { left: '12%', top: '15%', width: 58, rotate: '-24deg', lag: -14 },
  { left: '67%', top: '25%', width: 85, rotate: '19deg', lag: 11 },
  { left: '26%', top: '76%', width: 70, rotate: '-38deg', lag: 19 },
  { left: '76%', top: '83%', width: 44, rotate: '32deg', lag: -8 },
] as const;

export default function GenesisCosmicSky({ active, minimal = false, transparent = false }: Props) {
  const lightweight = minimal || getGenesisDeviceQuality('home') === 'minimal';
  const allowed = useGenesisMotionAllowed(active, lightweight ? 'minimal' : 'balanced');
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
      <Rect width="420" height="300" fill={transparent ? "transparent" : "#030D1E"}/>
      <Rect width="420" height="300" fill="url(#genesisFirstLight)"/>
      <Ellipse cx="42" cy="210" rx="185" ry="120" fill="url(#genesisNebula)"/>
      <Path d="M -90 240 C 35 0 245 -70 480 36" stroke="url(#genesisOrbit)" strokeWidth="1.4" fill="none" opacity=".68"/>
      <Path d="M -80 250 C 70 40 280 -34 515 70" stroke="url(#genesisOrbit)" strokeWidth=".58" fill="none" opacity=".38"/>
      <Path d="M -40 290 C 122 90 315 90 485 155" stroke="#75B7C2" strokeWidth=".55" fill="none" opacity=".25"/>
      <Path d="M 185 300 L 288 0 M 212 300 L 311 0" stroke="#EED69F" strokeWidth=".48" opacity=".28"/>
      <Path d="M 325 15 L 329 37 M 318 26 L 337 26 M 97 206 L 102 218 M 96 212 L 109 211 M 348 254 L 351 271" stroke="#FFECBC" strokeWidth=".9" opacity=".68"/>
    </Svg>
    {!lightweight ? FRAGMENTS.map((fragment, i) =>
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

/** Luminous orbital halo: scalable vector artwork, GPU-composited and focus-gated.
 * Light and atmosphere move; low-resolution character thumbnails never impersonate animation rigs.
 * Only real approved .riv rigs are animated by GenesisRiveCharacter. */
export function GenesisOrbitHalo({active,size=260}:{active:boolean;size?:number}) {
  const allowMotion = useGenesisMotionAllowed(active,getGenesisDeviceQuality('character'),'character');
  const phase = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    phase.stopAnimation();
    phase.setValue(0);
    if (!allowMotion) return;
    const loop=Animated.loop(Animated.sequence([
      Animated.timing(phase,{toValue:1,duration:4400,easing:Easing.inOut(Easing.sin),useNativeDriver:true}),
      Animated.timing(phase,{toValue:0,duration:4400,easing:Easing.inOut(Easing.sin),useNativeDriver:true}),
    ]));
    loop.start();
    return () => { loop.stop(); phase.stopAnimation(); };
  },[allowMotion,phase]);
  const opacity=phase.interpolate({inputRange:[0,1],outputRange:[0.68,0.96]});
  const scale=phase.interpolate({inputRange:[0,1],outputRange:[0.97,1.04]});
  return <Animated.View pointerEvents="none" accessibilityElementsHidden
    style={{position:'absolute',right:'-5%',top:'8%',width:size,height:size,opacity,transform:[{scale}]}}>
    <Svg width="100%" height="100%" viewBox="0 0 260 260">
      <Defs>
        <RadialGradient id="genesisHaloInner" cx="50%" cy="52%" rx="50%" ry="50%">
          <Stop offset="0" stopColor="#FFF0BD" stopOpacity=".42"/>
          <Stop offset=".34" stopColor="#7F87CC" stopOpacity=".24"/>
          <Stop offset=".72" stopColor="#45A2C7" stopOpacity=".08"/>
          <Stop offset="1" stopColor="#020B22" stopOpacity="0"/>
        </RadialGradient>
        <SvgLinearGradient id="genesisHaloOrbit" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#D2EDFF" stopOpacity=".05"/>
          <Stop offset=".5" stopColor="#FFF2C7" stopOpacity=".92"/>
          <Stop offset="1" stopColor="#6BCBCF" stopOpacity=".14"/>
        </SvgLinearGradient>
      </Defs>
      <Ellipse cx="130" cy="130" rx="127" ry="127" fill="url(#genesisHaloInner)"/>
      <Ellipse cx="130" cy="132" rx="116" ry="37" transform="rotate(-29 130 132)"
        stroke="url(#genesisHaloOrbit)" strokeWidth="1.8" fill="none"/>
      <Ellipse cx="130" cy="132" rx="99" ry="23" transform="rotate(38 130 132)"
        stroke="#9BE6E4" strokeOpacity=".38" strokeWidth=".85" fill="none"/>
      <Path d="M130 0 V260 M0 130 H260 M40 40 L220 220 M40 220 L220 40"
        stroke="#FFEAC0" strokeOpacity=".15" strokeWidth=".8"/>
      <Path d="M19 155 Q127 7 246 82" stroke="#E5B7FF" strokeOpacity=".26"
        strokeWidth="13" fill="none"/>
      <Ellipse cx="130" cy="130" rx="15" ry="15" fill="#FFF1C3" opacity=".19"/>
      <Rect x="127.5" y="17" width="5" height="20" rx="2.5" fill="#FFF2D2" opacity=".6"/>
      <Rect x="227" y="125" width="19" height="2" rx="1" fill="#9BE7FF" opacity=".66"/>
    </Svg>
  </Animated.View>;
}
