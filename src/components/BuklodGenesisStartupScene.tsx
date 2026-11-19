import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import Svg, { Path, Circle } from 'react-native-svg';
import {
  getBuklodSoundSettings,
  getBuklodGameSoundVolume,
  isBuklodGameSoundEnabled,
} from '@/lib/buklodSounds';

// A compact, offline, original sonic mark; no network request or paid generator.
const GENESIS_STINGER = require('../../assets/sounds/buklod-genesis-opening-20261120.wav');
const LOCKED = Dimensions.get('screen');

const STARS = Array.from({ length: 32 }, (_, i) => {
  // Deterministic positions: no state changes or Math.random during render.
  const x = ((i * 67 + 19) % 97) / 100;
  const y = ((i * 41 + 13) % 89) / 100;
  return { x, y, size: i % 6 === 0 ? 3 : i % 3 === 0 ? 2 : 1, band: i % 3 };
});

function GlowSeed() {
  return (
    <Svg width={64} height={104} viewBox="0 0 64 104">
      <Circle cx="32" cy="49" r="26" fill="#EAD985" opacity="0.1" />
      <Circle cx="32" cy="49" r="17" fill="#A1F7B0" opacity="0.18" />
      <Path d="M32 16 C7 35 11 67 32 82 C53 67 57 35 32 16Z"
        fill="#B8F7A0" stroke="#FFF5AC" strokeWidth="2" />
      <Path d="M32 24 C27 43 27 60 32 75 C37 60 37 43 32 24"
        stroke="#27775C" strokeWidth="2.5" fill="none" />
      <Path d="M32 35 C16 26 10 15 13 6 C27 6 34 14 32 35Z"
        fill="#54D7A9" stroke="#B4FFD4" strokeWidth="1.5" />
      <Path d="M32 35 C45 23 55 20 59 26 C51 38 41 39 32 35Z"
        fill="#78D999" stroke="#DAFFC7" strokeWidth="1.5" />
    </Svg>
  );
}

/**
 * Compositor-driven Android opening. Decorative only; never blocks hydration,
 * authentication, navigation, ads, or the existing fingerprint gate.
 */
export default function BuklodGenesisStartupScene() {
  const [reduceMotion, setReduceMotion] = useState(false);
  const reveal = useRef(new Animated.Value(0)).current;
  const orbit = useRef(new Animated.Value(0)).current;
  const dust = useRef(new Animated.Value(0)).current;
  const seedOpacity = useRef(new Animated.Value(1)).current;
  const starBlink = useRef(new Animated.Value(0.28)).current;

  useEffect(() => {
    let active = true;
    let player: AudioPlayer | null = null;
    let disposeTimer: ReturnType<typeof setTimeout> | null = null;
    let playbackTimer: ReturnType<typeof setTimeout> | null = null;

    // Respect existing game-audio, quiet hours, in-call and volume policy.
    void (async () => {
      try {
        await getBuklodSoundSettings();
        if (!active || AppState.currentState !== 'active' || !isBuklodGameSoundEnabled()) return;
        player = createAudioPlayer(GENESIS_STINGER, { updateInterval: 1000 });
        player.volume = Math.min(0.36, getBuklodGameSoundVolume());
        // Keep audio optional: a loading or playback failure cannot delay the app.
        playbackTimer = setTimeout(() => {
          if (active && AppState.currentState === 'active') {
            try { player?.play(); } catch { /* visual-only fallback */ }
          }
        }, 160);
        disposeTimer = setTimeout(() => {
          try { player?.release(); } catch { /* already disposed */ }
          player = null;
        }, 2950);
      } catch {
        try { player?.release(); } catch { /* optional audio */ }
      }
    })();

    void AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => { if (active) setReduceMotion(Boolean(enabled)); })
      .catch(() => undefined);
    return () => {
      active = false;
      if (playbackTimer) clearTimeout(playbackTimer);
      if (disposeTimer) clearTimeout(disposeTimer);
      try { player?.release(); } catch { /* best effort */ }
      player = null;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      reveal.setValue(1);
      seedOpacity.setValue(0);
      return;
    }
    const appear = Animated.timing(reveal, {
      toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    const sprout = Animated.sequence([
      Animated.delay(340),
      Animated.timing(seedOpacity, {
        toValue: 0, duration: 700, easing: Easing.in(Easing.cubic), useNativeDriver: true,
      }),
    ]);
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(starBlink, {
        toValue: 0.9, duration: 1150, easing: Easing.inOut(Easing.sine), useNativeDriver: true,
      }),
      Animated.timing(starBlink, {
        toValue: 0.26, duration: 1150, easing: Easing.inOut(Easing.sine), useNativeDriver: true,
      }),
    ]));
    const drift = Animated.loop(Animated.timing(dust, {
      toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true,
    }));
    const rotate = Animated.loop(Animated.timing(orbit, {
      toValue: 1, duration: 7200, easing: Easing.linear, useNativeDriver: true,
    }));
    appear.start();
    sprout.start();
    pulse.start();
    drift.start();
    rotate.start();
    return () => {
      appear.stop();
      sprout.stop();
      pulse.stop();
      drift.stop();
      rotate.stop();
    };
  }, [reduceMotion, dust, orbit, reveal, seedOpacity, starBlink]);

  const spin = orbit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const translate = dust.interpolate({ inputRange: [0, 1], outputRange: [20, -45] });
  const bloom = reveal.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.1] });

  const stars = useMemo(() => STARS.map((star, index) => (
    <Animated.View
      key={index}
      style={{
        position: 'absolute',
        left: Math.floor(LOCKED.width * star.x),
        top: Math.floor(LOCKED.height * star.y),
        width: star.size,
        height: star.size,
        borderRadius: star.size,
        backgroundColor: star.band === 0 ? '#EDFFBD' : '#97DCE6',
        opacity: starBlink,
      }}
    />
  )), [starBlink]);

  return (
    <View pointerEvents="none" style={styles.full}>
      <LinearGradient
        colors={['#020712', '#071F2D', '#16283B', '#030B18']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.full}
      />
      <Animated.View style={[styles.full, { opacity: reveal, transform: [{ translateY: translate }] }]}>
        {stars}
      </Animated.View>
      <Animated.View style={[styles.center, {
        opacity: reveal,
        transform: [{ rotate: spin }, { scale: bloom }],
      }]}>
        <View style={styles.outerGlow}/>
        <View style={styles.middleGlow}/>
        <View style={styles.innerGlow}/>
        <View style={styles.orbit}/>
      </Animated.View>
      <Animated.View style={[styles.center, { opacity: seedOpacity }]}>
        <GlowSeed/>
      </Animated.View>
      <Animated.View style={[styles.caption, { opacity: reveal }]}>
        <Text style={styles.eyebrow}>S E A S O N   2</Text>
        <Text style={styles.title}>GENESIS</Text>
        <Text style={styles.subtitle}>THE SEED OF GLORY</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  full: {
    position: 'absolute', top: 0, left: 0,
    width: LOCKED.width, height: LOCKED.height,
    overflow: 'hidden',
  },
  center: {
    position: 'absolute', left: LOCKED.width / 2 - 118,
    top: LOCKED.height / 2 - 118,
    width: 236, height: 236, alignItems: 'center', justifyContent: 'center',
  },
  outerGlow: {
    width: 232, height: 232, borderRadius: 116, backgroundColor: '#3ACAA1',
    opacity: 0.07, position: 'absolute',
  },
  middleGlow: {
    width: 190, height: 190, borderRadius: 95, backgroundColor: '#C7E6A1',
    opacity: 0.12, position: 'absolute',
  },
  innerGlow: {
    width: 132, height: 132, borderRadius: 66, backgroundColor: '#D9EEB5',
    opacity: 0.09, position: 'absolute',
  },
  orbit: {
    width: 223, height: 223, borderRadius: 112,
    borderWidth: 1.5, borderColor: 'rgba(194,241,196,0.33)',
    borderTopColor: '#FFF3AB', borderRightColor: 'transparent',
  },
  caption: {
    position: 'absolute', top: LOCKED.height / 2 + 149,
    left: 24, right: 24, alignItems: 'center',
  },
  eyebrow: { fontSize: 9, fontWeight: '700', color: '#A9EBC9', letterSpacing: 2.2 },
  title: { marginTop: 5, fontSize: 24, fontWeight: '900', color: '#FDF2C6', letterSpacing: 4 },
  subtitle: { marginTop: 2, fontSize: 10, fontWeight: '700', color: '#CAEDC3', letterSpacing: 2 },
});
