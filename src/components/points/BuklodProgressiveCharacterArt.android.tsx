/* BUKLOD_CHARACTER_ANDROID_ZOOM_FULL_SOURCE_20261116 */
/**
 * Android-only quality repair for the approved R31 20-level sprite renderer.
 *
 * Keep small roster/card art on React Native's inexpensive downscaled path.
 * The enlarged viewer gets a full-source decode, rather than stretching a
 * thumbnail-sized decoded bitmap. The locked .tsx web renderer stays intact.
 */
import React, { useEffect, useState } from 'react';
import { Image as ExpoImage } from 'expo-image';
import { Image as NativeImage, StyleSheet, View } from 'react-native';

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

// Normal thumbnail art tops out at 146. The fullscreen modal uses ~500.
const FULL_SOURCE_MIN_HEIGHT = 260;

export default function BuklodProgressiveCharacterArt({
  characterId,
  level,
  height,
  viewportWidth,
}: Props) {
  const [fullSourceFailed, setFullSourceFailed] = useState(false);
  const profile = PROGRESSIVE_CHARACTERS[characterId];
  const safeLevel = Math.max(1, Math.min(20, Math.floor(Number(level) || 1)));
  const nativeRowHeight = NATIVE_ROW_HEIGHT[characterId] || profile.rowHeight * 4;
  const scale = height / nativeRowHeight;
  const artWidth = Math.max(1, Math.round(NATIVE_CELL_WIDTH * scale));
  const frameWidth =
    typeof viewportWidth === 'number' && Number.isFinite(viewportWidth) && viewportWidth > 0
      ? Math.max(1, Math.round(viewportWidth))
      : artWidth;
  const left = Math.round((frameWidth - artWidth) / 2);
  const fullSource = height >= FULL_SOURCE_MIN_HEIGHT;

  // Decode failure falls back to the original renderer, never a blank modal.
  // Reset on image change, not on error (which could otherwise retry forever).
  useEffect(() => {
    setFullSourceFailed(false);
  }, [characterId, safeLevel, fullSource]);

  const sheetStyle = {
    position: 'absolute' as const,
    left: Math.round(-((safeLevel - 1) * NATIVE_CELL_WIDTH * scale)),
    top: 0,
    width: Math.round(NATIVE_SPRITE_WIDTH * scale),
    height: Math.round(nativeRowHeight * scale),
  };

  return (
    <View pointerEvents="none" style={[styles.frame, { width: frameWidth, height }]}>
      <View style={[styles.crop, { left, width: artWidth, height }]}>
        {fullSource && !fullSourceFailed ? (
          <ExpoImage
            key={characterId + '-' + safeLevel + '-full-source'}
            source={SHEETS[characterId]}
            contentFit="fill"
            allowDownscaling={false}
            cachePolicy="memory"
            priority="high"
            transition={0}
            onError={() => setFullSourceFailed(true)}
            style={sheetStyle}
          />
        ) : (
          <NativeImage
            key={characterId + '-' + safeLevel}
            source={SHEETS[characterId]}
            resizeMode="stretch"
            resizeMethod="scale"
            fadeDuration={0}
            style={sheetStyle}
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
