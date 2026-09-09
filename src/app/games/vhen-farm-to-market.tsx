import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { FarmToMarketGameV1 } from '@/features/games/vhen/FarmToMarketGameV1';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';

export default function VhenFarmToMarketScreen() {
  return (
    <BuklodGameStage biome="agriculture">
      <ScrollView contentContainerStyle={styles.page}>
        <FarmToMarketGameV1 />
      </ScrollView>
    </BuklodGameStage>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingTop: 18, paddingBottom: 32 },
});
