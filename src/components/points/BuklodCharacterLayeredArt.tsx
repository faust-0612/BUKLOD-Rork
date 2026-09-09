/* BUKLOD_R31_GOLDEN_ART_PRESERVED_PHASE1 */
/* BUKLOD_CHARACTER_ENVIRONMENT_SYSTEM_PHASE1 */
import React, { useEffect, useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import BuklodR31CharacterArt from '@/components/points/BuklodR31CharacterArt';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { useAuth } from '@/providers/AuthProvider';
import type { BodyId, Equipment } from '@/lib/character-lab-core/types';
import {
  WORLD_NAMES,
  getMyBuklodWorldV3,
  isCoreWorldCharacter,
  subscribeMyBuklodWorldV3,
  type BuklodWorldState,
} from '@/lib/buklodCharacterWorldV3';
import {
  loadProgressiveCharacter,
  progressiveLevelForEquipment,
  type ProgressiveCharacterId,
} from '@/lib/buklodProgressiveCharacter';

type Props = {
  body: BodyId;
  equipment: Equipment;
  height: number;
  viewportWidth?: number;
  showStage?: boolean;
  showEffects?: boolean;
};

export default function BuklodCharacterLayeredArt({
  body,
  equipment,
  height,
  viewportWidth,
  showStage = false,
}: Props) {
  const { theme } = useBuklodPresentation();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [world, setWorld] = useState<BuklodWorldState | null>(null);
  const [legacyId, setLegacyId] = useState<ProgressiveCharacterId>('phan');

  const legacyLevel = useMemo(
    () => progressiveLevelForEquipment(body, equipment),
    [body, equipment],
  );

  useEffect(() => {
    let mounted = true;
    const unsubscribe = subscribeMyBuklodWorldV3((next) => {
      if (mounted) setWorld(next);
    });
    void getMyBuklodWorldV3().then(
      (next) => { if (mounted) setWorld(next); },
      () => undefined,
    );
    void loadProgressiveCharacter(userId).then((id) => {
      if (mounted && id) setLegacyId(id);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [userId]);

  const width = viewportWidth ?? Math.max(82, Math.round(height * 0.65));
  const activeId = world?.initialized ? world.active_character_id : legacyId;
  const activeLevel = world?.initialized ? (world.character_level ?? 1) : legacyLevel;

  if (activeId && isCoreWorldCharacter(activeId)) {
    return (
      <View style={[styles.frame, showStage && { backgroundColor: theme.accentSoft, borderColor: theme.border, borderWidth: 1, borderRadius: 18 }]}> 
        <BuklodR31CharacterArt
          characterId={activeId}
          level={activeLevel}
          height={height}
          viewportWidth={width}
        />
      </View>
    );
  }

  if (activeId) {
    return (
      <View style={[styles.special, { width, height, borderColor: theme.border, backgroundColor: theme.accentSoft }]} pointerEvents="none">
        <MaterialCommunityIcons name="star-four-points-outline" size={Math.min(42, width * 0.42)} color={theme.accent} />
        <Text style={[styles.name, { color: theme.textPrimary }]} numberOfLines={1}>{WORLD_NAMES[activeId]}</Text>
        <Text style={[styles.level, { color: theme.textMuted }]}>LEVEL {activeLevel}</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' },
  special: { borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 6 },
  name: { marginTop: 5, fontSize: 10, fontWeight: '900' },
  level: { marginTop: 2, fontSize: 8, fontWeight: '900' },
});
