import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';

type SeasonInfo = {
  active?: boolean;
  id?: string;
  name?: string;
  starts_at?: string;
  ends_at?: string;
};
type SeasonRank = {
  user_id: string;
  display_name: string;
  completed_entries: number;
  wins: number;
  respect_received: number;
  arena_score: number;
  arena_tier: string;
};

function dateLabel(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

export default function IgpatArenaSeasonScreen() {
  const [season, setSeason] = useState<SeasonInfo>({ active: false });
  const [rows, setRows] = useState<SeasonRank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const current = await (supabase as any).rpc('get_current_buklod_igpat_season_v1');
      if (current.error) throw current.error;
      const info = (current.data ?? { active: false }) as SeasonInfo;
      setSeason(info);
      if (info.active && info.id) {
        const rank = await (supabase as any).rpc('get_buklod_igpat_season_rankings_v1', {
          p_season_id: info.id,
          p_limit: 50,
        });
        if (rank.error) throw rank.error;
        setRows((rank.data ?? []) as SeasonRank[]);
      } else {
        setRows([]);
      }
    } catch (loadError: any) {
      console.warn('BUKLOD IGPAT season:', String(loadError?.message ?? loadError));
      setError('Ranked Seasons are not available yet. The isolated Arena server update may still need to be applied.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}><MaterialCommunityIcons name="arrow-left" size={20} color="#FFFFFF" /></Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>BUKLOD IGPAT ARENA</Text>
          <Text style={styles.title}>Ranked Season</Text>
          <Text style={styles.subtitle}>Arena-only competition tiers. These scores never change Circle Rank, Character Level, Formation Rank, Cluster points, or Bayanihan points.</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerState}><ActivityIndicator color="#FFFFFF" /><Text style={styles.stateText}>Loading season…</Text></View>
      ) : error ? (
        <View style={styles.stateCard}><Text style={styles.stateText}>{error}</Text><Pressable style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>RETRY</Text></Pressable></View>
      ) : !season.active ? (
        <View style={styles.stateCard}>
          <MaterialCommunityIcons name="calendar-clock-outline" size={28} color="rgba(255,255,255,0.40)" style={styles.stateIcon} />
          <Text style={styles.stateTitle}>NO ACTIVE ARENA SEASON</Text>
          <Text style={styles.stateText}>A System Admin can schedule a season when Arena is ready for production. No ranking is auto-launched by this source work.</Text>
        </View>
      ) : (
        <>
          <View style={styles.seasonCard}>
            <Text style={styles.seasonLabel}>ACTIVE SEASON</Text>
            <Text style={styles.seasonName}>{season.name}</Text>
            <Text style={styles.seasonDates}>{dateLabel(season.starts_at)} – {dateLabel(season.ends_at)}</Text>
          </View>

          <View style={styles.tierRow}>
            {['Bronze','Silver','Gold','Elite','Champion'].map(tier => <View key={tier} style={styles.tier}><Text style={styles.tierText}>{tier.toUpperCase()}</Text></View>)}
          </View>

          <Text style={styles.section}>SEASON STANDINGS</Text>
          {rows.length ? (
            <View style={styles.list}>
              {rows.map((row, index) => (
                <View key={row.user_id} style={styles.rankCard}>
                  <View style={styles.place}><Text style={styles.placeText}>{index + 1}</Text></View>
                  <View style={styles.main}>
                    <Text style={styles.name} numberOfLines={1}>{row.display_name}</Text>
                    <Text style={styles.stats}>{row.wins} wins · {row.completed_entries} completed · {row.respect_received} Respect</Text>
                  </View>
                  <View style={styles.right}>
                    <Text style={styles.score}>{row.arena_score}</Text>
                    <Text style={styles.tierName}>{row.arena_tier.toUpperCase()}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.stateCard}><Text style={styles.stateText}>No verified completed Arena entries in this season yet.</Text></View>
          )}
        </>
      )}

      <View style={styles.isolationCard}>
        <MaterialCommunityIcons name="link-off" size={18} color="#D9FF69" />
        <Text style={styles.isolationText}>Arena season score is intentionally isolated. No conversion into money, Circle points, character progression, Formation progress, or Cluster points occurs here.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050807' },
  content: { padding: 18, paddingTop: 54, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: '#0D120F' },
  headerCopy: { flex: 1 },
  eyebrow: { color: 'rgba(255,255,255,0.42)', fontSize: 8.5, fontWeight: '900', letterSpacing: 1 },
  title: { marginTop: 4, color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  subtitle: { marginTop: 5, color: 'rgba(255,255,255,0.54)', fontSize: 10, lineHeight: 16 },
  centerState: { marginTop: 44, alignItems: 'center', gap: 10 },
  stateCard: { marginTop: 26, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', padding: 20, alignItems: 'center' },
  stateIcon: { marginBottom: 9 },
  stateTitle: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  stateText: { marginTop: 5, color: 'rgba(255,255,255,0.54)', fontSize: 9, lineHeight: 14, textAlign: 'center' },
  retry: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  retryText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '900' },
  seasonCard: { marginTop: 26, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(217,255,105,0.20)', backgroundColor: '#10150D', padding: 20, alignItems: 'center' },
  seasonLabel: { color: '#D9FF69', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8 },
  seasonName: { marginTop: 6, color: '#FFFFFF', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  seasonDates: { marginTop: 6, color: 'rgba(255,255,255,0.38)', fontSize: 8.5 },
  tierRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  tier: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  tierText: { color: 'rgba(255,255,255,0.48)', fontSize: 6.8, fontWeight: '900', letterSpacing: 0.4 },
  section: { marginTop: 24, marginBottom: 9, color: 'rgba(255,255,255,0.42)', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8 },
  list: { gap: 8 },
  rankCard: { minHeight: 70, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  place: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  placeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  main: { flex: 1 },
  name: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '900' },
  stats: { marginTop: 4, color: 'rgba(255,255,255,0.38)', fontSize: 7.8 },
  right: { alignItems: 'flex-end' },
  score: { color: '#D9FF69', fontSize: 16, fontWeight: '900' },
  tierName: { marginTop: 2, color: 'rgba(255,255,255,0.34)', fontSize: 6.5, fontWeight: '900', letterSpacing: 0.4 },
  isolationCard: { marginTop: 18, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(217,255,105,0.16)', backgroundColor: '#10150D', padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  isolationText: { flex: 1, color: 'rgba(255,255,255,0.46)', fontSize: 8.5, lineHeight: 13 },
});
