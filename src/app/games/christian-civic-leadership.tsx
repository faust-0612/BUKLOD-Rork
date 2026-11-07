import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { recordBuklodKingdomPreviewResult } from '@/features/games/kingdom/progress';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';
import { KingdomQuestionArcadeR1 } from '@/features/games/arcade/KingdomQuestionArcadeR1';

const GAME_ID = 'christian-civic-leadership';

export default function ChristianCivicLeadershipScreen() {
  return (
    <BuklodGameStage biome="academy" gameId={GAME_ID}>
      <ScrollView contentContainerStyle={styles.page}>
        <KingdomQuestionArcadeR1 mode="bible" onFinish={(result) => { void recordBuklodKingdomPreviewResult(result); }} />
      </ScrollView>
    </BuklodGameStage>
  );
}

const styles = StyleSheet.create({ page: { flexGrow: 1, paddingTop: 12, paddingBottom: 40 } });
