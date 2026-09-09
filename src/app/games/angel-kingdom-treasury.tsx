import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { KingdomTreasuryGameV1 } from '@/features/games/angel/KingdomTreasuryGameV1';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';

export default function AngelKingdomTreasuryScreen() {
  return (
    <BuklodGameStage biome="treasury">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.page}>
        <KingdomTreasuryGameV1 />
      </ScrollView>
    </BuklodGameStage>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  page: {
    flexGrow: 1,
    paddingTop: 18,
    paddingBottom: 36,
  },
});
