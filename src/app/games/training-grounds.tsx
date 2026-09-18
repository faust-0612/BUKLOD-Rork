import React, { useEffect, useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  loadBuklodKingdomLevelDetails,
  loadBuklodKingdomProgress,
  subscribeBuklodKingdomProgress,
  type BuklodKingdomLevelDetail,
  type BuklodKingdomProgress,
} from '@/features/games/kingdom/progress';
import {
  BuklodGameLanguageControl,
  BuklodGameLanguageProvider,
  BuklodGameText as Text,
} from '@/features/games/runtime/BuklodGameLanguage';

function TrainingGroundsContent() {
  const [progress, setProgress] = useState<BuklodKingdomProgress | null>(null);
  const [levelDetails, setLevelDetails] = useState<Record<string, Record<number, BuklodKingdomLevelDetail>>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      loadBuklodKingdomProgress(),
      loadBuklodKingdomLevelDetails().catch(() => []),
    ])
      .then(([value, details]) => {
        if (!mounted) return;
        setProgress(value);
        const grouped: Record<string, Record<number, BuklodKingdomLevelDetail>> = {};
        for (const detail of details) {
          grouped[detail.gameId] ??= {};
          grouped[detail.gameId][detail.levelNo] = detail;
        }
        setLevelDetails(grouped);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const unsubscribe = subscribeBuklodKingdomProgress((value) => {
      if (mounted) setProgress(value);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const stations = useMemo(
    () =>
      Object.values(progress?.stations ?? {}).sort(
        (a, b) => a.revealOrder - b.revealOrder,
      ),
    [progress],
  );

  if (loading && !progress) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f0cd72" />
        <Text style={styles.loading}>LOADING TRAINING GROUNDS...</Text>
      </View>
    );
  }

  if (!progress?.landmarks.trainingGrounds) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="lock" size={42} color="#e3c773" />
        <Text style={styles.lockTitle}>TRAINING GROUNDS LOCKED</Text>
        <Text style={styles.lockCopy}>Clear 4 Kingdom regions to unlock the Training Grounds.</Text>
        <Pressable onPress={() => router.back()} style={styles.primary}>
          <Text style={styles.primaryText}>BACK TO KINGDOM</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>BUKLOD KINGDOM</Text>
          <Text style={styles.title}>TRAINING GROUNDS</Text>
          <Text style={styles.copy}>
            Replay any unlocked region, improve stars and best score, and train for the current Level. First-clear XP is never farmed by replay.
          </Text>
        </View>
        <View style={styles.xpCard}>
          <Text style={styles.xpValue}>{progress.kingdomXp.toLocaleString()}</Text>
          <Text style={styles.xpLabel}>KINGDOM XP</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {stations.map((station) => {
          const availableLevels = station.unlocked
            ? Array.from(
                { length: station.mastered ? 20 : station.currentLevel },
                (_, index) => index + 1,
              )
            : [];
          const stationLevels = levelDetails[station.gameId] ?? {};
          return (
            <View
              key={station.gameId}
              style={[styles.card, !station.unlocked && styles.cardLocked]}
            >
              <View style={styles.cardTop}>
                <Text style={styles.character}>{station.characterName}</Text>
                <View style={[styles.statePill, station.mastered && styles.masteredPill]}>
                  <Text style={styles.stateText}>
                    {!station.unlocked
                      ? 'LOCKED'
                      : station.mastered
                        ? 'MASTERED'
                        : `LEVEL ${station.currentLevel}/20`}
                  </Text>
                </View>
              </View>
              <Text style={styles.game}>{station.gameName}</Text>
              <Text style={styles.region}>{station.regionName}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>★ {station.bestStars}</Text>
                <Text style={styles.meta}>{station.clearedLevels}/20 CLEARED</Text>
                <Text style={styles.meta}>WORLD {station.worldTier}</Text>
              </View>

              {station.unlocked ? (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Play current ${station.gameName} Level ${station.currentLevel}`}
                    onPress={() =>
                      router.push({
                        pathname: `/games/${station.gameId}` as any,
                        params: { level: String(station.currentLevel) },
                      })
                    }
                    style={({ pressed }) => [
                      styles.trainButton,
                      pressed && styles.cardPressed,
                    ]}
                  >
                    <Text style={styles.trainButtonText}>
                      {station.mastered ? 'TRAIN LEVEL 20' : `PLAY LEVEL ${station.currentLevel}`}
                    </Text>
                  </Pressable>

                  {station.clearedLevels > 0 ? (
                    <View style={styles.levelSection}>
                      <Text style={styles.levelSectionTitle}>REPLAY CLEARED LEVELS</Text>
                      <View style={styles.levelGrid}>
                        {availableLevels
                          .filter((levelNo) => levelNo <= station.clearedLevels)
                          .map((levelNo) => {
                            const detail = stationLevels[levelNo];
                            return (
                            <Pressable
                              key={levelNo}
                              accessibilityRole="button"
                              accessibilityLabel={`Replay ${station.gameName} Level ${levelNo}`}
                              onPress={() =>
                                router.push({
                                  pathname: `/games/${station.gameId}` as any,
                                  params: { level: String(levelNo) },
                                })
                              }
                              style={({ pressed }) => [
                                styles.levelButton,
                                levelNo === station.currentLevel && styles.levelButtonCurrent,
                                pressed && styles.cardPressed,
                              ]}
                            >
                              <Text style={styles.levelButtonText}>{levelNo}</Text>
                              <Text style={styles.levelStars}>
                                {detail?.bestStars ? '★'.repeat(detail.bestStars) : '·'}
                              </Text>
                            </Pressable>
                            );
                          })}
                      </View>
                    </View>
                  ) : null}
                </>
              ) : (
                <Text style={styles.requirement}>
                  REQUIRES CIRCLE RANK {station.requiredRankOrder}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

export default function BuklodKingdomTrainingGrounds() {
  return (
    <BuklodGameLanguageProvider gameId="training-grounds">
      <View style={styles.root}>
        <TrainingGroundsContent />
        <BuklodGameLanguageControl />
      </View>
    </BuklodGameLanguageProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#071722' },
  page: { padding: 22, paddingTop: 62, paddingBottom: 40, gap: 18 },
  center: {
    flex: 1,
    minHeight: 620,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#071722',
  },
  loading: { marginTop: 10, color: '#d9e3e9', fontSize: 10, fontWeight: '900' },
  lockTitle: { marginTop: 12, color: '#fff0b5', fontSize: 24, fontWeight: '900' },
  lockCopy: { marginTop: 8, color: '#bdc9d0', textAlign: 'center', lineHeight: 20 },
  header: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16 },
  eyebrow: { color: '#d7b95f', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#fff7d7', fontSize: 32, fontWeight: '900', marginTop: 4 },
  copy: { maxWidth: 650, marginTop: 8, color: '#c4d0d6', lineHeight: 20 },
  xpCard: {
    minWidth: 128,
    alignItems: 'flex-end',
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  xpValue: { color: '#f2d47c', fontSize: 26, fontWeight: '900' },
  xpLabel: { color: '#96a9b4', fontSize: 8, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    flexGrow: 1,
    flexBasis: 260,
    minHeight: 150,
    padding: 15,
    borderRadius: 18,
    backgroundColor: 'rgba(18,40,52,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(224,191,102,0.26)',
  },
  cardLocked: { opacity: 0.48, borderColor: 'rgba(160,170,176,0.22)' },
  cardPressed: { opacity: 0.78 },
  trainButton: {
    marginTop: 14,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    alignItems: 'center',
    backgroundColor: '#d7b85e',
  },
  trainButtonText: { color: '#17212a', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  levelSection: { marginTop: 12, gap: 7 },
  levelSectionTitle: { color: '#8fa5b0', fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  levelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  levelButton: {
    minWidth: 34,
    height: 42,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  levelButtonCurrent: { borderColor: '#e6c66d', backgroundColor: 'rgba(230,198,109,0.14)' },
  levelButtonText: { color: '#eef3f5', fontSize: 10, fontWeight: '900' },
  levelStars: { color: '#f2d47c', fontSize: 7, lineHeight: 9, fontWeight: '900', marginTop: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  character: { color: '#f2d47c', fontSize: 12, fontWeight: '900' },
  statePill: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, backgroundColor: '#274a5d' },
  masteredPill: { backgroundColor: '#7b6124' },
  stateText: { color: '#fff', fontSize: 8, fontWeight: '900' },
  game: { marginTop: 12, color: '#fff', fontSize: 20, fontWeight: '900' },
  region: { marginTop: 2, color: '#a9bcc6', fontSize: 11, fontWeight: '700' },
  metaRow: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  meta: { color: '#d7e1e6', fontSize: 9, fontWeight: '800' },
  requirement: { marginTop: 10, color: '#d4b2a8', fontSize: 8, fontWeight: '900' },
  primary: { marginTop: 18, paddingHorizontal: 20, paddingVertical: 13, borderRadius: 14, backgroundColor: '#e0c16b' },
  primaryText: { color: '#17212a', fontWeight: '900' },
});
