import React from 'react';
import {
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import BuklodCharacterLayeredArt
  from '@/components/points/BuklodCharacterLayeredArt';
import {
  createPhan3DManifest,
  type Phan3DAnimation,
  type Phan3DQuality,
} from '@/components/character3d/phan3dConfig';
import type {
  BodyId,
  Equipment,
} from '@/lib/character-lab-core/types';

export type BuklodPhan3DSlotProps = {
  level: number;
  body: BodyId;
  equipment: Equipment;
  height?: number;
  width?: number;
  animation?: Phan3DAnimation;
  quality?: Phan3DQuality;
  active?: boolean;
  style?: ViewStyle;
};

/**
 * Stable cross-platform integration point for Phan 3D.
 * Native/non-web platforms intentionally keep the proven layered character.
 * The web-specific sibling loads the real GLB only when the asset is present.
 */
export default function BuklodPhan3DSlot({
  level,
  body,
  equipment,
  height = 124,
  width = 82,
  style,
}: BuklodPhan3DSlotProps) {
  createPhan3DManifest(level);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.viewport,
        { width, height },
        style,
      ]}
    >
      <BuklodCharacterLayeredArt
        body={body}
        equipment={equipment}
        height={height}
        viewportWidth={width}
        showStage={false}
        showEffects={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
});
