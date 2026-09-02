import React from 'react';

import Svg, { G } from 'react-native-svg';

import RigJoint from '@/components/character-rig/RigJoint';
import {
  MaleEyesClosed,
  MaleEyesOpen,
  MaleFoot,
  MaleForearm,
  MaleHairBack,
  MaleHairFront,
  MaleHand,
  MaleHead,
  MaleMouth,
  MaleNeck,
  MaleShin,
  MALE_SLOT_BOXES,
  MaleThigh,
  MaleTorso,
  MaleUpperArm,
} from '@/components/character-rig/art/MaleStarterArt';
import {
  useCharacterBlink,
  useCharacterRigMotion,
} from '@/hooks/useCharacterRigMotion';
import type {
  CharacterPoseState,
  CharacterReactionsMode,
} from '@/lib/buklodCharacterEvents';
import { RIG_VIEWBOX } from '@/lib/character-rig/contract';
import { MALE_SKELETON } from '@/lib/character-rig/skeletonMale';
import type { MouthSlotId } from '@/lib/character-rig/contract';

type Props = {
  poseState?: CharacterPoseState;
  reactionKey?: number;
  talking?: boolean;
  alive?: boolean;
  reactionsMode?: CharacterReactionsMode;
  debugSkeleton?: boolean;
  bustCrop?: boolean;
};

function Arm({
  side,
  joints,
  debug,
}: {
  side: 'left' | 'right';
  joints: ReturnType<typeof useCharacterRigMotion>;
  debug: boolean;
}) {
  const sk = MALE_SKELETON;
  const isL = side === 'left';
  const origin = isL ? sk.lShoulder : sk.rShoulder;
  const shoulder = isL ? joints.lShoulder : joints.rShoulder;
  const elbow = isL ? joints.lElbow : joints.rElbow;
  const hand = isL ? joints.lHand : joints.rHand;

  return (
    <RigJoint
      x={origin.x}
      y={origin.y}
      angle={shoulder}
      debug={debug}
      debugLabel={isL ? 'L.SHOULDER' : 'R.SHOULDER'}
      debugBox={MALE_SLOT_BOXES.UPPER_ARM}
      debugBoneTo={{ x: 0, y: sk.bones.upperArm }}
    >
      <MaleUpperArm />
      <RigJoint
        x={0}
        y={sk.bones.upperArm}
        angle={elbow}
        debug={debug}
        debugLabel={isL ? 'L.ELBOW' : 'R.ELBOW'}
        debugBox={MALE_SLOT_BOXES.FOREARM}
        debugBoneTo={{ x: 0, y: sk.bones.forearm }}
      >
        <MaleForearm />
        <RigJoint
          x={0}
          y={sk.bones.forearm}
          angle={hand}
          debug={debug}
          debugLabel={isL ? 'L.WRIST' : 'R.WRIST'}
          debugBox={MALE_SLOT_BOXES.HAND}
        >
          <MaleHand side={side} />
        </RigJoint>
      </RigJoint>
    </RigJoint>
  );
}

function Leg({
  side,
  joints,
  debug,
}: {
  side: 'left' | 'right';
  joints: ReturnType<typeof useCharacterRigMotion>;
  debug: boolean;
}) {
  const sk = MALE_SKELETON;
  const isL = side === 'left';
  const origin = isL ? sk.lHip : sk.rHip;
  const hip = isL ? joints.lHip : joints.rHip;
  const knee = isL ? joints.lKnee : joints.rKnee;
  const foot = isL ? joints.lFoot : joints.rFoot;

  return (
    <RigJoint
      x={origin.x}
      y={origin.y}
      angle={hip}
      debug={debug}
      debugLabel={isL ? 'L.HIP' : 'R.HIP'}
      debugBox={MALE_SLOT_BOXES.THIGH}
      debugBoneTo={{ x: 0, y: sk.bones.thigh }}
    >
      <MaleThigh />
      <RigJoint
        x={0}
        y={sk.bones.thigh}
        angle={knee}
        debug={debug}
        debugLabel={isL ? 'L.KNEE' : 'R.KNEE'}
        debugBox={MALE_SLOT_BOXES.SHIN}
        debugBoneTo={{ x: 0, y: sk.bones.shin }}
      >
        <MaleShin />
        <RigJoint
          x={0}
          y={sk.bones.shin}
          angle={foot}
          debug={debug}
          debugLabel={isL ? 'L.ANKLE' : 'R.ANKLE'}
          debugBox={MALE_SLOT_BOXES.FOOT}
        >
          <MaleFoot />
        </RigJoint>
      </RigJoint>
    </RigJoint>
  );
}

/**
 * Character ENGINE. Art is injected per slot and is independent of the
 * transform hierarchy. Male starter art is the current production set.
 */
export default function CharacterRigView({
  poseState = 'IDLE',
  reactionKey = 0,
  talking = false,
  alive = true,
  reactionsMode = 'full',
  debugSkeleton = false,
  bustCrop = false,
}: Props) {
  const sk = MALE_SKELETON;
  const joints = useCharacterRigMotion(poseState, reactionKey, {
    reactionsMode,
  });
  const eyesClosed = useCharacterBlink(alive);
  const mouth: MouthSlotId = talking ? 'MOUTH_SMALL_OPEN' : 'MOUTH_NEUTRAL';

  const viewBox = bustCrop
    ? '70 20 120 170'
    : `0 0 ${RIG_VIEWBOX.w} ${RIG_VIEWBOX.h}`;

  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={viewBox}
      preserveAspectRatio={bustCrop ? 'xMidYMin meet' : 'xMidYMax meet'}
    >
      <G x={sk.root.x} y={sk.root.y}>
        <RigJoint
          x={0}
          y={0}
          angle={joints.rootRot}
          debug={debugSkeleton}
          debugLabel="ROOT"
        >
          <Leg side="left" joints={joints} debug={debugSkeleton} />
          <Leg side="right" joints={joints} debug={debugSkeleton} />

          <RigJoint
            x={sk.torso.x}
            y={sk.torso.y}
            angle={joints.torsoRot}
            debug={debugSkeleton}
            debugLabel="TORSO"
            debugBox={MALE_SLOT_BOXES.TORSO}
            debugBoneTo={sk.head}
          >
            <Arm side="left" joints={joints} debug={debugSkeleton} />
            <MaleTorso />

            <G x={sk.head.x} y={sk.head.y}>
              <MaleNeck />
              <RigJoint
                x={0}
                y={0}
                angle={joints.headRot}
                debug={debugSkeleton}
                debugLabel="NECK/HEAD"
                debugBox={MALE_SLOT_BOXES.HEAD}
              >
                <MaleHairBack />
                <MaleHead />
                {eyesClosed ? <MaleEyesClosed /> : <MaleEyesOpen />}
                <MaleMouth state={mouth} />
                <MaleHairFront />
              </RigJoint>
            </G>

            <Arm side="right" joints={joints} debug={debugSkeleton} />
          </RigJoint>
        </RigJoint>
      </G>
    </Svg>
  );
}
