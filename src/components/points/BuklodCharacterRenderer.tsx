import React, {
  forwardRef,
  useImperativeHandle,
} from 'react';

import {
  Animated,
  StyleSheet,
  View,
} from 'react-native';

import BuklodLocalCharacterFigure from '@/components/points/BuklodLocalCharacterFigure';
import { useBuklodCharacterMotion } from '@/components/points/BuklodCharacterMotionController';
import { useBuklodReduceMotion } from '@/components/HomeMotion';
import { useBuklodCharacterBlink } from '@/hooks/useBuklodCharacterBlink';
import type {
  CharacterPoseState,
  CharacterReactionsMode,
} from '@/lib/buklodCharacterEvents';
import { BASE_ASPECT } from '@/lib/character-lab-core/assets';
import { MOTION } from '@/lib/character-lab-core/motion';
import type {
  BodyId,
  Equipment,
  ReactionId,
  SlotId,
} from '@/lib/character-lab-core/types';

export type BuklodCharacterRendererRef = {
  triggerCelebration: () => void;
};

type Props = {
  body: BodyId;
  equipment: Equipment;
  width?: number;
  reactionId?: ReactionId;
  reactionKey?: number;
  entrance?: boolean;
  alive?: boolean;
  visible?: boolean;
  pointPresent?: boolean;
  swapKey?: number;
  poseState?: CharacterPoseState;
  reactionsMode?: CharacterReactionsMode;
  talking?: boolean;
  showBaseOnly?: boolean;
  enabledCategories?: readonly SlotId[] | 'all';
  calibrationMode?: boolean;
  bustCrop?: boolean;
  debugSkeleton?: boolean;
};

/**
 * Living character — local stylized figure colored by catalog unlocks.
 * Wardrobe, lifetime stages, and special effects stay data-driven.
 */
const BuklodCharacterRenderer = forwardRef<
  BuklodCharacterRendererRef,
  Props
>(function BuklodCharacterRenderer(
  {
    body,
    equipment,
    width,
    reactionId = 'neutral',
    reactionKey = 0,
    entrance = false,
    alive = true,
    visible = true,
    pointPresent = false,
    swapKey = 0,
    poseState = 'IDLE',
    reactionsMode = 'full',
    showBaseOnly = false,
    enabledCategories = 'all',
    bustCrop = false,
  },
  ref
) {
  const reduceMotion = useBuklodReduceMotion();
  const aspect = BASE_ASPECT[body];

  const motion = useBuklodCharacterMotion(reactionId, reactionKey, {
    entrance,
    alive,
    visible,
    swapKey,
    pointPresent,
    poseState,
    reactionsMode,
  });

  useImperativeHandle(ref, () => ({
    triggerCelebration: motion.triggerCelebration,
  }));

  const lidsClosed = useBuklodCharacterBlink(alive, reduceMotion);

  const headRotate = motion.headRotate.interpolate({
    inputRange: [-MOTION.idle.headDeg, MOTION.idle.headDeg],
    outputRange: [
      `${-MOTION.idle.headDeg}deg`,
      `${MOTION.idle.headDeg}deg`,
    ],
  });

  const swayRotate = motion.swayRotate.interpolate({
    inputRange: [-MOTION.idle.swayDeg, MOTION.idle.swayDeg],
    outputRange: [
      `${-MOTION.idle.swayDeg}deg`,
      `${MOTION.idle.swayDeg}deg`,
    ],
  });

  const containerStyle = width
    ? {
        width,
        height: bustCrop ? width * 0.72 : width / aspect,
      }
    : styles.fill;

  return (
    <View style={containerStyle}>
      <Animated.View
        style={[
          styles.fill,
          {
            opacity: motion.entranceOpacity,
            transform: [
              { translateY: motion.entranceTranslateY },
              { scale: motion.entranceScale },
            ],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.fill,
            {
              transform: [{ rotate: swayRotate }],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.fill,
              {
                transform: [
                  { translateY: motion.poseTranslateY },
                  { scale: motion.poseScale },
                  {
                    rotate: motion.poseRotate.interpolate({
                      inputRange: [-8, 8],
                      outputRange: ['-8deg', '8deg'],
                    }),
                  },
                ],
              },
            ]}
          >
            <Animated.View
              style={[
                styles.fill,
                {
                  opacity: motion.swapOpacity,
                  transform: [
                    { scale: motion.breathScale },
                    { translateY: motion.breathTranslateY },
                    { rotate: headRotate },
                  ],
                },
              ]}
            >
              <BuklodLocalCharacterFigure
                body={body}
                equipment={equipment}
                bustCrop={bustCrop}
                showBaseOnly={showBaseOnly}
                enabledCategories={enabledCategories}
                eyesClosed={lidsClosed}
              />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </View>
  );
});

export default BuklodCharacterRenderer;

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
