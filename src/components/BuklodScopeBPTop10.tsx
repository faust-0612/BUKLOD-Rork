import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

type RankRow = { rank_position: number; user_id: string; full_name: string; total_points: number };
type Props = { scopeId: string; scopeType: 'CLUSTER' | 'ORGANIZATION' };

/** Private, exact-scope BP list. The server enforces ACTIVE membership. No persisted private data. */
export default function BuklodScopeBPTop10({ scopeId, scopeType }: Props) {
  const { user } = useAuth();
  const [rows, setRows] = useState<RankRow[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'restricted'>('loading');
  const [reload, setReload] = useState(0);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const identityKey = `${scopeId}:${user?.id ?? ''}`;

  useFocusEffect(useCallback(() => {
    let active = true;
    setRows([]);
    setLoadedFor(null);
    if (!scopeId || !user?.id) {
      setLoadedFor(identityKey);
      setStatus('restricted');
      return () => { active = false; };
    }
    setStatus('loading');
    void (async () => {
      try {
        const { data, error } = await (supabase as any).rpc(
          'get_buklod_scope_bp_top10_v1', { p_scope_id: scopeId });
        if (!active) return;
        if (error) {
          setRows([]);
          setLoadedFor(identityKey);
          setStatus(String(error.code ?? '') === '42501' ? 'restricted' : 'error');
          return;
        }
        const next: RankRow[] = (Array.isArray(data) ? data : []).slice(0, 10)
          .map((row: any) => ({
            rank_position: Number(row.rank_position) || 0,
            user_id: String(row.user_id ?? ''),
            full_name: String(row.full_name ?? '').trim() || 'BUKLOD Member',
            total_points: Math.max(0, Number(row.total_points) || 0),
          }))
          .filter((row: RankRow) => Boolean(row.user_id && row.rank_position > 0));
        setRows(next);
        setLoadedFor(identityKey);
        setStatus('ready');
      } catch {
        if (active) {
          setRows([]);
          setLoadedFor(identityKey);
          setStatus('error');
        }
      }
    })();
    return () => { active = false; };
  }, [scopeId, user?.id, reload, identityKey]));
  const displayStatus = loadedFor === identityKey ? status : 'loading';
  const displayRows = loadedFor === identityKey ? rows : [];
  const retry = useCallback(() => setReload(value => value + 1), []);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="trophy-outline" size={20} color="#156B9F" />
        <Text style={styles.title}>MEMBER BP TOP 10</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh member BP ranking"
          onPress={retry} style={styles.refresh}>
          <MaterialCommunityIcons name="refresh" size={18} color="#156B9F" />
        </Pressable>
      </View>
      <Text style={styles.subtitle}>
        Lifetime BUKLOD Points · Active {scopeType === 'CLUSTER' ? 'Cluster' : 'Organization'} members only
      </Text>
      {displayStatus === 'loading' ? (
        <View style={styles.loading}><ActivityIndicator size="small" color="#156B9F" />
          <Text style={styles.message}>Loading member rankings…</Text></View>
      ) : displayStatus === 'restricted' ? (
        <Text style={styles.message}>Available to active members only.</Text>
      ) : displayStatus === 'error' ? (
        <Text style={styles.message}>Rankings unavailable. Tap refresh to retry.</Text>
      ) : displayRows.length === 0 ? (
        <Text style={styles.message}>No active members to rank yet.</Text>
      ) : (
        <View style={styles.list}>
          {displayRows.map(row => (
            <View key={row.user_id} style={[styles.row, row.user_id === user?.id && styles.mine]}
              accessibilityLabel={`Rank ${row.rank_position}, ${row.full_name}, ${row.total_points} BP`}>
              <Text style={[styles.rank, row.rank_position <= 3 && styles.top]}>#{row.rank_position}</Text>
              <Text style={styles.name} numberOfLines={1}>
                {row.full_name}{row.user_id === user?.id ? ' (You)' : ''}
              </Text>
              <Text style={styles.points}>{row.total_points.toLocaleString()} BP</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFF', borderColor: '#D8E7F2', borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16, padding: 12, gap: 7 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 14, fontWeight: '800', color: '#173A55' },
  refresh: { minWidth: 38, minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  subtitle: { fontSize: 12, color: '#607588', lineHeight: 18 },
  loading: { flexDirection: 'row', gap: 9, alignItems: 'center', paddingVertical: 8 },
  message: { fontSize: 12, lineHeight: 18, color: '#617488', paddingVertical: 8 },
  list: { gap: 2, marginTop: 2 },
  row: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 6, borderRadius: 9 },
  mine: { backgroundColor: '#E9F3FF' },
  rank: { width: 30, fontSize: 13, fontWeight: '800', color: '#536579' },
  top: { color: '#AC6A12' },
  name: { flex: 1, fontSize: 13, fontWeight: '600', color: '#203F56' },
  points: { fontSize: 13, fontWeight: '800', color: '#0B669C', fontVariant: ['tabular-nums'] },
});
