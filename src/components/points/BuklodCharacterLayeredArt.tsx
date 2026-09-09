/* BUKLOD_CHARACTER_SELECTION_V2_ACTIVE_ART_WRAPPER */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import BuklodCharacterLayeredArtLegacy
  from '@/components/points/BuklodCharacterLayeredArtLegacy';
import BuklodSpecialCharacterArtV2
  from '@/components/points/BuklodSpecialCharacterArtV2';
import { useAuth } from '@/providers/AuthProvider';
import {
  CORE_CHARACTER_ORDER,
  SPECIAL_CHARACTER_ORDER,
  getCachedBuklodCharacterSelectionV2,
  getMyBuklodCharacterSelectionV2,
  subscribeBuklodCharacterSelectionV2,
  type BuklodSpecialCharacterId,
  type BuklodCharacterSelectionV2State,
} from '@/lib/buklodCharacterSelectionV2';

import type {
  BodyId,
  Equipment,
} from '@/lib/character-lab-core/types';

type Props = {
  body: BodyId;
  equipment: Equipment;
  height: number;
  viewportWidth?: number;
  showStage?: boolean;
  showEffects?: boolean;
};

export default function BuklodCharacterLayeredArt(props: Props) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [selection, setSelection] =
    useState<BuklodCharacterSelectionV2State | null>(() =>
      getCachedBuklodCharacterSelectionV2(userId),
    );

  useEffect(() => {
    let mounted = true;

    if (!userId) {
      setSelection(null);
      return () => {
        mounted = false;
      };
    }

    const cached = getCachedBuklodCharacterSelectionV2(userId);
    if (cached) setSelection(cached);

    void getMyBuklodCharacterSelectionV2(userId).then(
      (state) => {
        if (mounted) setSelection(state);
      },
      () => {
        // Keep legacy art as the safe fallback when V2 state is unavailable.
      },
    );

    const unsubscribe = subscribeBuklodCharacterSelectionV2(
      (changedUserId, state) => {
        if (mounted && changedUserId === userId) {
          setSelection(state);
        }
      },
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [userId]);

  const activeId = selection?.active_character_id;

  if (
    activeId &&
    CORE_CHARACTER_ORDER.includes(activeId as any)
  ) {
    // Base-character selection/state is V2, while the existing layered
    // wardrobe remains the safe visual renderer until its full progressive
    // atlas is promoted separately. This preserves current production art
    // and prevents a missing-asset regression.
    return <BuklodCharacterLayeredArtLegacy {...props} />;
  }

  if (
    activeId &&
    SPECIAL_CHARACTER_ORDER.includes(activeId as BuklodSpecialCharacterId)
  ) {
    const frameWidth =
      props.viewportWidth ?? Math.max(110, Math.round(props.height * 0.78));

    return (
      <View
        pointerEvents="none"
        style={[
          styles.specialFrame,
          {
            width: frameWidth,
            height: props.height,
            backgroundColor: props.showStage ? '#EAF2ED' : 'transparent',
          },
        ]}
      >
        <BuklodSpecialCharacterArtV2
          characterId={activeId as BuklodSpecialCharacterId}
          height={props.height}
          viewportWidth={frameWidth}
        />
      </View>
    );
  }

  return <BuklodCharacterLayeredArtLegacy {...props} />;
}

const styles = StyleSheet.create({
  specialFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 20,
  },
});
