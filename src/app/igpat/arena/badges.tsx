import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';

type SkillBadge = {
  badge_key: string;
  badge_label: string;
  evidence_category: string;
  earned: boolean;
  verified_wins: number;
  criteria: string;
};

export default function IgpatSkillBadgesScreen() {
  const [rows, setRows] = useState<SkillBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc('get_my_buklod_igpat_skill_badges_v1');
      if (rpcError) throw rpcError;
      setRows((data ?? []) as SkillBadge[]);
    } catch (loadError: any) {
      console.warn('BUKLOD IGPAT skill badges:', String(loadError?.message ?? loadError));
      setError('Skill Badges are not available yet. The Arena server update may still need to be applied.');
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
          <Text style={styles.title}>Skill Badges</Text>
          <Text style={styles.subtitle}>Transparent criteria only. Badges come from verified demonstrated outcomes—not likes, app opens, or paid shortcuts.</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerState}><ActivityIndicator color="#FFFFFF" /><Text style={styles.stateText}>Loading badges…</Text></View>
      ) : error ? (
        <View style={styles.stateCard}><Text style={styles.stateText}>{error}</Text><Pressable style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>RETRY</Text></Pressable></View>
      ) : (
        <View style={styles.list}>
          {rows.map(row => (
            <View key={row.badge_key} style={[styles.card, row.earned && styles.cardEarned]}>
              <View style={[styles.iconWrap, row.earned && styles.iconEarned]}>
                <MaterialCommunityIcons name={row.earned ? 'shield-star' : 'shield-outline'} size={24} color={row.earned ? '#07100B' : 'rgba(255,255,255,0.38)'} />
              </View>
              <View style={styles.cardCopy}>
                <Text style={[styles.badgeName, row.earned && styles.badgeNameEarned]}>{row.badge_label.toUpperCase()}</Text>
                <Text style={[styles.criteria, row.earned && styles.criteriaEarned]}>{row.criteria}</Text>
                <Text style={[styles.evidence, row.earned && styles.evidenceEarned]}>{row.verified_wins} verified category win{row.verified_wins === 1 ? '' : 's'}</Text>
              </View>
              {row.earned ? <MaterialCommunityIcons name="check-circle" size={19} color="#07100B" /> : null}
            </View>
          ))}
        </View>
      )}

      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>CURRENT SAFE BADGE SET</Text>
        <Text style={styles.note}>Athlete, Speaker, Musician, Teacher and Creator are mapped only to approved King of the Hill categories. Builder, Volunteer and Mentor remain hidden until IGPAT has a reliable verified evidence source for them.</Text>
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
  stateCard: { marginTop: 26, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', padding: 18 },
  stateText: { color: 'rgba(255,255,255,0.56)', fontSize: 10, lineHeight: 16, textAlign: 'center' },
  retry: { marginTop: 12, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  retryText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '900' },
  list: { marginTop: 24, gap: 9 },
  card: { minHeight: 90, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.11)', backgroundColor: '#0D120F', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  cardEarned: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  iconEarned: { backgroundColor: 'rgba(7,16,11,0.08)' },
  cardCopy: { flex: 1 },
  badgeName: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  badgeNameEarned: { color: '#07100B' },
  criteria: { marginTop: 4, color: 'rgba(255,255,255,0.44)', fontSize: 8.5, lineHeight: 13 },
  criteriaEarned: { color: 'rgba(7,16,11,0.62)' },
  evidence: { marginTop: 5, color: 'rgba(255,255,255,0.28)', fontSize: 7.5, fontWeight: '800' },
  evidenceEarned: { color: 'rgba(7,16,11,0.42)' },
  noteCard: { marginTop: 16, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(217,255,105,0.16)', backgroundColor: '#10150D', padding: 14 },
  noteTitle: { color: '#D9FF69', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
  note: { marginTop: 5, color: 'rgba(255,255,255,0.48)', fontSize: 8.6, lineHeight: 14 },
});
