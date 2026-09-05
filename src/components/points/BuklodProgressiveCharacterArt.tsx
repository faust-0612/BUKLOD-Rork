/* BUKLOD_CHARACTER_R26_PROGRESSIVE_FULL_BODY_ART */
import React from 'react';

import {
  Image,
  StyleSheet,
  View,
} from 'react-native';

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

const SHEET_WIDTH = 1536;
const SHEET_HEIGHT = 1024;
const GRID_X = 190;
const GRID_WIDTH = 1235;
const CELL_WIDTH = GRID_WIDTH / 20;

const SHEET = require('../../../assets/characters/buklod_progression_r26.png');

export default function BuklodProgressiveCharacterArt({
  characterId,
  level,
  height,
  viewportWidth,
}: Props) {
  const profile = PROGRESSIVE_CHARACTERS[characterId];
  const safeLevel = Math.max(1, Math.min(20, Math.floor(level)));
  const cropX = GRID_X + (safeLevel - 1) * CELL_WIDTH;
  const cropY = profile.rowY;
  const cropWidth = CELL_WIDTH;
  const cropHeight = profile.rowHeight;
  const scale = height / cropHeight;
  const artWidth = Math.max(1, Math.round(cropWidth * scale));
  const frameWidth =
    typeof viewportWidth === 'number' && Number.isFinite(viewportWidth)
      ? Math.max(1, Math.round(viewportWidth))
      : artWidth;
  const left = (frameWidth - artWidth) / 2;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.frame,
        {
          width: frameWidth,
          height,
        },
      ]}
    >
      <View
        style={[
          styles.crop,
          {
            left,
            width: artWidth,
            height,
          },
        ]}
      >
        <Image
          source={SHEET}
          resizeMode="contain"
          fadeDuration={0}
          style={{
            position: 'absolute',
            left: -cropX * scale,
            top: -cropY * scale,
            width: SHEET_WIDTH * scale,
            height: SHEET_HEIGHT * scale,
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
});
