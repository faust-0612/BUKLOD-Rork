import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';

import { ClassroomDrawer } from '@/components/classroom/ClassroomDrawer';
import { FacultyGate } from '@/components/faculty/FacultyGate';
import { useBuklodAccess } from '@/hooks/useBuklodAccess';
import { useClassroomTheme } from '@/hooks/useClassroomTheme';
import { openAttendanceWorkspaceForAccount } from '@/lib/buklodScopeManage';
import { supabase } from '@/lib/supabase';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

type TermKey = 'PRELIM' | 'MIDTERM' | 'SEMIFINALS' | 'FINALS';
type StudentRow = {
  student_user_id: string;
  display_name?: string | null;
  username?: string | null;
  status: string;
};
type SessionRow = {
  id: string;
  opened_at: string;
  closed_at: string | null;
  late_after_minutes: number | null;
  term_key: TermKey;
};
type LogRow = {
  id: string;
  session_id: string;
  student_user_id: string;
  time_in: string | null;
  time_out: string | null;
  status: string | null;
};

const TERMS: { key: TermKey; label: string }[] = [
  { key: 'PRELIM', label: 'Prelim' },
  { key: 'MIDTERM', label: 'Midterm' },
  { key: 'SEMIFINALS', label: 'Semifinals' },
  { key: 'FINALS', label: 'Finals' },
];

function time(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function FacultyAttendanceScreen() {
  const params = useLocalSearchParams<{ id?: string; classroomId?: string; name?: string }>();
  const classroomId = String(params.id ?? params.classroomId ?? '');
  const classroomName = String(params.name ?? 'Classroom');
  const { theme, themeId, setThemeId } = useClassroomTheme();
  const { verifyFocusApp } = useBuklodAccess();
  const { scopes, activeScope, selectScope } = useBuklodScope();

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [termKey, setTermKey] = useState<TermKey>('PRELIM');
  const [canOpenAttendanceApp, setCanOpenAttendanceApp] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const selected = sessions.find(item => item.id === selectedId) ?? sessions[0] ?? null;
  const selectedLogs = useMemo(
    () => logs.filter(item => item.session_id === selected?.id),
    [logs, selected?.id]
  );

  const load = useCallback(async () => {
    if (!classroomId) return;
    const [rosterRes, sessionRes] = await Promise.all([
      supabase.rpc('buklod_education_roster_v1', { p_classroom_id: classroomId }),
      supabase
        .from('buklod_education_attendance_sessions')
        .select('id,opened_at,closed_at,late_after_minutes,term_key')
        .eq('classroom_id', classroomId)
        .order('opened_at', { ascending: false }),
    ]);

    if (rosterRes.error) throw rosterRes.error;
    if (sessionRes.error) throw sessionRes.error;

    const nextSessions = (sessionRes.data ?? []) as SessionRow[];
    setStudents((rosterRes.data ?? []) as StudentRow[]);
    setSessions(nextSessions);
    setSelectedId(current => current || nextSessions[0]?.id || '');

    const ids = nextSessions.map(item => item.id);
    if (ids.length === 0) {
      setLogs([]);
      return;
    }

    const { data: logData, error: logError } = await supabase
      .from('buklod_education_attendance_log')
      .select('id,session_id,student_user_id,time_in,time_out,status')
      .in('session_id', ids);
    if (logError) throw logError;
    setLogs((logData ?? []) as LogRow[]);
  }, [classroomId]);

  useEffect(() => {
    load().catch(error => Alert.alert('Attendance', error?.message ?? 'Could not load attendance.'));
  }, [load]);

  useEffect(() => {
    void verifyFocusApp('attendance').then(access => setCanOpenAttendanceApp(access.canSee));
  }, [verifyFocusApp]);

  const openSession = async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;

    setBusy(true);
    try {
      const { data, error } = await supabase
        .from('buklod_education_attendance_sessions')
        .insert({
          classroom_id: classroomId,
          opened_by: uid,
          term_key: termKey,
          late_after_minutes: 15,
          policy: { source: 'BUKLOD_CLASSROOM', verification: 'SERVER_TIME' },
        })
        .select('id')
        .single();
      if (error) throw error;
      setSelectedId(String(data?.id ?? ''));
      await load();
    } catch (error: any) {
      Alert.alert('Open session', String(error?.message ?? error));
    } finally {
      setBusy(false);
    }
  };

  const closeAndSync = async (session: SessionRow) => {
    setBusy(true);
    const { data, error } = await supabase.rpc('buklod_education_close_attendance_session_v2', {
      p_session_id: session.id,
    });
    setBusy(false);
    if (error) return Alert.alert('Close attendance', error.message);
    const result = data as any;
    Alert.alert('Attendance closed', `${Number(result?.synced_students ?? 0)} students synced to ${session.term_key} Attendance gradebook.`);
    await load();
  };

  const resync = async (session: SessionRow) => {
    setBusy(true);
    const { data, error } = await supabase.rpc('buklod_education_sync_attendance_session_to_gradebook_v1', {
      p_session_id: session.id,
    });
    setBusy(false);
    if (error) return Alert.alert('Gradebook sync', error.message);
    const result = data as any;
    Alert.alert('Synced', `${Number(result?.synced_students ?? 0)} student attendance grades refreshed.`);
  };

  const labelFor = (studentId: string) => {
    const row = students.find(item => item.student_user_id === studentId);
    return row?.display_name || row?.username || studentId.slice(0, 8);
  };

  const activeStudents = students.filter(item => item.status === 'ACTIVE');
  const presentCount = selected ? activeStudents.filter(student => selectedLogs.some(log => log.student_user_id === student.student_user_id && log.time_in)).length : 0;

  return (
    <FacultyGate>
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={theme.primary} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        >
          <View style={styles.topBar}>
            <Pressable onPress={() => setDrawerOpen(true)} style={[styles.menuButton, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
              <MaterialCommunityIcons name="menu" size={22} color={theme.ink} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[styles.topKicker, { color: theme.muted }]}>FACULTY ATTENDANCE</Text>
              <Text numberOfLines={1} style={[styles.topName, { color: theme.ink }]}>{classroomName}</Text>
            </View>
            <Pressable onPress={() => router.back()} style={[styles.backButton, { borderColor: theme.border }]}>
              <MaterialCommunityIcons name="arrow-left" size={18} color={theme.ink} />
            </Pressable>
          </View>

          <LinearGradient colors={[theme.heroStart, theme.heroEnd]} style={styles.hero}>
            <View style={[styles.heroMark, { backgroundColor: theme.accent }]}>
              <MaterialCommunityIcons name="account-check-outline" size={25} color={theme.drawer} />
            </View>
            <Text style={styles.heroKicker}>ROLL CALL → GRADEBOOK</Text>
            <Text style={styles.heroTitle}>Attendance Desk</Text>
            <Text style={styles.heroText}>Choose the grading period before opening a session. Closing the session releases its Attendance item into that term automatically.</Text>
          </LinearGradient>

          <View style={[styles.termPanel, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
            <Text style={[styles.panelKicker, { color: theme.muted }]}>NEW SESSION GOES TO</Text>
            <View style={styles.termRow}>
              {TERMS.map(term => (
                <Pressable key={term.key} onPress={() => setTermKey(term.key)} style={[styles.termChip, { backgroundColor: termKey === term.key ? theme.primary : theme.chip }]}>
                  <Text style={[styles.termChipText, { color: termKey === term.key ? '#fff' : theme.ink }]}>{term.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable disabled={busy} onPress={openSession} style={[styles.openButton, { backgroundColor: theme.secondary }, busy && styles.disabled]}>
              <MaterialCommunityIcons name="door-open" size={20} color="#fff" />
              <Text style={styles.openButtonText}>{busy ? 'Working…' : `Open ${TERMS.find(x => x.key === termKey)?.label} attendance`}</Text>
            </Pressable>
          </View>

          {canOpenAttendanceApp && (
            <Pressable
              style={[styles.workspaceButton, { borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}
              onPress={() => {
                void openAttendanceWorkspaceForAccount(selectScope, scopes, { activeScope }).catch((error: any) => {
                  Alert.alert('BUKLOD Attendance', String(error?.message ?? 'Open an Organization or Cluster first.'));
                });
              }}
            >
              <View style={[styles.workspaceIcon, { backgroundColor: theme.chip }]}>
                <MaterialCommunityIcons name="calendar-account-outline" size={20} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.workspaceTitle, { color: theme.ink }]}>Open full BUKLOD Attendance</Text>
                <Text style={[styles.workspaceText, { color: theme.muted }]}>Organization / Cluster attendance workspace</Text>
              </View>
              <MaterialCommunityIcons name="arrow-top-right" size={17} color={theme.muted} />
            </Pressable>
          )}

          <View style={styles.sectionHeading}>
            <Text style={[styles.sectionKicker, { color: theme.muted }]}>SESSION LOGBOOK</Text>
            <Text style={[styles.sectionCount, { color: theme.ink }]}>{sessions.length}</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sessionRail}>
            {sessions.map((item, index) => (
              <Pressable
                key={item.id}
                onPress={() => setSelectedId(item.id)}
                style={[
                  styles.sessionCard,
                  { backgroundColor: selected?.id === item.id ? theme.drawer : theme.surfaceRaised, borderColor: selected?.id === item.id ? theme.drawer : theme.border },
                ]}
              >
                <Text style={[styles.sessionNo, { color: selected?.id === item.id ? theme.accent : theme.secondary }]}>#{String(sessions.length - index).padStart(2, '0')}</Text>
                <Text style={[styles.sessionDate, { color: selected?.id === item.id ? theme.drawerInk : theme.ink }]}>{new Date(item.opened_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
                <Text style={[styles.sessionTerm, { color: selected?.id === item.id ? theme.muted : theme.muted }]}>{TERMS.find(x => x.key === item.term_key)?.label ?? item.term_key}</Text>
                <Text style={[styles.sessionState, { color: item.closed_at ? theme.success : theme.warning }]}>{item.closed_at ? 'CLOSED' : 'OPEN'}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {selected && (
            <View style={[styles.selectedPanel, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
              <View style={styles.selectedHeader}>
                <View>
                  <Text style={[styles.selectedKicker, { color: theme.muted }]}>{TERMS.find(x => x.key === selected.term_key)?.label?.toUpperCase()} ATTENDANCE</Text>
                  <Text style={[styles.selectedTitle, { color: theme.ink }]}>{new Date(selected.opened_at).toLocaleString()}</Text>
                </View>
                <View style={[styles.presentBadge, { backgroundColor: `${theme.success}20` }]}>
                  <Text style={[styles.presentValue, { color: theme.success }]}>{presentCount}/{activeStudents.length}</Text>
                  <Text style={[styles.presentLabel, { color: theme.success }]}>present</Text>
                </View>
              </View>

              <View style={styles.sessionActions}>
                {!selected.closed_at ? (
                  <Pressable disabled={busy} onPress={() => closeAndSync(selected)} style={[styles.sessionActionPrimary, { backgroundColor: theme.secondary }, busy && styles.disabled]}>
                    <MaterialCommunityIcons name="lock-check-outline" size={18} color="#fff" />
                    <Text style={styles.sessionActionPrimaryText}>Close + Sync Gradebook</Text>
                  </Pressable>
                ) : (
                  <Pressable disabled={busy} onPress={() => resync(selected)} style={[styles.sessionActionSecondary, { backgroundColor: theme.chip }, busy && styles.disabled]}>
                    <MaterialCommunityIcons name="sync" size={18} color={theme.ink} />
                    <Text style={[styles.sessionActionSecondaryText, { color: theme.ink }]}>Refresh Gradebook Sync</Text>
                  </Pressable>
                )}
              </View>

              <View style={[styles.rosterHeader, { borderTopColor: theme.border }]}>
                <Text style={[styles.rosterKicker, { color: theme.muted }]}>ROSTER VS TIME-IN</Text>
                <Text style={[styles.rosterHint, { color: theme.muted }]}>server verified</Text>
              </View>

              {activeStudents.map((student, index) => {
                const log = selectedLogs.find(item => item.student_user_id === student.student_user_id);
                const present = !!log?.time_in;
                return (
                  <View key={student.student_user_id} style={[styles.studentRow, index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                    <View style={[styles.studentIndex, { backgroundColor: present ? `${theme.success}18` : `${theme.danger}14` }]}>
                      <MaterialCommunityIcons name={present ? 'check' : 'minus'} size={17} color={present ? theme.success : theme.danger} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.studentName, { color: theme.ink }]}>{labelFor(student.student_user_id)}</Text>
                      <Text style={[styles.studentMeta, { color: theme.muted }]}>{present ? `In ${time(log?.time_in ?? null)} · Out ${time(log?.time_out ?? null)}` : 'No verified time-in'}</Text>
                    </View>
                    <Text style={[styles.studentStatus, { color: present ? theme.success : theme.danger }]}>{present ? 'PRESENT' : 'ABSENT'}</Text>
                  </View>
                );
              })}
            </View>
          )}

          <View style={[styles.note, { borderColor: theme.border }]}>
            <MaterialCommunityIcons name="shield-check-outline" size={19} color={theme.primary} />
            <Text style={[styles.noteText, { color: theme.muted }]}>Faculty does not manually forge a student time-in here. After close, verified time-in becomes 100 raw attendance points and no verified time-in becomes 0 for that session; the configured 50-base equivalent is applied by the grade engine across the Attendance category.</Text>
          </View>
        </ScrollView>

        <ClassroomDrawer
          visible={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          classroomId={classroomId}
          classroomName={classroomName}
          role="FACULTY"
          theme={theme}
          themeId={themeId}
          onThemeChange={setThemeId}
        />
      </View>
    </FacultyGate>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 42, paddingBottom: 80 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  menuButton: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  topKicker: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  topName: { fontSize: 14, fontWeight: '900', marginTop: 1 },
  backButton: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: 22, padding: 17, marginBottom: 12 },
  heroMark: { width: 43, height: 43, borderRadius: 9, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  heroKicker: { color: 'rgba(255,255,255,0.66)', fontSize: 8, fontWeight: '900', letterSpacing: 1.2, marginTop: 15 },
  heroTitle: { color: '#fff', fontSize: 25, fontWeight: '900', marginTop: 2 },
  heroText: { color: 'rgba(255,255,255,0.76)', fontSize: 10, lineHeight: 16, marginTop: 6 },
  termPanel: { borderRadius: 17, borderWidth: 1, padding: 13 },
  panelKicker: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  termRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  termChip: { borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7 },
  termChipText: { fontSize: 9, fontWeight: '900' },
  openButton: { minHeight: 44, borderRadius: 11, marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  openButtonText: { color: '#fff', fontWeight: '900', fontSize: 10 },
  disabled: { opacity: 0.45 },
  workspaceButton: { borderWidth: 1, borderRadius: 14, padding: 11, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 9 },
  workspaceIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  workspaceTitle: { fontSize: 11, fontWeight: '900' },
  workspaceText: { fontSize: 8, marginTop: 2 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 23, marginBottom: 8 },
  sectionKicker: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  sectionCount: { fontSize: 18, fontWeight: '900' },
  sessionRail: { gap: 7, paddingBottom: 4 },
  sessionCard: { width: 112, minHeight: 100, borderRadius: 14, borderWidth: 1, padding: 10 },
  sessionNo: { fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  sessionDate: { fontSize: 14, fontWeight: '900', marginTop: 8 },
  sessionTerm: { fontSize: 8, marginTop: 2 },
  sessionState: { fontSize: 7, fontWeight: '900', letterSpacing: 0.7, marginTop: 'auto' },
  selectedPanel: { borderRadius: 18, borderWidth: 1, padding: 13, marginTop: 10 },
  selectedHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  selectedKicker: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  selectedTitle: { fontSize: 13, fontWeight: '900', marginTop: 2 },
  presentBadge: { minWidth: 70, borderRadius: 10, padding: 7, alignItems: 'center' },
  presentValue: { fontSize: 15, fontWeight: '900' },
  presentLabel: { fontSize: 7, fontWeight: '800' },
  sessionActions: { marginTop: 11 },
  sessionActionPrimary: { minHeight: 41, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  sessionActionPrimaryText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  sessionActionSecondary: { minHeight: 41, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  sessionActionSecondaryText: { fontSize: 9, fontWeight: '900' },
  rosterHeader: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 13, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  rosterKicker: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  rosterHint: { fontSize: 8 },
  studentRow: { minHeight: 55, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7 },
  studentIndex: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  studentName: { fontSize: 11, fontWeight: '900' },
  studentMeta: { fontSize: 8, marginTop: 2 },
  studentStatus: { fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  note: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 13, paddingTop: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  noteText: { flex: 1, fontSize: 9, lineHeight: 14 },
});
