/* BUKLOD_PHASE1_ACTIVE_CHARACTER_ART */
import React, { useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import BuklodR31CharacterArt from '@/components/points/BuklodR31CharacterArt';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import {
  WORLD_NAMES,
  getMyBuklodWorldV3,
  isCoreWorldCharacter,
  subscribeMyBuklodWorldV3,
  type BuklodWorldState,
} from '@/lib/buklodCharacterWorldV3';

type Props = { height?: number; viewportWidth?: number };

export default function BuklodPhase1ActiveCharacterArt({
  height = 124,
  viewportWidth = 82,
}: Props) {
  const { theme } = useBuklodPresentation();
  const [world, setWorld] = useState<BuklodWorldState | null>(null);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = subscribeMyBuklodWorldV3((next) => {
      if (mounted) setWorld(next);
    });
    void getMyBuklodWorldV3(true).then(
      (next) => { if (mounted) setWorld(next); },
      () => { if (mounted) setWorld(null); },
    );
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const id = world?.active_character_id;
  if (id && isCoreWorldCharacter(id)) {
    return (
      <BuklodR31CharacterArt
        characterId={id}
        level={world?.character_level ?? 1}
        height={height}
        viewportWidth={viewportWidth}
      />
    );
  }

  if (id) {
    return (
      <View style={[styles.special, { width: viewportWidth, height, borderColor: theme.border, backgroundColor: theme.accentSoft }]}>
        <MaterialCommunityIcons name="star-four-points" size={Math.min(34, viewportWidth * 0.4)} color={theme.accent} />
        <Text style={[styles.specialName, { color: theme.textPrimary }]} numberOfLines={1}>
          {WORLD_NAMES[id]}
        </Text>
        <Text style={[styles.level, { color: theme.textMuted }]}>L{world?.character_level ?? 1}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.special, { width: viewportWidth, height, borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}>
      <MaterialCommunityIcons name="account-star-outline" size={34} color={theme.textMuted} />
      <Text style={[styles.level, { color: theme.textMuted }]}>Choose Character</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  special: { borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', padding: 5 },
  specialName: { marginTop: 4, fontSize: 9, fontWeight: '900' },
  level: { marginTop: 2, fontSize: 8, fontWeight: '800' },
});
