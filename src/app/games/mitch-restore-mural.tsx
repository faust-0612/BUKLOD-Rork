import React from 'react';
import { StyleSheet, View } from 'react-native';

import { RestoreMuralGameV1 } from '@/features/games/mitch/RestoreMuralGameV1';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';

export default function MitchRestoreMuralScreen() {
  return (
    <BuklodGameStage biome="art">
      <View style={styles.page}>
        <RestoreMuralGameV1 />
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
