import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { CivicLeadershipGameV1 } from '@/features/games/christian/CivicLeadershipGameV1';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';

export default function ChristianCivicLeadershipScreen() {
  return (
    <BuklodGameStage biome="academy">
      <ScrollView contentContainerStyle={styles.page}>
        <CivicLeadershipGameV1 />
      </ScrollView>
    </BuklodGameStage>
  );
}

const styles = StyleSheet.create({ page: { flexGrow: 1, paddingTop: 18, paddingBottom: 32 } });
