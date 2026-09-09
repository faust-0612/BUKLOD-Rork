import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { DiscoveryExpeditionGameV1 } from '@/features/games/quin/DiscoveryExpeditionGameV1';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';

export default function QuinDiscoveryExpeditionScreen() {
  return (
    <BuklodGameStage biome="discovery">
      <ScrollView contentContainerStyle={styles.page}>
        <DiscoveryExpeditionGameV1 />
      </ScrollView>
    </BuklodGameStage>
  );
}

const styles = StyleSheet.create({ page: { flexGrow: 1, paddingTop: 18, paddingBottom: 32 } });
