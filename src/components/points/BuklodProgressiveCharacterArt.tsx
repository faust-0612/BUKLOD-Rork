/* BUKLOD_CHARACTER_R31_PROGRESSIVE_ART_V2_SAFE */
/* BUKLOD_CHARACTER_R25_ZOOM_SHARP_FULL_SOURCE */
import React from 'react';
import { Image as NativeImage, StyleSheet, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

import {
  PROGRESSIVE_CHARACTERS,
  type ProgressiveCharacterId,
} from '@/lib/buklodProgressiveCharacter';

type Props = {
  characterId: ProgressiveCharacterId;
  level: number;
  height: number;
  viewportWidth?: number;
  /** Full-source decode for enlarged/fullscreen Character review surfaces. */
  highQuality?: boolean;
};

const SPRITE_WIDTH = 1235;
const CELL_WIDTH = SPRITE_WIDTH / 20;
const FULLSCREEN_QUALITY_HEIGHT = 320;
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
  highQuality = false,
}: Props) {
  const profile = PROGRESSIVE_CHARACTERS[characterId];
  const safeLevel = Math.max(1, Math.min(20, Math.floor(Number(level) || 1)));
  const cropX = (safeLevel - 1) * CELL_WIDTH;
  const scale = height / profile.rowHeight;
  const artWidth = Math.max(1, Math.round(CELL_WIDTH * scale));
  const frameWidth = typeof viewportWidth === 'number' && Number.isFinite(viewportWidth) && viewportWidth > 0
    ? Math.max(1, Math.round(viewportWidth))
    : artWidth;
  const left = Math.round((frameWidth - artWidth) / 2);
  const useFullSourceDecode = highQuality || height >= FULLSCREEN_QUALITY_HEIGHT;

  return (
    <View pointerEvents="none" style={[styles.frame, { width: frameWidth, height }]}>
      <View style={[styles.crop, { left, width: artWidth, height }]}>
        {useFullSourceDecode ? (
          <ExpoImage
            source={SHEETS[characterId]}
            contentFit="contain"
            allowDownscaling={false}
            cachePolicy="memory-disk"
            priority="high"
            transition={0}
            style={{
              position: 'absolute',
              left: Math.round(-cropX * scale),
              top: 0,
              width: Math.round(SPRITE_WIDTH * scale),
              height: Math.round(profile.rowHeight * scale),
            }}
          />
        ) : (
          <NativeImage
            source={SHEETS[characterId]}
            resizeMode="contain"
            fadeDuration={0}
            style={{
              position: 'absolute',
              left: Math.round(-cropX * scale),
              top: 0,
              width: Math.round(SPRITE_WIDTH * scale),
              height: Math.round(profile.rowHeight * scale),
            }}
          />
        )}
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
