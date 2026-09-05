import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { router, useFocusEffect } from 'expo-router';

import BuklodQuizStudentEntry from '@/components/classroom/BuklodQuizStudentEntry';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

type ClassroomView = 'FACULTY' | 'STUDENT';

type LauncherAccess = {
  show_launcher: boolean;
  can_faculty_view: boolean;
  can_student_view: boolean;
  dual_role: boolean;
  default_view: ClassroomView | null;
  faculty_free: boolean;
  student_core_free: boolean;
  student_plus_active: boolean;
  student_plus_pricing?: {
    monthly_php?: number;
    yearly_php?: number;
  } | null;
};

type ClassroomRow = {
  classroom_id: string;
  classroom_name: string;
  subject_code: string | null;
  section_name: string | null;
  school_year: string | null;
  term: string | null;
  classroom_mode: string;
  classroom_plan: string;
  role_key: ClassroomView;
  faculty_role: string | null;
  can_faculty_view: boolean;
  can_student_view: boolean;
  status: string;
  updated_at: string;
};

function facultyRoleLabel(role: string | null) {
  switch (String(role ?? '').toUpperCase()) {
    case 'PRIMARY':
      return 'Primary Faculty';
    case 'TEACHER':
      return 'Teacher';
    case 'CO_TEACHER':
      return 'Co-Teacher';
    case 'ASSISTANT':
      return 'Assistant';
    default:
      return 'Faculty';
  }
}

export default function BuklodClassroomsScreen() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [access, setAccess] = useState<LauncherAccess | null>(null);
  const [view, setView] = useState<ClassroomView>('STUDENT');
  const [rows, setRows] = useState<ClassroomRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const activeUserIdRef = useRef<string | null>(userId);

  useEffect(() => {
    activeUserIdRef.current = userId;
    setRows([]);
    setAccess(null);
    setRefreshing(false);
  }, [userId]);

  const load = useCallback(async (requestedView?: ClassroomView) => {
    const requestedUserId = userId;
    if (!requestedUserId) {
      setRows([]);
      setAccess(null);
      return;
    }

    const accessRes = await supabase.rpc('buklod_classroom_launcher_access_v1');
    if (activeUserIdRef.current !== requestedUserId) return;
    if (accessRes.error) throw accessRes.error;

    const nextAccess = accessRes.data as LauncherAccess;
    setAccess(nextAccess);

    if (!nextAccess?.show_launcher) {
      setRows([]);
      return;
    }

    let nextView = requestedView ?? view;
    if (nextView === 'FACULTY' && !nextAccess.can_faculty_view) nextView = 'STUDENT';
    if (nextView === 'STUDENT' && !nextAccess.can_student_view) nextView = 'FACULTY';
    if (!requestedView && !access && nextAccess.default_view) nextView = nextAccess.default_view;

    setView(nextView);

    const { data, error } = await supabase.rpc('buklod_classroom_my_classes_v2', {
      p_view: nextView,
    });

    if (activeUserIdRef.current !== requestedUserId) return;

    const { data: authCheck } = await supabase.auth.getUser();
    if (
      activeUserIdRef.current !== requestedUserId ||
      authCheck.user?.id !== requestedUserId
    ) {
      setRows([]);
      return;
    }

    if (error) throw error;
    setRows((data ?? []) as ClassroomRow[]);
  }, [access, userId, view]);

  useFocusEffect(
    useCallback(() => {
      load().catch(error => Alert.alert('BUKLOD Classroom', error?.message ?? 'Could not load My Classroom.'));
    }, [load])
  );

  const switchView = async (next: ClassroomView) => {
    if (next === view) return;
    if (next === 'FACULTY' && !access?.can_faculty_view) return;
    if (next === 'STUDENT' && !access?.can_student_view) return;
    setView(next);
    try {
      await load(next);
    } catch (error: any) {
      Alert.alert('My Classroom', error?.message ?? 'Could not switch classroom view.');
    }
  };

  const facultyCount = useMemo(
    () => rows.filter(row => row.role_key === 'FACULTY').length,
    [rows]
  );
  const studentCount = useMemo(
    () => rows.filter(row => row.role_key === 'STUDENT').length,
    [rows]
  );

  const openClassroom = (row: ClassroomRow) => {
    router.push({
      pathname: '/profile/buklod-classroom' as any,
      params: { id: row.classroom_id, classroomId: row.classroom_id, name: row.classroom_name },
    });
  };

  const openFacultyCommand = (row: ClassroomRow) => {
    router.push({
      pathname: '/profile/buklod-faculty-class' as any,
      params: { id: row.classroom_id, classroomId: row.classroom_id, name: row.classroom_name },
    });
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load(view);
    } catch (error: any) {
      Alert.alert('BUKLOD Classroom', error?.message ?? 'Refresh failed.');
    } finally {
      if (activeUserIdRef.current === userId) setRefreshing(false);
    }
  };

  const isFacultyView = view === 'FACULTY';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <Pressable style={styles.back} onPress={() => router.back()}>
        <MaterialCommunityIcons name="arrow-left" size={22} color="#17291d" />
        <Text style={styles.backText}>BUKLOD</Text>
      </Pressable>

      <View style={[styles.hero, isFacultyView ? styles.facultyHero : styles.studentHero]}>
        <View style={[styles.heroStamp, isFacultyView ? styles.facultyStamp : styles.studentStamp]}>
          <MaterialCommunityIcons
            name={isFacultyView ? 'human-male-board' : 'account-school-outline'}
            size={29}
            color={isFacultyView ? '#fff8e8' : '#e8fff2'}
          />
        </View>
        <Text style={[styles.eyebrow, isFacultyView && styles.facultyEyebrow]}>
          {isFacultyView ? 'TEACH • GUIDE • REVIEW' : 'LEARN • SUBMIT • GROW'}
        </Text>
        <Text style={[styles.title, isFacultyView && styles.facultyTitle]}>My Classroom</Text>
        <Text style={[styles.subtitle, isFacultyView && styles.facultySubtitle]}>
          {isFacultyView
            ? 'Your assigned classrooms. Faculty tools are free; authority comes from your classroom assignment and role.'
            : 'Your enrolled classes, activities, attendance, quizzes, materials, discussions and released grades.'}
        </Text>
      </View>

      {access?.dual_role ? (
        <View style={styles.viewSwitchShell}>
          <Pressable
            onPress={() => void switchView('FACULTY')}
            style={[styles.viewSwitch, isFacultyView && styles.viewSwitchFacultyOn]}
          >
            <MaterialCommunityIcons name="human-male-board" size={18} color={isFacultyView ? '#fff8e8' : '#6d756f'} />
            <Text style={[styles.viewSwitchText, isFacultyView && styles.viewSwitchTextOn]}>Faculty View</Text>
          </Pressable>
          <Pressable
            onPress={() => void switchView('STUDENT')}
            style={[styles.viewSwitch, !isFacultyView && styles.viewSwitchStudentOn]}
          >
            <MaterialCommunityIcons name="account-school-outline" size={18} color={!isFacultyView ? '#eafff2' : '#6d756f'} />
            <Text style={[styles.viewSwitchText, !isFacultyView && styles.viewSwitchTextOn]}>Student View</Text>
          </Pressable>
        </View>
      ) : null}

      {!access?.show_launcher ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="door-closed-lock" size={35} color="#69746d" />
          <Text style={styles.emptyTitle}>My Classroom is not active yet</Text>
          <Text style={styles.emptyText}>
            This doorway appears only after you are assigned to a classroom as Faculty or actively enrolled as a Student.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.metrics}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{isFacultyView ? facultyCount : studentCount}</Text>
              <Text style={styles.metricLabel}>{isFacultyView ? 'Assigned Classes' : 'Enrolled Classes'}</Text>
            </View>
            <View style={[styles.metric, isFacultyView ? styles.metricFaculty : styles.metricStudent]}>
              <MaterialCommunityIcons name={isFacultyView ? 'gift-outline' : 'school-outline'} size={24} color={isFacultyView ? '#8a551d' : '#1f7a3f'} />
              <Text style={styles.metricLabel}>{isFacultyView ? 'Faculty Tools FREE' : 'Student Core FREE'}</Text>
            </View>
          </View>

          {isFacultyView ? (
            <Pressable style={styles.facultyHubButton} onPress={() => router.push('/profile/buklod-faculty' as any)}>
              <View style={styles.facultyHubIcon}>
                <MaterialCommunityIcons name="plus-box-multiple-outline" size={22} color="#fff8e8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.facultyHubTitle}>Faculty Workspace</Text>
                <Text style={styles.facultyHubText}>Create a class or manage your faculty workspace. No faculty subscription required.</Text>
              </View>
              <MaterialCommunityIcons name="arrow-top-right" size={20} color="#fff8e8" />
            </Pressable>
          ) : (
            <>
              <BuklodQuizStudentEntry />
              <Pressable
                style={[styles.plusCard, access?.student_plus_active && styles.plusCardActive]}
                onPress={() => router.push('/profile/buklod-classroom-student-plus' as any)}
              >
                <View style={styles.plusStar}>
                  <MaterialCommunityIcons name="star-four-points" size={22} color="#2d223f" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.plusTitle}>{access?.student_plus_active ? 'Student Plus Active' : 'Student Plus'}</Text>
                  <Text style={styles.plusText}>
                    Grade forecast • weak-area insights • Deadline Radar • study planner
                  </Text>
                </View>
                <View style={styles.plusPrice}>
                  <Text style={styles.plusPriceText}>{access?.student_plus_active ? 'ACTIVE' : `₱${access?.student_plus_pricing?.monthly_php ?? 59}/mo`}</Text>
                </View>
              </Pressable>
            </>
          )}

          {rows.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name={isFacultyView ? 'human-male-board-poll' : 'school-outline'} size={34} color="#6b786e" />
              <Text style={styles.emptyTitle}>{isFacultyView ? 'No assigned classroom yet' : 'No enrolled classroom yet'}</Text>
              <Text style={styles.emptyText}>
                {isFacultyView
                  ? 'A Primary Faculty can assign you as Teacher, Co-Teacher or Assistant, or you can create your own classroom from Faculty Workspace.'
                  : 'Your classroom will appear here once your enrollment/admission becomes active.'}
              </Text>
            </View>
          ) : (
            rows.map((row, index) => (
              <View key={row.classroom_id} style={[styles.card, index % 2 === 1 && styles.cardOffset]}>
                <Pressable style={styles.cardMain} onPress={() => openClassroom(row)}>
                  <View style={[styles.cardIcon, isFacultyView ? styles.cardIconFaculty : styles.cardIconStudent]}>
                    <MaterialCommunityIcons name={isFacultyView ? 'book-education-outline' : 'notebook-outline'} size={25} color={isFacultyView ? '#8a551d' : '#1f7a3f'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{row.classroom_name}</Text>
                    <Text style={styles.cardMeta}>
                      {[row.subject_code, row.section_name, row.term].filter(Boolean).join(' • ') || 'Active classroom'}
                    </Text>
                    <View style={styles.pills}>
                      <View style={[styles.pill, isFacultyView && styles.facultyPill]}>
                        <Text style={[styles.pillText, isFacultyView && styles.facultyPillText]}>
                          {isFacultyView ? facultyRoleLabel(row.faculty_role) : 'ENROLLED'}
                        </Text>
                      </View>
                      <View style={styles.pill}><Text style={styles.pillText}>{row.classroom_mode}</Text></View>
                    </View>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={23} color="#839087" />
                </Pressable>

                {isFacultyView ? (
                  <Pressable style={styles.manageStrip} onPress={() => openFacultyCommand(row)}>
                    <MaterialCommunityIcons name="tune-variant" size={17} color="#8a551d" />
                    <Text style={styles.manageText}>Open Faculty Command Center</Text>
                    <MaterialCommunityIcons name="arrow-right" size={16} color="#8a551d" />
                  </Pressable>
                ) : null}
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f2f3ef' },
  content: { padding: 18, paddingTop: 42, paddingBottom: 70 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 15, minHeight: 42 },
  backText: { color: '#17291d', fontWeight: '900' },
  hero: { borderRadius: 24, padding: 20, marginBottom: 12, overflow: 'hidden' },
  studentHero: { backgroundColor: '#153d2a' },
  facultyHero: { backgroundColor: '#382817' },
  heroStamp: { width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 20, transform: [{ rotate: '-4deg' }] },
  studentStamp: { backgroundColor: '#2b8050' },
  facultyStamp: { backgroundColor: '#8a551d' },
  eyebrow: { color: '#7fd39e', fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  facultyEyebrow: { color: '#e4b879' },
  title: { color: '#f2fff5', fontSize: 30, fontWeight: '900', marginTop: 3 },
  facultyTitle: { color: '#fff8e8' },
  subtitle: { color: '#bdd7c5', lineHeight: 19, marginTop: 7 },
  facultySubtitle: { color: '#d8c4a7' },
  viewSwitchShell: { flexDirection: 'row', backgroundColor: '#e4e5df', borderRadius: 15, padding: 4, marginBottom: 12 },
  viewSwitch: { flex: 1, minHeight: 43, borderRadius: 12, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  viewSwitchFacultyOn: { backgroundColor: '#6f451b' },
  viewSwitchStudentOn: { backgroundColor: '#1f6a41' },
  viewSwitchText: { color: '#6d756f', fontSize: 11, fontWeight: '900' },
  viewSwitchTextOn: { color: '#fff' },
  metrics: { flexDirection: 'row', gap: 9, marginBottom: 12 },
  metric: { flex: 1, minHeight: 72, backgroundColor: '#fff', borderRadius: 15, padding: 12, alignItems: 'center', justifyContent: 'center' },
  metricFaculty: { backgroundColor: '#fff4df' },
  metricStudent: { backgroundColor: '#eaf6ed' },
  metricValue: { color: '#17291d', fontSize: 22, fontWeight: '900' },
  metricLabel: { color: '#68736b', fontSize: 10, fontWeight: '800', marginTop: 2, textAlign: 'center' },
  facultyHubButton: { backgroundColor: '#6f451b', borderRadius: 17, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  facultyHubIcon: { width: 39, height: 39, borderRadius: 12, backgroundColor: '#8a551d', alignItems: 'center', justifyContent: 'center' },
  facultyHubTitle: { color: '#fff8e8', fontWeight: '900', fontSize: 14 },
  facultyHubText: { color: '#dfc7a4', fontSize: 9, lineHeight: 14, marginTop: 2 },
  plusCard: { backgroundColor: '#eee7ff', borderRadius: 17, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, borderWidth: 1, borderColor: '#d6c8f0' },
  plusCardActive: { backgroundColor: '#e3f5e8', borderColor: '#a9d9b5' },
  plusStar: { width: 39, height: 39, borderRadius: 13, backgroundColor: '#e0d0ff', alignItems: 'center', justifyContent: 'center' },
  plusTitle: { color: '#2d223f', fontWeight: '900', fontSize: 13 },
  plusText: { color: '#6e627d', fontSize: 9, lineHeight: 13, marginTop: 2 },
  plusPrice: { backgroundColor: '#2d223f', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  plusPriceText: { color: '#fff', fontSize: 8, fontWeight: '900' },
  card: { backgroundColor: '#fff', borderRadius: 19, marginBottom: 10, overflow: 'hidden' },
  cardOffset: { marginLeft: 12 },
  cardMain: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  cardIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  cardIconStudent: { backgroundColor: '#e7f4e9' },
  cardIconFaculty: { backgroundColor: '#fff0d7' },
  cardTitle: { color: '#203328', fontWeight: '900', fontSize: 16 },
  cardMeta: { color: '#6f7b72', marginTop: 3, fontSize: 11 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  pill: { backgroundColor: '#eef4ef', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  facultyPill: { backgroundColor: '#fff0d7' },
  pillText: { color: '#526159', fontWeight: '900', fontSize: 8 },
  facultyPillText: { color: '#8a551d' },
  manageStrip: { minHeight: 39, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, backgroundColor: '#fff6e7', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#ead8bd', paddingHorizontal: 12 },
  manageText: { color: '#8a551d', fontSize: 9, fontWeight: '900', flex: 1 },
  empty: { backgroundColor: '#fff', borderRadius: 20, padding: 22, alignItems: 'center', marginTop: 4 },
  emptyTitle: { color: '#24362b', fontWeight: '900', fontSize: 17, marginTop: 10 },
  emptyText: { color: '#6c786f', textAlign: 'center', lineHeight: 19, marginTop: 6 },
});
