import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

import KlCoverImage from '@/components/kabihasnang-ligaw/KlCoverImage';
import { KL_SEASON_ONE_ID } from '@/lib/kabihasnang-ligaw/catalog';
import { klCopy } from '@/lib/kabihasnang-ligaw/copy';
import { selectReaderSeries } from '@/lib/kabihasnang-ligaw/seriesProgress';
import { useAuth } from '@/providers/AuthProvider';
import { useNetwork } from '@/providers/NetworkProvider';

/** Permanent Community Wall feature. No posting, media, or points side effects. */
export default function KabihasnangLigawWallCard() {
  const router = useRouter();
  const { user } = useAuth();
  const { online } = useNetwork();
  const { width } = useWindowDimensions();
  const compact = width < 380;
  const [currentSeriesId, setCurrentSeriesId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(`kl.reader.v1.${user?.id ?? 'device'}`).then((raw) => {
      if (!active || !raw) return;
      try {
        const parsed = JSON.parse(raw) as { lastEpisodeId?: string | null };
        if (parsed.lastEpisodeId) setCurrentSeriesId(KL_SEASON_ONE_ID);
      } catch {
        setCurrentSeriesId(null);
      }
    });
    return () => {
      active = false;
    };
  }, [user?.id]);

  const seriesId = selectReaderSeries({ currentSeriesId, completedSeriesIds: [] });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={klCopy.openLibrary}
      onPress={() => router.push('/kabihasnang-ligaw' as never)}
      style={[styles.card, compact && styles.cardCompact]}
    >
      {seriesId === KL_SEASON_ONE_ID ? (
        <KlCoverImage variant="series" lowBandwidth={!online} />
      ) : null}
      <View style={[styles.copy, compact && styles.copyCompact]}>
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
  copy: { paddingHorizontal: 22, paddingBottom: 18 },
  copyCompact: { paddingHorizontal: 16 },
  actionRow: { marginTop: 12 },
  action: { color: '#f1d39b', fontSize: 15, fontWeight: '800' },
});
