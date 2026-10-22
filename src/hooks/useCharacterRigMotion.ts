import { useEffect, useRef, useState } from 'react';

import { Animated, Easing } from 'react-native';

import { useBuklodReduceMotion } from '@/components/HomeMotion';
import type {
  CharacterPoseState,
  CharacterReactionsMode,
} from '@/lib/buklodCharacterEvents';
import { REST_JOINTS } from '@/lib/character-rig/skeletonMale';

export type RigJointValues = {
  rootRot: Animated.Value;
  torsoRot: Animated.Value;
  headRot: Animated.Value;
  lShoulder: Animated.Value;
  lElbow: Animated.Value;
  lHand: Animated.Value;
  rShoulder: Animated.Value;
  rElbow: Animated.Value;
  rHand: Animated.Value;
  lHip: Animated.Value;
  lKnee: Animated.Value;
  lFoot: Animated.Value;
  rHip: Animated.Value;
  rKnee: Animated.Value;
  rFoot: Animated.Value;
};

function makeRigJoints(): RigJointValues {
  return {
    rootRot: new Animated.Value(REST_JOINTS.rootRot),
    torsoRot: new Animated.Value(REST_JOINTS.torsoRot),
    headRot: new Animated.Value(REST_JOINTS.headRot),
    lShoulder: new Animated.Value(REST_JOINTS.lShoulder),
    lElbow: new Animated.Value(REST_JOINTS.lElbow),
    lHand: new Animated.Value(REST_JOINTS.lHand),
    rShoulder: new Animated.Value(REST_JOINTS.rShoulder),
    rElbow: new Animated.Value(REST_JOINTS.rElbow),
    rHand: new Animated.Value(REST_JOINTS.rHand),
    lHip: new Animated.Value(REST_JOINTS.lHip),
    lKnee: new Animated.Value(REST_JOINTS.lKnee),
    lFoot: new Animated.Value(REST_JOINTS.lFoot),
    rHip: new Animated.Value(REST_JOINTS.rHip),
    rKnee: new Animated.Value(REST_JOINTS.rKnee),
    rFoot: new Animated.Value(REST_JOINTS.rFoot),
  };
}

function to(
  value: Animated.Value,
  toValue: number,
  duration: number,
  easing = Easing.inOut(Easing.cubic)
) {
  return Animated.timing(value, {
    toValue,
    duration,
    easing,
    useNativeDriver: false,
  });
}

function resetAll(j: RigJointValues, duration: number) {
  return Animated.parallel([
    to(j.rootRot, REST_JOINTS.rootRot, duration),
    to(j.torsoRot, REST_JOINTS.torsoRot, duration),
    to(j.headRot, REST_JOINTS.headRot, duration),
    to(j.lShoulder, REST_JOINTS.lShoulder, duration),
    to(j.lElbow, REST_JOINTS.lElbow, duration),
    to(j.lHand, REST_JOINTS.lHand, duration),
    to(j.rShoulder, REST_JOINTS.rShoulder, duration),
    to(j.rElbow, REST_JOINTS.rElbow, duration),
    to(j.rHand, REST_JOINTS.rHand, duration),
  ]);
}

function playNod(j: RigJointValues, slow: boolean) {
  const down = slow ? 700 : 420;
  const hold = slow ? 160 : 90;
  const up = slow ? 560 : 340;
  return Animated.sequence([
    to(j.headRot, 13, down, Easing.out(Easing.quad)),
    Animated.delay(hold),
    to(j.headRot, REST_JOINTS.headRot, up, Easing.inOut(Easing.cubic)),
    to(j.headRot, 8, slow ? 420 : 260, Easing.out(Easing.quad)),
    to(j.headRot, REST_JOINTS.headRot, slow ? 400 : 260, Easing.inOut(Easing.cubic)),
  ]);
}

function playWave(j: RigJointValues, slow: boolean) {
  const lift = slow ? 520 : 320;
  const flap = slow ? 220 : 140;
  const back = slow ? 480 : 300;
  return Animated.sequence([
    Animated.parallel([
      to(j.rShoulder, -122, lift),
      to(j.rElbow, -58, lift),
    ]),
    to(j.rHand, 30, flap, Easing.inOut(Easing.sin)),
    to(j.rHand, -26, flap, Easing.inOut(Easing.sin)),
    to(j.rHand, 28, flap, Easing.inOut(Easing.sin)),
    to(j.rHand, REST_JOINTS.rHand, flap, Easing.inOut(Easing.sin)),
    Animated.parallel([
      to(j.rShoulder, REST_JOINTS.rShoulder, back),
      to(j.rElbow, REST_JOINTS.rElbow, back),
      to(j.rHand, REST_JOINTS.rHand, back),
    ]),
  ]);
}

function playPoint(j: RigJointValues, slow: boolean) {
  const lift = slow ? 560 : 340;
  const hold = slow ? 480 : 320;
  const back = slow ? 500 : 340;
  return Animated.sequence([
    Animated.parallel([
      to(j.rShoulder, -74, lift),
      to(j.rElbow, -8, lift),
      to(j.rHand, 6, lift),
    ]),
    Animated.delay(hold),
    Animated.parallel([
      to(j.rShoulder, REST_JOINTS.rShoulder, back),
      to(j.rElbow, REST_JOINTS.rElbow, back),
      to(j.rHand, REST_JOINTS.rHand, back),
    ]),
  ]);
}

function animationFor(
  pose: CharacterPoseState,
  j: RigJointValues
): Animated.CompositeAnimation | null {
  switch (pose) {
    case 'NOD':
      return playNod(j, false);
    case 'NOD_SLOW':
      return playNod(j, true);
    case 'WAVE':
    case 'WELCOME':
      return playWave(j, false);
    case 'WAVE_SLOW':
      return playWave(j, true);
    case 'POINT_PRESENT':
      return playPoint(j, false);
    case 'POINT_SLOW':
      return playPoint(j, true);
    default:
      return null;
  }
}

export function useCharacterRigMotion(
  poseState: CharacterPoseState,
  reactionKey: number,
  options?: {
    reactionsMode?: CharacterReactionsMode;
  }
) {
  const reduceMotion = useBuklodReduceMotion();
  const reactionsMode = options?.reactionsMode ?? 'full';
  const jointsRef = useRef<RigJointValues>(makeRigJoints());
  const joints = jointsRef.current;
  const runRef = useRef<Animated.CompositeAnimation | null>(null);
  const first = useRef(true);

  useEffect(() => {
    runRef.current?.stop();

    if (
      first.current &&
      (poseState === 'IDLE' || poseState === 'THINKING')
    ) {
      first.current = false;
      return;
    }
    first.current = false;

    if (reduceMotion || reactionsMode === 'off') {
      resetAll(joints, 1).start();
      return;
    }

    const anim = animationFor(poseState, joints);
    if (!anim) {
      if (poseState === 'IDLE') resetAll(joints, 220).start();
      return;
    }

    runRef.current = anim;
    anim.start();
    return () => anim.stop();
  }, [joints, poseState, reactionKey, reactionsMode, reduceMotion]);

  return joints;
}

/** Discrete blink — swaps EYES_OPEN / EYES_CLOSED. Does not transform the head. */
export function useCharacterBlink(alive: boolean): boolean {
  const reduceMotion = useBuklodReduceMotion();
  const [closed, setClosed] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setClosed(false);
    if (!alive || reduceMotion) return;

    let cancelled = false;
    const schedule = () => {
      const gap = 2800 + Math.random() * 3400;
      const t = setTimeout(() => {
        if (cancelled) return;
        setClosed(true);
        const t2 = setTimeout(() => {
          if (cancelled) return;
          setClosed(false);
          schedule();
        }, 90);
        timers.current.push(t2);
      }, gap);
      timers.current.push(t);
    };
    schedule();
    return () => {
      cancelled = true;
      timers.current.forEach(clearTimeout);
    };
  }, [alive, reduceMotion]);

  return closed;
}
