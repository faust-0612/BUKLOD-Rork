import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { getBuklodGameDefinition } from '@/features/games/registry';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';
import { PlaygroundMemoryGame } from '@/features/games/trudice/PlaygroundMemoryGame';

const definition = getBuklodGameDefinition('trudice-playground-memory');

export default function TrudicePlaygroundMemoryScreen() {
  return (
    <BuklodGameStage biome="playground">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.page}>
        <View style={styles.intro}>
          <Text style={styles.kicker}>BUKLOD KINGDOM • GAME LAB</Text>
          <Text style={styles.heading}>{definition?.title ?? 'Playground Memory'}</Text>
          <Text style={styles.copy}>{definition?.objective ?? 'Find all matching pairs.'}</Text>
          <Text style={styles.note}>
            Gameplay prototype: final Trudice art, Kingdom station unlocks, XP persistence and collectible writes remain intentionally disconnected while the experience is tuned.
          </Text>
        </View>

        <PlaygroundMemoryGame />
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
    maxWidth: 900,
    alignSelf: 'center',
    gap: 8,
  },
  kicker: {
    color: '#f5d7ff',
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
    color: '#f7eefe',
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 760,
  },
  note: {
    color: '#ffe3a2',
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 760,
  },
});
