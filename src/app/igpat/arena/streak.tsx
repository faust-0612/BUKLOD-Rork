import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';

type StreakData = {
  current_streak: number;
  best_streak: number;
  completion_days: number;
  seven_day_earned: boolean;
  fourteen_day_earned: boolean;
  thirty_day_earned: boolean;
};

const EMPTY: StreakData = {
  current_streak: 0,
  best_streak: 0,
  completion_days: 0,
  seven_day_earned: false,
  fourteen_day_earned: false,
  thirty_day_earned: false,
};

export default function IgpatIronStreakScreen() {
  const [data, setData] = useState<StreakData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: rpcError } = await (supabase as any).rpc('get_my_buklod_igpat_iron_streak_v1');
      if (rpcError) throw rpcError;
      setData({ ...EMPTY, ...(result ?? {}) });
    } catch (loadError: any) {
      console.warn('BUKLOD IGPAT Iron Streak:', String(loadError?.message ?? loadError));
      setError('Iron Streak is not available yet. The secured Arena update may still need to be applied.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const badge = (label: string, earned: boolean) => (
    <View style={[styles.badge, earned && styles.badgeEarned]}>
      <MaterialCommunityIcons name={earned ? 'shield-star' : 'shield-outline'} size={20} color={earned ? '#07100B' : 'rgba(255,255,255,0.38)'} />
      <Text style={[styles.badgeLabel, earned && styles.badgeLabelEarned]}>{label}</Text>
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}><MaterialCommunityIcons name="arrow-left" size={20} color="#FFFFFF" /></Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>BUKLOD IGPAT ARENA</Text>
          <Text style={styles.title}>Iron Streak</Text>
          <Text style={styles.subtitle}>Meaningful completion only. Opening the app never preserves this number.</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerState}><ActivityIndicator color="#FFFFFF" /><Text style={styles.stateText}>Loading streak…</Text></View>
      ) : error ? (
        <View style={styles.stateCard}><Text style={styles.stateText}>{error}</Text><Pressable style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>RETRY</Text></Pressable></View>
      ) : (
        <>
          <View style={styles.hero}>
            <MaterialCommunityIcons name="fire" size={34} color="#D9FF69" />
            <Text style={styles.heroValue}>{data.current_streak}</Text>
            <Text style={styles.heroLabel}>CURRENT COMPLETION STREAK</Text>
            <Text style={styles.heroHint}>Consecutive UTC days with verified Arena completion.</Text>
          </View>

          <View style={styles.metrics}>
            <View style={styles.metric}><Text style={styles.metricValue}>{data.best_streak}</Text><Text style={styles.metricLabel}>BEST STREAK</Text></View>
            <View style={styles.metric}><Text style={styles.metricValue}>{data.completion_days}</Text><Text style={styles.metricLabel}>COMPLETION DAYS</Text></View>
          </View>

          <Text style={styles.section}>ACHIEVEMENT MARKERS</Text>
          <View style={styles.badges}>
            {badge('7-DAY DISCIPLINE', data.seven_day_earned)}
            {badge('14-DAY ENDURANCE', data.fourteen_day_earned)}
            {badge('30-DAY IRON', data.thirty_day_earned)}
          </View>

          <View style={styles.noteCard}>
            <Text style={styles.noteTitle}>NO EMPTY STREAK FARMING</Text>
            <Text style={styles.note}>Only verified completed Arena participation contributes. Login, app-open, idle watch time, or passive scrolling never counts.</Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050807', padding: 18, paddingTop: 54 },
  headerRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: '#0D120F' },
  headerCopy: { flex: 1 },
  eyebrow: { color: 'rgba(255,255,255,0.42)', fontSize: 8.5, fontWeight: '900', letterSpacing: 1 },
  title: { marginTop: 4, color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  subtitle: { marginTop: 5, color: 'rgba(255,255,255,0.54)', fontSize: 10, lineHeight: 16 },
  centerState: { marginTop: 44, alignItems: 'center', gap: 10 },
  stateCard: { marginTop: 26, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', padding: 18 },
  stateText: { color: 'rgba(255,255,255,0.56)', fontSize: 10, lineHeight: 16, textAlign: 'center' },
  retry: { marginTop: 12, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  retryText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '900' },
  hero: { marginTop: 28, borderRadius: 21, borderWidth: 1, borderColor: 'rgba(217,255,105,0.20)', backgroundColor: '#10150D', padding: 22, alignItems: 'center' },
  heroValue: { marginTop: 4, color: '#FFFFFF', fontSize: 42, fontWeight: '900' },
  heroLabel: { marginTop: 2, color: '#D9FF69', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8 },
  heroHint: { marginTop: 6, color: 'rgba(255,255,255,0.38)', fontSize: 8, textAlign: 'center' },
  metrics: { marginTop: 10, flexDirection: 'row', gap: 8 },
  metric: { flex: 1, minHeight: 82, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', alignItems: 'center', justifyContent: 'center' },
  metricValue: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  metricLabel: { marginTop: 4, color: 'rgba(255,255,255,0.34)', fontSize: 7, fontWeight: '900', letterSpacing: 0.6 },
  section: { marginTop: 22, marginBottom: 9, color: 'rgba(255,255,255,0.42)', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8 },
  badges: { flexDirection: 'row', gap: 8 },
  badge: { flex: 1, minHeight: 88, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: '#0D120F', alignItems: 'center', justifyContent: 'center', padding: 8 },
  badgeEarned: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  badgeLabel: { marginTop: 7, color: 'rgba(255,255,255,0.36)', fontSize: 6.8, fontWeight: '900', letterSpacing: 0.4, textAlign: 'center' },
  badgeLabelEarned: { color: '#07100B' },
  noteCard: { marginTop: 16, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: '#0D120F', padding: 14 },
  noteTitle: { color: '#D9FF69', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
  note: { marginTop: 5, color: 'rgba(255,255,255,0.48)', fontSize: 8.8, lineHeight: 14 },
});
