import React from 'react';
import { StyleSheet, View } from 'react-native';

import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';
import { PlaygroundPathGameV2 } from '@/features/games/trudice/PlaygroundPathGameV2';

export default function TrudicePlaygroundMemoryScreen() {
  return (
    <View style={styles.page}>
      <BuklodGameStage biome="playground">
        <PlaygroundPathGameV2 />
      </BuklodGameStage>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    minHeight: 680,
    backgroundColor: '#2a1748',
  },
});
