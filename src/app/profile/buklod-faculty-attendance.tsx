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
import {
  BUKLOD_HIT_SLOP,
  BUKLOD_HIT_SLOP_TIGHT,
} from '@/lib/buklodTouch';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  useLocalSearchParams,
} from 'expo-router';

import { FacultyClassHeader, FacultyGate } from '@/components/faculty/FacultyGate';
import { useBuklodAccess } from '@/hooks/useBuklodAccess';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { openAttendanceWorkspaceForAccount } from '@/lib/buklodScopeManage';
import { supabase } from '@/lib/supabase';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

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
};

type LogRow = {
  id: string;
  session_id: string;
  student_user_id: string;
  time_in: string | null;
  time_out: string | null;
  status: string | null;
};

export default function FacultyAttendanceScreen() {
  const params = useLocalSearchParams<{ id?: string; classroomId?: string; name?: string }>();
  const classroomId = String(params.id ?? params.classroomId ?? '');
  const classroomName = String(params.name ?? 'Classroom');
  const { theme } = useBuklodPresentation();
  const { verifyFocusApp } = useBuklodAccess();
  const { scopes, activeScope, selectScope } = useBuklodScope();

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [canOpenAttendanceApp, setCanOpenAttendanceApp] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

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
        .select('id,opened_at,closed_at,late_after_minutes')
        .eq('classroom_id', classroomId)
        .order('opened_at', { ascending: false }),
    ]);

    if (rosterRes.error) Alert.alert('Roster', rosterRes.error.message);
    if (sessionRes.error) Alert.alert('Attendance', sessionRes.error.message);

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

    if (logError) Alert.alert('Attendance log', logError.message);
    setLogs((logData ?? []) as LogRow[]);
  }, [classroomId]);

  useEffect(() => {
    load();
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
          late_after_minutes: 15,
          policy: {
            source: 'BUKLOD_CLASSROOM',
            verification: 'SERVER_TIME',
          },
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

  const closeSession = async (session: SessionRow) => {
    const { error } = await supabase
      .from('buklod_education_attendance_sessions')
      .update({ closed_at: new Date().toISOString() })
      .eq('id', session.id)
      .eq('classroom_id', classroomId)
      .is('closed_at', null);

    if (error) return Alert.alert('Close session', error.message);
    load();
  };

  const labelFor = (studentId: string) => {
    const row = students.find(item => item.student_user_id === studentId);
    return row?.display_name || row?.username || studentId.slice(0, 8);
  };

  return (
    <FacultyGate>
      <ScrollView
        style={[styles.screen, { backgroundColor: theme.canvas }]}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }} />
        }
      >
        <FacultyClassHeader
          classroomName={classroomName}
          eyebrow="CLASS ATTENDANCE"
          title="Attendance sessions"
          subtitle="Faculty opens and closes the class session. Students time in with the existing server-time RPC. GPS and QR are not simulated here."
        />

        <Pressable
          disabled={busy}
          style={({ pressed }) => [styles.primary, { backgroundColor: theme.buttonPrimary }, pressed && styles.pressed]}
          onPress={openSession}
        >
          <Text style={styles.primaryText}>{busy ? 'Opening…' : 'Open class session'}</Text>
        </Pressable>

        {canOpenAttendanceApp && (
          <Pressable
            style={({ pressed }) => [styles.secondary, { backgroundColor: theme.accentSoft }, pressed && styles.pressed]}
            onPress={() => {
              void openAttendanceWorkspaceForAccount(selectScope, scopes, {
                activeScope,
              }).catch((error: any) => {
                Alert.alert(
                  'BUKLOD Attendance',
                  String(error?.message ?? 'Open an Organization or Cluster first.'),
                );
              });
            }}
          >
            <Text style={{ color: theme.accent, fontWeight: '900' }}>Open BUKLOD Attendance workspace</Text>
          </Pressable>
        )}

        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Sessions</Text>
        {sessions.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: theme.surface }]}>
            <Text style={{ color: theme.textMuted }}>No sessions opened for this class.</Text>
          </View>
        ) : (
          sessions.map(item => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: theme.surface, borderColor: selected?.id === item.id ? theme.accent : 'transparent' },
                pressed && styles.pressed,
              ]}
              onPress={() => setSelectedId(item.id)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: theme.textPrimary }]}>
                  {new Date(item.opened_at).toLocaleString()}
                </Text>
                <Text style={[styles.meta, { color: theme.textMuted }]}>
                  {item.closed_at ? `Closed ${new Date(item.closed_at).toLocaleString()}` : 'OPEN'}
                </Text>
              </View>
              {!item.closed_at && (
                <Pressable onPress={() => closeSession(item)} hitSlop={BUKLOD_HIT_SLOP}>
                  <Text style={{ color: theme.accent, fontWeight: '900' }}>Close</Text>
                </Pressable>
              )}
            </Pressable>
          ))
        )}

        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
          Roster vs time-in {selected ? '' : ''}
        </Text>
        {!selected ? (
          <Text style={{ color: theme.textMuted }}>Open a session to compare the roster.</Text>
        ) : (
          students
            .filter(item => item.status === 'ACTIVE')
            .map(student => {
              const log = selectedLogs.find(item => item.student_user_id === student.student_user_id);
              return (
                <View key={student.student_user_id} style={[styles.card, { backgroundColor: theme.surface }]}>
                  <MaterialCommunityIcons
                    name={log?.time_in ? 'check-circle-outline' : 'clock-outline'}
                    size={22}
                    color={log?.time_in ? theme.success : theme.warning}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: theme.textPrimary }]}>{labelFor(student.student_user_id)}</Text>
                    <Text style={[styles.meta, { color: theme.textMuted }]}>
                      {log?.time_in
                        ? `In ${new Date(log.time_in).toLocaleTimeString()}${log.time_out ? ` • Out ${new Date(log.time_out).toLocaleTimeString()}` : ''}`
                        : 'Not timed in'}
                      {log?.status ? ` • ${log.status}` : ''}
                    </Text>
                  </View>
                </View>
              );
            })
        )}

        <View style={[styles.note, { backgroundColor: theme.accentSoft }]}>
          <MaterialCommunityIcons name="information-outline" size={18} color={theme.accent} />
          <Text style={{ flex: 1, color: theme.textSecondary, lineHeight: 18, fontSize: 12 }}>
            Faculty cannot mark another student present from this screen. That write path is not in the current attendance_log policies. Uncertain absences after close appear in Exception Queue.
          </Text>
        </View>
      </ScrollView>
    </FacultyGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingTop: 42, paddingBottom: 70 },
  primary: { borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginBottom: 10 },
  primaryText: { color: '#fff', fontWeight: '900' },
  secondary: { borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginBottom: 18 },
  sectionTitle: { fontSize: 17, fontWeight: '900', marginTop: 8, marginBottom: 10 },
  empty: { borderRadius: 15, padding: 16, marginBottom: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 15, padding: 13, marginBottom: 8, borderWidth: 1 },
  name: { fontWeight: '900' },
  meta: { marginTop: 2, fontSize: 12 },
  note: { flexDirection: 'row', gap: 10, borderRadius: 14, padding: 13, marginTop: 12 },
  pressed: { opacity: 0.88 },
});
