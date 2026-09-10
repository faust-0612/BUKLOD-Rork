import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { EnterpriseBuilderGameV1 } from '@/features/games/phan/EnterpriseBuilderGameV1';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';

const GAME_ID = 'phan-enterprise-builder';

export default function PhanEnterpriseBuilderScreen() {
  return (
    <BuklodGameStage biome="farm" gameId={GAME_ID}>
      <ScrollView contentContainerStyle={styles.page}>
        <EnterpriseBuilderGameV1 />
      </ScrollView>
    </BuklodGameStage>
  );
}

const styles = StyleSheet.create({ page: { flexGrow: 1, paddingTop: 18, paddingBottom: 32 } });
