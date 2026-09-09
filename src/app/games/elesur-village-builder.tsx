import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { VillageBuilderGameV1 } from '@/features/games/elesur/VillageBuilderGameV1';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';

export default function ElesurVillageBuilderScreen() {
  return (
    <BuklodGameStage biome="highlands">
      <ScrollView contentContainerStyle={styles.page}>
        <VillageBuilderGameV1 />
      </ScrollView>
    </BuklodGameStage>
  );
}

const styles = StyleSheet.create({ page: { flexGrow: 1, paddingTop: 18, paddingBottom: 32 } });
