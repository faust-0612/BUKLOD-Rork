import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';

type Member = { user_id: string; name: string; status: string };
type Squad = { id: string; display_name: string; captain_user_id: string; is_captain: boolean; members: Member[] };
type Invite = { squad_id: string; display_name: string; captain_name: string; created_at?: string | null };
type Candidate = { user_id: string; name: string };
type Opponent = { squad_id: string; display_name: string; captain_user_id: string; captain_name: string; active_members: number };
type Match = {
  id: string;
  status: string;
  challenger_squad_id: string;
  challenger_name: string;
  opponent_squad_id: string;
  opponent_name: string;
  challenger_post_id?: string | null;
  opponent_post_id?: string | null;
  winner_squad_id?: string | null;
  respect_score?: number | null;
  my_vote_squad_id?: string | null;
};
type MyIgpat = { id: string; body?: string | null; created_at?: string | null };
type Hub = {
  my_squad?: Squad | null;
  invites?: Invite[];
  invite_candidates?: Candidate[];
  opponents?: Opponent[];
  matches?: Match[];
  votable_matches?: Match[];
  my_igpats?: MyIgpat[];
};

function when(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}

export default function IgpatSquadScreen() {
  const [hub, setHub] = useState<Hub>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPosts, setSelectedPosts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: loadError } = await (supabase as any).rpc('get_my_buklod_igpat_squad_hub_v1');
      if (loadError) throw loadError;
      setHub((data ?? {}) as Hub);
    } catch (loadError: any) {
      console.warn('BUKLOD IGPAT Squad:', String(loadError?.message ?? loadError));
      setHub({});
      setError('Squad Arena is not available yet. The secured Arena server update may still need to be applied.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const run = async (key: string, rpc: string, args: Record<string, unknown> = {}, success?: string) => {
    if (busy) return;
    setBusy(key);
    try {
      const { error: rpcError } = await (supabase as any).rpc(rpc, args);
      if (rpcError) throw rpcError;
      if (success) Alert.alert('IGPAT Squad', success);
      await load();
    } catch (actionError: any) {
      Alert.alert('Squad Action Failed', String(actionError?.message ?? actionError));
    } finally {
      setBusy(null);
    }
  };

  const own = hub.my_squad ?? null;
  const igpats = hub.my_igpats ?? [];
  const activeMembers = useMemo(() => own?.members?.filter(member => member.status === 'ACTIVE') ?? [], [own?.members]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={20} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>BUKLOD IGPAT ARENA</Text>
          <Text style={styles.title}>Squad vs Squad</Text>
          <Text style={styles.subtitle}>Team identity by consent. One team IGPAT per side, outside Respect voting, no public shame for declining.</Text>
        </View>
      </View>

      <View style={styles.ruleCard}>
        <MaterialCommunityIcons name="account-group-outline" size={20} color="#D9FF69" />
        <Text style={styles.ruleText}>Squads require consenting active members. Captains can challenge only followed captains, duplicate active matchups are blocked, and participants cannot vote in their own battle.</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#FFFFFF" /><Text style={styles.stateText}>Loading Squad Arena…</Text></View>
      ) : error ? (
        <View style={styles.stateCard}><Text style={styles.stateText}>{error}</Text><Pressable style={styles.smallButton} onPress={() => void load()}><Text style={styles.smallText}>RETRY</Text></Pressable></View>
      ) : (
        <>
          {(hub.invites ?? []).length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>SQUAD INVITES</Text>
              {(hub.invites ?? []).map(invite => (
                <View key={invite.squad_id} style={styles.card}>
                  <Text style={styles.cardTitle}>{invite.display_name}</Text>
                  <Text style={styles.meta}>Captain · {invite.captain_name}{when(invite.created_at) ? ` · ${when(invite.created_at)}` : ''}</Text>
                  <View style={styles.row}>
                    <Pressable disabled={!!busy} style={styles.primarySmall} onPress={() => void run(`accept:${invite.squad_id}`, 'igpat_respond_squad_invite_v1', { p_squad_id: invite.squad_id, p_accept: true }, 'Squad invitation accepted.')}><Text style={styles.primarySmallText}>ACCEPT</Text></Pressable>
                    <Pressable disabled={!!busy} style={styles.smallButton} onPress={() => void run(`decline:${invite.squad_id}`, 'igpat_respond_squad_invite_v1', { p_squad_id: invite.squad_id, p_accept: false }, 'Invitation declined privately.')}><Text style={styles.smallText}>DECLINE</Text></Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {!own ? (
            <View style={styles.stateCard}>
              <Text style={styles.cardTitle}>CREATE YOUR ARENA SQUAD</Text>
              <Text style={styles.stateText}>The Squad name is derived from your BUKLOD profile to reduce impersonation and harassment. Invite people you already follow; they must accept before joining.</Text>
              <Pressable disabled={!!busy} style={styles.primaryButton} onPress={() => void run('create', 'igpat_create_my_squad_v1', {}, 'Arena Squad created.')}>
                {busy === 'create' ? <ActivityIndicator color="#07100B" /> : <MaterialCommunityIcons name="account-multiple-plus-outline" size={18} color="#07100B" />}
                <Text style={styles.primaryText}>CREATE SQUAD</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>MY SQUAD</Text>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{own.display_name}</Text>
                  <Text style={styles.meta}>{activeMembers.length} active member{activeMembers.length === 1 ? '' : 's'} · {own.is_captain ? 'CAPTAIN' : 'MEMBER'}</Text>
                  <View style={styles.memberWrap}>
                    {(own.members ?? []).map(member => (
                      <View key={member.user_id} style={[styles.memberChip, member.status !== 'ACTIVE' && styles.memberPending]}>
                        <Text style={styles.memberText}>{member.name}</Text>
                        {member.status !== 'ACTIVE' ? <Text style={styles.memberStatus}>{member.status}</Text> : null}
                      </View>
                    ))}
                  </View>
                  <Pressable disabled={!!busy} style={styles.dangerButton} onPress={() => void run('leave', 'igpat_leave_squad_v1', { p_squad_id: own.id }, own.is_captain ? 'Squad archived.' : 'You left the Squad.')}><Text style={styles.dangerText}>{own.is_captain ? 'ARCHIVE SQUAD' : 'LEAVE SQUAD'}</Text></Pressable>
                </View>
              </View>

              {own.is_captain && (hub.invite_candidates ?? []).length ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>INVITE FOLLOWED MEMBERS</Text>
                  <View style={styles.list}>
                    {(hub.invite_candidates ?? []).slice(0, 30).map(candidate => (
                      <Pressable key={candidate.user_id} disabled={!!busy} style={styles.personRow} onPress={() => void run(`invite:${candidate.user_id}`, 'igpat_invite_squad_member_v1', { p_squad_id: own.id, p_target_user_id: candidate.user_id }, `Invitation sent to ${candidate.name}.`)}>
                        <MaterialCommunityIcons name="account-plus-outline" size={18} color="#D9FF69" />
                        <Text style={styles.personName}>{candidate.name}</Text>
                        <Text style={styles.actionText}>INVITE</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              {own.is_captain ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>CHALLENGE ANOTHER SQUAD</Text>
                  {activeMembers.length < 2 ? <Text style={styles.helper}>Your Squad needs at least 2 active consenting members before challenging another Squad.</Text> : null}
                  <View style={styles.list}>
                    {(hub.opponents ?? []).map(opponent => (
                      <Pressable key={opponent.squad_id} disabled={!!busy || activeMembers.length < 2} style={styles.personRow} onPress={() => void run(`challenge:${opponent.squad_id}`, 'igpat_create_squad_match_v1', { p_squad_id: own.id, p_opponent_squad_id: opponent.squad_id }, 'Squad challenge sent privately to the opposing captain.')}>
                        <MaterialCommunityIcons name="shield-sword-outline" size={18} color="#D9FF69" />
                        <View style={styles.flex}><Text style={styles.personName}>{opponent.display_name}</Text><Text style={styles.meta}>{opponent.active_members} members · Captain {opponent.captain_name}</Text></View>
                        <Text style={styles.actionText}>CHALLENGE</Text>
                      </Pressable>
                    ))}
                    {!(hub.opponents ?? []).length ? <Text style={styles.helper}>No eligible followed Squad captains are available yet.</Text> : null}
                  </View>
                </View>
              ) : null}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>SQUAD MATCHES</Text>
                {(hub.matches ?? []).length ? (hub.matches ?? []).map(match => {
                  const opponentInvite = own.is_captain && match.status === 'OPEN' && match.opponent_squad_id === own.id;
                  const canSubmit = own.is_captain && (match.status === 'ACCEPTED' || match.status === 'ACTIVE');
                  const selected = selectedPosts[match.id] ?? igpats[0]?.id ?? '';
                  return (
                    <View key={match.id} style={styles.card}>
                      <View style={styles.cardTop}><Text style={styles.cardTitle}>{match.challenger_name} vs {match.opponent_name}</Text><Text style={styles.badge}>{match.status}</Text></View>
                      <Text style={styles.meta}>{Number(match.respect_score ?? 0)} outside Respect{match.winner_squad_id ? ' · RESULT READY' : ''}</Text>
                      <View style={styles.row}>
                        {match.challenger_post_id ? <Pressable style={styles.smallButton} onPress={() => router.push(`/post/${match.challenger_post_id}` as any)}><Text style={styles.smallText}>TEAM A IGPAT</Text></Pressable> : null}
                        {match.opponent_post_id ? <Pressable style={styles.smallButton} onPress={() => router.push(`/post/${match.opponent_post_id}` as any)}><Text style={styles.smallText}>TEAM B IGPAT</Text></Pressable> : null}
                      </View>
                      {opponentInvite ? <View style={styles.row}><Pressable disabled={!!busy} style={styles.primarySmall} onPress={() => void run(`matchAccept:${match.id}`, 'igpat_respond_squad_match_v1', { p_match_id: match.id, p_accept: true }, 'Squad challenge accepted.')}><Text style={styles.primarySmallText}>ACCEPT</Text></Pressable><Pressable disabled={!!busy} style={styles.smallButton} onPress={() => void run(`matchDecline:${match.id}`, 'igpat_respond_squad_match_v1', { p_match_id: match.id, p_accept: false }, 'Squad challenge declined privately.')}><Text style={styles.smallText}>DECLINE</Text></Pressable></View> : null}
                      {canSubmit && igpats.length ? (
                        <>
                          <Text style={styles.helper}>Captain submits one team IGPAT. Choose a real IGPAT you created.</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.igpatRow}>
                            {igpats.slice(0, 12).map(post => (
                              <Pressable key={post.id} style={[styles.igpatChip, selected === post.id && styles.igpatSelected]} onPress={() => setSelectedPosts(current => ({ ...current, [match.id]: post.id }))}><Text style={[styles.igpatText, selected === post.id && styles.igpatTextSelected]} numberOfLines={1}>{post.body?.trim() || `IGPAT · ${when(post.created_at)}`}</Text></Pressable>
                            ))}
                          </ScrollView>
                          <Pressable disabled={!!busy || !selected} style={styles.primarySmall} onPress={() => void run(`submit:${match.id}`, 'igpat_submit_squad_match_v1', { p_match_id: match.id, p_post_id: selected }, 'Team IGPAT submitted.')}><Text style={styles.primarySmallText}>SUBMIT TEAM IGPAT</Text></Pressable>
                        </>
                      ) : null}
                      {match.status === 'ACTIVE' ? <Pressable disabled={!!busy} style={styles.smallButton} onPress={() => void run(`finalize:${match.id}`, 'igpat_finalize_squad_match_v1', { p_match_id: match.id }, 'Squad result finalized from unique outside Respect.')}><Text style={styles.smallText}>FINALIZE WHEN READY</Text></Pressable> : null}
                    </View>
                  );
                }) : <Text style={styles.helper}>No Squad matches yet.</Text>}
              </View>
            </>
          )}

          {(hub.votable_matches ?? []).length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>OUTSIDE RESPECT</Text>
              <Text style={styles.helper}>You are not in these Squads, so you may give one Respect vote per match after viewing both team IGPATs.</Text>
              {(hub.votable_matches ?? []).map(match => (
                <View key={match.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{match.challenger_name} vs {match.opponent_name}</Text>
                  <View style={styles.row}>
                    <Pressable style={styles.smallButton} onPress={() => router.push(`/post/${match.challenger_post_id}` as any)}><Text style={styles.smallText}>VIEW A</Text></Pressable>
                    <Pressable style={styles.smallButton} onPress={() => router.push(`/post/${match.opponent_post_id}` as any)}><Text style={styles.smallText}>VIEW B</Text></Pressable>
                  </View>
                  <View style={styles.voteGrid}>
                    <Pressable disabled={!!busy} style={[styles.voteButton, match.my_vote_squad_id === match.challenger_squad_id && styles.voteSelected]} onPress={() => void run(`voteA:${match.id}`, 'igpat_vote_squad_match_v1', { p_match_id: match.id, p_squad_id: match.challenger_squad_id })}><Text style={[styles.voteText, match.my_vote_squad_id === match.challenger_squad_id && styles.voteTextSelected]}>RESPECT · {match.challenger_name}</Text></Pressable>
                    <Pressable disabled={!!busy} style={[styles.voteButton, match.my_vote_squad_id === match.opponent_squad_id && styles.voteSelected]} onPress={() => void run(`voteB:${match.id}`, 'igpat_vote_squad_match_v1', { p_match_id: match.id, p_squad_id: match.opponent_squad_id })}><Text style={[styles.voteText, match.my_vote_squad_id === match.opponent_squad_id && styles.voteTextSelected]}>RESPECT · {match.opponent_name}</Text></Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050807' }, content: { padding: 18, paddingTop: 54, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' }, backButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: '#0D120F' }, headerCopy: { flex: 1 },
  eyebrow: { color: 'rgba(255,255,255,0.44)', fontSize: 8.5, fontWeight: '900', letterSpacing: 1 }, title: { marginTop: 4, color: '#FFFFFF', fontSize: 25, fontWeight: '900' }, subtitle: { marginTop: 5, color: 'rgba(255,255,255,0.57)', fontSize: 10.5, lineHeight: 16 },
  ruleCard: { marginTop: 18, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(217,255,105,0.18)', backgroundColor: '#10150D', flexDirection: 'row', gap: 10, alignItems: 'flex-start' }, ruleText: { flex: 1, color: 'rgba(255,255,255,0.58)', fontSize: 9.5, lineHeight: 15 },
  center: { marginTop: 44, alignItems: 'center', gap: 10 }, stateCard: { marginTop: 20, borderRadius: 17, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F' }, stateText: { color: 'rgba(255,255,255,0.60)', fontSize: 9.5, lineHeight: 15, textAlign: 'center' },
  section: { marginTop: 22 }, sectionTitle: { marginBottom: 9, color: '#FFFFFF', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.8 }, list: { gap: 8 }, card: { marginBottom: 9, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F' }, cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, cardTitle: { flex: 1, color: '#FFFFFF', fontSize: 12, fontWeight: '900', lineHeight: 17 }, meta: { marginTop: 4, color: 'rgba(255,255,255,0.42)', fontSize: 8.3, lineHeight: 12 }, badge: { color: '#D9FF69', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.6 }, helper: { marginBottom: 8, color: 'rgba(255,255,255,0.44)', fontSize: 8.8, lineHeight: 14 },
  row: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, flex: { flex: 1 }, primaryButton: { marginTop: 14, minHeight: 48, borderRadius: 15, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, primaryText: { color: '#07100B', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 }, primarySmall: { minHeight: 44, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }, primarySmallText: { color: '#07100B', fontSize: 8, fontWeight: '900', letterSpacing: 0.6 }, smallButton: { minHeight: 44, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)', alignItems: 'center', justifyContent: 'center' }, smallText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 }, dangerButton: { marginTop: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, dangerText: { color: 'rgba(255,255,255,0.45)', fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  memberWrap: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, memberChip: { paddingHorizontal: 10, minHeight: 34, borderRadius: 999, backgroundColor: 'rgba(217,255,105,0.10)', justifyContent: 'center' }, memberPending: { backgroundColor: 'rgba(255,255,255,0.06)' }, memberText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '800' }, memberStatus: { marginTop: 1, color: 'rgba(255,255,255,0.36)', fontSize: 6.5, fontWeight: '900' },
  personRow: { minHeight: 58, padding: 11, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.11)', backgroundColor: '#0D120F', flexDirection: 'row', alignItems: 'center', gap: 10 }, personName: { flex: 1, color: '#FFFFFF', fontSize: 10, fontWeight: '900' }, actionText: { color: '#D9FF69', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.6 },
  igpatRow: { gap: 7, paddingVertical: 8 }, igpatChip: { maxWidth: 180, minHeight: 42, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', justifyContent: 'center' }, igpatSelected: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' }, igpatText: { color: '#FFFFFF', fontSize: 8.5 }, igpatTextSelected: { color: '#07100B', fontWeight: '900' },
  voteGrid: { marginTop: 10, gap: 7 }, voteButton: { minHeight: 46, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }, voteSelected: { backgroundColor: '#D9FF69', borderColor: '#D9FF69' }, voteText: { color: '#FFFFFF', fontSize: 8.2, fontWeight: '900', textAlign: 'center' }, voteTextSelected: { color: '#07100B' },
});
