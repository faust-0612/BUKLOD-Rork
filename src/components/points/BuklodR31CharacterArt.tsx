/* BUKLOD_R31_GOLDEN_ART_PRESERVED_PHASE1 */
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

import type { BuklodWorldCharacterId } from '@/lib/buklodCharacterWorldV3';

const R31_ART: Partial<Record<BuklodWorldCharacterId, {
  source: ImageSourcePropType;
  stripWidth: number;
  stripHeight: number;
}>> = {
  phan: { source: require('../../../assets/images/characters/phan_r26.jpg'), stripWidth: 4940, stripHeight: 516 },
  quin: { source: require('../../../assets/images/characters/quin_r26.jpg'), stripWidth: 4940, stripHeight: 568 },
  van: { source: require('../../../assets/images/characters/van_r26.jpg'), stripWidth: 4940, stripHeight: 560 },
  christian: { source: require('../../../assets/images/characters/christian_r26.jpg'), stripWidth: 4940, stripHeight: 508 },
  lhen: { source: require('../../../assets/images/characters/lhen_r26.jpg'), stripWidth: 4940, stripHeight: 512 },
};

type Props = {
  characterId: BuklodWorldCharacterId;
  level?: number;
  height?: number;
  viewportWidth?: number;
};

export default function BuklodR31CharacterArt({
  characterId,
  level = 1,
  height = 180,
  viewportWidth = 112,
}: Props) {
  const art = R31_ART[characterId];
  if (!art) return null;

  const safeLevel = Math.max(1, Math.min(20, Math.floor(level || 1)));
  const frameWidth = art.stripWidth / 20;
  const scale = height / art.stripHeight;
  const renderedFrameWidth = frameWidth * scale;
  const renderedStripWidth = art.stripWidth * scale;
  const centerOffset = (viewportWidth - renderedFrameWidth) / 2;
  const left = centerOffset - ((safeLevel - 1) * renderedFrameWidth);

  return (
    <View style={[styles.viewport, { width: viewportWidth, height }]} pointerEvents="none">
      <Image
        source={art.source}
        resizeMode="stretch"
        fadeDuration={0}
        style={{
          position: 'absolute',
          left,
          top: 0,
          width: renderedStripWidth,
          height,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});
