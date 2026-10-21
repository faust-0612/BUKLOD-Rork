import React from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';

import { KL_AUTHOR } from '@/lib/kabihasnang-ligaw/catalog';
import { klCopy } from '@/lib/kabihasnang-ligaw/copy';

/** Permanent Community Wall feature. No posting, media, or points side effects. */
export default function KabihasnangLigawWallCard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 380;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={klCopy.openLibrary}
      onPress={() => router.push('/kabihasnang-ligaw' as never)}
      style={[styles.card, compact && styles.cardCompact]}
    >
      <Text style={styles.eyebrow}>{klCopy.libraryKicker}</Text>
      <Text style={[styles.title, compact && styles.titleCompact]}>{klCopy.libraryTitle}</Text>
      <Text style={styles.description}>{klCopy.librarySubtitle}</Text>
      <Text style={styles.schedule}>{klCopy.cardSchedule}</Text>
      <Text style={styles.credit}>{KL_AUTHOR}</Text>
      <View style={styles.actionRow}>
        <Text style={styles.action}>{klCopy.openLibrary}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 10,
    marginVertical: 12,
    borderRadius: 24,
    padding: 22,
    backgroundColor: '#142a28',
    borderWidth: 1,
    borderColor: '#a28b5a',
  },
  cardCompact: { padding: 16, marginHorizontal: 8 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, color: '#e3c990' },
  title: { fontSize: 26, fontWeight: '800', color: '#fff4df', marginTop: 13, lineHeight: 32 },
  titleCompact: { fontSize: 22, lineHeight: 28 },
  description: { fontSize: 15, color: '#e2e9df', marginTop: 9, lineHeight: 22 },
  schedule: { fontSize: 14, color: '#d6c8ad', marginTop: 8, lineHeight: 21 },
  credit: { fontSize: 12, color: '#c3cbbb', marginTop: 8 },
  actionRow: { marginTop: 18 },
  action: { color: '#f1d39b', fontSize: 15, fontWeight: '800' },
});
