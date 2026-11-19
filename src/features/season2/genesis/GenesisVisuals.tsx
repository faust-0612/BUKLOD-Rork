import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Path, Circle, G } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { GENESIS_MOTION_MS, GENESIS_PALETTE, resolveGenesisMotion, type GenesisQuality } from './genesisContract';

/** One shared accessible motion switch. No background work when the scene is hidden. */
export function useGenesisMotionAllowed(active: boolean, quality: GenesisQuality = 'balanced') {
  const [reduced, setReduced] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduced(value); }).catch(() => {});
    const reducedSub = AccessibilityInfo.addEventListener('reduceMotionChanged', value => setReduced(Boolean(value)));
    const appSub = AppState.addEventListener('change', value => setForeground(value === 'active'));
    return () => { mounted = false; reducedSub.remove(); appSub.remove(); };
  }, []);
  return resolveGenesisMotion({
    surface: 'home', quality, focused: active, appActive: foreground, reducedMotion: reduced,
  }).ambient;
}

function Shard({ x, y, phase, angle = 0 }: { x: string; y: string; phase: Animated.Value; angle?: number }) {
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', left: x as any, top: y as any, width: 31, height: 10,
      opacity: phase.interpolate({ inputRange: [0, 0.2, 0.68, 1], outputRange: [0.16, 0.83, 0.72, 0.12] }),
      transform: [
        { translateY: phase.interpolate({ inputRange: [0, 1], outputRange: [22, -28] }) },
        { translateX: phase.interpolate({ inputRange: [0, 1], outputRange: [-10, 19] }) },
        { rotate: `${angle}deg` },
      ],
    }}>
      <Svg viewBox="0 0 31 10" width="31" height="10">
        <Defs><SvgLinearGradient id="genesisShard" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={GENESIS_PALETTE.teal} stopOpacity="0" />
          <Stop offset=".64" stopColor={GENESIS_PALETTE.goldLight} stopOpacity=".95" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </SvgLinearGradient></Defs>
        <Path d="M0 5 L22 2 L31 5 L22 8 Z" fill="url(#genesisShard)" />
        <Path d="M8 5 L28 5" stroke={GENESIS_PALETTE.goldLight} strokeWidth=".65" strokeOpacity=".8" />
      </Svg>
    </Animated.View>
  );
}

/** Fine-line botanical engraving, dawn rays and long luminous fragments — not dot particles. */
export function GenesisAtmosphere({ active, quality = 'balanced' }: { active: boolean; quality?: GenesisQuality }) {
  const allowMotion = useGenesisMotionAllowed(active, quality);
  const phase = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!allowMotion) { phase.stopAnimation(); phase.setValue(0); return; }
    const animation = Animated.loop(Animated.timing(phase, {
      toValue: 1, duration: GENESIS_MOTION_MS.atmosphericDrift,
      easing: Easing.inOut(Easing.sin), useNativeDriver: true,
    }));
    animation.start();
    return () => { animation.stop(); phase.setValue(0); };
  }, [allowMotion, phase]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 360 150" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <SvgLinearGradient id="genesisRoot" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor={GENESIS_PALETTE.leaf} stopOpacity=".04" />
            <Stop offset=".58" stopColor={GENESIS_PALETTE.gold} stopOpacity=".33" />
            <Stop offset="1" stopColor={GENESIS_PALETTE.goldLight} stopOpacity=".08" />
          </SvgLinearGradient>
          <SvgLinearGradient id="genesisRay" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={GENESIS_PALETTE.goldLight} stopOpacity=".21" />
            <Stop offset="1" stopColor={GENESIS_PALETTE.goldLight} stopOpacity="0" />
          </SvgLinearGradient>
        </Defs>
        <Path d="M165 150 C208 119 216 84 282 40 C311 20 321 5 332 -19"
          stroke="url(#genesisRoot)" strokeWidth="1.35" fill="none" />
        <Path d="M212 150 C243 119 247 94 287 72 C324 48 344 40 364 37"
          stroke="url(#genesisRoot)" strokeWidth=".7" fill="none" />
        <Path d="M260 150 C282 123 282 92 310 79 C332 66 343 67 360 63"
          stroke="url(#genesisRoot)" strokeWidth=".8" fill="none" />
        <Path d="M282 40 C267 22 259 14 254 -2 M287 72 C269 68 253 54 249 39 M310 79 C297 59 293 51 296 28"
          stroke="url(#genesisRoot)" strokeWidth="1.1" fill="none" />
        <Path d="M0 140 C70 126 91 110 157 113" stroke="#8ECFA9" strokeOpacity=".12" fill="none"/>
        <Path d="M214 0 L301 0 L291 150 L279 150 Z" fill="url(#genesisRay)" opacity=".34" />
        <Path d="M315 -10 L335 0 L250 150 L232 150 Z" fill="url(#genesisRay)" opacity=".23" />
        <G stroke={GENESIS_PALETTE.goldLight} strokeOpacity=".44" strokeWidth=".8" fill="none">
          <Path d="M281 40 Q271 35 267 24 Q282 26 286 39" />
          <Path d="M288 72 Q302 65 310 52 Q310 70 291 79" />
          <Path d="M315 78 Q329 76 337 65 Q335 82 318 85" />
          <Path d="M255 40 Q242 29 238 18 Q257 20 261 37" />
        </G>
      </Svg>
      {allowMotion ? (
        <>
          <Shard x="18%" y="25%" phase={phase} angle={-15} />
          <Shard x="62%" y="56%" phase={phase} angle={22} />
          <Shard x="82%" y="13%" phase={phase} angle={-38} />
        </>
      ) : null}
    </View>
  );
}

/** Engraved seal with interwoven root and dawning light; deliberately not a generic circular spinner. */
export function GenesisSeal({ size = 72, active = false }: { size?: number; active?: boolean }) {
  const allowMotion = useGenesisMotionAllowed(active);
  const glow = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    if (!allowMotion) { glow.stopAnimation(); glow.setValue(0.4); return; }
    const sequence = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 0.82, duration: 1550, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0.4, duration: 1550, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    sequence.start();
    return () => sequence.stop();
  }, [allowMotion, glow]);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', width: size * .83, height: size * .83,
        borderRadius: size, backgroundColor: '#C8AD5B', opacity: glow, transform: [{ scale: .76 }] }} />
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Defs><SvgLinearGradient id="genesisSealMetal" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor="#7F7146"/><Stop offset=".46" stopColor="#F9E4AC"/>
          <Stop offset="1" stopColor="#B89956"/>
        </SvgLinearGradient></Defs>
        <Circle cx="60" cy="60" r="51" stroke="url(#genesisSealMetal)" strokeWidth="2.25" fill="#0A3326" fillOpacity=".88"/>
        <Circle cx="60" cy="60" r="45" stroke={GENESIS_PALETTE.gold} strokeWidth=".5" strokeOpacity=".64" fill="none" strokeDasharray="21 3 4 5"/>
        <G stroke="url(#genesisSealMetal)" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <Path d="M60 93 V59 M60 60 C47 55 42 46 37 34 M60 61 C73 53 77 43 83 32 M60 74 C48 70 39 63 33 52 M60 77 C72 72 84 63 89 49"
            strokeWidth="3"/>
          <Path d="M60 92 C49 90 42 96 37 102 M60 90 C75 88 81 95 84 101 M60 90 C60 98 59 101 56 105"
            strokeWidth="1.2"/>
          <Path d="M37 34 C46 32 52 35 54 40 C44 45 38 42 37 34 Z M83 32 C76 33 69 37 68 43 C77 45 82 40 83 32 Z"
            strokeWidth="1.3"/>
          <Path d="M33 52 Q44 50 50 57 Q39 62 33 52 Z M89 49 Q77 47 71 57 Q84 60 89 49 Z" strokeWidth="1.2"/>
          <Path d="M60 19 V28 M56 22 L60 17 L64 22 M27 59 L20 59 M93 59 L100 59" strokeWidth="1.2"/>
        </G>
      </Svg>
    </View>
  );
}

export function GenesisHomeHero({ active = true, quality = 'balanced' }: { active?: boolean; quality?: GenesisQuality }) {
  return (
    <LinearGradient colors={['#0B3026', '#14583E', '#317853']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={styles.hero} accessible accessibilityRole="header"
      accessibilityLabel="Genesis: The Beginning. A new chapter of life, connection and purpose.">
      <GenesisAtmosphere active={active} quality={quality}/>
      <View style={styles.heroCopy}>
        <Text style={styles.kicker}>BUKLOD  ·  SEASON 2</Text>
        <Text style={styles.title}>Genesis: The Beginning</Text>
        <Text style={styles.sub}>A new chapter of life, connection and purpose.</Text>
        <View style={styles.rule}><View style={styles.ruleLight}/></View>
      </View>
      <View style={styles.emblem}><GenesisSeal size={74} active={active}/></View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: 122, borderRadius: 17, overflow: 'hidden', flexDirection: 'row',
    alignItems: 'center', paddingVertical: 15, paddingHorizontal: 14, borderWidth: 1,
    borderColor: '#648B69' },
  heroCopy: { flex: 1, minWidth: 0, zIndex: 1, paddingRight: 3 },
  kicker: { fontSize: 9.5, fontWeight: '800', color: '#F3D798', letterSpacing: 1.6 },
  title: { marginTop: 5, fontSize: 20, lineHeight: 24, fontWeight: '900', color: GENESIS_PALETTE.textOnDark },
  sub: { marginTop: 5, fontSize: 11.5, lineHeight: 16, color: '#E0F1E5' },
  emblem: { width: 77, alignItems: 'flex-end', justifyContent: 'center' },
  rule: { marginTop: 10, height: 1, backgroundColor: '#6E9D7E', width: 96 },
  ruleLight: { width: 35, height: 1, backgroundColor: GENESIS_PALETTE.goldLight },
});
