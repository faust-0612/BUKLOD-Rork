import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ForestEnvironment } from '@/features/games/jawo/ForestEnvironment';
import { ForestTrailGameV2 } from '@/features/games/jawo/ForestTrailGameV2';
import { recordBuklodKingdomPreviewResult } from '@/features/games/kingdom/progress';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';

const GAME_ID = 'jawo-forest-trail';

export default function JawoForestTrailScreen() {
  return (
    <View style={styles.page}>
      <BuklodGameStage biome="forest" gameId={GAME_ID}>
        <ForestEnvironment intensity={1} progress={0} />
        <ForestTrailGameV2 onFinish={(result) => { void recordBuklodKingdomPreviewResult(result); }} />
      </BuklodGameStage>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    minHeight: 680,
    backgroundColor: '#06130f',
  },
});
