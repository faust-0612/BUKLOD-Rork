import React from 'react';
import { StyleSheet, View } from 'react-native';

import { RescueGridGameV1 } from '@/features/games/ace/RescueGridGameV1';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';

export default function AceRescueGridScreen() {
  return (
    <View style={styles.page}>
      <BuklodGameStage biome="strategy">
        <RescueGridGameV1 />
      </BuklodGameStage>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    minHeight: 680,
    backgroundColor: '#10151f',
  },
});
