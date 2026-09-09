import React from 'react';
import { StyleSheet, View } from 'react-native';

import { MissionTrailGameV1 } from '@/features/games/niel/MissionTrailGameV1';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';

export default function NielMissionTrailScreen() {
  return (
    <BuklodGameStage biome="mission">
      <View style={styles.page}>
        <MissionTrailGameV1 />
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
