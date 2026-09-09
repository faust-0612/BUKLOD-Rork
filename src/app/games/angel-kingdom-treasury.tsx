import React from 'react';
import { StyleSheet, View } from 'react-native';

import { KingdomTreasuryGameV1 } from '@/features/games/angel/KingdomTreasuryGameV1';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';

export default function AngelKingdomTreasuryScreen() {
  return (
    <BuklodGameStage biome="treasury">
      <View style={styles.page}>
        <KingdomTreasuryGameV1 />
      </View>
    </BuklodGameStage>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingTop: 18,
    paddingBottom: 28,
  },
});
