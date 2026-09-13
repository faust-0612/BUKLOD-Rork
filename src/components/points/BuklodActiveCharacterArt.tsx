/* BUKLOD_CHARACTER_VISIBLE_SYNC_R31_R40_V2 */
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import BuklodCharacterLayeredArt from '@/components/points/BuklodCharacterLayeredArt';
import BuklodProgressiveCharacterArt from '@/components/points/BuklodProgressiveCharacterArt';
import { useAuth } from '@/providers/AuthProvider';
import {
  CORE_CHARACTER_ORDER,
  SPECIAL_CHARACTER_ORDER,
  getMyBuklodCharacterSelectionV2,
  subscribeBuklodCharacterSelectionV2,
  type BuklodCharacterSelectionV2State,
  type BuklodCoreCharacterId,
  type BuklodSpecialCharacterId,
} from '@/lib/buklodCharacterSelectionV2';
import { getBuklodSpecialLevelAsset } from '@/lib/buklodSpecialCharacterAssets';
import type { BuklodCharacterState } from '@/lib/buklodCharacter';

type Props = {
  fallbackCharacter: BuklodCharacterState;
  height: number;
  viewportWidth?: number;
  showStage?: boolean;
  showEffects?: boolean;
};

export default function BuklodActiveCharacterArt({
  fallbackCharacter,
  height,
  viewportWidth,
  showStage = false,
  showEffects = false,
}: Props) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [selection, setSelection] = useState<BuklodCharacterSelectionV2State | null>(null);

  useEffect(() => {
    if (!userId) {
      setSelection(null);
      return;
    }

    let mounted = true;
    void getMyBuklodCharacterSelectionV2(userId).then(
      (next) => {
        if (mounted) setSelection(next);
      },
      () => {
        if (mounted) setSelection(null);
      },
    );

    const unsubscribe = subscribeBuklodCharacterSelectionV2((changedUserId, next) => {
      if (mounted && changedUserId === userId) setSelection(next);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [userId]);

  const activeId = selection?.active_character_id;
  const level = Math.max(1, Math.min(20, Number(selection?.character_level ?? 1) || 1));

  if (activeId && CORE_CHARACTER_ORDER.includes(activeId as BuklodCoreCharacterId)) {
    return (
      <View pointerEvents="none" style={[styles.frame, viewportWidth ? { width: viewportWidth } : null, { height }]}>
        <BuklodProgressiveCharacterArt
          characterId={activeId as BuklodCoreCharacterId}
          level={level}
          height={height}
          viewportWidth={viewportWidth}
        />
      </View>
    );
  }

  if (activeId && SPECIAL_CHARACTER_ORDER.includes(activeId as BuklodSpecialCharacterId)) {
    return (
      <View pointerEvents="none" style={[styles.frame, viewportWidth ? { width: viewportWidth } : null, { height }]}>
        <Image
          source={getBuklodSpecialLevelAsset(activeId as BuklodSpecialCharacterId, level)}
          resizeMode="contain"
          fadeDuration={0}
          style={{ width: viewportWidth ?? height * 0.72, height }}
        />
      </View>
    );
  }

  /* Presentation-only compatibility fallback. It preserves the current layered
   * renderer whenever V2 state cannot be loaded; it never becomes selection or
   * progression authority. */
  return (
    <BuklodCharacterLayeredArt
      body={fallbackCharacter.body}
      equipment={fallbackCharacter.equipment}
      height={height}
      viewportWidth={viewportWidth}
      showStage={showStage}
      showEffects={showEffects}
    />
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
});
