/* BUKLOD_CHARACTER_VISIBLE_SYNC_R31_R40_V2 */
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import BuklodProgressiveCharacterArt from '@/components/points/BuklodProgressiveCharacterArt';
import { BuklodEquippedCollectibleRail, getBuklodEquipRailWidth } from '@/components/points/BuklodCharacterCollectibleVisual';
import { useAuth } from '@/providers/AuthProvider';
import {
  getMyCharacterCollectibles,
  shownCollectiblePins,
  subscribeBuklodCharacterCollectibles,
  type CharacterCollectiblePin,
} from '@/lib/buklodCharacterCollectibles';
import {
  CORE_CHARACTER_ORDER,
  SPECIAL_CHARACTER_ORDER,
  getCachedBuklodCharacterSelectionV2,
  getMyBuklodCharacterSelectionV2,
  resolveBuklodCharacterDisplay,
  subscribeBuklodCharacterDisplayOverride,
  subscribeBuklodCharacterSelectionV2,
  type BuklodCharacterSelectionV2State,
  type BuklodCoreCharacterId,
  type BuklodSpecialCharacterId,
} from '@/lib/buklodCharacterSelectionV2';
import { getBuklodSpecialLevelAsset } from '@/lib/buklodSpecialCharacterAssets';
import type { BuklodCharacterState } from '@/lib/buklodCharacter';
import type { ProgressiveCharacterId } from '@/lib/buklodProgressiveCharacter';

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
  const [selection, setSelection] = useState<BuklodCharacterSelectionV2State | null>(() =>
    getCachedBuklodCharacterSelectionV2(userId),
  );
  const [tick, setTick] = useState(0);
  const [pins, setPins] = useState<CharacterCollectiblePin[]>([]);
  const [pinRevision, setPinRevision] = useState(0);

  useEffect(() => {
    if (!userId) {
      setSelection(null);
      return;
    }

    let mounted = true;
    const cached = getCachedBuklodCharacterSelectionV2(userId);
    if (cached) setSelection(cached);

    void getMyBuklodCharacterSelectionV2(userId, true).then(
      (next) => {
        if (mounted) setSelection(next);
      },
      () => {
        if (mounted) setSelection(null);
      },
    );

    const unsubscribeSelection = subscribeBuklodCharacterSelectionV2((changedUserId, next) => {
      if (mounted && changedUserId === userId) {
        setSelection(next);
        setTick((value) => value + 1);
      }
    });
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
  const artKey = `${activeId ?? 'none'}-${level}-${display?.revision ?? 0}-${tick}`;
  const isCore = Boolean(activeId && CORE_CHARACTER_ORDER.includes(activeId as BuklodCoreCharacterId));

  useEffect(() => subscribeBuklodCharacterCollectibles((changedId) => {
    if (changedId === activeId) setPinRevision((value) => value + 1);
  }), [activeId]);

  useEffect(() => {
    if (!userId || !isCore || !activeId) {
      setPins([]);
      return;
    }
    let alive = true;
    void getMyCharacterCollectibles(activeId as ProgressiveCharacterId)
      .then((state) => {
        if (!alive) return;
        setPins(shownCollectiblePins(state, activeId as ProgressiveCharacterId));
      })
      .catch(() => {
        if (alive) setPins([]);
      });
    return () => {
      alive = false;
    };
  }, [userId, isCore, activeId, tick, pinRevision]);

  if (activeId && CORE_CHARACTER_ORDER.includes(activeId as BuklodCoreCharacterId)) {
    const portraitWidth = typeof viewportWidth === 'number' && viewportWidth > 0
      ? viewportWidth : Math.round(height * 0.72);
    const railWidth = getBuklodEquipRailWidth(height);
    return (
      <View pointerEvents="none" style={[styles.frame, { width: portraitWidth + railWidth, height }]}>
        <BuklodEquippedCollectibleRail pins={pins} height={height} />
        <View style={{ width: portraitWidth, height, marginLeft: railWidth }}>
          <BuklodProgressiveCharacterArt
            key={artKey}
            characterId={activeId as BuklodCoreCharacterId}
            level={level}
            height={height}
            viewportWidth={portraitWidth}
          />
        </View>
      </View>
    );
  }

  if (activeId && SPECIAL_CHARACTER_ORDER.includes(activeId as BuklodSpecialCharacterId)) {
    return (
      <View pointerEvents="none" style={[styles.frame, viewportWidth ? { width: viewportWidth } : null, { height }]}>
        <Image
          key={artKey}
          source={getBuklodSpecialLevelAsset(activeId as BuklodSpecialCharacterId, level)}
          resizeMode="contain"
          fadeDuration={0}
          style={{ width: viewportWidth ?? height * 0.72, height }}
        />
      </View>
    );
  }

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
    overflow: 'hidden',
  },
});
