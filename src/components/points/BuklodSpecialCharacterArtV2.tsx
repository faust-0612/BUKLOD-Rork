/* BUKLOD_CHARACTER_V2_SPECIAL_ATLAS_ART */
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { BuklodSpecialCharacterId } from '@/lib/buklodCharacterSelectionV2';

type Props = {
  characterId: BuklodSpecialCharacterId;
  height: number;
  viewportWidth?: number;
};

// Approved Series-1 character sheets, packed 4 x 2 for fast web delivery.
const CELL = 80;
const ATLAS_WIDTH = 320;
const ATLAS_HEIGHT = 160;
const ATLAS = require('../../../assets/images/characters/buklod_special_series1_v2.webp');

const CELLS: Record<BuklodSpecialCharacterId, { col: number; row: number }> = {
  jawo: { col: 0, row: 0 },
  trudice: { col: 1, row: 0 },
  ace: { col: 2, row: 0 },
  mitch: { col: 3, row: 0 },
  niel: { col: 0, row: 1 },
  angel: { col: 1, row: 1 },
  vhen: { col: 2, row: 1 },
  ellusur: { col: 3, row: 1 },
};

export default function BuklodSpecialCharacterArtV2({
  characterId,
  height,
  viewportWidth,
}: Props) {
  const cell = CELLS[characterId];
  const width = viewportWidth ?? height;
  const renderSize = Math.max(1, Math.min(height, width));
  const scale = renderSize / CELL;
  const cropLeft = (width - renderSize) / 2;
  const cropTop = (height - renderSize) / 2;

  return (
    <View pointerEvents="none" style={[styles.frame, { width, height }]}>
      <View
        style={[
          styles.crop,
          { left: cropLeft, top: cropTop, width: renderSize, height: renderSize },
        ]}
      >
        <Image
          source={ATLAS}
          resizeMode="contain"
          fadeDuration={0}
          style={{
            position: 'absolute',
            left: -cell.col * CELL * scale,
            top: -cell.row * CELL * scale,
            width: ATLAS_WIDTH * scale,
            height: ATLAS_HEIGHT * scale,
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
    justifyContent: 'center',
    overflow: 'hidden',
  },
  crop: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: 12,
  },
});
