import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';

type BondRow = {
  id: string;
  kind: 'pass' | 'capsule' | 'relay' | 'mosaic' | 'memory_echo' | string;
  post_id: string;
  actor_user_id: string;
  actor_name?: string | null;
  target_id?: string | null;
  message?: string | null;
  unlock_at?: string | null;
  status?: string | null;
  created_at?: string | null;
  locked?: boolean | null;
};

function formatDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

function kindLabel(kind: string): string {
  if (kind === 'capsule') return 'IGPAT CAPSULE';
  if (kind === 'pass') return 'PASSED IGPAT';
  if (kind === 'mosaic') return 'MOMENT MOSAIC';
  if (kind === 'relay') return 'IGPAT RELAY';
  if (kind === 'memory_echo') return 'MEMORY ECHO';
  return kind.replace(/_/g, ' ').toUpperCase();
}

function missingRpc(message: string): boolean {
  return /igpat_get_bond_inbox_v2|function.*does not exist/i.test(message);
}

export default function IgpatBondInboxScreen() {
  const { user } = useAuth();
  const [rows, setRows] = useState<BondRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc('igpat_get_bond_inbox_v2', {
        p_limit: 80,
      });
      if (rpcError) throw rpcError;
      setRows(((data ?? []) as BondRow[]).filter(row => Boolean(row?.id && row?.post_id)));
    } catch (err: any) {
      const message = String(err?.message ?? err ?? 'Bond inbox could not load.');
      setError(
        missingRpc(message)
          ? 'The hardened IGPAT Bond inbox is prepared in source, but its server update still needs to be applied.'
          : message
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
          <MaterialCommunityIcons name="arrow-left" size={20} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>BUKLOD IGPAT</Text>
          <Text style={styles.title}>Bond Inbox</Text>
          <Text style={styles.subtitle}>Intentional Passes, Capsules, and other direct IGPAT bonds.</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color="#FFFFFF" />
          <Text style={styles.stateText}>Loading bonds…</Text>
        </View>
      ) : error ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateText}>{error}</Text>
          <Pressable style={styles.retry} onPress={() => void load()}>
            <Text style={styles.retryText}>RETRY</Text>
          </Pressable>
        </View>
      ) : rows.length ? (
        <View style={styles.list}>
          {rows.map(row => {
            const outgoing = row.actor_user_id === user?.id;
            const actorName = resolvePersonDisplayName(row.actor_name || 'BUKLOD Member', row.actor_user_id);
            const locked = Boolean(row.locked);
            return (
              <View key={row.id} style={[styles.card, locked && styles.lockedCard]}>
                <View style={styles.cardTop}>
                  <View style={[styles.kindIcon, locked && styles.kindIconLocked]}>
                    <MaterialCommunityIcons
                      name={locked ? 'lock-outline' : row.kind === 'pass' ? 'send-outline' : 'link-variant'}
                      size={17}
                      color={locked ? '#D9FF69' : '#FFFFFF'}
                    />
                  </View>
                  <View style={styles.cardHeading}>
                    <Text style={styles.kind}>{kindLabel(row.kind)}</Text>
                    <Text style={styles.direction}>{outgoing ? 'SENT BY YOU' : `FROM ${actorName}`}</Text>
                  </View>
                </View>

                {locked ? (
                  <>
                    <Text style={styles.lockedTitle}>This Capsule is still sealed.</Text>
                    <Text style={styles.body}>Opens {formatDate(row.unlock_at)}. The hidden message is not returned by the server before that time.</Text>
                  </>
                ) : (
                  <>
                    {!!row.message?.trim() && <Text style={styles.message}>{row.message.trim()}</Text>}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Open bonded IGPAT"
                      style={styles.openButton}
                      onPress={() => router.push(`/post/${row.post_id}` as any)}
                    >
                      <Text style={styles.openText}>OPEN IGPAT</Text>
                      <MaterialCommunityIcons name="chevron-right" size={17} color="#FFFFFF" />
                    </Pressable>
                  </>
                )}

                <Text style={styles.date}>{formatDate(row.created_at)}</Text>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.stateCard}>
          <Text style={styles.stateText}>No IGPAT Bonds yet.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060908' },
  content: { padding: 20, paddingTop: 54, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  back: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D120F' },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#D9FF69', fontSize: 8.5, fontWeight: '900', letterSpacing: 1 },
  title: { marginTop: 3, color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  subtitle: { marginTop: 5, color: 'rgba(255,255,255,0.56)', fontSize: 11, lineHeight: 17 },
  centerState: { marginTop: 46, alignItems: 'center', gap: 10 },
  stateCard: { marginTop: 24, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', padding: 17 },
  stateText: { color: 'rgba(255,255,255,0.62)', fontSize: 11, lineHeight: 17, textAlign: 'center' },
  retry: { marginTop: 13, alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)' },
  retryText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  list: { marginTop: 22, gap: 10 },
  card: { borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', backgroundColor: '#0D120F', padding: 15 },
  lockedCard: { borderColor: 'rgba(217,255,105,0.23)', backgroundColor: '#10150D' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kindIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  kindIconLocked: { backgroundColor: 'rgba(217,255,105,0.08)' },
  cardHeading: { flex: 1 },
  kind: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.8 },
  direction: { marginTop: 3, color: 'rgba(255,255,255,0.44)', fontSize: 8, fontWeight: '800' },
  lockedTitle: { marginTop: 14, color: '#D9FF69', fontSize: 13, fontWeight: '900' },
  body: { marginTop: 6, color: 'rgba(255,255,255,0.58)', fontSize: 10.5, lineHeight: 16 },
  message: { marginTop: 14, color: '#FFFFFF', fontSize: 12, lineHeight: 19, fontWeight: '700' },
  openButton: { marginTop: 13, minHeight: 42, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  openText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  date: { marginTop: 12, color: 'rgba(255,255,255,0.34)', fontSize: 8.5 },
});
