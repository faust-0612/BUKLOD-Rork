import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { RhythmJourneyGameV1 } from '@/features/games/lhen/RhythmJourneyGameV1';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';

const GAME_ID = 'lhen-rhythm-journey';

export default function LhenRhythmJourneyScreen() {
  return (
    <BuklodGameStage biome="music" gameId={GAME_ID}>
      <ScrollView contentContainerStyle={styles.page}>
        <RhythmJourneyGameV1 />
      </ScrollView>
    </BuklodGameStage>
  );
}

const styles = StyleSheet.create({ page: { flexGrow: 1, paddingTop: 18, paddingBottom: 32 } });
