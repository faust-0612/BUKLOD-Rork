import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ForestTrailGame } from '@/features/games/jawo/ForestTrailGame';
import { getBuklodGameDefinition } from '@/features/games/registry';

const definition = getBuklodGameDefinition('jawo-forest-trail');

export default function JawoForestTrailScreen() {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.intro}>
        <Text style={styles.kicker}>BUKLOD KINGDOM • STANDALONE GAME LAB</Text>
        <Text style={styles.heading}>{definition?.title ?? 'Forest Trail'}</Text>
        <Text style={styles.copy}>
          {definition?.objective ?? 'Avoid obstacles and collect trail lights.'}
        </Text>
        <Text style={styles.note}>
          Prototype only: no Kingdom Map, character art, Supabase progress, Circle Rank, or collectible write is connected yet.
        </Text>
      </View>

      <ForestTrailGame />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    backgroundColor: '#07180f',
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
    color: '#9dd7a8',
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
    color: '#d9eadc',
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
