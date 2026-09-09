import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { getBuklodGameDefinition } from '@/features/games/registry';
import { PlaygroundMemoryGame } from '@/features/games/trudice/PlaygroundMemoryGame';

const definition = getBuklodGameDefinition('trudice-playground-memory');

export default function TrudicePlaygroundMemoryScreen() {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.intro}>
        <Text style={styles.kicker}>BUKLOD KINGDOM • STANDALONE GAME LAB</Text>
        <Text style={styles.heading}>{definition?.title ?? 'Playground Memory'}</Text>
        <Text style={styles.copy}>
          {definition?.objective ?? 'Find all matching pairs.'}
        </Text>
        <Text style={styles.note}>
          Prototype only: no character asset, Kingdom station unlock, XP persistence, or collectible write is connected yet.
        </Text>
      </View>

      <PlaygroundMemoryGame />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    backgroundColor: '#f5e6b8',
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
    color: '#8a552b',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  heading: {
    color: '#512e67',
    fontSize: 38,
    fontWeight: '900',
  },
  copy: {
    color: '#5e4937',
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 760,
  },
  note: {
    color: '#8b5d1f',
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 760,
  },
});
