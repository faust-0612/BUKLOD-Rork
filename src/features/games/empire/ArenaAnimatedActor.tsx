/**
 * BUKLOD Arena — reusable 2.5D character presentation.
 * Motion is visual-only. Server/simulation owns positions, hit damage, levels and items.
 * Before rigged/spritesheet art exists, the current canonical character portrait is used
 * as a breathing/moving badge rather than falsely rendering another hero.
 */
import React, { memo, useEffect } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Svg, {Circle, Defs, RadialGradient, Stop, Path} from 'react-native-svg';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';

const AnimatedExpoImage = Animated.createAnimatedComponent(ExpoImage);

type Props = {
  image: ImageSourcePropType;
  actorId: string;
  x: number;
  y: number;
  size: number;
  sprite: boolean;
  moving: boolean;
  friendly: boolean;
  active: boolean;
  pose?: 'idle' | 'walk' | 'attack' | 'skill';
  health?: number;
  selected?: boolean;
};

export const ArenaAnimatedActor = memo(function ArenaAnimatedActor({
  image, actorId, x, y, size, sprite, moving, friendly, active, pose='idle', health=1, selected=false,
}: Props) {
  const breath = useSharedValue(0);
  const motion = useSharedValue(0);
  const abilityFlash = useSharedValue(0);
  const screenX = useSharedValue(x - size / 2);
  const screenY = useSharedValue(y - size * 0.77);
  // Smooth the received 5Hz server snapshots / 10Hz practice frames on UI
  // thread without changing the authoritative world position or hit timing.
  useEffect(() => {
    const nextX = x - size / 2;
    const nextY = y - size * 0.77;
    const jump = Math.hypot(nextX - screenX.value, nextY - screenY.value);
    if (!active || jump > Math.max(110, size * 1.6)) {
      cancelAnimation(screenX);
      cancelAnimation(screenY);
      screenX.value = nextX;
      screenY.value = nextY;
    } else {
      const transition = { duration: 155, easing: Easing.out(Easing.quad) };
      screenX.value = withTiming(nextX, transition);
      screenY.value = withTiming(nextY, transition);
    }
  }, [x, y, size, active, screenX, screenY]);
  useEffect(() => {
    if (active) {
      breath.value = withRepeat(withTiming(1, { duration: 840, easing: Easing.inOut(Easing.sin) }), -1, true);
    } else {
      cancelAnimation(breath);
      cancelAnimation(motion);
      breath.value = 0;
      motion.value = 0;
    }
    return () => { cancelAnimation(breath); cancelAnimation(motion); };
  }, [active, breath, motion]);
  useEffect(() => {
    if (active) motion.value = withTiming(moving ? 1 : 0, { duration: 180 });
  }, [active, moving, motion]);
  useEffect(() => {
    cancelAnimation(abilityFlash);
    abilityFlash.value = 0;
    if (active && (pose === 'attack' || pose === 'skill')) {
      abilityFlash.value = withTiming(1, { duration: pose === 'skill' ? 550 : 340 });
    }
    return () => cancelAnimation(abilityFlash);
  }, [active, pose, abilityFlash]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: screenX.value },
      { translateY: screenY.value - (breath.value * (1.4 + motion.value * 3.3)) },
      { rotate: `${Math.sin(breath.value * Math.PI * 2) * (sprite ? 0.9 : 1.7)}deg` },
      { scale: 1 + breath.value * 0.032 + motion.value * 0.028 },
    ],
  }));

  const auraStyle = useAnimatedStyle(() => ({
    opacity: 0.54 + breath.value * 0.18 + (1 - abilityFlash.value) * (pose === 'skill' ? .18 : .05),
    transform: [{scale: 1 + breath.value*.06 + (1 - abilityFlash.value) * (pose === 'skill' ? .24 : .05)}],
  }));
  const ringColor = friendly ? '#78f7dd' : '#ffc59d';
  const hpWidth = (size*.70)*Math.max(0,Math.min(1,health));

  return (
    <Animated.View
      accessible={false}
      pointerEvents="none"
      style={[
        styles.actor, { left: 0, top: 0, width: size, height: size },
        animatedStyle,
      ]}
    >
      <Animated.View pointerEvents="none" style={[styles.aura,{width:size*1.22,height:size*.56,
          left:-size*.11,bottom:size*.10},auraStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 120 54">
          <Defs><RadialGradient id="arena-hero-aura" cx="50%" cy="50%" rx="48%" ry="45%">
            <Stop offset="0%" stopColor={ringColor} stopOpacity=".65"/>
            <Stop offset="65%" stopColor={ringColor} stopOpacity=".16"/>
            <Stop offset="100%" stopColor={ringColor} stopOpacity="0"/>
          </RadialGradient></Defs>
          <Circle cx="60" cy="27" r="26" fill="url(#arena-hero-aura)"/>
          <Path d="M8 27 Q60 -5 112 27 Q60 59 8 27 Z"
            stroke={ringColor} strokeOpacity={selected ? .95 : .48}
            strokeWidth={selected ? 2.4 : 1.2} fill="none"/>
          <Path d="M20 27 L100 27 M60 7 L60 47" stroke={ringColor} strokeOpacity=".29" strokeWidth="1"/>
        </Svg>
      </Animated.View>
      {(pose==='attack' || pose==='skill') && active ? <Animated.View pointerEvents="none"
        style={[styles.abilityFlash,{width:size*1.15,height:size*1.1,left:-size*.08,top:-size*.14},auraStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Circle cx="50" cy="50" r={pose==='skill'?42:34} stroke={pose==='skill'?'#b1dfff':'#ffdf90'}
            strokeWidth={pose==='skill'?2.4:1.5} fill="none" strokeDasharray="9 6"/>
          <Path d="M19 19L30 30 M81 19L70 30 M19 81L30 70 M81 81L70 70"
            stroke="#fff2c4" strokeWidth="2.4" strokeLinecap="round"/>
        </Svg>
      </Animated.View> : null}
      {!sprite ? <View pointerEvents="none" style={[
        styles.portraitFrame, {
          borderRadius: size / 2,
          borderColor: friendly ? '#87ffdf' : '#ffc0aa',
          backgroundColor: '#092b39',
        },
      ]}>
        <AnimatedExpoImage
          accessibilityLabel={actorId + ' BUKLOD avatar'}
          source={image}
          contentFit="cover"
          style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
        />
      </View> : <AnimatedExpoImage
        accessibilityLabel={actorId + ' BUKLOD character animation'}
        source={image}
        contentFit="contain"
        style={StyleSheet.absoluteFill}
      />}
      <View pointerEvents="none" style={[styles.hpBack,{width:size*.70,top:Math.max(0,size*.04)}]}>
        <View style={[styles.hpFill,{width:hpWidth,backgroundColor:friendly?'#92fac9':'#ffab87'}]}/>
      </View>
      <View pointerEvents="none" style={[styles.groundShadow, { bottom: -size * 0.1, width: size * 0.57 }]} />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  actor: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  aura: {position:'absolute',zIndex:-2},
  abilityFlash: {position:'absolute',zIndex:2},
  hpBack: {position:'absolute',height:4.6,borderRadius:4,backgroundColor:'#162834',borderColor:'#f5d9a2',borderWidth:.65,zIndex:5,left:'15%',overflow:'hidden'},
  hpFill: {height:'100%',borderRadius:3},
  portraitFrame: { flex: 1, width: '86%', overflow: 'hidden', borderWidth: 1.8, elevation: 4 },
  groundShadow: {
    position: 'absolute', height: 5, borderRadius: 12, backgroundColor: '#06131c88',
    alignSelf: 'center', zIndex: -1,
  },
});
