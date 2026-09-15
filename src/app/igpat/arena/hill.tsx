import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

type HillRow = {
  category_key: string;
  category_label: string;
  champion_user_id?: string | null;
  champion_name?: string | null;
  title_challenge_id?: string | null;
  active_challenge_id?: string | null;
};

export default function IgpatHillScreen() {
  const { user } = useAuth();
  const [rows, setRows] = useState<HillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc('get_buklod_igpat_hills_v1');
      if (rpcError) throw rpcError;
      setRows((data ?? []) as HillRow[]);
    } catch (loadError: any) {
      console.warn('BUKLOD IGPAT Hill:', String(loadError?.message ?? loadError));
      setRows([]);
      setError('King of the Hill is not available yet. The secured Arena update may still need to be applied.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const challenge = async (row: HillRow) => {
    if (busyKey) return;
    setBusyKey(row.category_key);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc('igpat_challenge_hill_v1', {
        p_category_key: row.category_key,
      });
      if (rpcError) throw rpcError;
      const id = String(data ?? '').trim();
      if (!id) throw new Error('Hill challenge did not return an ID.');
      router.push(`/igpat/arena/${id}` as any);
    } catch (actionError: any) {
      Alert.alert('King of the Hill', actionError?.message ?? 'Could not start this Hill challenge.');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}><MaterialCommunityIcons name="arrow-left" size={20} color="#FFFFFF" /></Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>BUKLOD IGPAT ARENA</Text>
          <Text style={styles.title}>King of the Hill</Text>
          <Text style={styles.subtitle}>Approved categories only. Clear rules, actual IGPAT submissions, and unique outside Respect decide the title.</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerState}><ActivityIndicator color="#FFFFFF" /><Text style={styles.stateText}>Loading Hills…</Text></View>
      ) : error ? (
        <View style={styles.stateCard}><Text style={styles.stateText}>{error}</Text><Pressable style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>RETRY</Text></Pressable></View>
      ) : (
        <View style={styles.list}>
          {rows.map(row => {
            const isChampion = row.champion_user_id === user?.id;
            return (
              <View key={row.category_key} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.crown}><MaterialCommunityIcons name="crown-outline" size={20} color="#D9FF69" /></View>
                  <View style={styles.cardCopy}>
                    <Text style={styles.category}>{row.category_label.toUpperCase()}</Text>
                    <Text style={styles.champion}>{row.champion_name || 'No champion yet'}</Text>
                    <Text style={styles.hint}>{isChampion ? 'YOU HOLD THIS TITLE' : row.active_challenge_id ? 'HILL CHALLENGE ACTIVE' : row.champion_user_id ? 'CHAMPION CAN BE CHALLENGED' : 'FIRST VERIFIED WINNER TAKES THE HILL'}</Text>
                  </View>
                </View>

                {row.active_challenge_id ? (
                  <Pressable style={styles.openButton} onPress={() => router.push(`/igpat/arena/${row.active_challenge_id}` as any)}>
                    <Text style={styles.openText}>OPEN ACTIVE CHALLENGE</Text>
                    <MaterialCommunityIcons name="chevron-right" size={16} color="#FFFFFF" />
                  </Pressable>
                ) : !isChampion ? (
                  <Pressable style={styles.challengeButton} disabled={!!busyKey} onPress={() => void challenge(row)}>
                    {busyKey === row.category_key ? <ActivityIndicator color="#07100B" /> : <MaterialCommunityIcons name="sword-cross" size={16} color="#07100B" />}
                    <Text style={styles.challengeText}>{busyKey === row.category_key ? 'STARTING…' : 'CHALLENGE THE HILL'}</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.rulesCard}>
        <Text style={styles.rulesTitle}>HILL RULES</Text>
        <Text style={styles.rulesText}>One active challenge per category. The champion does not choose the result. Both competitors submit real IGPAT content, outside viewers give one unique Respect vote, and the verified winner holds the title.</Text>
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
  centerState: { marginTop: 42, alignItems: 'center', gap: 10 },
  stateCard: { marginTop: 26, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', padding: 18 },
  stateText: { color: 'rgba(255,255,255,0.56)', fontSize: 10, lineHeight: 16, textAlign: 'center' },
  retry: { marginTop: 12, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  retryText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '900' },
  list: { marginTop: 22, gap: 10 },
  card: { borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  crown: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(217,255,105,0.08)', alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1 },
  category: { color: '#D9FF69', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
  champion: { marginTop: 3, color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  hint: { marginTop: 4, color: 'rgba(255,255,255,0.36)', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.5 },
  challengeButton: { marginTop: 12, minHeight: 42, borderRadius: 13, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  challengeText: { color: '#07100B', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.6 },
  openButton: { marginTop: 12, minHeight: 42, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  openText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.6 },
  rulesCard: { marginTop: 16, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(217,255,105,0.18)', backgroundColor: '#10150D', padding: 14 },
  rulesTitle: { color: '#D9FF69', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
  rulesText: { marginTop: 6, color: 'rgba(255,255,255,0.50)', fontSize: 8.8, lineHeight: 14 },
});
