import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';

type BountyRow = {
  challenge_id: string;
  title: string;
  status: string;
  reward_kind: 'badge' | 'title';
  reward_label: string;
  winner_user_id?: string | null;
  winner_name?: string | null;
  created_at?: string | null;
};
type RewardRow = {
  challenge_id: string;
  reward_kind: 'badge' | 'title';
  reward_label: string;
  challenge_title: string;
  earned_at?: string | null;
};

function dateLabel(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}

export default function IgpatBountyScreen() {
  const [rows, setRows] = useState<BountyRow[]>([]);
  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bounties, earned] = await Promise.all([
        (supabase as any).rpc('get_buklod_igpat_bounties_v1', { p_limit: 30 }),
        (supabase as any).rpc('get_my_buklod_igpat_bounty_rewards_v1'),
      ]);
      if (bounties.error) throw bounties.error;
      if (earned.error) throw earned.error;
      setRows((bounties.data ?? []) as BountyRow[]);
      setRewards((earned.data ?? []) as RewardRow[]);
    } catch (loadError: any) {
      console.warn('BUKLOD IGPAT Bounty:', String(loadError?.message ?? loadError));
      setError('Bounty Challenge is not available yet. The secured Arena update may still need to be applied.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={20} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>BUKLOD IGPAT ARENA</Text>
          <Text style={styles.title}>Bounty Challenge</Text>
          <Text style={styles.subtitle}>Symbolic recognition only: approved badge or title. No betting, paid wagering, random money, or financial prizes.</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerState}><ActivityIndicator color="#FFFFFF" /><Text style={styles.stateText}>Loading bounties…</Text></View>
      ) : error ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateText}>{error}</Text>
          <Pressable style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>RETRY</Text></Pressable>
        </View>
      ) : (
        <>
          {rewards.length ? (
            <View style={styles.rewardSection}>
              <Text style={styles.sectionTitle}>MY EARNED RECOGNITION</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rewardRail}>
                {rewards.map(reward => (
                  <Pressable key={`${reward.challenge_id}:${reward.reward_label}`} style={styles.rewardCard} onPress={() => router.push(`/igpat/arena/${reward.challenge_id}` as any)}>
                    <MaterialCommunityIcons name={reward.reward_kind === 'badge' ? 'shield-star-outline' : 'medal-outline'} size={22} color="#D9FF69" />
                    <Text style={styles.rewardLabel}>{reward.reward_label}</Text>
                    <Text style={styles.rewardType}>{reward.reward_kind.toUpperCase()} · {dateLabel(reward.earned_at)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>ARENA BOUNTIES</Text>
          {rows.length ? (
            <View style={styles.list}>
              {rows.map(row => {
                const active = row.status === 'OPEN' || row.status === 'ACCEPTED' || row.status === 'ACTIVE';
                return (
                  <Pressable key={row.challenge_id} style={styles.card} onPress={() => router.push(`/igpat/arena/${row.challenge_id}` as any)}>
                    <View style={styles.cardTop}>
                      <Text style={styles.status}>{active ? 'ACTIVE BOUNTY' : row.status}</Text>
                      <View style={styles.kindBadge}>
                        <MaterialCommunityIcons name={row.reward_kind === 'badge' ? 'shield-star-outline' : 'medal-outline'} size={13} color="#D9FF69" />
                        <Text style={styles.kindText}>{row.reward_kind.toUpperCase()}</Text>
                      </View>
                    </View>
                    <Text style={styles.cardTitle}>{row.title}</Text>
                    <Text style={styles.rewardLine}>RECOGNITION · {row.reward_label}</Text>
                    {row.winner_name ? <Text style={styles.winner}>EARNED BY · {row.winner_name}</Text> : null}
                    <View style={styles.cardBottom}>
                      <Text style={styles.date}>{dateLabel(row.created_at)}</Text>
                      <View style={styles.openHint}><Text style={styles.openText}>OPEN</Text><MaterialCommunityIcons name="chevron-right" size={16} color="#FFFFFF" /></View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.stateCard}><Text style={styles.stateText}>No approved Arena bounty is available.</Text></View>
          )}
        </>
      )}

      <View style={styles.ethicsCard}>
        <MaterialCommunityIcons name="shield-check-outline" size={18} color="#D9FF69" />
        <Text style={styles.ethicsText}>Bounties are created only through the approved admin contract and recognize verified Arena performance. They do not exchange cash, paid entries, random prizes, or points from other BUKLOD systems.</Text>
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
  stateCard: { marginTop: 24, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', padding: 18 },
  stateText: { color: 'rgba(255,255,255,0.56)', fontSize: 10, lineHeight: 16, textAlign: 'center' },
  retry: { marginTop: 12, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  retryText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '900' },
  rewardSection: { marginTop: 24 },
  sectionTitle: { marginTop: 24, marginBottom: 9, color: 'rgba(255,255,255,0.42)', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8 },
  rewardRail: { gap: 8, paddingRight: 18 },
  rewardCard: { width: 170, minHeight: 110, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(217,255,105,0.18)', backgroundColor: '#10150D', padding: 13, justifyContent: 'center' },
  rewardLabel: { marginTop: 8, color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  rewardType: { marginTop: 5, color: 'rgba(255,255,255,0.36)', fontSize: 7.5, fontWeight: '800' },
  list: { gap: 9 },
  card: { borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', padding: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  status: { color: '#D9FF69', fontSize: 7.8, fontWeight: '900', letterSpacing: 0.6 },
  kindBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kindText: { color: 'rgba(255,255,255,0.44)', fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  cardTitle: { marginTop: 8, color: '#FFFFFF', fontSize: 14, lineHeight: 19, fontWeight: '900' },
  rewardLine: { marginTop: 8, color: 'rgba(255,255,255,0.58)', fontSize: 8.5, fontWeight: '800' },
  winner: { marginTop: 7, color: '#D9FF69', fontSize: 8, fontWeight: '900' },
  cardBottom: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { color: 'rgba(255,255,255,0.28)', fontSize: 7.5 },
  openHint: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  openText: { color: '#FFFFFF', fontSize: 7.5, fontWeight: '900' },
  ethicsCard: { marginTop: 18, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(217,255,105,0.16)', backgroundColor: '#10150D', padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  ethicsText: { flex: 1, color: 'rgba(255,255,255,0.46)', fontSize: 8.5, lineHeight: 13 },
});
