import React from 'react';

import { StyleSheet, View } from 'react-native';

import BuklodLocalCharacterFigure from '@/components/points/BuklodLocalCharacterFigure';
import { BASE_ASPECT } from '@/lib/character-lab-core/assets';
import type { BodyId, Equipment } from '@/lib/character-lab-core/types';

type Props = {
  body: BodyId;
  equipment: Equipment;
  width?: number;
  bustCrop?: boolean;
};

/** Static local composite for pickers and review — no remote artwork. */
export default function BuklodCharacterApprovedComposite({
  body,
  equipment,
  width,
  bustCrop = false,
}: Props) {
  const aspect = BASE_ASPECT[body];
  const containerStyle = width
    ? {
        width,
        height: bustCrop ? width * 0.72 : width / aspect,
      }
    : styles.fill;

  return (
    <View style={[containerStyle, styles.root]}>
      <BuklodLocalCharacterFigure
        body={body}
        equipment={equipment}
        bustCrop={bustCrop}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  root: {
    position: 'relative',
    overflow: 'hidden',
  },
});
