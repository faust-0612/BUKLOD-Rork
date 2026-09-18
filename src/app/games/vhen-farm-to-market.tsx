import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';
import { FarmToMarketGameV1 } from '@/features/games/vhen/FarmToMarketGameV1';

const GAME_ID = 'vhen-farm-to-market';

export default function VhenFarmToMarketScreen() {
  return (
    <BuklodGameStage biome="agriculture" gameId={GAME_ID}>
      <ScrollView contentContainerStyle={styles.page}>
        <FarmToMarketGameV1 />
      </ScrollView>
    </BuklodGameStage>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingTop: 18, paddingBottom: 32 },
});
