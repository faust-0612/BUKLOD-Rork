import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { igpatRelayPromptLabel } from '@/lib/igpat/relay';

type RelayRow = {
  id: string;
  parent_post_id?: string | null;
  relay_prompt?: string | null;
  relay_depth?: number | null;
  user_id?: string | null;
  author_name?: string | null;
  body?: string | null;
  created_at?: string | null;
};

function formatDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

export default function IgpatRelayChainScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const postId = String(params.id ?? '').trim();
  const [rows, setRows] = useState<RelayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!postId) {
      setRows([]);
      setError('Relay chain is unavailable.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: relayError } = await (supabase as any).rpc('get_buklod_igpat_relay_chain_v1', { p_post_id: postId });
      if (relayError) throw relayError;
      setRows(((data ?? []) as RelayRow[]).filter(row => Boolean(row?.id)));
    } catch (loadError: any) {
      console.warn('BUKLOD IGPAT Relay chain:', String(loadError?.message ?? loadError));
      setRows([]);
      setError('This Relay chain is not available yet. The IGPat server update may still need to be applied.');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={20} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>BUKLOD IGPAT</Text>
          <Text style={styles.title}>IGPAT Relay</Text>
          <Text style={styles.subtitle}>Follow the bond from one video response to the next.</Text>
        </View>
      </View>

      {!!postId && (
        <View style={styles.advancedSection}>
          <Text style={styles.sectionLabel}>ADVANCED IGPAT ACTIONS</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Open Community Reveal" style={styles.featureButton} onPress={() => router.push(`/igpat/reveal/${postId}` as any)}>
            <View style={styles.featureIcon}><MaterialCommunityIcons name="lock-open-variant-outline" size={18} color="#D9FF69" /></View>
            <View style={styles.featureCopy}>
              <Text style={styles.featureTitle}>COMMUNITY REVEAL</Text>
              <Text style={styles.featureHint}>Participation milestone with server-gated reveal content.</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={19} color="#FFFFFF" />
          </Pressable>

          <View style={styles.featureGrid}>
            <Pressable accessibilityRole="button" accessibilityLabel="Create IGPAT Capsule" style={styles.featureTile} onPress={() => router.push(`/igpat/capsule/${postId}` as any)}>
              <MaterialCommunityIcons name="timer-lock-outline" size={19} color="#FFFFFF" />
              <Text style={styles.tileTitle}>CAPSULE</Text>
              <Text style={styles.tileHint}>Open later</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Pass this IGPAT" style={styles.featureTile} onPress={() => router.push(`/igpat/pass/${postId}` as any)}>
              <MaterialCommunityIcons name="send-outline" size={19} color="#FFFFFF" />
              <Text style={styles.tileTitle}>PASS</Text>
              <Text style={styles.tileHint}>Send intentionally</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Open Moment Mosaic" style={styles.featureTile} onPress={() => router.push(`/igpat/mosaic/${postId}` as any)}>
              <MaterialCommunityIcons name="view-grid-outline" size={19} color="#FFFFFF" />
              <Text style={styles.tileTitle}>MOSAIC</Text>
              <Text style={styles.tileHint}>Shared moments</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Open IGPAT Bond inbox" style={styles.featureTile} onPress={() => router.push('/igpat/bonds' as any)}>
              <MaterialCommunityIcons name="inbox-arrow-down-outline" size={19} color="#FFFFFF" />
              <Text style={styles.tileTitle}>BOND INBOX</Text>
              <Text style={styles.tileHint}>Passes & Capsules</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Open Memory Echo" style={styles.featureTile} onPress={() => router.push('/igpat/memory-echo' as any)}>
              <MaterialCommunityIcons name="history" size={19} color="#FFFFFF" />
              <Text style={styles.tileTitle}>MEMORY ECHO</Text>
              <Text style={styles.tileHint}>Then ↔ Now</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Open IGPAT Arena" style={styles.featureTile} onPress={() => router.push('/igpat/arena' as any)}>
              <MaterialCommunityIcons name="sword-cross" size={19} color="#D9FF69" />
              <Text style={styles.tileTitle}>ARENA</Text>
              <Text style={styles.tileHint}>Intentional competition</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Open IGPAT feed controls" style={styles.featureTile} onPress={() => router.push(`/igpat/options/${postId}` as any)}>
              <MaterialCommunityIcons name="tune-variant" size={19} color="#FFFFFF" />
              <Text style={styles.tileTitle}>FEED CONTROLS</Text>
              <Text style={styles.tileHint}>Tune / hide / report</Text>
            </Pressable>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.centerState}><ActivityIndicator color="#FFFFFF" /><Text style={styles.stateText}>Loading Relay chain…</Text></View>
      ) : error ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void load()}><Text style={styles.retryText}>RETRY</Text></Pressable>
        </View>
      ) : rows.length ? (
        <View style={styles.chain}>
          {rows.map((row, index) => {
            const depth = Math.max(0, Number(row.relay_depth ?? 0));
            const isRoot = depth === 0 || !row.parent_post_id;
            return (
              <View key={row.id} style={styles.chainRow}>
                <View style={styles.railWrap}>
                  <View style={[styles.node, isRoot && styles.rootNode]} />
                  {index < rows.length - 1 ? <View style={styles.rail} /> : null}
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={`Open IGPAT by ${row.author_name || 'BUKLOD Member'}`} style={[styles.card, { marginLeft: Math.min(depth, 6) * 8 }]} onPress={() => router.push(`/post/${row.id}` as any)}>
                  <View style={styles.cardTop}>
                    <Text style={styles.author} numberOfLines={1}>{row.author_name || 'BUKLOD Member'}</Text>
                    <Text style={styles.depth}>{isRoot ? 'START' : `#${depth + 1}`}</Text>
                  </View>
                  <Text style={styles.prompt}>{isRoot ? 'Original IGPAT' : igpatRelayPromptLabel(row.relay_prompt)}</Text>
                  {!!row.body?.trim() && <Text style={styles.body} numberOfLines={3}>{row.body.trim()}</Text>}
                  <View style={styles.cardBottom}>
                    <Text style={styles.date}>{formatDate(row.created_at)}</Text>
                    <View style={styles.openHint}><Text style={styles.openHintText}>OPEN</Text><MaterialCommunityIcons name="chevron-right" size={16} color="#FFFFFF" /></View>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.stateCard}><Text style={styles.stateText}>No visible Relay entries were found.</Text></View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060908' },
  content: { padding: 18, paddingTop: 54, paddingBottom: 44 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: '#0D120F' },
  headerCopy: { flex: 1 },
  eyebrow: { color: 'rgba(255,255,255,0.46)', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { marginTop: 4, color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  subtitle: { marginTop: 5, color: 'rgba(255,255,255,0.58)', fontSize: 11, lineHeight: 17 },
  advancedSection: { marginTop: 18 },
  sectionLabel: { marginBottom: 8, color: 'rgba(255,255,255,0.40)', fontSize: 8, fontWeight: '900', letterSpacing: 0.9 },
  featureButton: { minHeight: 66, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(217,255,105,0.24)', backgroundColor: '#10150D', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(217,255,105,0.08)', alignItems: 'center', justifyContent: 'center' },
  featureCopy: { flex: 1 },
  featureTitle: { color: '#D9FF69', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  featureHint: { marginTop: 3, color: 'rgba(255,255,255,0.50)', fontSize: 8.8, lineHeight: 13 },
  featureGrid: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  featureTile: { width: '48%', minHeight: 86, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', padding: 11, justifyContent: 'center' },
  tileTitle: { marginTop: 8, color: '#FFFFFF', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.5 },
  tileHint: { marginTop: 3, color: 'rgba(255,255,255,0.40)', fontSize: 7.8, lineHeight: 11 },
  centerState: { marginTop: 48, alignItems: 'center', gap: 10 },
  stateCard: { marginTop: 28, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', padding: 18 },
  stateText: { color: 'rgba(255,255,255,0.68)', fontSize: 11, lineHeight: 17, textAlign: 'center' },
  retryButton: { marginTop: 14, alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  retryText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  chain: { marginTop: 28 },
  chainRow: { flexDirection: 'row', alignItems: 'stretch' },
  railWrap: { width: 22, alignItems: 'center' },
  node: { width: 9, height: 9, borderRadius: 5, marginTop: 22, backgroundColor: '#FFFFFF' },
  rootNode: { backgroundColor: '#D9FF69' },
  rail: { flex: 1, width: 1, minHeight: 52, backgroundColor: 'rgba(255,255,255,0.18)' },
  card: { flex: 1, marginBottom: 12, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  author: { flex: 1, color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  depth: { color: 'rgba(255,255,255,0.42)', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  prompt: { marginTop: 5, color: '#D9FF69', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  body: { marginTop: 8, color: 'rgba(255,255,255,0.74)', fontSize: 11, lineHeight: 17 },
  cardBottom: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  date: { flex: 1, color: 'rgba(255,255,255,0.36)', fontSize: 8.5 },
  openHint: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  openHintText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
});
