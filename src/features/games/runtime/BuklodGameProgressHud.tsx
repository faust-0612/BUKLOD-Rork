import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import type {
  BuklodKingdomProgress,
  BuklodKingdomStationProgress,
} from '@/features/games/kingdom/progress';

export default function BuklodGameProgressHud({
  loading,
  station,
  progress,
  canPlay,
}: {
  loading: boolean;
  station: BuklodKingdomStationProgress | null;
  progress: BuklodKingdomProgress | null;
  canPlay: boolean;
}) {
  if (loading && !station) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color="#f2d379" />
        <Text style={styles.loadingText}>LOADING KINGDOM...</Text>
      </View>
    );
  }

  if (!canPlay) {
    return (
      <View style={styles.lockOverlay}>
        <View style={styles.lockCard}>
          <MaterialCommunityIcons name="lock" size={34} color="#f2d379" />
          <Text style={styles.lockTitle}>REGION LOCKED</Text>
          <Text style={styles.lockText}>
            {station?.requiredRankOrder
              ? `Reach Circle Rank ${station.requiredRankOrder} to enter this Kingdom region.`
              : 'This Kingdom region is not available yet.'}
          </Text>
          <Text style={styles.lockMeta}>
            Your Circle Rank: {progress?.circleRankOrder ?? 1}
          </Text>
        </View>
      </View>
    );
  }

  if (!station) return null;

  return (
    <View style={styles.hud} pointerEvents="none">
      <View style={styles.levelPill}>
        <Text style={styles.levelLabel}>KINGDOM LEVEL</Text>
        <Text style={styles.levelValue}>{station.currentLevel}/20</Text>
      </View>
      <View style={styles.metaPill}>
        <Text style={styles.metaText}>WORLD TIER {station.worldTier}</Text>
        <Text style={styles.metaText}>★ {station.bestStars} • {station.clearedLevels} CLEARED</Text>
      </View>
      {progress?.lastResult?.gameId === station.gameId ? (
        <View style={styles.rewardPill}>
          <Text style={styles.rewardTitle}>
            {progress.lastResult.firstClear ? 'LEVEL CLEAR SAVED' : 'BEST RUN UPDATED'}
          </Text>
          {progress.lastResult.kingdomXpAwarded > 0 ? (
            <Text style={styles.rewardText}>
              +{progress.lastResult.kingdomXpAwarded} Kingdom XP
            </Text>
          ) : null}
          {progress.lastResult.collectibleAwarded ? (
            <Text style={styles.collectibleText}>NEW COLLECTIBLE</Text>
          ) : null}
        </View>
      ) : null}
      {progress?.pendingResults ? (
        <View style={styles.pendingPill}>
          <MaterialCommunityIcons name="cloud-sync-outline" size={11} color="#ffe6a1" />
          <Text style={styles.pendingText}>{progress.pendingResults} PENDING SYNC</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    position: 'absolute',
    left: 12,
    top: 10,
    zIndex: 120,
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    backgroundColor: 'rgba(5,10,18,0.84)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  loadingText: { color: '#ffffff', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  hud: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 105,
    maxWidth: 250,
    gap: 5,
    pointerEvents: 'none',
  },
  levelPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 13,
    backgroundColor: 'rgba(5,10,18,0.84)',
    borderWidth: 1,
    borderColor: 'rgba(243,210,125,0.34)',
  },
  levelLabel: { color: '#d9c58c', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.8 },
  levelValue: { color: '#ffffff', fontSize: 18, lineHeight: 20, fontWeight: '900' },
  metaPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(5,10,18,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  metaText: { color: 'rgba(255,255,255,0.78)', fontSize: 7.5, fontWeight: '800' },
  rewardPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(65,48,13,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(242,211,121,0.36)',
  },
  rewardTitle: { color: '#fff0b0', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.5 },
  rewardText: { marginTop: 1, color: '#ffffff', fontSize: 9, fontWeight: '900' },
  collectibleText: { marginTop: 2, color: '#9ee7b6', fontSize: 7, fontWeight: '900' },
  pendingPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(80,55,10,0.84)',
  },
  pendingText: { color: '#ffe6a1', fontSize: 7.5, fontWeight: '900' },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 140,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(3,7,12,0.78)',
  },
  lockCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(10,18,26,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(242,211,121,0.34)',
  },
  lockTitle: {
    marginTop: 10,
    color: '#fff3c4',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 1,
  },
  lockText: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    fontWeight: '700',
  },
  lockMeta: {
    marginTop: 10,
    color: '#b8c7d2',
    fontSize: 10,
    fontWeight: '800',
  },
});
