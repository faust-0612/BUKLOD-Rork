import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { CivicLeadershipGameV1 } from '@/features/games/christian/CivicLeadershipGameV1';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';

const GAME_ID = 'christian-civic-leadership';

export default function ChristianCivicLeadershipScreen() {
  return (
    <BuklodGameStage biome="academy" gameId={GAME_ID}>
      <ScrollView contentContainerStyle={styles.page}>
        <CivicLeadershipGameV1 />
      </ScrollView>
    </BuklodGameStage>
  );
}

const styles = StyleSheet.create({ page: { flexGrow: 1, paddingTop: 18, paddingBottom: 32 } });
