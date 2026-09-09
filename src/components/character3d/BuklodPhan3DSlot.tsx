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

export type BuklodPhan3DSlotProps = {
  level: number;
  body: string;
  equipment: string;
  height?: number;
  width?: number;
  animation?: Phan3DAnimation;
  quality?: Phan3DQuality;
  active?: boolean;
  style?: ViewStyle;
};

/**
 * Stable integration point for Phan 3D.
 *
 * This shared implementation deliberately keeps today's proven layered art as
 * the fallback. A platform-specific `BuklodPhan3DSlot.web.tsx` can replace the
 * viewport with the real GLB renderer without changing Profile/rank logic.
 */
export default function BuklodPhan3DSlot({
  level,
  body,
  equipment,
  height = 124,
  width = 82,
  style,
}: BuklodPhan3DSlotProps) {
  // Resolve/validate the level now so the integration contract is exercised
  // even while the real GLB asset is being authored.
  createPhan3DManifest(level);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.viewport,
        {
          width,
          height,
        },
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
