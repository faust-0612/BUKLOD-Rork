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
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { ClassroomDrawer } from '@/components/classroom/ClassroomDrawer';
import { useClassroomTheme } from '@/hooks/useClassroomTheme';
import { supabase } from '@/lib/supabase';

type AttendanceRow = {
  session_id: string;
  opened_at: string;
  closed_at: string | null;
  term_key: 'PRELIM' | 'MIDTERM' | 'SEMIFINALS' | 'FINALS';
  time_in: string | null;
  time_out: string | null;
  status: string;
  verification: Record<string, unknown>;
};

const TERM_LABEL: Record<string, string> = {
  PRELIM: 'Prelim',
  MIDTERM: 'Midterm',
  SEMIFINALS: 'Semifinals',
  FINALS: 'Finals',
};

function formatDate(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function BuklodClassroomAttendanceScreen() {
  const params = useLocalSearchParams<{ id?: string; classroomId?: string; name?: string }>();
  const classroomId = String(params.id ?? params.classroomId ?? '');
  const classroomName = String(params.name ?? 'Classroom');
  const { theme, themeId, setThemeId } = useClassroomTheme();

  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    if (!classroomId) return;
    const { data, error } = await supabase.rpc('buklod_classroom_student_attendance_v1', {
      p_classroom_id: classroomId,
    });
    if (error) throw error;
    setRows((data ?? []) as AttendanceRow[]);
  }, [classroomId]);

  useFocusEffect(
    useCallback(() => {
      load().catch(error => Alert.alert('Attendance', error?.message ?? 'Could not load attendance.'));
    }, [load])
  );

  const openSession = useMemo(
    () => rows.find(row => !row.closed_at) ?? null,
    [rows]
  );

  const stats = useMemo(() => {
    const closed = rows.filter(row => row.closed_at);
    const present = closed.filter(row => !!row.time_in).length;
    const absent = closed.length - present;
    return { closed: closed.length, present, absent };
  }, [rows]);

  const timeIn = async (sessionId: string) => {
    setBusyId(sessionId);
    const { error } = await supabase.rpc('buklod_education_time_in_v1', { p_session_id: sessionId });
    setBusyId(null);
    if (error) return Alert.alert('Time In', error.message);
    await load();
  };

  const timeOut = async (sessionId: string) => {
    setBusyId(sessionId);
    const { error } = await supabase.rpc('buklod_education_time_out_session_v1', { p_session_id: sessionId });
    setBusyId(null);
    if (error) return Alert.alert('Time Out', error.message);
    await load();
  };

  return (
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
            <Text style={[styles.topKicker, { color: theme.muted }]}>CLASS ATTENDANCE</Text>
            <Text numberOfLines={1} style={[styles.topName, { color: theme.ink }]}>{classroomName}</Text>
          </View>
          <Pressable onPress={() => router.back()} style={[styles.backButton, { borderColor: theme.border }]}>
            <MaterialCommunityIcons name="arrow-left" size={18} color={theme.ink} />
          </Pressable>
        </View>

        <LinearGradient colors={[theme.heroStart, theme.heroEnd]} style={styles.hero}>
          <View style={[styles.punch, { backgroundColor: theme.accent }]}>
            <MaterialCommunityIcons name="calendar-check-outline" size={25} color={theme.drawer} />
          </View>
          <Text style={styles.heroKicker}>SERVER-TIME ATTENDANCE</Text>
          <Text style={styles.heroTitle}>Show up. Time in.</Text>
          <Text style={styles.heroText}>Your time is recorded by the server, not by the phone clock. Closed sessions feed the Attendance component of the gradebook.</Text>
        </LinearGradient>

        {openSession ? (
          <View style={[styles.liveCard, { backgroundColor: theme.surfaceRaised, borderColor: theme.secondary }]}>
            <View style={styles.liveTop}>
              <View>
                <Text style={[styles.liveKicker, { color: theme.secondary }]}>OPEN NOW</Text>
                <Text style={[styles.liveDate, { color: theme.ink }]}>{formatDate(openSession.opened_at)}</Text>
              </View>
              <View style={[styles.termStamp, { borderColor: theme.secondary }]}>
                <Text style={[styles.termStampText, { color: theme.secondary }]}>{TERM_LABEL[openSession.term_key] ?? openSession.term_key}</Text>
              </View>
            </View>

            <View style={styles.clockRow}>
              <View style={[styles.clockBox, { backgroundColor: theme.background }]}>
                <Text style={[styles.clockLabel, { color: theme.muted }]}>TIME IN</Text>
                <Text style={[styles.clockValue, { color: theme.ink }]}>{formatTime(openSession.time_in)}</Text>
              </View>
              <View style={[styles.clockBox, { backgroundColor: theme.background }]}>
                <Text style={[styles.clockLabel, { color: theme.muted }]}>TIME OUT</Text>
                <Text style={[styles.clockValue, { color: theme.ink }]}>{formatTime(openSession.time_out)}</Text>
              </View>
            </View>

            {!openSession.time_in ? (
              <Pressable disabled={busyId === openSession.session_id} onPress={() => timeIn(openSession.session_id)} style={[styles.timeButton, { backgroundColor: theme.secondary }, busyId === openSession.session_id && styles.disabled]}>
                <MaterialCommunityIcons name="login-variant" size={20} color="#fff" />
                <Text style={styles.timeButtonText}>{busyId === openSession.session_id ? 'Recording…' : 'TIME IN NOW'}</Text>
              </Pressable>
            ) : !openSession.time_out ? (
              <Pressable disabled={busyId === openSession.session_id} onPress={() => timeOut(openSession.session_id)} style={[styles.timeButton, { backgroundColor: theme.primary }, busyId === openSession.session_id && styles.disabled]}>
                <MaterialCommunityIcons name="logout-variant" size={20} color="#fff" />
                <Text style={styles.timeButtonText}>{busyId === openSession.session_id ? 'Recording…' : 'TIME OUT'}</Text>
              </Pressable>
            ) : (
              <View style={[styles.doneStrip, { backgroundColor: `${theme.success}22` }]}>
                <MaterialCommunityIcons name="check-circle-outline" size={20} color={theme.success} />
                <Text style={[styles.doneText, { color: theme.success }]}>Attendance recorded for this session.</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.noSession, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
            <MaterialCommunityIcons name="clock-outline" size={26} color={theme.muted} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.noSessionTitle, { color: theme.ink }]}>No open attendance session</Text>
              <Text style={[styles.noSessionText, { color: theme.muted }]}>Faculty will open one when attendance is being taken.</Text>
            </View>
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
            <Text style={[styles.statValue, { color: theme.success }]}>{stats.present}</Text>
            <Text style={[styles.statLabel, { color: theme.muted }]}>Present</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
            <Text style={[styles.statValue, { color: theme.danger }]}>{stats.absent}</Text>
            <Text style={[styles.statLabel, { color: theme.muted }]}>Absent</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
            <Text style={[styles.statValue, { color: theme.primary }]}>{stats.closed}</Text>
            <Text style={[styles.statLabel, { color: theme.muted }]}>Closed</Text>
          </View>
        </View>

        <View style={styles.historyHeading}>
          <Text style={[styles.historyKicker, { color: theme.muted }]}>ATTENDANCE LOGBOOK</Text>
          <Text style={[styles.historyCount, { color: theme.ink }]}>{rows.length}</Text>
        </View>

        {rows.map((row, index) => {
          const present = !!row.time_in;
          const active = !row.closed_at;
          return (
            <View key={row.session_id} style={[styles.historyCard, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
              <View style={[styles.indexBadge, { backgroundColor: index % 2 === 0 ? `${theme.primary}1A` : `${theme.secondary}1A` }]}>
                <Text style={[styles.indexText, { color: index % 2 === 0 ? theme.primary : theme.secondary }]}>{String(rows.length - index).padStart(2, '0')}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.historyTop}>
                  <Text style={[styles.historyDate, { color: theme.ink }]}>{formatDate(row.opened_at)}</Text>
                  <Text style={[styles.historyTerm, { color: theme.muted }]}>{TERM_LABEL[row.term_key] ?? row.term_key}</Text>
                </View>
                <Text style={[styles.historyTimes, { color: theme.muted }]}>In {formatTime(row.time_in)}  ·  Out {formatTime(row.time_out)}</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: active ? `${theme.warning}22` : present ? `${theme.success}22` : `${theme.danger}20` }]}>
                <Text style={[styles.statusText, { color: active ? theme.warning : present ? theme.success : theme.danger }]}>{active ? 'OPEN' : present ? 'PRESENT' : 'ABSENT'}</Text>
              </View>
            </View>
          );
        })}

        <View style={[styles.note, { borderColor: theme.border }]}>
          <MaterialCommunityIcons name="shield-check-outline" size={19} color={theme.primary} />
          <Text style={[styles.noteText, { color: theme.muted }]}>Attendance shown here is based on BUKLOD Classroom server records. You cannot manually mark yourself present after a session is closed.</Text>
        </View>
      </ScrollView>

      <ClassroomDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        classroomId={classroomId}
        classroomName={classroomName}
        role="STUDENT"
        theme={theme}
        themeId={themeId}
        onThemeChange={setThemeId}
      />
    </View>
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
  punch: { width: 43, height: 43, borderRadius: 10, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  heroKicker: { color: 'rgba(255,255,255,0.66)', fontSize: 8, fontWeight: '900', letterSpacing: 1.2, marginTop: 15 },
  heroTitle: { color: '#fff', fontSize: 25, fontWeight: '900', marginTop: 2 },
  heroText: { color: 'rgba(255,255,255,0.76)', fontSize: 10, lineHeight: 16, marginTop: 6 },
  liveCard: { borderRadius: 18, borderWidth: 1, padding: 14 },
  liveTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  liveKicker: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  liveDate: { fontSize: 18, fontWeight: '900', marginTop: 2 },
  termStamp: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, transform: [{ rotate: '2deg' }] },
  termStampText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  clockRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  clockBox: { flex: 1, borderRadius: 12, padding: 11 },
  clockLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  clockValue: { fontSize: 19, fontWeight: '900', marginTop: 3 },
  timeButton: { minHeight: 46, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 11 },
  timeButtonText: { color: '#fff', fontWeight: '900', fontSize: 11, letterSpacing: 0.5 },
  disabled: { opacity: 0.45 },
  doneStrip: { minHeight: 43, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 11 },
  doneText: { fontSize: 10, fontWeight: '900' },
  noSession: { borderWidth: 1, borderRadius: 17, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  noSessionTitle: { fontSize: 13, fontWeight: '900' },
  noSessionText: { fontSize: 9, lineHeight: 14, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 11 },
  statCard: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 11 },
  statValue: { fontSize: 21, fontWeight: '900' },
  statLabel: { fontSize: 8, fontWeight: '800', marginTop: 2 },
  historyHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 8 },
  historyKicker: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  historyCount: { fontSize: 18, fontWeight: '900' },
  historyCard: { minHeight: 67, borderWidth: 1, borderRadius: 15, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 7 },
  indexBadge: { width: 37, height: 45, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  indexText: { fontSize: 12, fontWeight: '900' },
  historyTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  historyDate: { fontSize: 11, fontWeight: '900' },
  historyTerm: { fontSize: 8, fontWeight: '800' },
  historyTimes: { fontSize: 9, marginTop: 4 },
  statusPill: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 5 },
  statusText: { fontSize: 7, fontWeight: '900', letterSpacing: 0.6 },
  note: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 13, paddingTop: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  noteText: { flex: 1, fontSize: 9, lineHeight: 14 },
});
