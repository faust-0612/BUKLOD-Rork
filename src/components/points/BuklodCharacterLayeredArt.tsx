/* BUKLOD_CHARACTER_SELECTION_V2_ACTIVE_ART_WRAPPER */
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import BuklodCharacterLayeredArtLegacy
  from '@/components/points/BuklodCharacterLayeredArtLegacy';
import BuklodProgressiveCharacterArt from '@/components/points/BuklodProgressiveCharacterArt';
import { useAuth } from '@/providers/AuthProvider';
import {
  CORE_CHARACTER_ORDER,
  SPECIAL_CHARACTER_ORDER,
  getCachedBuklodCharacterSelectionV2,
  getMyBuklodCharacterSelectionV2,
  resolveBuklodCharacterDisplay,
  subscribeBuklodCharacterDisplayOverride,
  subscribeBuklodCharacterSelectionV2,
  type BuklodCoreCharacterId,
  type BuklodSpecialCharacterId,
  type BuklodCharacterSelectionV2State,
} from '@/lib/buklodCharacterSelectionV2';
import { getBuklodSpecialLevelAsset } from '@/lib/buklodSpecialCharacterAssets';

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
  const [tick, setTick] = useState(0);

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

    void getMyBuklodCharacterSelectionV2(userId, true).then(
      (state) => {
        if (mounted) setSelection(state);
      },
      () => undefined,
    );

    const unsubscribeSelection = subscribeBuklodCharacterSelectionV2(
      (changedUserId, state) => {
        if (mounted && changedUserId === userId) {
          setSelection(state);
          setTick((value) => value + 1);
        }
      },
    );
    const unsubscribeDisplay = subscribeBuklodCharacterDisplayOverride(() => {
      if (mounted) setTick((value) => value + 1);
    });

    return () => {
      mounted = false;
      unsubscribeSelection();
      unsubscribeDisplay();
    };
  }, [userId]);

  const display = resolveBuklodCharacterDisplay(selection);
  const activeId = display?.character_id;
  const level = display?.character_level ?? 1;
  const frameWidth =
    props.viewportWidth ?? Math.max(110, Math.round(props.height * 0.78));
  const artKey = `${activeId ?? 'none'}-${level}-${display?.revision ?? 0}-${tick}`;

  if (activeId && CORE_CHARACTER_ORDER.includes(activeId as BuklodCoreCharacterId)) {
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
        <BuklodProgressiveCharacterArt
          key={artKey}
          characterId={activeId as BuklodCoreCharacterId}
          level={level}
          height={props.height}
          viewportWidth={frameWidth}
        />
      </View>
    );
  }

  if (activeId && SPECIAL_CHARACTER_ORDER.includes(activeId as BuklodSpecialCharacterId)) {
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
        <Image
          key={artKey}
          source={getBuklodSpecialLevelAsset(activeId as BuklodSpecialCharacterId, level)}
          resizeMode="contain"
          fadeDuration={0}
          style={{ width: frameWidth, height: props.height }}
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
