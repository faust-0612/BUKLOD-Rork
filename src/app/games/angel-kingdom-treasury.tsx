import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { KingdomTreasuryGameV1 } from '@/features/games/angel/KingdomTreasuryGameV1';
import { recordBuklodKingdomPreviewResult } from '@/features/games/kingdom/progress';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';

const GAME_ID = 'angel-kingdom-treasury';

export default function AngelKingdomTreasuryScreen() {
  return (
    <BuklodGameStage biome="treasury" gameId={GAME_ID}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.page}>
        <KingdomTreasuryGameV1 onFinish={(result) => { void recordBuklodKingdomPreviewResult(result); }} />
      </ScrollView>
    </BuklodGameStage>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  page: { flexGrow: 1, paddingTop: 18, paddingBottom: 36 },
});
