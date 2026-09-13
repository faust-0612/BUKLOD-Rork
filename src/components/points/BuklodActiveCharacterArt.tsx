/* BUKLOD_CHARACTER_VISIBLE_SYNC_R31_R40_V2 */
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

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
  height,
  viewportWidth,
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

  /* Fail closed to the canonical Character system. Never resurrect the retired
   * layered/wardrobe renderer when server-backed V2 state is unavailable.
   * Keep the frame height stable while the canonical state loads or retries. */
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.frame, viewportWidth ? { width: viewportWidth } : null, { height }]}
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
