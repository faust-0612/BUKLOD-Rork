import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

type BossGroup = {
  group_id: string;
  group_name: string;
  is_leader: boolean;
  active_member_count: number;
};
type BossRow = {
  id: string;
  group_id: string;
  group_name: string;
  title: string;
  target_count: number;
  completion_count: number;
  status: string;
  is_leader: boolean;
  has_contributed: boolean;
  created_at?: string | null;
  completed_at?: string | null;
};
type MyIgpat = { id: string; body?: string | null; created_at?: string | null };

function dateLabel(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

export default function IgpatBossChallengeScreen() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<BossGroup[]>([]);
  const [rows, setRows] = useState<BossRow[]>([]);
  const [myIgpats, setMyIgpats] = useState<MyIgpat[]>([]);
  const [selectedPostByBoss, setSelectedPostByBoss] = useState<Record<string, string>>({});
  const [createGroupId, setCreateGroupId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const leaderGroups = useMemo(() => groups.filter(group => group.is_leader), [groups]);
  const selectedLeaderGroup = leaderGroups.find(group => group.group_id === createGroupId) ?? null;

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [groupResult, bossResult, postResult] = await Promise.all([
        (supabase as any).rpc('get_my_buklod_igpat_boss_groups_v1'),
        (supabase as any).rpc('get_my_buklod_igpat_boss_challenges_v1', { p_limit: 30 }),
        supabase
          .from('community_posts')
          .select('id,body,created_at')
          .eq('user_id', user.id)
          .eq('is_reel', true)
          .eq('is_hidden', false)
          .is('deleted_at', null)
          .like('media_mime_type', 'video/%')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);
      if (groupResult.error) throw groupResult.error;
      if (bossResult.error) throw bossResult.error;
      if (postResult.error) throw postResult.error;

      const nextGroups = (groupResult.data ?? []) as BossGroup[];
      setGroups(nextGroups);
      setRows((bossResult.data ?? []) as BossRow[]);
      setMyIgpats((postResult.data ?? []) as MyIgpat[]);
      setCreateGroupId(current => current && nextGroups.some(group => group.group_id === current && group.is_leader)
        ? current
        : nextGroups.find(group => group.is_leader)?.group_id ?? null);
    } catch (loadError: any) {
      console.warn('BUKLOD IGPAT Boss Challenge:', String(loadError?.message ?? loadError));
      setError('Boss Challenge is not available yet. The secured IGPAT server update may still need to be applied.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  const createBoss = async () => {
    if (!createGroupId || busy) return;
    const count = Number(target);
    if (!Number.isInteger(count) || count < 2) {
      Alert.alert('Boss Challenge', 'Enter a valid member target of at least 2.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Boss Challenge', 'Give this objective a clear title.');
      return;
    }
    setBusy('create');
    try {
      const { error: rpcError } = await (supabase as any).rpc('igpat_create_boss_challenge_v1', {
        p_group_id: createGroupId,
        p_title: title.trim(),
        p_target_count: count,
      });
      if (rpcError) throw rpcError;
      setTitle('');
      setTarget('');
      await load();
    } catch (actionError: any) {
      Alert.alert('Could Not Create Boss Challenge', actionError?.message ?? 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const contribute = async (boss: BossRow) => {
    const postId = selectedPostByBoss[boss.id] || myIgpats[0]?.id;
    if (!postId || busy) {
      Alert.alert('Boss Challenge', 'Choose one of your actual IGPAT videos first.');
      return;
    }
    setBusy(`contribute:${boss.id}`);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc('igpat_submit_boss_contribution_v1', {
        p_boss_id: boss.id,
        p_post_id: postId,
      });
      if (rpcError) throw rpcError;
      const completed = Boolean(data?.completed);
      Alert.alert('Boss Challenge', completed ? 'Objective completed.' : 'Your verified contribution was counted.');
      await load();
    } catch (actionError: any) {
      Alert.alert('Could Not Contribute', actionError?.message ?? 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (boss: BossRow) => {
    if (busy) return;
    setBusy(`cancel:${boss.id}`);
    try {
      const { error: rpcError } = await (supabase as any).rpc('igpat_cancel_boss_challenge_v1', { p_boss_id: boss.id });
      if (rpcError) throw rpcError;
      await load();
    } catch (actionError: any) {
      Alert.alert('Could Not Cancel', actionError?.message ?? 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}><MaterialCommunityIcons name="arrow-left" size={20} color="#FFFFFF" /></Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>BUKLOD IGPAT ARENA</Text>
          <Text style={styles.title}>Boss Challenge</Text>
          <Text style={styles.subtitle}>A Cluster objective built from unique verified member contributions. No betting, wagering, or random financial mechanics.</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerState}><ActivityIndicator color="#FFFFFF" /><Text style={styles.stateText}>Loading Boss Challenges…</Text></View>
      ) : error ? (
        <View style={styles.stateCard}><Text style={styles.stateText}>{error}</Text><Pressable style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>RETRY</Text></Pressable></View>
      ) : (
        <>
          {leaderGroups.length ? (
            <View style={styles.createCard}>
              <Text style={styles.sectionTitle}>CREATE CLUSTER OBJECTIVE</Text>
              <View style={styles.chips}>
                {leaderGroups.map(group => {
                  const selected = group.group_id === createGroupId;
                  return (
                    <Pressable key={group.group_id} style={[styles.chip, selected && styles.chipSelected]} onPress={() => setCreateGroupId(group.group_id)} disabled={!!busy}>
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>{group.group_name}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {selectedLeaderGroup ? <Text style={styles.helper}>{selectedLeaderGroup.active_member_count} active members · target cannot exceed current membership.</Text> : null}
              <TextInput value={title} onChangeText={value => setTitle(value.slice(0, 160))} placeholder="Objective title" placeholderTextColor="rgba(255,255,255,0.34)" style={styles.input} editable={!busy} />
              <TextInput value={target} onChangeText={value => setTarget(value.replace(/[^0-9]/g, '').slice(0, 4))} placeholder="Target members" placeholderTextColor="rgba(255,255,255,0.34)" keyboardType="number-pad" style={styles.input} editable={!busy} />
              <Pressable style={[styles.createButton, !!busy && styles.disabled]} disabled={!!busy} onPress={() => void createBoss()}>
                {busy === 'create' ? <ActivityIndicator color="#07100B" /> : <MaterialCommunityIcons name="flag-checkered" size={17} color="#07100B" />}
                <Text style={styles.createText}>CREATE BOSS CHALLENGE</Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={styles.section}>MY CLUSTER OBJECTIVES</Text>
          {rows.length ? (
            <View style={styles.list}>
              {rows.map(row => {
                const progress = Math.min(1, Number(row.completion_count || 0) / Math.max(1, Number(row.target_count || 1)));
                const selectedPost = selectedPostByBoss[row.id] || myIgpats[0]?.id || null;
                return (
                  <View key={row.id} style={styles.card}>
                    <View style={styles.cardTop}>
                      <Text style={styles.groupName}>{row.group_name}</Text>
                      <Text style={[styles.status, row.status === 'COMPLETED' && styles.statusComplete]}>{row.status}</Text>
                    </View>
                    <Text style={styles.cardTitle}>{row.title}</Text>
                    <Text style={styles.progressText}>{row.completion_count} / {row.target_count} COMPLETE</Text>
                    <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} /></View>
                    <Text style={styles.date}>{dateLabel(row.created_at)}</Text>

                    {row.status === 'OPEN' ? (
                      <>
                        <Text style={styles.miniLabel}>{row.has_contributed ? 'UPDATE YOUR VERIFIED CONTRIBUTION' : 'YOUR VERIFIED CONTRIBUTION'}</Text>
                        {myIgpats.length ? (
                          <View style={styles.postList}>
                            {myIgpats.slice(0, 5).map(post => {
                              const selected = selectedPost === post.id;
                              return (
                                <Pressable key={post.id} style={[styles.postChoice, selected && styles.postSelected]} onPress={() => setSelectedPostByBoss(current => ({ ...current, [row.id]: post.id }))} disabled={!!busy}>
                                  <Text style={[styles.postDate, selected && styles.postDateSelected]}>{dateLabel(post.created_at)}</Text>
                                  <Text style={[styles.postBody, selected && styles.postBodySelected]} numberOfLines={1}>{post.body?.trim() || 'IGPAT video'}</Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        ) : (
                          <Pressable style={styles.outlineButton} onPress={() => router.push('/igpat/create' as any)}><Text style={styles.outlineText}>CREATE IGPAT FIRST</Text></Pressable>
                        )}
                        <Pressable style={[styles.contributeButton, (!selectedPost || !!busy) && styles.disabled]} disabled={!selectedPost || !!busy} onPress={() => void contribute(row)}>
                          <Text style={styles.contributeText}>{busy === `contribute:${row.id}` ? 'COUNTING…' : row.has_contributed ? 'UPDATE CONTRIBUTION' : 'CONTRIBUTE'}</Text>
                        </Pressable>
                        {row.is_leader ? <Pressable style={styles.cancelButton} disabled={!!busy} onPress={() => void cancel(row)}><Text style={styles.cancelText}>CANCEL OBJECTIVE</Text></Pressable> : null}
                      </>
                    ) : row.status === 'COMPLETED' ? (
                      <View style={styles.completeBadge}><MaterialCommunityIcons name="check-decagram-outline" size={18} color="#D9FF69" /><Text style={styles.completeText}>COMMUNITY OBJECTIVE COMPLETE</Text></View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.stateCard}><Text style={styles.stateText}>No Boss Challenge exists in your active Clusters yet.</Text></View>
          )}
        </>
      )}
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
  stateCard: { marginTop: 22, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', padding: 18 },
  stateText: { color: 'rgba(255,255,255,0.56)', fontSize: 10, lineHeight: 16, textAlign: 'center' },
  retry: { marginTop: 12, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  retryText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '900' },
  createCard: { marginTop: 24, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(217,255,105,0.18)', backgroundColor: '#10150D', padding: 14 },
  sectionTitle: { color: '#D9FF69', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
  chips: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { maxWidth: '100%', paddingHorizontal: 12, minHeight: 36, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  chipSelected: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  chipText: { maxWidth: 220, color: 'rgba(255,255,255,0.66)', fontSize: 8.5, fontWeight: '900' },
  chipTextSelected: { color: '#07100B' },
  helper: { marginTop: 8, color: 'rgba(255,255,255,0.38)', fontSize: 8.2 },
  input: { marginTop: 9, minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', backgroundColor: '#0D120F', color: '#FFFFFF', paddingHorizontal: 12, fontSize: 9.5 },
  createButton: { marginTop: 10, minHeight: 46, borderRadius: 14, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  createText: { color: '#07100B', fontSize: 8.8, fontWeight: '900', letterSpacing: 0.6 },
  section: { marginTop: 24, marginBottom: 8, color: 'rgba(255,255,255,0.42)', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8 },
  list: { gap: 10 },
  card: { borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  groupName: { color: '#D9FF69', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.6 },
  status: { color: 'rgba(255,255,255,0.38)', fontSize: 7.5, fontWeight: '900' },
  statusComplete: { color: '#D9FF69' },
  cardTitle: { marginTop: 6, color: '#FFFFFF', fontSize: 13, lineHeight: 18, fontWeight: '900' },
  progressText: { marginTop: 10, color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  progressTrack: { marginTop: 7, height: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.09)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#D9FF69' },
  date: { marginTop: 7, color: 'rgba(255,255,255,0.30)', fontSize: 7.5 },
  miniLabel: { marginTop: 14, marginBottom: 7, color: 'rgba(255,255,255,0.38)', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.6 },
  postList: { gap: 6 },
  postChoice: { borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', padding: 9 },
  postSelected: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  postDate: { color: 'rgba(255,255,255,0.30)', fontSize: 7 },
  postDateSelected: { color: 'rgba(7,16,11,0.45)' },
  postBody: { marginTop: 3, color: '#FFFFFF', fontSize: 8.8, fontWeight: '700' },
  postBodySelected: { color: '#07100B' },
  contributeButton: { marginTop: 9, minHeight: 42, borderRadius: 13, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  contributeText: { color: '#07100B', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.6 },
  outlineButton: { minHeight: 39, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  outlineText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900' },
  cancelButton: { marginTop: 8, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 7 },
  cancelText: { color: 'rgba(255,255,255,0.40)', fontSize: 7.5, fontWeight: '900' },
  completeBadge: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 7 },
  completeText: { color: '#D9FF69', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.5 },
  disabled: { opacity: 0.38 },
});
