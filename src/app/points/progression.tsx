import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

type RankProgress = {
  lifetime_points: number;
  weekly_points: number;
  monthly_points: number;
  rank_order: number;
  rank_name: string;
  rank_min_points: number;
  next_rank_points: number | null;
  next_rank_name: string | null;
  points_to_next: number;
  progress_percent: number;
};

type RankLadderRow = {
  rank_order: number;
  rank_family: string;
  rank_level: string;
  rank_name: string;
  min_points: number;
  max_points: number | null;
};

const GREEN = '#075B30';
const money = (value: number | null | undefined) =>
  Number(value ?? 0).toLocaleString('en-PH');
const number = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export default function CircleRankProgressionScreen() {
  const [progress, setProgress] = useState<RankProgress | null>(null);
  const [ladder, setLadder] = useState<RankLadderRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  const load = useCallback(async (refresh = false) => {
    const request = ++requestId.current;
    if (refresh) setRefreshing(true);
    else setBusy(true);
    setError('');

    try {
      const [progressResult, ladderResult] = await Promise.all([
        supabase.rpc('get_my_buklod_rank_progress'),
        supabase.rpc('get_buklod_rank_ladder'),
      ]);
      if (progressResult.error) throw progressResult.error;
      if (ladderResult.error) throw ladderResult.error;

      const progressRows = Array.isArray(progressResult.data)
        ? progressResult.data
        : [];
      const ladderRows = Array.isArray(ladderResult.data)
        ? ladderResult.data
        : [];
      if (!progressRows[0] || ladderRows.length === 0) {
        throw new Error('Circle Rank progression data is not available.');
      }

      if (request !== requestId.current) return;
      setProgress(progressRows[0] as RankProgress);
      setLadder(
        [...(ladderRows as RankLadderRow[])].sort(
          (a, b) => number(a.rank_order) - number(b.rank_order),
        ),
      );
    } catch {
      if (request === requestId.current) {
        setError('Could not load your Circle Rank progression. Your points are unchanged.');
      }
    } finally {
      if (request === requestId.current) {
        setBusy(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      requestId.current += 1;
    };
  }, [load]);

  const percent = Math.min(100, Math.max(0, number(progress?.progress_percent)));
  const currentOrder = number(progress?.rank_order);
  let previousFamily = '';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />
      }
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <MaterialCommunityIcons name="arrow-left" color={GREEN} size={24} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>MY BUKLOD</Text>
          <Text style={styles.heading}>Circle Rank Progression</Text>
        </View>
      </View>

      {busy && !progress ? (
        <View style={styles.state}>
          <ActivityIndicator color={GREEN} />
          <Text style={styles.stateText}>Loading your rank progression…</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.state}>
          <MaterialCommunityIcons name="alert-circle-outline" size={25} color="#9A3A2A" />
          <Text style={styles.stateText}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void load()}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>TRY AGAIN</Text>
          </Pressable>
        </View>
      ) : null}

      {progress ? (
        <>
          <View style={styles.currentCard}>
            <Text style={styles.lightLabel}>YOUR CURRENT CIRCLE RANK</Text>
            <Text style={styles.currentRank}>{progress.rank_name}</Text>
            <Text style={styles.points}>{money(progress.lifetime_points)} lifetime points</Text>
            <View style={styles.progressMeta}>
              <Text style={styles.lightLabel}>RANK PROGRESS</Text>
              <Text style={styles.progressValue}>{percent.toFixed(0)}%</Text>
            </View>
            <View
              accessibilityLabel="Rank progress"
              accessibilityValue={{ min: 0, max: 100, now: percent }}
              style={styles.track}
            >
              <View style={[styles.trackFill, { width: percent + '%' }]} />
            </View>
            <Text style={styles.nextRank}>
              {progress.next_rank_name
                ? money(progress.points_to_next) +
                  ' points to ' + progress.next_rank_name +
                  ' (' + money(progress.next_rank_points) + ' total)'
                : 'Maximum Circle Rank reached'}
            </Text>
            <View style={styles.periodRow}>
              <Text style={styles.periodText}>This week: +{money(progress.weekly_points)}</Text>
              <Text style={styles.periodText}>This month: +{money(progress.monthly_points)}</Text>
            </View>
          </View>

          <View style={styles.roadmapHead}>
            <Text style={styles.roadmapTitle}>FULL RANK ROADMAP</Text>
            <Text style={styles.roadmapSubtitle}>
              All {ladder.length} Circle Ranks, in order. Your lifetime points determine progression.
            </Text>
          </View>

          {ladder.map((item) => {
            const familyHeading = previousFamily !== item.rank_family;
            previousFamily = item.rank_family;
            const order = number(item.rank_order);
            const achieved = order < currentOrder;
            const current = order === currentOrder;
            return (
              <React.Fragment key={String(item.rank_order)}>
                {familyHeading ? (
                  <Text style={styles.familyHeading}>{item.rank_family}</Text>
                ) : null}
                <View style={[styles.rankRow, current && styles.activeRow]}>
                  <View style={[styles.rankNumber, current && styles.activeNumber]}>
                    {achieved ? (
                      <MaterialCommunityIcons name="check" color={GREEN} size={16} />
                    ) : (
                      <Text style={[styles.rankNumberText, current && styles.activeNumberText]}>
                        {order}
                      </Text>
                    )}
                  </View>
                  <View style={styles.rankDetails}>
                    <Text style={[styles.rankTitle, current && styles.currentRowText]}>
                      {item.rank_name}
                    </Text>
                    <Text style={styles.rankThreshold}>
                      {money(item.min_points)} pts
                      {item.max_points === null
                        ? ' and above'
                        : ' – ' + money(item.max_points) + ' pts'}
                    </Text>
                  </View>
                  <Text style={[styles.status, current && styles.currentStatus]}>
                    {current ? 'YOU ARE HERE' : achieved ? 'REACHED' : 'LOCKED'}
                  </Text>
                </View>
              </React.Fragment>
            );
          })}

          <Text style={styles.note}>
            Circle Rank is based on verified lifetime BUKLOD Points. Spending available points
            does not lower your rank. Character levels are separate; eligible character and
            reward unlocks follow their own verified progression rules.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/points')}
            style={styles.pointsButton}
          >
            <Text style={styles.pointsButtonText}>OPEN BUKLOD POINTS</Text>
            <MaterialCommunityIcons name="arrow-right" color="#FFFFFF" size={20} />
          </Pressable>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5FAF7' },
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 90, gap: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  backButton: {
    width: 42, height: 42, borderRadius: 12, justifyContent: 'center',
    alignItems: 'center', backgroundColor: '#E7F4EB',
  },
  headerText: { flex: 1 },
  eyebrow: { color: GREEN, fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  heading: { color: '#173126', fontSize: 23, fontWeight: '900', marginTop: 2 },
  state: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24,
    alignItems: 'center', gap: 12, marginBottom: 16,
  },
  stateText: { color: '#47594F', textAlign: 'center', fontSize: 14 },
  retryButton: { backgroundColor: '#E7F4EB', padding: 12, borderRadius: 12 },
  retryText: { color: GREEN, fontWeight: '800' },
  currentCard: {
    backgroundColor: GREEN, borderRadius: 22, padding: 20, marginBottom: 24,
  },
  lightLabel: { color: '#D5F4DF', fontWeight: '800', fontSize: 11, letterSpacing: 0.7 },
  currentRank: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', marginTop: 8 },
  points: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginTop: 6 },
  progressMeta: {
    marginTop: 24, flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  track: {
    height: 12, borderRadius: 7, backgroundColor: '#448862', overflow: 'hidden',
    marginTop: 9,
  },
  trackFill: { backgroundColor: '#F2D66F', height: '100%', borderRadius: 7 },
  nextRank: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', marginTop: 13 },
  periodRow: {
    borderTopColor: '#448862', borderTopWidth: 1, paddingTop: 12,
    marginTop: 15, flexDirection: 'row', flexWrap: 'wrap', gap: 16,
  },
  periodText: { color: '#D5F4DF', fontSize: 12, fontWeight: '600' },
  roadmapHead: { marginBottom: 14 },
  roadmapTitle: { color: '#173126', fontSize: 17, fontWeight: '900' },
  roadmapSubtitle: { color: '#617268', fontSize: 13, lineHeight: 19, marginTop: 4 },
  familyHeading: {
    color: GREEN, fontWeight: '900', fontSize: 14,
    marginTop: 18, marginBottom: 9, letterSpacing: 0.2,
  },
  rankRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, marginBottom: 7, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#DFE8E2', borderRadius: 13,
  },
  activeRow: { backgroundColor: '#E7F6EB', borderColor: GREEN, borderWidth: 1.5 },
  rankNumber: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#EEF3F0',
    alignItems: 'center', justifyContent: 'center',
  },
  activeNumber: { backgroundColor: GREEN },
  rankNumberText: { color: '#617268', fontWeight: '800', fontSize: 12 },
  activeNumberText: { color: '#FFFFFF' },
  rankDetails: { flex: 1 },
  rankTitle: { color: '#21392D', fontWeight: '800', fontSize: 13 },
  currentRowText: { color: GREEN },
  rankThreshold: { color: '#78877D', fontSize: 11, marginTop: 3 },
  status: { color: '#87948B', fontSize: 9, fontWeight: '800' },
  currentStatus: { color: GREEN },
  note: { color: '#617268', fontSize: 12, lineHeight: 19, marginTop: 23 },
  pointsButton: {
    marginTop: 20, padding: 15, borderRadius: 14, backgroundColor: GREEN,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 9,
  },
  pointsButtonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
});
