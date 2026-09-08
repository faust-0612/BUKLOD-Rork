import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { FacultyGate } from '@/components/faculty/FacultyGate';
import { useClassroomTheme } from '@/hooks/useClassroomTheme';
import { supabase } from '@/lib/supabase';

type AttendanceProposal = {
  id: string;
  live_session_id: string;
  attendance_session_id: string;
  student_user_id: string;
  first_joined_at: string | null;
  last_left_at: string | null;
  connected_seconds: number;
  rejoin_count: number;
  proposed_status: string;
  evidence: Record<string, unknown>;
  review_status: string;
  final_status: string | null;
  created_at: string;
};

type InteractionReview = {
  id: string;
  session_id: string;
  target_user_id: string | null;
  target_name: string;
  interaction_type: string;
  result: string;
  network_evidence: Record<string, unknown>;
  created_at: string;
  completed_at: string | null;
  review_status: string;
  resolution: string | null;
  review_note: string | null;
};

function duration(seconds: number) {
  const total = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}m ${secs}s`;
}

function shortDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function evidenceText(evidence: Record<string, unknown> | null | undefined) {
  if (!evidence) return 'No network evidence';
  const quality = evidence.stream_connection_quality ?? evidence.connection_quality;
  const type = evidence.network_type;
  const connected = evidence.is_connected;
  const reachable = evidence.is_internet_reachable;
  const parts = [
    quality ? `Stream ${String(quality)}` : '',
    type ? `Network ${String(type)}` : '',
    connected === false ? 'Disconnected' : '',
    reachable === false ? 'Internet unreachable' : '',
  ].filter(Boolean);
  return parts.join(' • ') || 'No verified weak-network signal recorded';
}

export default function BuklodFacultyLiveReviewScreen() {
  const params = useLocalSearchParams<{ id?: string; classroomId?: string; name?: string }>();
  const classroomId = String(params.id ?? params.classroomId ?? '');
  const classroomName = String(params.name ?? 'Classroom');
  const { theme } = useClassroomTheme();

  const [attendance, setAttendance] = useState<AttendanceProposal[]>([]);
  const [interactions, setInteractions] = useState<InteractionReview[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!classroomId) return;
    const [attendanceRes, interactionRes] = await Promise.all([
      supabase.rpc('buklod_classroom_live_attendance_proposals_v1', { p_classroom_id: classroomId }),
      supabase.rpc('buklod_classroom_interaction_reviews_v1', { p_classroom_id: classroomId }),
    ]);
    if (attendanceRes.error) throw attendanceRes.error;
    if (interactionRes.error) throw interactionRes.error;
    setAttendance((attendanceRes.data ?? []) as AttendanceProposal[]);
    setInteractions((interactionRes.data ?? []) as InteractionReview[]);
  }, [classroomId]);

  useFocusEffect(useCallback(() => {
    void load().catch(error => Alert.alert('Live Review', error?.message ?? 'Could not load live-class evidence.'));
  }, [load]));

  const pendingAttendance = useMemo(
    () => attendance.filter(row => row.review_status !== 'APPROVED'),
    [attendance],
  );
  const pendingInteractions = useMemo(
    () => interactions.filter(row => row.review_status !== 'RESOLVED'),
    [interactions],
  );
  const readyLiveSessions = useMemo(() => {
    const groups = new Map<string, AttendanceProposal[]>();
    for (const row of attendance) {
      const list = groups.get(row.live_session_id) ?? [];
      list.push(row);
      groups.set(row.live_session_id, list);
    }
    return Array.from(groups.entries())
      .filter(([, rows]) => rows.length > 0 && rows.every(row => row.review_status === 'APPROVED'))
      .map(([liveSessionId, rows]) => ({ liveSessionId, rows, createdAt: rows[0]?.created_at ?? null }));
  }, [attendance]);

  const approveAttendance = async (row: AttendanceProposal, status: string) => {
    if (busyId) return;
    setBusyId(row.id);
    try {
      const { error } = await supabase.rpc('buklod_classroom_approve_live_attendance_v1', {
        p_proposal_id: row.id,
        p_status: status,
        p_note: `Faculty approved from Live Review. Proposed: ${row.proposed_status}`,
      });
      if (error) throw error;
      await load();
    } catch (error) {
      Alert.alert('Attendance Review', error instanceof Error ? error.message : 'Could not approve attendance evidence.');
    } finally {
      setBusyId(null);
    }
  };

  const finalizeAttendance = async (liveSessionId: string) => {
    if (busyId) return;
    const key = `finalize-${liveSessionId}`;
    setBusyId(key);
    try {
      const { data, error } = await supabase.rpc('buklod_classroom_finalize_live_attendance_v1', {
        p_live_session_id: liveSessionId,
      });
      if (error) throw error;
      const result = data as any;
      Alert.alert('Live attendance finalized', `${Number(result?.synced_students ?? 0)} student attendance grades synchronized after full faculty review.`);
      await load();
    } catch (error) {
      Alert.alert('Finalize Attendance', error instanceof Error ? error.message : 'Could not finalize live attendance.');
    } finally {
      setBusyId(null);
    }
  };

  const resolveInteraction = async (row: InteractionReview, resolution: string) => {
    if (busyId) return;
    setBusyId(row.id);
    try {
      const { error } = await supabase.rpc('buklod_classroom_resolve_interaction_review_v1', {
        p_interaction_id: row.id,
        p_resolution: resolution,
        p_note: evidenceText(row.network_evidence),
      });
      if (error) throw error;
      await load();
    } catch (error) {
      Alert.alert('Recitation Review', error instanceof Error ? error.message : 'Could not resolve recitation review.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <FacultyGate>
      <ScrollView
        style={[styles.screen, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={theme.primary} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={[styles.back, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
            <MaterialCommunityIcons name="arrow-left" size={20} color={theme.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.kicker, { color: theme.secondary }]}>FACULTY EVIDENCE DESK</Text>
            <Text numberOfLines={1} style={[styles.title, { color: theme.ink }]}>{classroomName}</Text>
          </View>
        </View>

        <View style={[styles.hero, { backgroundColor: theme.drawer }]}>
          <MaterialCommunityIcons name="shield-check-outline" size={31} color={theme.accent} />
          <Text style={[styles.heroTitle, { color: theme.drawerInk }]}>Review before consequence</Text>
          <Text style={[styles.heroText, { color: `${theme.drawerInk}B8` }]}>BUKLOD records live attendance and no-response/network evidence automatically, but it does not automatically deduct grades. Faculty confirms the final classification here.</Text>
        </View>

        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: theme.ink }]}>Live attendance proposals</Text>
          <Text style={[styles.count, { color: theme.secondary }]}>{pendingAttendance.length}</Text>
        </View>

        {pendingAttendance.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}><Text style={{ color: theme.muted }}>No attendance evidence waiting for review.</Text></View>
        ) : pendingAttendance.map(row => (
          <View key={row.id} style={[styles.card, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: theme.ink }]}>Student {row.student_user_id.slice(0, 8)}</Text>
                <Text style={[styles.meta, { color: theme.muted }]}>Joined {shortDate(row.first_joined_at)} • Connected {duration(row.connected_seconds)} • Rejoins {row.rejoin_count}</Text>
              </View>
              <View style={[styles.proposal, { backgroundColor: `${theme.warning}1C` }]}><Text style={[styles.proposalText, { color: theme.warning }]}>{row.proposed_status}</Text></View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionRow}>
              {['PRESENT','LATE','ABSENT','EXCUSED'].map(status => (
                <Pressable key={status} disabled={busyId === row.id} onPress={() => approveAttendance(row, status)} style={[styles.action, { backgroundColor: status === 'ABSENT' ? `${theme.danger}18` : theme.chip }]}>
                  <Text style={[styles.actionText, { color: status === 'ABSENT' ? theme.danger : theme.ink }]}>{status}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ))}

        {readyLiveSessions.length > 0 && (
          <View style={[styles.finalizePanel, { backgroundColor: theme.surfaceRaised, borderColor: theme.success }]}>
            <View style={styles.finalizeHead}>
              <MaterialCommunityIcons name="check-decagram-outline" size={21} color={theme.success} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.finalizeTitle, { color: theme.ink }]}>Fully reviewed live sessions</Text>
                <Text style={[styles.meta, { color: theme.muted }]}>Sync only after every student's proposal in that live session has a faculty decision.</Text>
              </View>
            </View>
            {readyLiveSessions.map(session => (
              <Pressable key={session.liveSessionId} disabled={!!busyId} onPress={() => finalizeAttendance(session.liveSessionId)} style={[styles.finalizeButton, { backgroundColor: theme.success }, !!busyId && styles.disabled]}>
                <Text style={styles.finalizeButtonText}>{busyId === `finalize-${session.liveSessionId}` ? 'Finalizing…' : `Finalize ${shortDate(session.createdAt)} • ${session.rows.length} students`}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: theme.ink }]}>Recitation / response reviews</Text>
          <Text style={[styles.count, { color: theme.secondary }]}>{pendingInteractions.length}</Text>
        </View>

        {pendingInteractions.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}><Text style={{ color: theme.muted }}>No no-response or network cases waiting for faculty review.</Text></View>
        ) : pendingInteractions.map(row => (
          <View key={row.id} style={[styles.card, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.ink }]}>{row.target_name || 'BUKLOD Student'}</Text>
            <Text style={[styles.meta, { color: theme.muted }]}>{row.interaction_type} • {shortDate(row.created_at)}</Text>
            <View style={[styles.evidence, { backgroundColor: theme.background }]}>
              <MaterialCommunityIcons name={row.result.includes('NETWORK') ? 'wifi-alert' : 'account-alert-outline'} size={18} color={row.result.includes('NETWORK') ? theme.warning : theme.danger} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.evidenceTitle, { color: theme.ink }]}>{row.result}</Text>
                <Text style={[styles.evidenceText, { color: theme.muted }]}>{evidenceText(row.network_evidence)}</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionRow}>
              <Pressable onPress={() => resolveInteraction(row, 'NO_PENALTY')} style={[styles.action, { backgroundColor: theme.chip }]}><Text style={[styles.actionText, { color: theme.ink }]}>No penalty</Text></Pressable>
              <Pressable onPress={() => resolveInteraction(row, 'MISSED_RESPONSE')} style={[styles.action, { backgroundColor: `${theme.danger}18` }]}><Text style={[styles.actionText, { color: theme.danger }]}>Missed</Text></Pressable>
              <Pressable onPress={() => resolveInteraction(row, 'TECHNICAL')} style={[styles.action, { backgroundColor: `${theme.warning}18` }]}><Text style={[styles.actionText, { color: theme.warning }]}>Technical</Text></Pressable>
              <Pressable onPress={() => resolveInteraction(row, 'EXCUSED')} style={[styles.action, { backgroundColor: `${theme.success}18` }]}><Text style={[styles.actionText, { color: theme.success }]}>Excused</Text></Pressable>
            </ScrollView>
          </View>
        ))}

        <View style={[styles.footerNote, { borderColor: theme.border }]}>
          <MaterialCommunityIcons name="information-outline" size={18} color={theme.primary} />
          <Text style={[styles.footerText, { color: theme.muted }]}>“Missed” records the faculty decision in the audited live-interaction review. It does not silently change an academic grade; any grade deduction remains an explicit faculty grading action.</Text>
        </View>
      </ScrollView>
    </FacultyGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 18, paddingTop: 42, paddingBottom: 80 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  back: { width: 42, height: 42, borderWidth: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  title: { fontSize: 17, fontWeight: '900', marginTop: 2 },
  hero: { borderRadius: 19, padding: 16, marginBottom: 20 },
  heroTitle: { fontSize: 22, fontWeight: '900', marginTop: 9 },
  heroText: { fontSize: 10, lineHeight: 16, marginTop: 5 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '900' },
  count: { fontSize: 17, fontWeight: '900' },
  empty: { borderWidth: 1, borderRadius: 15, padding: 15, marginBottom: 12 },
  card: { borderWidth: 1, borderRadius: 16, padding: 13, marginBottom: 9 },
  cardTop: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  cardTitle: { fontSize: 13, fontWeight: '900' },
  meta: { fontSize: 9, lineHeight: 14, marginTop: 2 },
  proposal: { borderRadius: 9, paddingHorizontal: 8, paddingVertical: 5 },
  proposalText: { fontSize: 8, fontWeight: '900' },
  evidence: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderRadius: 11, padding: 10, marginTop: 9 },
  evidenceTitle: { fontSize: 10, fontWeight: '900' },
  evidenceText: { fontSize: 8, lineHeight: 12, marginTop: 2 },
  actionRow: { gap: 6, paddingTop: 10 },
  action: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  actionText: { fontSize: 8, fontWeight: '900' },
  finalizePanel: { borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 12 },
  finalizeHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  finalizeTitle: { fontSize: 12, fontWeight: '900' },
  finalizeButton: { minHeight: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, marginTop: 8 },
  finalizeButtonText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  disabled: { opacity: 0.5 },
  footerNote: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 8, paddingTop: 12, marginTop: 10 },
  footerText: { flex: 1, fontSize: 9, lineHeight: 14 },
});