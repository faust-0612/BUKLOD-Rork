import { useCallback, useEffect, useRef } from 'react';

import {
  Animated,
  Easing,
} from 'react-native';

import { useBuklodReduceMotion } from '@/components/HomeMotion';
import { useBuklodAmbientLife } from '@/hooks/useBuklodAmbientLife';
import {
  MOTION,
  REACTIONS,
} from '@/lib/character-lab-core/motion';
import {
  type CharacterPoseState,
  type CharacterReactionsMode,
  WAVE_REACTION_MS,
} from '@/lib/buklodCharacterEvents';
import type { ReactionId } from '@/lib/character-lab-core/types';

export type CharacterMotionValues = {
  entranceOpacity: Animated.Value;
  entranceTranslateY: Animated.Value;
  entranceScale: Animated.Value;
  breathScale: Animated.Value;
  breathTranslateY: Animated.Value;
  swayRotate: Animated.Value;
  headRotate: Animated.Value;
  poseTranslateY: Animated.Value;
  poseScale: Animated.Value;
  poseRotate: Animated.Value;
  swapOpacity: Animated.Value;
};

const WAVE_POSE = {
  durationMs: WAVE_REACTION_MS,
  hopPx: 9,
  scaleTo: 1.022,
  leanDeg: 0,
};

/** Reactions that must not lean — no separate arm pose layers exist. */
const NO_LEAN_REACTIONS: ReadonlySet<ReactionId> = new Set([
  'happy',
  'welcome',
  'celebrate',
]);

type ReactionSpec = {
  durationMs: number;
  hopPx: number;
  scaleTo: number;
  leanDeg: number;
};

function specForReaction(
  reactionId: ReactionId,
  poseState?: CharacterPoseState
): ReactionSpec {
  if (poseState === 'WAVE') return WAVE_POSE;
  const base = REACTIONS[reactionId];
  const leanDeg = NO_LEAN_REACTIONS.has(reactionId) ? 0 : base.leanDeg;
  return {
    durationMs: base.durationMs,
    hopPx: base.hopPx,
    scaleTo: base.scaleTo,
    leanDeg,
  };
}

function runReactionPulse(
  spec: ReactionSpec,
  targets: {
    poseTranslateY: Animated.Value;
    poseScale: Animated.Value;
    poseRotate: Animated.Value;
  }
) {
  const peakMs = Math.round(spec.durationMs * 0.42);
  const settleMs = Math.round(spec.durationMs * 0.58);

  Animated.parallel([
    Animated.sequence([
      Animated.timing(targets.poseTranslateY, {
        toValue: -spec.hopPx,
        duration: peakMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(targets.poseTranslateY, {
        toValue: 0,
        duration: settleMs,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]),
    Animated.sequence([
      Animated.timing(targets.poseScale, {
        toValue: spec.scaleTo,
        duration: peakMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(targets.poseScale, {
        toValue: 1,
        duration: settleMs,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]),
    Animated.sequence([
      Animated.timing(targets.poseRotate, {
        toValue: spec.leanDeg,
        duration: peakMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(targets.poseRotate, {
        toValue: 0,
        duration: settleMs,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]),
  ]).start();
}

export function useBuklodCharacterMotion(
  reactionId: ReactionId,
  reactionKey: number,
  options?: {
    entrance?: boolean;
    alive?: boolean;
    visible?: boolean;
    swapKey?: number;
    pointPresent?: boolean;
    poseState?: CharacterPoseState;
    reactionsMode?: CharacterReactionsMode;
  }
) {
  const reduceMotion = useBuklodReduceMotion();
  const entrance = options?.entrance ?? false;
  const alive = options?.alive ?? true;
  const visible = options?.visible ?? true;
  const swapKey = options?.swapKey ?? 0;
  const pointPresent = options?.pointPresent ?? false;
  const poseState = options?.poseState ?? 'IDLE';
  const reactionsMode = options?.reactionsMode ?? 'full';
  const idleActive = alive && visible && !reduceMotion;

  const entranceOpacity = useRef(new Animated.Value(entrance ? 0 : 1)).current;
  const entranceTranslateY = useRef(
    new Animated.Value(entrance ? MOTION.entrance.characterRiseFromPx : 0)
  ).current;
  const entranceScale = useRef(
    new Animated.Value(entrance ? MOTION.entrance.characterScaleFrom : 1)
  ).current;
  const breathScale = useRef(new Animated.Value(1)).current;
  const breathTranslateY = useRef(new Animated.Value(0)).current;
  const swayRotate = useRef(new Animated.Value(0)).current;
  const headRotate = useRef(new Animated.Value(0)).current;
  const poseTranslateY = useRef(new Animated.Value(0)).current;
  const poseScale = useRef(new Animated.Value(1)).current;
  const poseRotate = useRef(new Animated.Value(0)).current;
  const swapOpacity = useRef(new Animated.Value(1)).current;

  const firstReaction = useRef(true);

  const triggerAmbientNudge = useCallback(() => {
    if (!idleActive || reactionId !== 'neutral') return;
    runReactionPulse(WAVE_POSE, {
      poseTranslateY,
      poseScale,
      poseRotate,
    });
  }, [idleActive, poseRotate, poseScale, poseTranslateY, reactionId]);

  useBuklodAmbientLife(breathScale, breathTranslateY, swayRotate, {
    visible: idleActive,
    reactionsMode,
    reactionId,
    onMicroReaction: triggerAmbientNudge,
  });

  useEffect(() => {
    if (!entrance || reduceMotion) {
      entranceOpacity.setValue(1);
      entranceTranslateY.setValue(0);
      entranceScale.setValue(1);
      return;
    }

    const delay = MOTION.entrance.characterDelayMs;
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(entranceOpacity, {
          toValue: 1,
          duration: MOTION.entrance.characterMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(entranceTranslateY, {
          toValue: 0,
          duration: MOTION.entrance.characterMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(entranceScale, {
          toValue: 1,
          duration: MOTION.entrance.characterMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);

    return () => clearTimeout(timer);
  }, [
    entrance,
    entranceOpacity,
    entranceScale,
    entranceTranslateY,
    reduceMotion,
  ]);

  useEffect(() => {
    if (!idleActive) {
      headRotate.setValue(0);
      return;
    }

    const headLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(headRotate, {
          toValue: MOTION.idle.headDeg,
          duration: MOTION.idle.headLoopMs / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(headRotate, {
          toValue: -MOTION.idle.headDeg,
          duration: MOTION.idle.headLoopMs / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    headLoop.start();
    return () => headLoop.stop();
  }, [headRotate, idleActive]);

  useEffect(() => {
    if (!pointPresent || !idleActive || reactionId !== 'neutral') return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(poseTranslateY, {
          toValue: -3,
          duration: 680,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(poseTranslateY, {
          toValue: 0,
          duration: 680,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    pulse.start();
    return () => pulse.stop();
  }, [idleActive, pointPresent, poseTranslateY, reactionId]);

  useEffect(() => {
    if (firstReaction.current && reactionId === 'neutral') {
      firstReaction.current = false;
      return;
    }
    firstReaction.current = false;

    const spec = specForReaction(reactionId, poseState);
    if (
      spec.durationMs === 0 ||
      reduceMotion ||
      reactionsMode === 'off'
    ) {
      poseTranslateY.setValue(0);
      poseScale.setValue(1);
      poseRotate.setValue(0);
      return;
    }

    runReactionPulse(spec, {
      poseTranslateY,
      poseScale,
      poseRotate,
    });
  }, [
    entrance,
    poseRotate,
    poseScale,
    poseState,
    poseTranslateY,
    reactionId,
    reactionKey,
    reduceMotion,
    reactionsMode,
  ]);

  useEffect(() => {
    if (!swapKey || reduceMotion) return;

    swapOpacity.setValue(0.72);
    Animated.timing(swapOpacity, {
      toValue: 1,
      duration: MOTION.swap.layerSettleMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [reduceMotion, swapKey, swapOpacity]);

  const triggerCelebration = useCallback(() => {
    const spec = REACTIONS.celebrate;
    if (reduceMotion) return;

    runReactionPulse(spec, {
      poseTranslateY,
      poseScale,
      poseRotate,
    });
  }, [poseRotate, poseScale, poseTranslateY, reduceMotion]);

  return {
    entranceOpacity,
    entranceTranslateY,
    entranceScale,
    breathScale,
    breathTranslateY,
    swayRotate,
    headRotate,
    poseTranslateY,
    poseScale,
    poseRotate,
    swapOpacity,
    stageFlash: REACTIONS[reactionId].stageFlash,
    triggerCelebration,
  };
}
