import React from 'react';

import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { LayerPlacement } from '@/lib/character-lab-core/assets';

type Props = {
  uri: string;
  placement: LayerPlacement;
  style?: StyleProp<ViewStyle>;
  opacity?: number;
  /** When true, image preserves natural aspect inside the placement box. */
  preserveAspect?: boolean;
};

/**
 * Single wardrobe layer positioned from atlas metadata (% of body box).
 * Fills the placement rectangle exactly — placements were computed for stretch-fit.
 */
export default function BuklodCharacterLayer({
  uri,
  placement,
  style,
  opacity = 1,
  preserveAspect = false,
}: Props) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.layer,
        {
          left: `${placement.left}%`,
          top: `${placement.top}%`,
          width: `${placement.width}%`,
          height: `${placement.height}%`,
          opacity,
        },
        style,
      ]}
    >
      <Image
        source={{ uri }}
        style={styles.image}
        contentFit={preserveAspect ? 'contain' : 'fill'}
        contentPosition="center"
        transition={180}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
