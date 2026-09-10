import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { VillageBuilderGameV1 } from '@/features/games/elesur/VillageBuilderGameV1';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';

const GAME_ID = 'elesur-village-builder';

export default function ElesurVillageBuilderScreen() {
  return (
    <BuklodGameStage biome="highlands" gameId={GAME_ID}>
      <ScrollView contentContainerStyle={styles.page}>
        <VillageBuilderGameV1 />
      </ScrollView>
    </BuklodGameStage>
  );
}

const styles = StyleSheet.create({ page: { flexGrow: 1, paddingTop: 18, paddingBottom: 32 } });
