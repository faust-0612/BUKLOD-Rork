import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
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
import { igpatArenaModeLabel, igpatArenaStatusLabel } from '@/lib/igpat/arena';
import { useAuth } from '@/providers/AuthProvider';

type ArenaResult = {
  submitted_by: string;
  participant_name: string;
  post_id?: string | null;
  completion_note?: string | null;
  respect_received?: number | null;
  verified?: boolean | null;
  created_at?: string | null;
};
type ArenaDetail = {
  id: string;
  mode: string;
  title?: string | null;
  status: string;
  creator_user_id: string;
  creator_name: string;
  opponent_user_id?: string | null;
  opponent_name?: string | null;
  winner_user_id?: string | null;
  winner_name?: string | null;
  starter_post_id?: string | null;
  respect_score?: number | null;
  results?: ArenaResult[];
  my_vote_result_user_id?: string | null;
  is_creator?: boolean;
  is_opponent?: boolean;
  can_accept?: boolean;
  can_decline?: boolean;
  can_cancel?: boolean;
  can_submit?: boolean;
  can_vote?: boolean;
  can_finalize?: boolean;
  created_at?: string | null;
  completed_at?: string | null;
};
type MyIgpat = {
  id: string;
  body?: string | null;
  created_at?: string | null;
};

function compactDate(value?: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString();
}

export default function IgpatArenaDetailScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id?: string }>();
  const challengeId = String(params.id ?? '').trim();
  const [detail, setDetail] = useState<ArenaDetail | null>(null);
  const [myIgpats, setMyIgpats] = useState<MyIgpat[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!challengeId) {
      setError('Arena challenge is unavailable.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: detailError } = await (supabase as any).rpc(
        'get_buklod_igpat_arena_detail_v2',
        { p_challenge_id: challengeId }
      );
      if (detailError) throw detailError;
      const next = (data ?? null) as ArenaDetail | null;
      setDetail(next);

      if (next?.can_submit && user?.id) {
        const { data: posts, error: postsError } = await supabase
          .from('community_posts')
          .select('id,body,created_at')
          .eq('user_id', user.id)
          .eq('is_reel', true)
          .eq('is_hidden', false)
          .is('deleted_at', null)
          .like('media_mime_type', 'video/%')
          .order('created_at', { ascending: false })
          .limit(20);
        if (postsError) throw postsError;
        const safePosts = (posts ?? []) as MyIgpat[];
        setMyIgpats(safePosts);
        setSelectedPostId(current => current && safePosts.some(row => row.id === current) ? current : safePosts[0]?.id ?? null);
      } else {
        setMyIgpats([]);
        setSelectedPostId(null);
      }
    } catch (loadError: any) {
      console.warn('BUKLOD IGPAT Arena detail:', String(loadError?.message ?? loadError));
      setDetail(null);
      setError('Arena detail is not available yet. The secured server update may still need to be applied.');
    } finally {
      setLoading(false);
    }
  }, [challengeId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const myResult = useMemo(
    () => detail?.results?.find(row => row.submitted_by === user?.id) ?? null,
    [detail?.results, user?.id]
  );

  const run = async (key: string, fn: () => Promise<any>, success?: string) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
      if (success) Alert.alert('IGPAT Arena', success);
      await load();
    } catch (actionError: any) {
      console.warn(`BUKLOD IGPAT Arena ${key}:`, String(actionError?.message ?? actionError));
      Alert.alert('Arena Action Failed', actionError?.message ?? 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const accept = () => run('accept', async () => {
    const { error: rpcError } = await (supabase as any).rpc('igpat_accept_arena_challenge_v1', { p_challenge_id: challengeId });
    if (rpcError) throw rpcError;
  }, 'Challenge accepted. Submit your own IGPAT when ready.');

  const decline = () => run('decline', async () => {
    const { error: rpcError } = await (supabase as any).rpc('igpat_decline_arena_challenge_v1', { p_challenge_id: challengeId });
    if (rpcError) throw rpcError;
  }, 'Challenge declined.');

  const cancel = () => run('cancel', async () => {
    const { error: rpcError } = await (supabase as any).rpc('igpat_cancel_arena_challenge_v1', { p_challenge_id: challengeId });
    if (rpcError) throw rpcError;
  }, 'Open challenge cancelled.');

  const submit = () => {
    if (!selectedPostId) {
      Alert.alert('IGPAT Arena', 'Choose one of your IGPAT videos as your actual submission.');
      return;
    }
    void run('submit', async () => {
      const { error: rpcError } = await (supabase as any).rpc('igpat_submit_arena_result_v1', {
        p_challenge_id: challengeId,
        p_post_id: selectedPostId,
        p_completion_note: note.trim(),
      });
      if (rpcError) throw rpcError;
      setNote('');
    }, myResult ? 'Arena submission updated.' : 'Arena submission entered.');
  };

  const vote = (resultUserId: string) => run('respect', async () => {
    const { error: rpcError } = await (supabase as any).rpc('igpat_give_arena_respect_v2', {
      p_challenge_id: challengeId,
      p_result_user_id: resultUserId,
    });
    if (rpcError) throw rpcError;
  });

  const finalize = () => run('finalize', async () => {
    const { error: rpcError } = await (supabase as any).rpc('igpat_complete_arena_challenge_v2', { p_challenge_id: challengeId });
    if (rpcError) throw rpcError;
  }, 'Arena result finalized from verified submissions and unique Respect.');

  const rematch = () => run('rematch', async () => {
    const { data, error: rpcError } = await (supabase as any).rpc('igpat_rematch_arena_challenge_v1', { p_challenge_id: challengeId });
    if (rpcError) throw rpcError;
    const nextId = String(data ?? '').trim();
    if (!nextId) throw new Error('Rematch did not return a challenge ID.');
    router.replace(`/igpat/arena/${nextId}` as any);
  });

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#FFFFFF" /><Text style={styles.stateText}>Loading Arena…</Text></View>;
  }
  if (error || !detail) {
    return (
      <View style={styles.center}>
        <Text style={styles.stateText}>{error ?? 'Arena challenge unavailable.'}</Text>
        <Pressable style={styles.retryButton} onPress={() => void load()}><Text style={styles.retryText}>RETRY</Text></Pressable>
      </View>
    );
  }

  const results = detail.results ?? [];
  const isCompleted = detail.status === 'COMPLETED';

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}><MaterialCommunityIcons name="arrow-left" size={20} color="#FFFFFF" /></Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>BUKLOD IGPAT ARENA</Text>
          <Text style={styles.title}>{igpatArenaModeLabel(detail.mode)}</Text>
          <Text style={styles.status}>{igpatArenaStatusLabel(detail.status)}</Text>
        </View>
      </View>

      <View style={styles.challengeCard}>
        <Text style={styles.challengeTitle}>{detail.title?.trim() || igpatArenaModeLabel(detail.mode)}</Text>
        <Text style={styles.match}>{detail.creator_name}{detail.opponent_name ? `  vs  ${detail.opponent_name}` : ' · awaiting challenger'}</Text>
        <Text style={styles.meta}>{Number(detail.respect_score ?? 0)} total Respect · {compactDate(detail.created_at)}</Text>
        {detail.starter_post_id ? (
          <Pressable style={styles.inlineLink} onPress={() => router.push(`/post/${detail.starter_post_id}` as any)}>
            <Text style={styles.inlineLinkText}>OPEN STARTER IGPAT</Text><MaterialCommunityIcons name="chevron-right" size={16} color="#D9FF69" />
          </Pressable>
        ) : null}
      </View>

      {(detail.can_accept || detail.can_decline || detail.can_cancel) ? (
        <View style={styles.actionRow}>
          {detail.can_accept ? <Pressable style={styles.primaryAction} disabled={!!busy} onPress={() => void accept()}><Text style={styles.primaryText}>{busy === 'accept' ? 'ACCEPTING…' : 'ACCEPT'}</Text></Pressable> : null}
          {detail.can_decline ? <Pressable style={styles.secondaryAction} disabled={!!busy} onPress={() => void decline()}><Text style={styles.secondaryText}>DECLINE</Text></Pressable> : null}
          {detail.can_cancel ? <Pressable style={styles.secondaryAction} disabled={!!busy} onPress={() => void cancel()}><Text style={styles.secondaryText}>CANCEL</Text></Pressable> : null}
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>SUBMISSIONS</Text>
      {results.length ? (
        <View style={styles.resultsList}>
          {results.map(result => {
            const selectedVote = detail.my_vote_result_user_id === result.submitted_by;
            return (
              <View key={result.submitted_by} style={styles.resultCard}>
                <View style={styles.resultTop}>
                  <Text style={styles.resultName}>{result.participant_name}</Text>
                  <Text style={styles.respect}>{Number(result.respect_received ?? 0)} RESPECT</Text>
                </View>
                {result.completion_note?.trim() ? <Text style={styles.resultNote}>{result.completion_note.trim()}</Text> : null}
                <View style={styles.resultActions}>
                  {result.post_id ? (
                    <Pressable style={styles.smallButton} onPress={() => router.push(`/post/${result.post_id}` as any)}>
                      <Text style={styles.smallText}>OPEN IGPAT</Text>
                    </Pressable>
                  ) : <Text style={styles.unavailable}>Submission media unavailable to this account.</Text>}
                  {detail.can_vote && result.post_id ? (
                    <Pressable style={[styles.respectButton, selectedVote && styles.respectSelected]} disabled={!!busy} onPress={() => void vote(result.submitted_by)}>
                      <MaterialCommunityIcons name="shield-star-outline" size={15} color={selectedVote ? '#07100B' : '#FFFFFF'} />
                      <Text style={[styles.respectButtonText, selectedVote && styles.respectSelectedText]}>{selectedVote ? 'RESPECTED' : 'GIVE RESPECT'}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyCard}><Text style={styles.emptyText}>No verified submission yet.</Text></View>
      )}

      {detail.can_submit ? (
        <View style={styles.submitSection}>
          <Text style={styles.sectionTitle}>{myResult ? 'UPDATE YOUR ENTRY' : 'YOUR ARENA ENTRY'}</Text>
          <Text style={styles.helper}>Choose an IGPAT you actually created. Arena rewards demonstrated participation—not taps or view farming.</Text>
          {myIgpats.length ? (
            <View style={styles.igpatList}>
              {myIgpats.map(post => {
                const selected = selectedPostId === post.id;
                return (
                  <Pressable key={post.id} style={[styles.igpatChoice, selected && styles.igpatSelected]} onPress={() => setSelectedPostId(post.id)} disabled={!!busy}>
                    <Text style={[styles.igpatDate, selected && styles.igpatDateSelected]}>{compactDate(post.created_at)}</Text>
                    <Text style={[styles.igpatBody, selected && styles.igpatBodySelected]} numberOfLines={2}>{post.body?.trim() || 'IGPAT video'}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Create an IGPAT first, then return here to submit it.</Text>
              <Pressable style={styles.smallButton} onPress={() => router.push('/igpat/create' as any)}><Text style={styles.smallText}>CREATE IGPAT</Text></Pressable>
            </View>
          )}
          <TextInput
            value={note}
            onChangeText={value => setNote(value.slice(0, 800))}
            placeholder="Short completion note (optional)"
            placeholderTextColor="rgba(255,255,255,0.34)"
            style={styles.noteInput}
            multiline
            maxLength={800}
            editable={!busy}
          />
          <Pressable style={[styles.submitButton, (!selectedPostId || !!busy) && styles.disabled]} disabled={!selectedPostId || !!busy} onPress={submit}>
            <Text style={styles.submitText}>{busy === 'submit' ? 'SUBMITTING…' : myResult ? 'UPDATE ENTRY' : 'SUBMIT ENTRY'}</Text>
          </Pressable>
        </View>
      ) : null}

      {detail.can_finalize ? (
        <View style={styles.finalizeCard}>
          <Text style={styles.finalizeTitle}>FINALIZE RESULT</Text>
          <Text style={styles.finalizeText}>For Duels, both participants must submit. Winner is derived from unique outside Respect; a tie or zero votes stays a draw.</Text>
          <Pressable style={styles.secondaryAction} disabled={!!busy} onPress={() => void finalize()}><Text style={styles.secondaryText}>{busy === 'finalize' ? 'FINALIZING…' : 'FINALIZE'}</Text></Pressable>
        </View>
      ) : null}

      {isCompleted ? (
        <View style={styles.resultSummary}>
          <MaterialCommunityIcons name={detail.winner_user_id ? 'trophy-outline' : 'scale-balance'} size={22} color="#D9FF69" />
          <Text style={styles.summaryTitle}>{detail.winner_name ? `${detail.winner_name} earned the result.` : 'Respect ended in a draw.'}</Text>
          <Text style={styles.summaryText}>Arena records are structured competition only; they never label normal IGPAT social posts as wins or losses.</Text>
          {(detail.is_creator || detail.is_opponent) ? (
            <Pressable style={styles.rematchButton} disabled={!!busy} onPress={() => void rematch()}>
              <MaterialCommunityIcons name="refresh" size={16} color="#FFFFFF" />
              <Text style={styles.rematchText}>{busy === 'rematch' ? 'CREATING…' : 'RIVAL REMATCH'}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050807' },
  center: { flex: 1, backgroundColor: '#050807', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  content: { padding: 18, paddingTop: 54, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: '#0D120F' },
  headerCopy: { flex: 1 },
  eyebrow: { color: 'rgba(255,255,255,0.42)', fontSize: 8.5, fontWeight: '900', letterSpacing: 1 },
  title: { marginTop: 4, color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  status: { marginTop: 5, color: '#D9FF69', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8 },
  stateText: { color: 'rgba(255,255,255,0.60)', fontSize: 10, lineHeight: 16, textAlign: 'center' },
  retryButton: { marginTop: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)' },
  retryText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '900' },
  challengeCard: { marginTop: 20, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', padding: 15 },
  challengeTitle: { color: '#FFFFFF', fontSize: 17, lineHeight: 22, fontWeight: '900' },
  match: { marginTop: 7, color: 'rgba(255,255,255,0.70)', fontSize: 10.5, fontWeight: '800' },
  meta: { marginTop: 8, color: 'rgba(255,255,255,0.36)', fontSize: 8.5 },
  inlineLink: { marginTop: 12, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 3 },
  inlineLinkText: { color: '#D9FF69', fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  actionRow: { marginTop: 12, flexDirection: 'row', gap: 8 },
  primaryAction: { flex: 1, minHeight: 45, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#07100B', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  secondaryAction: { flex: 1, minHeight: 45, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: '#0D120F', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  sectionTitle: { marginTop: 23, marginBottom: 9, color: 'rgba(255,255,255,0.48)', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.9 },
  resultsList: { gap: 9 },
  resultCard: { borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', padding: 14 },
  resultTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  resultName: { flex: 1, color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  respect: { color: '#D9FF69', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  resultNote: { marginTop: 7, color: 'rgba(255,255,255,0.56)', fontSize: 9, lineHeight: 14 },
  resultActions: { marginTop: 11, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  smallButton: { minHeight: 34, paddingHorizontal: 11, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  smallText: { color: '#FFFFFF', fontSize: 7.8, fontWeight: '900', letterSpacing: 0.5 },
  respectButton: { minHeight: 34, paddingHorizontal: 11, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', flexDirection: 'row', alignItems: 'center', gap: 5 },
  respectSelected: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  respectButtonText: { color: '#FFFFFF', fontSize: 7.8, fontWeight: '900', letterSpacing: 0.5 },
  respectSelectedText: { color: '#07100B' },
  unavailable: { color: 'rgba(255,255,255,0.34)', fontSize: 8 },
  emptyCard: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: '#0D120F', padding: 14, gap: 10 },
  emptyText: { color: 'rgba(255,255,255,0.44)', fontSize: 9, lineHeight: 14 },
  submitSection: { marginTop: 4 },
  helper: { color: 'rgba(255,255,255,0.42)', fontSize: 8.8, lineHeight: 14 },
  igpatList: { marginTop: 10, gap: 7 },
  igpatChoice: { borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', padding: 11 },
  igpatSelected: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  igpatDate: { color: 'rgba(255,255,255,0.36)', fontSize: 7.5, fontWeight: '800' },
  igpatDateSelected: { color: 'rgba(7,16,11,0.46)' },
  igpatBody: { marginTop: 4, color: '#FFFFFF', fontSize: 9.5, lineHeight: 14, fontWeight: '700' },
  igpatBodySelected: { color: '#07100B' },
  noteInput: { marginTop: 10, minHeight: 74, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#0D120F', color: '#FFFFFF', padding: 12, textAlignVertical: 'top', fontSize: 9.5 },
  submitButton: { marginTop: 10, minHeight: 46, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#07100B', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  disabled: { opacity: 0.38 },
  finalizeCard: { marginTop: 22, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(217,255,105,0.18)', backgroundColor: '#10150D', padding: 14 },
  finalizeTitle: { color: '#D9FF69', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
  finalizeText: { marginTop: 5, marginBottom: 11, color: 'rgba(255,255,255,0.50)', fontSize: 8.8, lineHeight: 14 },
  resultSummary: { marginTop: 22, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(217,255,105,0.20)', backgroundColor: '#10150D', padding: 16, alignItems: 'center' },
  summaryTitle: { marginTop: 8, color: '#FFFFFF', fontSize: 13, fontWeight: '900', textAlign: 'center' },
  summaryText: { marginTop: 6, color: 'rgba(255,255,255,0.46)', fontSize: 8.8, lineHeight: 14, textAlign: 'center' },
  rematchButton: { marginTop: 13, minHeight: 40, paddingHorizontal: 15, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', flexDirection: 'row', alignItems: 'center', gap: 6 },
  rematchText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.6 },
});
