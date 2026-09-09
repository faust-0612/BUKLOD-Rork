import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ForestTrailGame } from '@/features/games/jawo/ForestTrailGame';
import { getBuklodGameDefinition } from '@/features/games/registry';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';

const definition = getBuklodGameDefinition('jawo-forest-trail');

export default function JawoForestTrailScreen() {
  return (
    <BuklodGameStage biome="forest">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.page}>
        <View style={styles.intro}>
          <Text style={styles.kicker}>BUKLOD KINGDOM • GAME LAB</Text>
          <Text style={styles.heading}>{definition?.title ?? 'Forest Trail'}</Text>
          <Text style={styles.copy}>
            {definition?.objective ?? 'Avoid obstacles and collect trail lights.'}
          </Text>
          <Text style={styles.note}>
            Gameplay prototype: Kingdom Map, final Jawo art, persistence, Circle Rank and collectible writes remain intentionally disconnected while the experience is tuned.
          </Text>
        </View>

        <ForestTrailGame />
      </ScrollView>
    </BuklodGameStage>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  page: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 36,
    paddingBottom: 64,
    gap: 18,
  },
  intro: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    gap: 8,
  },
  kicker: {
    color: '#aee7b8',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  heading: {
    color: '#ffffff',
    fontSize: 38,
    fontWeight: '900',
  },
  copy: {
    color: '#e5f3e8',
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 760,
  },
  note: {
    color: '#f4d97d',
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 760,
  },
});
