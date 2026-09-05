import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useFacultyEntitlement } from '@/hooks/useFacultyEntitlement';
import BuklodQuizStudentEntry from '@/components/classroom/BuklodQuizStudentEntry';

type ClassroomView = 'STUDENT' | 'FACULTY';

type ClassroomRow = {
  classroom_id: string;
  classroom_name: string;
  subject_code: string | null;
  section_name: string | null;
  school_year: string | null;
  term: string | null;
  classroom_mode: string;
  classroom_plan: string;
  role_key: 'FACULTY' | 'STUDENT' | 'DUAL';
  faculty_role: 'PRIMARY' | 'TEACHER' | 'CO_TEACHER' | 'ASSISTANT' | null;
  faculty_permissions: Record<string, boolean>;
  is_student: boolean;
  is_faculty: boolean;
  dual_role: boolean;
  status: string;
  updated_at: string;
};

function facultyRoleLabel(role: ClassroomRow['faculty_role']) {
  if (role === 'PRIMARY') return 'Primary Faculty';
  if (role === 'CO_TEACHER') return 'Co-Teacher';
  if (role === 'ASSISTANT') return 'Assistant';
  return 'Teacher';
}

export default function BuklodClassroomsScreen() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const {
    show_launcher: showLauncher,
    has_faculty_entitlement: hasFacultyEntitlement,
    has_student_enrollment: hasStudentEnrollment,
    dual_role: accountDualRole,
    loading: accessLoading,
    refresh: refreshAccess,
  } = useFacultyEntitlement();

  const [rows, setRows] = useState<ClassroomRow[]>([]);
  const [view, setView] = useState<ClassroomView>('STUDENT');
  const [refreshing, setRefreshing] = useState(false);
  const activeUserIdRef = useRef<string | null>(userId);

  useEffect(() => {
    activeUserIdRef.current = userId;
    setRows([]);
    setRefreshing(false);
  }, [userId]);

  const load = useCallback(async () => {
    const requestedUserId = userId;

    if (!requestedUserId) {
      setRows([]);
      return;
    }

    const [{ data, error }] = await Promise.all([
      (supabase as any).rpc('buklod_classroom_my_classes_v2'),
      refreshAccess(),
    ]);

    if (activeUserIdRef.current !== requestedUserId) return;

    const { data: authCheck } = await supabase.auth.getUser();
    if (
      activeUserIdRef.current !== requestedUserId ||
      authCheck.user?.id !== requestedUserId
    ) {
      setRows([]);
      return;
    }

    if (error) {
      Alert.alert('BUKLOD Classroom', error.message);
      return;
    }

    const nextRows = (data ?? []) as ClassroomRow[];
    setRows(nextRows);

    const nextHasStudent = nextRows.some(row => row.is_student);
    const nextHasFaculty = nextRows.some(row => row.is_faculty);
    if (nextHasFaculty && !nextHasStudent) setView('FACULTY');
    if (nextHasStudent && !nextHasFaculty) setView('STUDENT');
  }, [refreshAccess, userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const studentRows = useMemo(() => rows.filter(row => row.is_student), [rows]);
  const facultyRows = useMemo(() => rows.filter(row => row.is_faculty), [rows]);
  const canStudentView = hasStudentEnrollment || studentRows.length > 0;
  const canFacultyView = hasFacultyEntitlement || facultyRows.length > 0;
  const showSwitcher = canStudentView && canFacultyView;
  const visibleRows = view === 'FACULTY' ? facultyRows : studentRows;

  useEffect(() => {
    if (view === 'STUDENT' && !canStudentView && canFacultyView) setView('FACULTY');
    if (view === 'FACULTY' && !canFacultyView && canStudentView) setView('STUDENT');
  }, [canFacultyView, canStudentView, view]);

  const openRow = (row: ClassroomRow) => {
    if (view === 'FACULTY') {
      router.push({
        pathname: '/profile/buklod-faculty-class' as any,
        params: {
          id: row.classroom_id,
          classroomId: row.classroom_id,
          name: row.classroom_name,
        },
      });
      return;
    }

    router.push({
      pathname: '/profile/buklod-classroom' as any,
      params: { id: row.classroom_id, name: row.classroom_name },
    });
  };

  if (accessLoading) {
    return (
      <View style={styles.routeLoading}>
        <ActivityIndicator size="large" color="#5C3927" />
        <Text style={styles.routeLoadingText}>Checking Classroom access…</Text>
      </View>
    );
  }

  if (!showLauncher) {
    return (
      <View style={styles.routeDenied}>
        <View style={styles.routeDeniedIcon}>
          <MaterialCommunityIcons name="school-lock-outline" size={34} color="#756F64" />
        </View>
        <Text style={styles.routeDeniedTitle}>My Classroom is not active for this account</Text>
        <Text style={styles.routeDeniedText}>
          This doorway is only available to actively enrolled students or users with an active BUKLOD Faculty entitlement. Student enrollment is free; Faculty access uses the Faculty bundle.
        </Text>
        <Pressable style={styles.routeBackButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={18} color="#fff" />
          <Text style={styles.routeBackText}>Back to BUKLOD</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            if (activeUserIdRef.current === userId) setRefreshing(false);
          }}
        />
      }
    >
      <Pressable style={styles.back} onPress={() => router.back()}>
        <MaterialCommunityIcons name="arrow-left" size={22} color="#2D342F" />
        <Text style={styles.backText}>BUKLOD</Text>
      </Pressable>

      <View style={[styles.hero, view === 'FACULTY' ? styles.heroFaculty : styles.heroStudent]}>
        <View style={styles.heroTop}>
          <View style={[styles.heroIcon, view === 'FACULTY' ? styles.iconFaculty : styles.iconStudent]}>
            <MaterialCommunityIcons
              name={view === 'FACULTY' ? 'human-male-board' : 'account-school-outline'}
              size={29}
              color={view === 'FACULTY' ? '#8B4A25' : '#315D8C'}
            />
          </View>
          {(accountDualRole || showSwitcher) && (
            <View style={styles.dualBadge}>
              <MaterialCommunityIcons name="swap-horizontal" size={15} color="#615B50" />
              <Text style={styles.dualBadgeText}>DUAL ROLE</Text>
            </View>
          )}
        </View>
        <Text style={styles.eyebrow}>{view === 'FACULTY' ? 'TEACH • MANAGE' : 'LEARN • PARTICIPATE'}</Text>
        <Text style={styles.title}>My Classroom</Text>
        <Text style={styles.subtitle}>
          {view === 'FACULTY'
            ? 'Your Faculty doorway. Classroom data stays with the class even when teachers change; your controls follow your active assignment and role.'
            : 'Your Student doorway for enrolled classes, materials, submissions, attendance, quizzes, discussions and released grades.'}
        </Text>
      </View>

      {showSwitcher && (
        <View style={styles.switcher}>
          <Pressable
            style={[styles.switchOption, view === 'STUDENT' && styles.switchStudent]}
            onPress={() => setView('STUDENT')}
          >
            <MaterialCommunityIcons name="account-school-outline" size={18} color={view === 'STUDENT' ? '#fff' : '#315D8C'} />
            <Text style={[styles.switchText, view === 'STUDENT' && styles.switchTextOn]}>Student View</Text>
          </Pressable>
          <Pressable
            style={[styles.switchOption, view === 'FACULTY' && styles.switchFaculty]}
            onPress={() => setView('FACULTY')}
          >
            <MaterialCommunityIcons name="human-male-board" size={18} color={view === 'FACULTY' ? '#fff' : '#8B4A25'} />
            <Text style={[styles.switchText, view === 'FACULTY' && styles.switchTextOn]}>Faculty View</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{visibleRows.length}</Text>
          <Text style={styles.metricLabel}>{view === 'FACULTY' ? 'Assigned Classes' : 'Enrolled Classes'}</Text>
        </View>
        <View style={styles.metric}>
          <MaterialCommunityIcons
            name={view === 'FACULTY' ? 'shield-account-outline' : 'book-open-page-variant-outline'}
            size={24}
            color={view === 'FACULTY' ? '#8B4A25' : '#315D8C'}
          />
          <Text style={styles.metricLabel}>{view === 'FACULTY' ? 'Faculty Bundle Active' : 'Student Core Free'}</Text>
        </View>
      </View>

      {view === 'STUDENT' && <BuklodQuizStudentEntry />}

      {view === 'FACULTY' && (
        <Pressable style={styles.commandButton} onPress={() => router.push('/profile/buklod-faculty' as any)}>
          <View>
            <Text style={styles.commandEyebrow}>FACULTY COMMAND CENTER</Text>
            <Text style={styles.commandTitle}>Manage all assigned classes</Text>
            <Text style={styles.commandMeta}>Class creation, roster, attendance, assessments, gradebook and Quiz examiner tools.</Text>
          </View>
          <MaterialCommunityIcons name="arrow-top-right" size={22} color="#fff" />
        </Pressable>
      )}

      {visibleRows.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons
            name={view === 'FACULTY' ? 'human-male-board-poll' : 'school-outline'}
            size={34}
            color="#756F64"
          />
          <Text style={styles.emptyTitle}>
            {view === 'FACULTY' ? 'No assigned classroom yet' : 'No enrolled classroom yet'}
          </Text>
          <Text style={styles.emptyText}>
            {view === 'FACULTY'
              ? 'Your Faculty entitlement is active. Create a classroom or wait for a Primary Faculty assignment. You do not need another payment for Classroom, Attendance, or Quiz examiner access.'
              : 'Your classroom appears here after active enrollment. Student Classroom, Attendance, Quiz taking and grade consultation do not require a Faculty subscription.'}
          </Text>
        </View>
      ) : (
        visibleRows.map(row => (
          <Pressable
            key={`${view}:${row.classroom_id}`}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            onPress={() => openRow(row)}
          >
            <View style={[styles.cardRail, view === 'FACULTY' ? styles.railFaculty : styles.railStudent]} />
            <View style={[styles.cardIcon, view === 'FACULTY' ? styles.iconFaculty : styles.iconStudent]}>
              <MaterialCommunityIcons
                name={view === 'FACULTY' ? 'human-male-board' : 'account-school-outline'}
                size={24}
                color={view === 'FACULTY' ? '#8B4A25' : '#315D8C'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{row.classroom_name}</Text>
              <Text style={styles.cardMeta}>
                {[row.subject_code, row.section_name, row.term].filter(Boolean).join(' • ') || 'Active classroom'}
              </Text>
              <View style={styles.pills}>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{view === 'FACULTY' ? facultyRoleLabel(row.faculty_role) : 'ENROLLED'}</Text>
                </View>
                {row.dual_role && (
                  <View style={styles.dualPill}><Text style={styles.dualPillText}>DUAL</Text></View>
                )}
                <View style={styles.pill}><Text style={styles.pillText}>{row.classroom_mode}</Text></View>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={23} color="#817C72" />
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F0E9' },
  content: { padding: 20, paddingTop: 44, paddingBottom: 70 },
  routeLoading: { flex: 1, backgroundColor: '#F3F0E9', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  routeLoadingText: { color: '#716D66', fontWeight: '800' },
  routeDenied: { flex: 1, backgroundColor: '#F3F0E9', alignItems: 'center', justifyContent: 'center', padding: 28 },
  routeDeniedIcon: { width: 66, height: 66, borderRadius: 22, backgroundColor: '#E7E1D7', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  routeDeniedTitle: { color: '#353A36', fontWeight: '900', fontSize: 19, textAlign: 'center' },
  routeDeniedText: { color: '#716D66', textAlign: 'center', lineHeight: 20, marginTop: 7, maxWidth: 470 },
  routeBackButton: { marginTop: 18, backgroundColor: '#5C3927', borderRadius: 13, minHeight: 44, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  routeBackText: { color: '#fff', fontWeight: '900' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 16 },
  backText: { color: '#2D342F', fontWeight: '900' },
  hero: { borderRadius: 27, padding: 20, marginBottom: 12, borderWidth: 1 },
  heroStudent: { backgroundColor: '#EAF1F7', borderColor: '#C8D9E7' },
  heroFaculty: { backgroundColor: '#F4E9DF', borderColor: '#DEC8B7' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  heroIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  iconStudent: { backgroundColor: '#DCE9F3' },
  iconFaculty: { backgroundColor: '#EED9C8' },
  dualBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFDF7', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  dualBadgeText: { color: '#615B50', fontWeight: '900', fontSize: 9, letterSpacing: 0.5 },
  eyebrow: { color: '#655F55', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#292F2B', fontSize: 30, fontWeight: '900', marginTop: 2 },
  subtitle: { color: '#625F59', lineHeight: 20, marginTop: 7 },
  switcher: { flexDirection: 'row', padding: 5, borderRadius: 16, backgroundColor: '#E4E0D8', gap: 5, marginBottom: 12 },
  switchOption: { flex: 1, minHeight: 43, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  switchStudent: { backgroundColor: '#315D8C' },
  switchFaculty: { backgroundColor: '#8B4A25' },
  switchText: { color: '#625F59', fontSize: 11, fontWeight: '900' },
  switchTextOn: { color: '#fff' },
  metrics: { flexDirection: 'row', gap: 9, marginBottom: 12 },
  metric: { flex: 1, minHeight: 70, backgroundColor: '#FFFDF9', borderRadius: 15, padding: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E0DBD2' },
  metricValue: { color: '#2D342F', fontSize: 22, fontWeight: '900' },
  metricLabel: { color: '#756F64', fontSize: 10, fontWeight: '800', marginTop: 3, textAlign: 'center' },
  commandButton: { backgroundColor: '#5C3927', borderRadius: 18, padding: 15, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  commandEyebrow: { color: '#E7CDBB', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  commandTitle: { color: '#fff', fontSize: 15, fontWeight: '900', marginTop: 2 },
  commandMeta: { color: '#E8DDD6', fontSize: 10, lineHeight: 15, marginTop: 3, maxWidth: 470 },
  card: { backgroundColor: '#FFFDF9', borderRadius: 19, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: '#E0DBD2', overflow: 'hidden' },
  cardRail: { width: 4, alignSelf: 'stretch', borderRadius: 4 },
  railStudent: { backgroundColor: '#315D8C' },
  railFaculty: { backgroundColor: '#8B4A25' },
  cardIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: '#2E342F', fontWeight: '900', fontSize: 16 },
  cardMeta: { color: '#756F68', marginTop: 3, fontSize: 11 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  pill: { backgroundColor: '#EEEAE2', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  pillText: { color: '#625F59', fontWeight: '900', fontSize: 8 },
  dualPill: { backgroundColor: '#E2D6EA', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  dualPillText: { color: '#6A4177', fontWeight: '900', fontSize: 8 },
  empty: { backgroundColor: '#FFFDF9', borderRadius: 20, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: '#E0DBD2' },
  emptyTitle: { color: '#353A36', fontWeight: '900', fontSize: 17, marginTop: 10 },
  emptyText: { color: '#716D66', textAlign: 'center', lineHeight: 19, marginTop: 6 },
  pressed: { opacity: 0.84 },
});
