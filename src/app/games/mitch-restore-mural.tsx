import React from 'react';
import { StyleSheet, View } from 'react-native';

import { recordBuklodKingdomPreviewResult } from '@/features/games/kingdom/progress';
import { RestoreMuralGameV1 } from '@/features/games/mitch/RestoreMuralGameV1';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';

const GAME_ID = 'mitch-restore-mural';

export default function MitchRestoreMuralScreen() {
  return (
    <BuklodGameStage biome="art" gameId={GAME_ID}>
      <View style={styles.page}>
        <RestoreMuralGameV1 onFinish={(result) => { void recordBuklodKingdomPreviewResult(result); }} />
      </View>
    </BuklodGameStage>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingTop: 20,
    paddingBottom: 28,
  },
});
