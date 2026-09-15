import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '@/lib/supabase';

type MosaicRow = {
  id: string;
  parent_post_id?: string | null;
  relay_prompt?: string | null;
  relay_depth?: number | null;
  user_id?: string | null;
  author_name?: string | null;
  body?: string | null;
  created_at?: string | null;
};

export default function IgpatMomentMosaicScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = String(id ?? '').trim();
  const [rows, setRows] = useState<MosaicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!postId) {
      setError('Moment Mosaic link is incomplete.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc('get_buklod_igpat_relay_chain_v1', {
        p_post_id: postId,
      });
      if (rpcError) throw rpcError;
      setRows(((data ?? []) as MosaicRow[]).filter(row => Boolean(row?.id)));
    } catch (err: any) {
      const message = String(err?.message ?? err ?? 'Moment Mosaic could not load.');
      setError(
        /get_buklod_igpat_relay_chain_v1|function.*does not exist/i.test(message)
          ? 'Moment Mosaic depends on the IGPAT Relay server update, which still needs to be applied.'
          : message
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    void load();
  }, [load]);

  const root = rows.find(row => Number(row.relay_depth ?? 0) === 0 || !row.parent_post_id) ?? rows[0] ?? null;
  const contributions = useMemo(
    () => rows.filter(row => row.id === root?.id || row.relay_prompt === 'show_yours'),
    [root?.id, rows]
  );

  const addContribution = () => {
    const rootId = root?.id || postId;
    if (!rootId) return;
    router.push({
      pathname: '/igpat/create',
      params: {
        relayParentPostId: rootId,
        relayPrompt: 'show_yours',
        relayParentAuthor: root?.author_name || 'BUKLOD Member',
      },
    } as any);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" style={styles.back} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={20} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>BUKLOD IGPAT</Text>
          <Text style={styles.title}>Moment Mosaic</Text>
          <Text style={styles.subtitle}>Many short contributions, one shared moment.</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <MaterialCommunityIcons name="view-grid-outline" size={21} color="#D9FF69" />
        <View style={styles.infoCopy}>
          <Text style={styles.infoTitle}>COLLECTIVE EXPERIENCE</Text>
          <Text style={styles.infoText}>Baptism, anniversary, camp, wedding, outreach, class, mission, or celebration. Tap any participant to open their real IGPAT contribution.</Text>
        </View>
      </View>

      <Pressable style={styles.addButton} onPress={addContribution} disabled={!postId}>
        <MaterialCommunityIcons name="plus" size={18} color="#07100B" />
        <Text style={styles.addText}>ADD YOUR MOMENT</Text>
      </Pressable>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#FFFFFF" /><Text style={styles.state}>Loading Mosaic…</Text></View>
      ) : error ? (
        <View style={styles.stateCard}>
          <Text style={styles.state}>{error}</Text>
          <Pressable style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>RETRY</Text></Pressable>
        </View>
      ) : contributions.length ? (
        <View style={styles.grid}>
          {contributions.map((row, index) => {
            const isRoot = row.id === root?.id;
            const name = row.author_name || 'BUKLOD Member';
            return (
              <Pressable
                key={row.id}
                accessibilityRole="button"
                accessibilityLabel={`Open contribution by ${name}`}
                style={[styles.tile, isRoot && styles.rootTile]}
                onPress={() => router.push(`/post/${row.id}` as any)}
              >
                <View style={[styles.avatar, isRoot && styles.rootAvatar]}>
                  <Text style={[styles.avatarText, isRoot && styles.rootAvatarText]}>{name.slice(0, 1).toUpperCase()}</Text>
                </View>
                <Text style={styles.participant} numberOfLines={1}>{name}</Text>
                <Text style={styles.role}>{isRoot ? 'ORIGINAL MOMENT' : `CONTRIBUTION ${index}`}</Text>
                {!!row.body?.trim() ? <Text style={styles.body} numberOfLines={4}>{row.body.trim()}</Text> : <Text style={styles.bodyMuted}>Tap to watch their IGPAT.</Text>}
                <View style={styles.openRow}><Text style={styles.openText}>OPEN</Text><MaterialCommunityIcons name="chevron-right" size={15} color="#FFFFFF" /></View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.stateCard}><Text style={styles.state}>No visible contributions yet. Be the first to add your moment.</Text></View>
      )}

      <Text style={styles.performanceNote}>Mosaic intentionally uses lightweight contribution tiles instead of mounting many video players at once. Video opens only when a participant is tapped.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060908' },
  content: { padding: 18, paddingTop: 54, paddingBottom: 48 },
  header: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  back: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: '#0D120F', alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#D9FF69', fontSize: 8.5, fontWeight: '900', letterSpacing: 1 },
  title: { marginTop: 3, color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  subtitle: { marginTop: 5, color: 'rgba(255,255,255,0.56)', fontSize: 11 },
  infoCard: { marginTop: 20, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(217,255,105,0.22)', backgroundColor: '#10150D', padding: 14, flexDirection: 'row', gap: 11 },
  infoCopy: { flex: 1 },
  infoTitle: { color: '#D9FF69', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  infoText: { marginTop: 4, color: 'rgba(255,255,255,0.54)', fontSize: 9.5, lineHeight: 15 },
  addButton: { marginTop: 12, minHeight: 47, borderRadius: 15, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  addText: { color: '#07100B', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.7 },
  center: { marginTop: 40, alignItems: 'center', gap: 9 },
  state: { color: 'rgba(255,255,255,0.60)', fontSize: 10.5, lineHeight: 16, textAlign: 'center' },
  stateCard: { marginTop: 22, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', padding: 16 },
  retry: { marginTop: 12, alignSelf: 'center', paddingHorizontal: 17, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)' },
  retryText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '900' },
  grid: { marginTop: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48%', minHeight: 176, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', padding: 13 },
  rootTile: { borderColor: 'rgba(217,255,105,0.26)', backgroundColor: '#10150D' },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  rootAvatar: { backgroundColor: '#D9FF69' },
  avatarText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  rootAvatarText: { color: '#07100B' },
  participant: { marginTop: 10, color: '#FFFFFF', fontSize: 10.5, fontWeight: '900' },
  role: { marginTop: 3, color: '#D9FF69', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.5 },
  body: { marginTop: 9, color: 'rgba(255,255,255,0.60)', fontSize: 9.5, lineHeight: 14 },
  bodyMuted: { marginTop: 9, color: 'rgba(255,255,255,0.38)', fontSize: 9, lineHeight: 14 },
  openRow: { marginTop: 'auto', paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  openText: { color: '#FFFFFF', fontSize: 7.8, fontWeight: '900', letterSpacing: 0.6 },
  performanceNote: { marginTop: 18, color: 'rgba(255,255,255,0.34)', fontSize: 8.5, lineHeight: 13, textAlign: 'center' },
});
