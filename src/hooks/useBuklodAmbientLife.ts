import { useCallback, useEffect, useRef } from 'react';

import { Animated, Easing } from 'react-native';

import { useBuklodReduceMotion } from '@/components/HomeMotion';
import { MOTION } from '@/lib/character-lab-core/motion';
import type { CharacterReactionsMode } from '@/lib/buklodCharacterEvents';
import type { ReactionId } from '@/lib/character-lab-core/types';

type AmbientOptions = {
  visible?: boolean;
  reactionsMode?: CharacterReactionsMode;
  reactionId?: ReactionId;
  onMicroReaction?: () => void;
};

/**
 * Irregular idle life — breath, weight shift, optional ambient micro-reactions.
 * Uses refs/timers so loops are not restarted on every render.
 */
export function useBuklodAmbientLife(
  breathScale: Animated.Value,
  breathTranslateY: Animated.Value,
  swayRotate: Animated.Value,
  options: AmbientOptions = {}
) {
  const reduceMotion = useBuklodReduceMotion();
  const visible = options.visible ?? true;
  const reactionsMode = options.reactionsMode ?? 'full';
  const reactionId = options.reactionId ?? 'neutral';
  const onMicroReaction = options.onMicroReaction;

  const breathLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const weightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ambientTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const breathDurationRef = useRef<number>(
    MOTION.idle.breathLoopMs
  );

  const clearTimers = useCallback(() => {
    if (weightTimerRef.current) {
      clearTimeout(weightTimerRef.current);
      weightTimerRef.current = null;
    }
    if (ambientTimerRef.current) {
      clearTimeout(ambientTimerRef.current);
      ambientTimerRef.current = null;
    }
  }, []);

  const randomBreathMs = useCallback(() => {
    return 2600 + Math.floor(Math.random() * 800);
  }, []);

  const startBreathLoop = useCallback(() => {
    breathLoopRef.current?.stop();

    const half = breathDurationRef.current / 2;
    breathLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(breathScale, {
            toValue: MOTION.idle.breathScale,
            duration: half,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(breathTranslateY, {
            toValue: -MOTION.idle.breathLiftPx,
            duration: half,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(breathScale, {
            toValue: 1,
            duration: half,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(breathTranslateY, {
            toValue: 0,
            duration: half,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    breathLoopRef.current.start();
  }, [breathScale, breathTranslateY]);

  const scheduleWeightShift = useCallback(() => {
    if (!mountedRef.current) return;

    const delay = 5000 + Math.floor(Math.random() * 4000);
    weightTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;

      const direction = Math.random() > 0.5 ? 1 : -1;
      Animated.sequence([
        Animated.timing(swayRotate, {
          toValue: direction * MOTION.idle.swayDeg * 1.4,
          duration: 520,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(swayRotate, {
          toValue: 0,
          duration: 640,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]).start(() => {
        scheduleWeightShift();
      });
    }, delay);
  }, [swayRotate]);

  const scheduleAmbientReaction = useCallback(() => {
    if (!mountedRef.current) return;

    const delay = 12000 + Math.floor(Math.random() * 12000);
    ambientTimerRef.current = setTimeout(() => {
      if (
        mountedRef.current &&
        reactionsMode === 'full' &&
        reactionId === 'neutral' &&
        onMicroReaction
      ) {
        onMicroReaction();
      }
      scheduleAmbientReaction();
    }, delay);
  }, [onMicroReaction, reactionId, reactionsMode]);

  useEffect(() => {
    mountedRef.current = true;
    const idleActive =
      visible && !reduceMotion && reactionsMode !== 'off';

    clearTimers();
    breathLoopRef.current?.stop();

    if (!idleActive) {
      breathScale.setValue(1);
      breathTranslateY.setValue(0);
      swayRotate.setValue(0);
      return () => {
        mountedRef.current = false;
        clearTimers();
        breathLoopRef.current?.stop();
      };
    }

    breathDurationRef.current = randomBreathMs();
    startBreathLoop();
    scheduleWeightShift();
    if (reactionsMode === 'full') {
      scheduleAmbientReaction();
    }

    return () => {
      mountedRef.current = false;
      clearTimers();
      breathLoopRef.current?.stop();
    };
  }, [
    breathScale,
    breathTranslateY,
    clearTimers,
    randomBreathMs,
    reactionsMode,
    reduceMotion,
    scheduleAmbientReaction,
    scheduleWeightShift,
    startBreathLoop,
    swayRotate,
    visible,
  ]);
}
