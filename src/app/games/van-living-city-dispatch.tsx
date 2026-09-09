import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { LivingCityDispatchGameV1 } from '@/features/games/van/LivingCityDispatchGameV1';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';

export default function VanLivingCityDispatchScreen() {
  return (
    <BuklodGameStage biome="city">
      <ScrollView contentContainerStyle={styles.page}>
        <LivingCityDispatchGameV1 />
      </ScrollView>
    </BuklodGameStage>
  );
}

const styles = StyleSheet.create({ page: { flexGrow: 1, paddingTop: 18, paddingBottom: 32 } });
