/* BUKLOD_CHARACTER_STUDIO_LAYOUT_R2 */
import React from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';

import BuklodLocalCharacterFigure
  from '@/components/points/BuklodLocalCharacterFigure';

import type {
  BodyId,
  Equipment,
} from '@/lib/character-lab-core/types';

type Props = {
  body: BodyId;
  equipment: Equipment;
  size?: number;
  studio?: boolean;
};

export default function
BuklodCharacterCompactFullBody({
  body,
  equipment,
  size = 92,
  studio = false,
}: Props) {
  const height =
    studio ? 184 : 142;

  return (
    <View
      style={[
        styles.wrap,
        studio
          ? styles.studioWrap
          : styles.profileWrap,
        { height },
      ]}
      pointerEvents="none"
    >
      <View
        style={[
          styles.halo,
          studio
            ? styles.studioHalo
            : styles.profileHalo,
        ]}
      />

      <View
        style={styles.figure}
      >
        <BuklodLocalCharacterFigure
          body={body}
          equipment={equipment}
          width={size}
          mode="full"
        />
      </View>

      <View
        style={[
          styles.shadow,
          {
            width:
              studio
                ? Math.max(
                    58,
                    size * 0.62,
                  )
                : Math.max(
                    46,
                    size * 0.56,
                  ),
          },
        ]}
      />
    </View>
  );
}

const styles =
  StyleSheet.create({
    wrap: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'flex-end',
      alignSelf: 'center',
      overflow: 'hidden',
    },

    profileWrap: {
      width: 118,
    },

    studioWrap: {
      width: 172,
    },

    halo: {
      position: 'absolute',
      alignSelf: 'center',
      borderRadius: 999,
      backgroundColor:
        'rgba(31,122,61,0.065)',
      borderWidth: 1,
      borderColor:
        'rgba(31,122,61,0.10)',
    },

    profileHalo: {
      width: 98,
      height: 118,
      bottom: 9,
    },

    studioHalo: {
      width: 150,
      height: 164,
      bottom: 7,
    },

    figure: {
      zIndex: 2,
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginBottom: 9,
    },

    shadow: {
      position: 'absolute',
      zIndex: 1,
      bottom: 5,
      height: 9,
      borderRadius: 999,
      backgroundColor:
        'rgba(16,38,26,0.13)',
      transform: [
        { scaleY: 0.58 },
      ],
    },
  });