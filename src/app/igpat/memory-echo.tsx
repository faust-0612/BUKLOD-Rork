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
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';
import { useAuth } from '@/providers/AuthProvider';

type EchoRow = {
  id: string;
  user_id?: string | null;
  body?: string | null;
  created_at: string;
  author_name?: string | null;
};

function ageLabel(value: string): string {
  const created = new Date(value);
  const now = new Date();
  if (Number.isNaN(created.getTime())) return 'From before';
  const days = Math.max(1, Math.floor((now.getTime() - created.getTime()) / 86_400_000));
  if (days >= 330) {
    const years = Math.max(1, Math.round(days / 365.25));
    return years === 1 ? 'One year ago…' : `${years} years ago…`;
  }
  if (days >= 60) return `${Math.round(days / 30.4)} months ago…`;
  return `${days} days ago…`;
}

export default function IgpatMemoryEchoScreen() {
  const { user } = useAuth();
  const [rows, setRows] = useState<EchoRow[]>([]);
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
      const cutoff = new Date(Date.now() - 45 * 86_400_000).toISOString();
      const [{ data: ownPosts, error: ownError }, { data: reactions, error: reactionError }] = await Promise.all([
        supabase
          .from('community_posts')
          .select('id,user_id,body,created_at')
          .eq('is_reel', true)
          .like('media_mime_type', 'video/%')
          .eq('user_id', user.id)
          .lt('created_at', cutoff)
          .is('deleted_at', null)
          .eq('is_hidden', false)
          .order('created_at', { ascending: false })
          .limit(40),
        supabase
          .from('reactions')
          .select('post_id')
          .eq('user_id', user.id)
          .limit(160),
      ]);
      if (ownError) throw ownError;
      if (reactionError) throw reactionError;

      const reactedIds = Array.from(new Set((reactions ?? []).map(row => String(row.post_id ?? '')).filter(Boolean))).slice(0, 80);
      let reactedPosts: any[] = [];
      if (reactedIds.length) {
        const { data, error: reactedError } = await supabase
          .from('community_posts')
          .select('id,user_id,body,created_at')
          .in('id', reactedIds)
          .eq('is_reel', true)
          .like('media_mime_type', 'video/%')
          .lt('created_at', cutoff)
          .is('deleted_at', null)
          .eq('is_hidden', false)
          .order('created_at', { ascending: false })
          .limit(40);
        if (reactedError) throw reactedError;
        reactedPosts = data ?? [];
      }

      const merged = new Map<string, EchoRow>();
      for (const row of [...(ownPosts ?? []), ...reactedPosts]) {
        if (row?.id) merged.set(String(row.id), row as EchoRow);
      }
      const base = Array.from(merged.values())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 40);

      const authorIds = Array.from(new Set(base.map(row => String(row.user_id ?? '')).filter(Boolean)));
      const names = new Map<string, string>();
      if (authorIds.length) {
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id,full_name,first_name,username')
          .in('id', authorIds);
        if (profileError) throw profileError;
        for (const profile of profiles ?? []) {
          const id = String(profile.id ?? '');
          const raw = profile.full_name || profile.first_name || profile.username || 'BUKLOD Member';
          if (id) names.set(id, resolvePersonDisplayName(String(raw), id));
        }
      }

      setRows(base.map(row => ({
        ...row,
        author_name: names.get(String(row.user_id ?? '')) ?? 'BUKLOD Member',
      })));
    } catch (err: any) {
      console.warn('BUKLOD IGPAT Memory Echo:', String(err?.message ?? err));
      setRows([]);
      setError(String(err?.message ?? err ?? 'Memory Echo could not load.'));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  const createNow = (row: EchoRow) => {
    router.push({
      pathname: '/igpat/create',
      params: {
        relayParentPostId: row.id,
        relayPrompt: 'show_yours',
        relayParentAuthor: row.author_name || 'BUKLOD Member',
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
          <Text style={styles.title}>Memory Echo</Text>
          <Text style={styles.subtitle}>Meaningful older moments that are still visible to you now.</Text>
        </View>
      </View>

      <View style={styles.ruleCard}>
        <MaterialCommunityIcons name="history" size={20} color="#D9FF69" />
        <Text style={styles.ruleText}>Privacy is checked again today. Deleted, hidden, or no-longer-authorized Local/Cluster/Scope IGPATs are not resurfaced.</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#FFFFFF" /><Text style={styles.state}>Looking back…</Text></View>
      ) : error ? (
        <View style={styles.stateCard}><Text style={styles.state}>{error}</Text><Pressable style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>RETRY</Text></Pressable></View>
      ) : rows.length ? (
        <View style={styles.list}>
          {rows.map(row => (
            <View key={row.id} style={styles.card}>
              <Text style={styles.age}>{ageLabel(row.created_at)}</Text>
              <Text style={styles.author}>{row.author_name}</Text>
              {!!row.body?.trim() ? <Text style={styles.body} numberOfLines={4}>{row.body.trim()}</Text> : <Text style={styles.bodyMuted}>A past IGPAT moment.</Text>}
              <View style={styles.actions}>
                <Pressable style={styles.secondary} onPress={() => router.push(`/post/${row.id}` as any)}>
                  <Text style={styles.secondaryText}>THEN</Text>
                </Pressable>
                <View style={styles.arrow}><Text style={styles.arrowText}>↔</Text></View>
                <Pressable style={styles.primary} onPress={() => createNow(row)}>
                  <Text style={styles.primaryText}>NOW</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.stateCard}><Text style={styles.state}>No older meaningful IGPAT moments are currently available to resurface.</Text></View>
      )}
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
  subtitle: { marginTop: 5, color: 'rgba(255,255,255,0.56)', fontSize: 11, lineHeight: 17 },
  ruleCard: { marginTop: 18, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(217,255,105,0.20)', backgroundColor: '#10150D', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  ruleText: { flex: 1, color: 'rgba(255,255,255,0.56)', fontSize: 9, lineHeight: 14 },
  center: { marginTop: 42, alignItems: 'center', gap: 9 },
  stateCard: { marginTop: 22, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', padding: 16 },
  state: { color: 'rgba(255,255,255,0.60)', fontSize: 10.5, lineHeight: 16, textAlign: 'center' },
  retry: { marginTop: 12, alignSelf: 'center', paddingHorizontal: 17, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)' },
  retryText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '900' },
  list: { marginTop: 20, gap: 11 },
  card: { borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', backgroundColor: '#0D120F', padding: 15 },
  age: { color: '#D9FF69', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  author: { marginTop: 6, color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  body: { marginTop: 8, color: 'rgba(255,255,255,0.67)', fontSize: 11, lineHeight: 17 },
  bodyMuted: { marginTop: 8, color: 'rgba(255,255,255,0.38)', fontSize: 10 },
  actions: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  secondary: { flex: 1, minHeight: 42, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.17)', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  arrow: { width: 26, alignItems: 'center' },
  arrowText: { color: 'rgba(255,255,255,0.50)', fontSize: 16, fontWeight: '900' },
  primary: { flex: 1, minHeight: 42, borderRadius: 13, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#07100B', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
});
