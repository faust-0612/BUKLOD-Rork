import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';

type Overview = {
  days?: number;
  posts?: number;
  views?: number;
  watch_ms?: number;
  watch_hours?: number;
  completions?: number;
  completion_rate?: number;
  reactions?: number;
  comments?: number;
  shares?: number;
  follows_gained?: number;
};

type TopPost = {
  post_id: string;
  title?: string | null;
  created_at?: string | null;
  views?: number;
  watch_ms?: number;
  reactions?: number;
  comments?: number;
  shares?: number;
  completions?: number;
  completion_rate?: number;
};

type AnalyticsPayload = {
  overview?: Overview;
  top_posts?: TopPost[];
  generated_at?: string | null;
};

const WINDOWS = [7, 30, 90] as const;

function number(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function Stat({ icon, value, label }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; value: string; label: string }) {
  return (
    <View style={styles.statCard} accessible accessibilityLabel={`${label}: ${value}`}>
      <MaterialCommunityIcons name={icon} size={18} color="#D9FF69" />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function IgpatAnalyticsScreen() {
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(30);
  const [payload, setPayload] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: analyticsError } = await (supabase as any).rpc(
        'get_my_buklod_igpat_creator_analytics_v1',
        { p_days: days, p_limit: 10 }
      );
      if (analyticsError) throw analyticsError;
      setPayload((data ?? {}) as AnalyticsPayload);
    } catch (loadError: any) {
      console.warn('BUKLOD IGPAT creator analytics:', String(loadError?.message ?? loadError));
      setPayload(null);
      setError('Creator analytics are not available yet. The secured IGPAT analytics server update may still need to be applied.');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { void load(); }, [load]);

  const overview = payload?.overview ?? {};
  const posts = Array.isArray(payload?.top_posts) ? payload?.top_posts ?? [] : [];

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={20} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>BUKLOD IGPAT</Text>
          <Text style={styles.title}>Creator Analytics</Text>
          <Text style={styles.subtitle}>Useful performance signals for your own IGPATs—without exposing viewer identities.</Text>
        </View>
      </View>

      <View style={styles.windowTabs} accessibilityRole="tablist">
        {WINDOWS.map(value => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: value === days }}
            onPress={() => setDays(value)}
            style={[styles.windowTab, value === days && styles.windowTabActive]}
          >
            <Text style={[styles.windowText, value === days && styles.windowTextActive]}>{value} DAYS</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.centerState}><ActivityIndicator color="#FFFFFF" /><Text style={styles.stateText}>Loading creator insights…</Text></View>
      ) : error ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void load()}><Text style={styles.retryText}>RETRY</Text></Pressable>
        </View>
      ) : (
        <>
          <View style={styles.statsGrid}>
            <Stat icon="eye-outline" value={number(overview.views).toLocaleString()} label="Views" />
            <Stat icon="clock-outline" value={`${number(overview.watch_hours).toFixed(1)}h`} label="Watch time" />
            <Stat icon="progress-check" value={`${number(overview.completion_rate).toFixed(1)}%`} label="Completion" />
            <Stat icon="heart-outline" value={number(overview.reactions).toLocaleString()} label="Reactions" />
            <Stat icon="comment-outline" value={number(overview.comments).toLocaleString()} label="Comments" />
            <Stat icon="share-variant-outline" value={number(overview.shares).toLocaleString()} label="Shares" />
            <Stat icon="account-plus-outline" value={number(overview.follows_gained).toLocaleString()} label="Follows gained" />
            <Stat icon="movie-open-outline" value={number(overview.posts).toLocaleString()} label="IGPATs" />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>TOP IGPATS</Text>
            <Text style={styles.sectionHint}>Ranked from real watch and engagement signals, not a public vanity leaderboard.</Text>
          </View>

          {posts.length ? (
            <View style={styles.list}>
              {posts.map((post, index) => (
                <Pressable
                  key={post.post_id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${post.title || 'IGPAT'}`}
                  style={styles.postCard}
                  onPress={() => router.push(`/post/${post.post_id}` as any)}
                >
                  <View style={styles.rankCircle}><Text style={styles.rankText}>{index + 1}</Text></View>
                  <View style={styles.postMain}>
                    <Text style={styles.postTitle} numberOfLines={2}>{post.title || 'Untitled IGPAT'}</Text>
                    <Text style={styles.postMeta}>
                      {number(post.views).toLocaleString()} views · {number(post.completion_rate).toFixed(1)}% complete · {number(post.shares).toLocaleString()} shares
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={18} color="rgba(255,255,255,0.55)" />
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.stateCard}><Text style={styles.stateText}>No creator analytics are available in this period yet.</Text></View>
          )}

          <View style={styles.privacyCard}>
            <MaterialCommunityIcons name="shield-account-outline" size={18} color="#D9FF69" />
            <Text style={styles.privacyText}>Analytics are aggregate-only. This screen does not reveal who watched your IGPATs.</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050807' },
  content: { padding: 18, paddingTop: 54, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: '#0D120F' },
  headerCopy: { flex: 1 },
  eyebrow: { color: 'rgba(255,255,255,0.46)', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { marginTop: 4, color: '#FFFFFF', fontSize: 25, fontWeight: '900' },
  subtitle: { marginTop: 5, color: 'rgba(255,255,255,0.58)', fontSize: 11, lineHeight: 17 },
  windowTabs: { marginTop: 20, padding: 3, borderRadius: 999, backgroundColor: '#0D120F', flexDirection: 'row' },
  windowTab: { flex: 1, minHeight: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  windowTabActive: { backgroundColor: '#FFFFFF' },
  windowText: { color: 'rgba(255,255,255,0.56)', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.6 },
  windowTextActive: { color: '#07100B' },
  centerState: { marginTop: 40, alignItems: 'center', gap: 10 },
  stateCard: { marginTop: 18, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', padding: 18 },
  stateText: { color: 'rgba(255,255,255,0.62)', fontSize: 10.5, lineHeight: 16, textAlign: 'center' },
  retryButton: { marginTop: 13, alignSelf: 'center', paddingHorizontal: 17, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)' },
  retryText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
  statsGrid: { marginTop: 18, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: { width: '48%', minHeight: 104, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', padding: 13, justifyContent: 'center' },
  statValue: { marginTop: 8, color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  statLabel: { marginTop: 3, color: 'rgba(255,255,255,0.43)', fontSize: 8.5, fontWeight: '800' },
  sectionHeader: { marginTop: 24 },
  sectionTitle: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.9 },
  sectionHint: { marginTop: 4, color: 'rgba(255,255,255,0.43)', fontSize: 8.8, lineHeight: 13 },
  list: { marginTop: 10, gap: 8 },
  postCard: { minHeight: 72, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rankCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(217,255,105,0.10)' },
  rankText: { color: '#D9FF69', fontSize: 10, fontWeight: '900' },
  postMain: { flex: 1 },
  postTitle: { color: '#FFFFFF', fontSize: 11, lineHeight: 16, fontWeight: '900' },
  postMeta: { marginTop: 4, color: 'rgba(255,255,255,0.43)', fontSize: 8.3, lineHeight: 12 },
  privacyCard: { marginTop: 20, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(217,255,105,0.18)', backgroundColor: '#10150D', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  privacyText: { flex: 1, color: 'rgba(255,255,255,0.56)', fontSize: 9, lineHeight: 14 },
});
