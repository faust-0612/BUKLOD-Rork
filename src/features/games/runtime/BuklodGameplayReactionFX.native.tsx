/**
 * Gameplay-linked FX for Android Kingdom stations. Reactions come from the same
 * accepted gameplay feedback events as audio/haptics, never from score guesses.
 * One short-lived Reanimated UI-thread animation, bounded Skia draws, no timers,
 * network, currency mutation, touch handlers, or new native dependencies.
 */
import React, { memo, useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { BlurMask, Canvas, Circle, Fill, Group } from '@shopify/react-native-skia';
import {
  cancelAnimation, Easing, useDerivedValue, useSharedValue, withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { subscribeBuklodGameCharacterMotion } from './characterMotionBus';
import type { BuklodCharacterReaction } from '@/components/points/BuklodCharacterMotion';

type GameplayReaction = Extract<
  BuklodCharacterReaction,
  'move' | 'collect' | 'impact' | 'success' | 'failure' | 'unlock'
>;

const DURATION_MS: Record<GameplayReaction, number> = {
  move: 230, collect: 520, impact: 320, success: 950, failure: 510, unlock: 750,
};
const COLORS: Record<GameplayReaction, string> = {
  move: '#9aeaff', collect: '#fff6a3', impact: '#ff808b',
  success: '#b8ffe6', failure: '#ff9bad', unlock: '#ffe3a3',
};
const BURST_PARTICLES = 12;

function isGameplayReaction(value: BuklodCharacterReaction): value is GameplayReaction {
  return value === 'move' || value === 'collect' || value === 'impact'
    || value === 'success' || value === 'failure' || value === 'unlock';
}

const Particle = memo(function Particle({
  index, progress, reaction, centerX, centerY, color,
}: {
  index: number;
  progress: SharedValue<number>;
  reaction: GameplayReaction;
  centerX: number;
  centerY: number;
  color: string;
}) {
  // Fixed particle count and positions are deterministic, with no JS frame loop.
  const angle = index * Math.PI * 2 / BURST_PARTICLES;
  const length = reaction === 'success' ? 154 : reaction === 'unlock' ? 125 : 98;
  const x = useDerivedValue(() => centerX + Math.cos(angle) * (22 + progress.value * length));
  const y = useDerivedValue(() => centerY + Math.sin(angle) * (16 + progress.value * length * .7));
  const r = useDerivedValue(() => Math.max(0.3, (reaction === 'success' ? 5 : 3.5) * (1 - progress.value * .75)));
  const alpha = useDerivedValue(() => Math.max(0, (1 - progress.value) * .92));
  return <Group opacity={alpha}><Circle cx={x} cy={y} r={r} color={color} /></Group>;
});

function BuklodGameplayReactionFX({ enabled }: { enabled: boolean }) {
  const [reaction, setReaction] = useState<GameplayReaction | null>(null);
  const progress = useSharedValue(1);
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    if (!enabled) {
      cancelAnimation(progress);
      progress.value = 1;
      setReaction(null);
      return;
    }
    const unsubscribe = subscribeBuklodGameCharacterMotion(event => {
      if (!isGameplayReaction(event.type)) return;
      // Feedback is already debounced upstream; always restart a single pulse.
      cancelAnimation(progress);
      setReaction(event.type);
      progress.value = 0;
      progress.value = withTiming(1, {
        duration: DURATION_MS[event.type], easing: Easing.out(Easing.cubic),
      });
    });
    return () => {
      unsubscribe();
      cancelAnimation(progress);
      progress.value = 1;
    };
  }, [enabled, progress]);

  const ringRadius = useDerivedValue(() => 23 + progress.value * 95);
  const ringAlpha = useDerivedValue(() => Math.max(0, (1 - progress.value) * .82));
  const haloRadius = useDerivedValue(() => 24 + progress.value * 66);
  const flashAlpha = useDerivedValue(() => Math.max(0, (1 - progress.value) * .12));
  // FX share the gameplay screen but never occupy the input responder layer.
  if (!enabled || !reaction) return null;

  const centerX = width * .5;
  const centerY = height * .48;
  const color = COLORS[reaction];
  const showSparks = reaction === 'collect' || reaction === 'success' || reaction === 'unlock';

  return <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Canvas style={{ width, height }}>
      {reaction === 'impact' || reaction === 'failure' ? (
        <Group opacity={flashAlpha}><Fill color={color} /></Group>
      ) : null}
      <Group opacity={ringAlpha}>
        <Circle cx={centerX} cy={centerY} r={haloRadius} color={color}>
          <BlurMask blur={9} style="normal" />
        </Circle>
        <Circle cx={centerX} cy={centerY} r={ringRadius} color={color}
          style="stroke" strokeWidth={reaction === 'success' ? 6 : 3} />
      </Group>
      {showSparks ? Array.from({ length: BURST_PARTICLES }, (_, index) => (
        <Particle key={index} index={index} progress={progress} reaction={reaction}
          centerX={centerX} centerY={centerY} color={color} />
      )) : null}
    </Canvas>
  </View>;
}

export default memo(BuklodGameplayReactionFX);
