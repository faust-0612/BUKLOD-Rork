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
};

export const ArenaAnimatedActor = memo(function ArenaAnimatedActor({
  image, actorId, x, y, size, sprite, moving, friendly, active,
}: Props) {
  const breath = useSharedValue(0);
  const motion = useSharedValue(0);
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

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -(breath.value * (1.4 + motion.value * 3.3)) },
      { rotate: `${Math.sin(breath.value * Math.PI * 2) * (sprite ? 0.9 : 1.7)}deg` },
      { scale: 1 + breath.value * 0.032 + motion.value * 0.028 },
    ],
  }));

  return (
    <Animated.View
      accessible={false}
      pointerEvents="none"
      style={[
        styles.actor, { left: x - size / 2, top: y - size * 0.77, width: size, height: size },
        animatedStyle,
      ]}
    >
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
      <View pointerEvents="none" style={[styles.groundShadow, { bottom: -size * 0.1, width: size * 0.57 }]} />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  actor: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  portraitFrame: { flex: 1, width: '86%', overflow: 'hidden', borderWidth: 1.8, elevation: 4 },
  groundShadow: {
    position: 'absolute', height: 5, borderRadius: 12, backgroundColor: '#06131c88',
    alignSelf: 'center', zIndex: -1,
  },
});
