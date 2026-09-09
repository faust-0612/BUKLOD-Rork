import React from 'react';
import { StyleSheet, View } from 'react-native';

import { recordBuklodKingdomPreviewResult } from '@/features/games/kingdom/progress';
import { MissionTrailGameV1 } from '@/features/games/niel/MissionTrailGameV1';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';

const GAME_ID = 'niel-mission-trail';

export default function NielMissionTrailScreen() {
  return (
    <BuklodGameStage biome="mission" gameId={GAME_ID}>
      <View style={styles.page}>
        <MissionTrailGameV1 onFinish={(result) => { void recordBuklodKingdomPreviewResult(result); }} />
      </View>
    </BuklodGameStage>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingTop: 18,
    paddingBottom: 28,
  },
});
