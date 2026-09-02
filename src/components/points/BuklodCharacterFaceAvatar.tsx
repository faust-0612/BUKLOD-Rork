/* BUKLOD_REAL_LAYERED_FACE_AVATAR_R8 */
import React from 'react';

import {
  StyleSheet,
  View,
} from 'react-native';

import BuklodCharacterLayeredArt
  from '@/components/points/BuklodCharacterLayeredArt';

import {
  FACE_RIG,
} from '@/lib/character-lab-core/assets';

import {
  useBuklodPresentation,
} from '@/hooks/useBuklodPresentation';

import {
  withAlpha,
} from '@/lib/buklodContrast';

import type {
  BodyId,
  Equipment,
  ReactionId,
} from '@/lib/character-lab-core/types';

type Props = {
  body: BodyId;
  equipment: Equipment;
  size?: number;
  reactionId?: ReactionId;
  reactionKey?: number;
  border?: boolean;
};

export default function
BuklodCharacterFaceAvatar({
  body,
  equipment,
  size = 56,
  border = true,
}: Props) {
  const {
    theme,
  } = useBuklodPresentation();

  const rig =
    FACE_RIG[body];

  const headSpanPercent =
    Math.max(
      8,
      rig.chinY -
        rig.headTop,
    );

  /*
   * Fit the REAL Character head to roughly 90% of the circle.
   * This derives scale from the calibrated anatomy rig rather than
   * using a guessed fixed zoom.
   */
  const artHeight =
    Math.max(
      size * 5,
      (
        size * 0.90
      ) /
        (
          headSpanPercent /
          100
        ),
    );

  const topOffset =
    -(
      artHeight *
      (
        rig.headTop /
        100
      )
    ) +
    size * 0.045;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.clip,
        {
          width: size,
          height: size,
          borderRadius:
            size / 2,
          borderColor:
            border
              ? withAlpha(
                  theme.accent,
                  0.55,
                )
              : 'transparent',
          backgroundColor:
            withAlpha(
              '#060A08',
              0.92,
            ),
        },
      ]}
    >
      <View
        style={[
          styles.realCrop,
          {
            top:
              topOffset,
          },
        ]}
      >
        <BuklodCharacterLayeredArt
          body={body}
          equipment={
            equipment
          }
          height={
            artHeight
          }
          showStage={false}
          showEffects={false}
        />
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    clip: {
      position: 'relative',
      overflow: 'hidden',
      borderWidth: 2,
      alignItems: 'center',
    },

    realCrop: {
      position: 'absolute',
      alignItems: 'center',
    },
  });
