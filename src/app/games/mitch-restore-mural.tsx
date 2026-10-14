import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { recordBuklodKingdomPreviewResult } from '@/features/games/kingdom/progress';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';
import { KingdomBlocksGameR1 } from '@/features/games/arcade/KingdomBlocksGameR1';

const GAME_ID = 'mitch-restore-mural';

export default function MitchRestoreMuralScreen() {
  return (
    <BuklodGameStage biome="art" gameId={GAME_ID}>
      <ScrollView contentContainerStyle={styles.page}>
        <KingdomBlocksGameR1 onFinish={(result) => { void recordBuklodKingdomPreviewResult(result); }} />
      </ScrollView>
    </BuklodGameStage>
  );
}

const styles = StyleSheet.create({ page: { flexGrow: 1, paddingTop: 12, paddingBottom: 40 } });
