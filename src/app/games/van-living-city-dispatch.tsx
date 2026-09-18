import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';
import { LivingCityDispatchGameV1 } from '@/features/games/van/LivingCityDispatchGameV1';

const GAME_ID = 'van-living-city-dispatch';

export default function VanLivingCityDispatchScreen() {
  return (
    <BuklodGameStage biome="city" gameId={GAME_ID}>
      <ScrollView contentContainerStyle={styles.page}>
        <LivingCityDispatchGameV1 />
      </ScrollView>
    </BuklodGameStage>
  );
}

const styles = StyleSheet.create({ page: { flexGrow: 1, paddingTop: 18, paddingBottom: 32 } });
