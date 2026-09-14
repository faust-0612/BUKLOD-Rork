import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';

type ArenaRecord = {
  wins: number;
  losses: number;
  draws: number;
  completed: number;
  win_rate: number;
  current_win_streak: number;
  best_win_streak: number;
};

const EMPTY: ArenaRecord = {
  wins: 0,
  losses: 0,
  draws: 0,
  completed: 0,
  win_rate: 0,
  current_win_streak: 0,
  best_win_streak: 0,
};

export default function IgpatArenaRecordScreen() {
  const [record, setRecord] = useState<ArenaRecord>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc('get_my_buklod_igpat_arena_record_v1');
      if (rpcError) throw rpcError;
      setRecord({ ...EMPTY, ...(data ?? {}) });
    } catch (loadError: any) {
      console.warn('BUKLOD IGPAT Arena record:', String(loadError?.message ?? loadError));
      setError('Your structured Arena record is not available yet. The secured server update may still need to be applied.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={20} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>BUKLOD IGPAT ARENA</Text>
          <Text style={styles.title}>My Record</Text>
          <Text style={styles.subtitle}>Private structured competition record. Normal IGPAT posts never receive wins or losses.</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerState}><ActivityIndicator color="#FFFFFF" /><Text style={styles.stateText}>Loading record…</Text></View>
      ) : error ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void load()}><Text style={styles.retryText}>RETRY</Text></Pressable>
        </View>
      ) : (
        <>
          <View style={styles.recordCard}>
            <View style={styles.bigRecord}>
              <Text style={styles.bigValue}>{record.wins}W</Text>
              <Text style={styles.dash}>–</Text>
              <Text style={styles.bigValue}>{record.losses}L</Text>
              {record.draws > 0 ? <Text style={styles.draws}> · {record.draws}D</Text> : null}
            </View>
            <Text style={styles.completed}>{record.completed} structured challenges completed</Text>
          </View>

          <View style={styles.metricGrid}>
            <View style={styles.metric}><Text style={styles.metricValue}>{Number(record.win_rate ?? 0).toFixed(1)}%</Text><Text style={styles.metricLabel}>WIN RATE</Text></View>
            <View style={styles.metric}><Text style={styles.metricValue}>{record.current_win_streak}</Text><Text style={styles.metricLabel}>CURRENT STREAK</Text></View>
            <View style={styles.metric}><Text style={styles.metricValue}>{record.best_win_streak}</Text><Text style={styles.metricLabel}>BEST STREAK</Text></View>
          </View>

          <View style={styles.noteCard}>
            <MaterialCommunityIcons name="shield-check-outline" size={19} color="#D9FF69" />
            <Text style={styles.note}>This record is for intentional Arena modes only. It is not used to shame users or score ordinary social participation.</Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050807', padding: 18, paddingTop: 54 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: '#0D120F' },
  headerCopy: { flex: 1 },
  eyebrow: { color: 'rgba(255,255,255,0.44)', fontSize: 8.5, fontWeight: '900', letterSpacing: 1 },
  title: { marginTop: 4, color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  subtitle: { marginTop: 5, color: 'rgba(255,255,255,0.54)', fontSize: 10, lineHeight: 16 },
  centerState: { marginTop: 46, alignItems: 'center', gap: 10 },
  stateCard: { marginTop: 28, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', padding: 18 },
  stateText: { color: 'rgba(255,255,255,0.58)', fontSize: 10, lineHeight: 16, textAlign: 'center' },
  retryButton: { marginTop: 12, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  retryText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '900' },
  recordCard: { marginTop: 28, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(217,255,105,0.20)', backgroundColor: '#10150D', padding: 22, alignItems: 'center' },
  bigRecord: { flexDirection: 'row', alignItems: 'baseline' },
  bigValue: { color: '#FFFFFF', fontSize: 32, fontWeight: '900' },
  dash: { marginHorizontal: 8, color: 'rgba(255,255,255,0.30)', fontSize: 24, fontWeight: '900' },
  draws: { color: '#D9FF69', fontSize: 13, fontWeight: '900' },
  completed: { marginTop: 8, color: 'rgba(255,255,255,0.46)', fontSize: 9 },
  metricGrid: { marginTop: 12, flexDirection: 'row', gap: 8 },
  metric: { flex: 1, minHeight: 84, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', alignItems: 'center', justifyContent: 'center' },
  metricValue: { color: '#D9FF69', fontSize: 20, fontWeight: '900' },
  metricLabel: { marginTop: 5, color: 'rgba(255,255,255,0.36)', fontSize: 7, fontWeight: '900', letterSpacing: 0.6, textAlign: 'center' },
  noteCard: { marginTop: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: '#0D120F', padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  note: { flex: 1, color: 'rgba(255,255,255,0.48)', fontSize: 8.8, lineHeight: 14 },
});
