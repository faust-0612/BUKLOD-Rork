import React from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';

import KlCoverImage from '@/components/kabihasnang-ligaw/KlCoverImage';
import { KL_AUTHOR } from '@/lib/kabihasnang-ligaw/catalog';
import { klCopy } from '@/lib/kabihasnang-ligaw/copy';
import { useNetwork } from '@/providers/NetworkProvider';

/** Permanent Community Wall feature. No posting, media, or points side effects. */
export default function KabihasnangLigawWallCard() {
  const router = useRouter();
  const { online } = useNetwork();
  const { width } = useWindowDimensions();
  const compact = width < 380;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={klCopy.openLibrary}
      onPress={() => router.push('/kabihasnang-ligaw' as never)}
      style={[styles.card, compact && styles.cardCompact]}
    >
      <KlCoverImage variant="card" lowBandwidth={!online} />
      <View style={[styles.copy, compact && styles.copyCompact]}>
      <Text style={styles.eyebrow}>{klCopy.libraryKicker}</Text>
      <Text style={styles.chapter}>{klCopy.cardChapter}</Text>
      <Text style={[styles.title, compact && styles.titleCompact]}>{klCopy.cardTitle}</Text>
      <Text style={styles.description}>{klCopy.cardLine}</Text>
      <Text style={styles.credit}>{KL_AUTHOR}</Text>
      <View style={styles.actionRow}>
        <Text style={styles.action}>{klCopy.openLibrary}</Text>
      </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 10,
    marginVertical: 12,
    borderRadius: 24,
    backgroundColor: '#142a28',
    borderWidth: 1,
    borderColor: '#a28b5a',
    overflow: 'hidden',
  },
  cardCompact: { marginHorizontal: 8 },
  copy: { padding: 22 },
  copyCompact: { padding: 16 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, color: '#e3c990' },
  chapter: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, color: '#d6c8ad', marginTop: 12 },
  title: { fontSize: 26, fontWeight: '800', color: '#fff4df', marginTop: 6, lineHeight: 32 },
  titleCompact: { fontSize: 22, lineHeight: 28 },
  description: { fontSize: 15, color: '#e2e9df', marginTop: 9, lineHeight: 22 },
  schedule: { fontSize: 14, color: '#d6c8ad', marginTop: 8, lineHeight: 21 },
  credit: { fontSize: 12, color: '#c3cbbb', marginTop: 8 },
  actionRow: { marginTop: 18 },
  action: { color: '#f1d39b', fontSize: 15, fontWeight: '800' },
});
