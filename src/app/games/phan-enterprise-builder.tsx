import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { EnterpriseBuilderGameV1 } from '@/features/games/phan/EnterpriseBuilderGameV1';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';

export default function PhanEnterpriseBuilderScreen() {
  return (
    <BuklodGameStage biome="farm">
      <ScrollView contentContainerStyle={styles.page}>
        <EnterpriseBuilderGameV1 />
      </ScrollView>
    </BuklodGameStage>
  );
}

const styles = StyleSheet.create({ page: { flexGrow: 1, paddingTop: 18, paddingBottom: 32 } });
