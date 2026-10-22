/* BUKLOD_CHARACTER_R31_PROGRESSIVE_ART_V2_SAFE */
/* Approved crop. Native sprite sheets are 4940px wide x 20 levels. */
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

import {
  PROGRESSIVE_CHARACTERS,
  type ProgressiveCharacterId,
} from '@/lib/buklodProgressiveCharacter';

type Props = {
  characterId: ProgressiveCharacterId;
  level: number;
  height: number;
  viewportWidth?: number;
};

const NATIVE_SPRITE_WIDTH = 4940;
const NATIVE_CELL_WIDTH = NATIVE_SPRITE_WIDTH / 20;
const NATIVE_ROW_HEIGHT: Record<ProgressiveCharacterId, number> = {
  phan: 516,
  quin: 568,
  van: 560,
  christian: 508,
  lhen: 512,
};

const SHEETS = {
  phan: require('../../../assets/images/characters/phan_r26.jpg'),
  quin: require('../../../assets/images/characters/quin_r26.jpg'),
  van: require('../../../assets/images/characters/van_r26.jpg'),
  christian: require('../../../assets/images/characters/christian_r26.jpg'),
  lhen: require('../../../assets/images/characters/lhen_r26.jpg'),
} as const;

export default function BuklodProgressiveCharacterArt({
  characterId,
  level,
  height,
  viewportWidth,
}: Props) {
  const profile = PROGRESSIVE_CHARACTERS[characterId];
  const safeLevel = Math.max(1, Math.min(20, Math.floor(Number(level) || 1)));
  const nativeRowHeight = NATIVE_ROW_HEIGHT[characterId] || profile.rowHeight * 4;
  // Uniformly scale the approved sprite crop at every preview size.
  const scale = height / nativeRowHeight;
  const artWidth = Math.max(1, Math.round(NATIVE_CELL_WIDTH * scale));
  const frameWidth =
    typeof viewportWidth === 'number' && Number.isFinite(viewportWidth) && viewportWidth > 0
      ? Math.max(1, Math.round(viewportWidth))
      : artWidth;
  const left = Math.round((frameWidth - artWidth) / 2);

  return (
    <View pointerEvents="none" style={[styles.frame, { width: frameWidth, height }]}>
      <View style={[styles.crop, { left, width: artWidth, height }]}>
        <Image
          key={`${characterId}-${safeLevel}`}
          source={SHEETS[characterId]}
          resizeMode="stretch"
          resizeMethod="scale"
          fadeDuration={0}
          style={{
            position: 'absolute',
            left: Math.round(-((safeLevel - 1) * NATIVE_CELL_WIDTH * scale)),
            top: 0,
            width: Math.round(NATIVE_SPRITE_WIDTH * scale),
            height: Math.round(nativeRowHeight * scale),
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  crop: {
    position: 'absolute',
    bottom: 0,
    overflow: 'hidden',
    borderRadius: 10,
  },
  zoomFrame: {
    overflow: 'hidden',
    borderRadius: 10,
  },
});
