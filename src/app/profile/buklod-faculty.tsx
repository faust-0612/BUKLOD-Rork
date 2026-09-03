import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import {
  FACULTY_AUTOPILOT_MODULES,
  openFacultyAutopilotModule,
  type FacultyAutopilotModule,
  type FacultyClassroomRef,
} from '@/lib/education/facultyAutopilot';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';

import { FacultyGate } from '@/components/faculty/FacultyGate';

type Classroom = {
  id: string;
  name: string;
  subject_code: string | null;
  section_name: string | null;
  school_year: string | null;
  term: string | null;
  status: string;
};

type DashboardStats = {
  classrooms: number;
  students: number;
  pendingGrades: number;
  openAttendance: number;
};

const EMPTY_STATS: DashboardStats = {
  classrooms: 0,
  students: 0,
  pendingGrades: 0,
  openAttendance: 0,
};

export default function BuklodFacultyScreen() {
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showClassPick, setShowClassPick] = useState(false);
  const [pendingModule, setPendingModule] = useState<FacultyAutopilotModule | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [section, setSection] = useState('');
  const [busy, setBusy] = useState(false);
  const { theme } = useBuklodPresentation();

  const activeClasses = useMemo(
    () => classes.filter(item => item.status === 'ACTIVE'),
    [classes]
  );

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;

    const { data: classroomRows, error } = await supabase
      .from('buklod_education_classrooms')
      .select('id,name,subject_code,section_name,school_year,term,status')
      .eq('faculty_user_id', uid)
      .order('created_at', { ascending: false });

    if (error) {
      Alert.alert('BUKLOD Faculty', error.message);
      return;
    }

    const rows = (classroomRows ?? []) as Classroom[];
    setClasses(rows);

    const ids = rows.map(item => item.id);
    let students = 0;
    let pendingGrades = 0;
    let openAttendance = 0;

    if (ids.length > 0) {
      const [enrollmentRes, gradesRes, attendanceRes] = await Promise.all([
        supabase
          .from('buklod_education_enrollments')
          .select('id', { count: 'exact', head: true })
          .in('classroom_id', ids)
          .eq('status', 'ACTIVE'),
        supabase
          .from('buklod_education_grades')
          .select('id', { count: 'exact', head: true })
          .in('classroom_id', ids)
          .in('status', ['DRAFT', 'COMPUTED', 'REVIEWED']),
        supabase
          .from('buklod_education_attendance_sessions')
          .select('id', { count: 'exact', head: true })
          .in('classroom_id', ids)
          .is('closed_at', null),
      ]);

      students = enrollmentRes.count ?? 0;
      pendingGrades = gradesRes.count ?? 0;
      openAttendance = attendanceRes.count ?? 0;
    }

    setStats({
      classrooms: rows.filter(item => item.status === 'ACTIVE').length,
      students,
      pendingGrades,
      openAttendance,
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openModule = (module: FacultyAutopilotModule) => {
    if (activeClasses.length === 0) {
      Alert.alert(
        'Select a class',
        'Create a class first. Autopilot tools stay inside that classroom.'
      );
      return;
    }

    if (activeClasses.length === 1) {
      openFacultyAutopilotModule(module, activeClasses[0]);
      return;
    }

    setPendingModule(module);
    setShowClassPick(true);
  };

  const pickClass = (classroom: FacultyClassroomRef) => {
    setShowClassPick(false);
    if (pendingModule) openFacultyAutopilotModule(pendingModule, classroom);
    setPendingModule(null);
  };

  const createClass = async () => {
    if (!name.trim()) {
      return Alert.alert('Create Class', 'Enter a class/subject name.');
    }

    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc(
        'buklod_education_create_classroom_with_owner_v1',
        {
          p_name: name.trim(),
          p_subject_code: code.trim() || null,
          p_section_name: section.trim() || null,
        }
      );

      if (error) throw error;

      setName('');
      setCode('');
      setSection('');
      setShowCreate(false);
      await load();
    } catch (error: any) {
      Alert.alert('Create Class', String(error?.message ?? error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FacultyGate>
    <>
      <ScrollView
        style={[styles.screen, { backgroundColor: theme.canvas }]}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>ACADEMIC OPERATIONS</Text>
            <Text style={styles.title}>BUKLOD Faculty</Text>
            <Text style={styles.subtitle}>
              Teach more. Let BUKLOD handle routine academic operations.
            </Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          {[
            ['Active Classes', stats.classrooms],
            ['Active Students', stats.students],
            ['Grades to Review', stats.pendingGrades],
            ['Open Attendance', stats.openAttendance],
          ].map(([label, value]) => (
            <View key={String(label)} style={styles.statCard}>
              <Text style={styles.statValue}>{String(value)}</Text>
              <Text style={styles.statLabel}>{String(label)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Classes</Text>
          <Pressable style={styles.primarySmall} onPress={() => setShowCreate(true)}>
            <MaterialCommunityIcons name="plus" size={19} color="#fff" />
            <Text style={styles.primarySmallText}>Create</Text>
          </Pressable>
        </View>

        {activeClasses.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No active class yet</Text>
            <Text style={styles.emptyText}>
              Create a class. Students, materials, attendance, assessments, and grades
              will be tied to that classroom.
            </Text>
          </View>
        ) : (
          activeClasses.map(item => (
            <Pressable
              key={item.id}
              style={styles.classCard}
              onPress={() =>
                router.push({
                  pathname: '/profile/buklod-faculty-class' as any,
                  params: { id: item.id, name: item.name },
                })
              }
            >
              <View style={styles.classIcon}>
                <MaterialCommunityIcons name="google-classroom" size={26} color="#1f7a3f" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.classTitle}>{item.name}</Text>
                <Text style={styles.classMeta}>
                  {[item.subject_code, item.section_name].filter(Boolean).join(' • ') || 'Active classroom'}
                </Text>
              </View>
            </Pressable>
          ))
        )}

        {/* BUKLOD_FACULTY_ACADEMIC_FLOW_R2 */}
        <Text style={styles.sectionTitle}>Academic Control Center</Text>
        <Pressable
          style={({ pressed }) => [
            styles.toolCard,
            { backgroundColor: '#e8f4ea', borderWidth: 1, borderColor: '#c9e2cf' },
            pressed && { opacity: 0.88 },
          ]}
          onPress={() => router.push('/profile/buklod-faculty-academic-flow' as any)}
        >
          <View style={[styles.classIcon, { backgroundColor: '#fff' }]}>
            <MaterialCommunityIcons name="school-outline" size={25} color="#1f7a3f" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toolTitle}>Faculty × Quiz × Attendance × Grades</Text>
            <Text style={styles.toolText}>
              Start here: roster import, grading weights and rubrics, attendance, BUKLOD Quiz exams, released-score sync, and controlled final-grade release.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#1f7a3f" />
        </Pressable>

        <Text style={styles.sectionTitle}>Faculty Autopilot</Text>
        <Text style={styles.toolText}>
          {activeClasses.length > 1
            ? 'Choose a class, then open the tool. Work stays inside that classroom.'
            : 'Each card opens the live classroom tool. No placeholder metrics.'}
        </Text>

        {FACULTY_AUTOPILOT_MODULES.map(module => (
          <Pressable
            key={module.key}
            style={({ pressed }) => [styles.toolCard, pressed && { opacity: 0.88 }]}
            onPress={() => openModule(module)}
          >
            <MaterialCommunityIcons name={module.icon as any} size={24} color={theme.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.toolTitle}>{module.title}</Text>
              <Text style={styles.toolText}>{module.description}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color="#9aa59c" />
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalShade}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create Class</Text>

            <Text style={styles.label}>Class / Subject Name</Text>
            <TextInput value={name} onChangeText={setName} placeholder="e.g. Community Health Nursing II" style={styles.input} />

            <Text style={styles.label}>Subject Code</Text>
            <TextInput value={code} onChangeText={setCode} placeholder="e.g. CHN 2" style={styles.input} />

            <Text style={styles.label}>Section</Text>
            <TextInput value={section} onChangeText={setSection} placeholder="e.g. BSN 3A" style={styles.input} />

            <View style={styles.modalActions}>
              <Pressable style={styles.secondary} onPress={() => setShowCreate(false)}>
                <Text style={styles.secondaryText}>Cancel</Text>
              </Pressable>
              <Pressable disabled={busy} style={styles.primary} onPress={createClass}>
                <Text style={styles.primaryText}>{busy ? 'Creating...' : 'Create Class'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showClassPick} transparent animationType="fade" onRequestClose={() => setShowClassPick(false)}>
        <View style={styles.modalShade}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose class</Text>
            <Text style={styles.toolText}>
              {pendingModule?.title ?? 'Autopilot'} will open inside the class you select.
            </Text>
            {activeClasses.map(item => (
              <Pressable
                key={item.id}
                style={({ pressed }) => [styles.classCard, pressed && { opacity: 0.88 }]}
                onPress={() => pickClass(item)}
              >
                <View style={styles.classIcon}>
                  <MaterialCommunityIcons name="google-classroom" size={22} color="#1f7a3f" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.classTitle}>{item.name}</Text>
                  <Text style={styles.classMeta}>
                    {[item.subject_code, item.section_name].filter(Boolean).join(' • ') || 'Active classroom'}
                  </Text>
                </View>
              </Pressable>
            ))}
            <Pressable style={styles.secondary} onPress={() => setShowClassPick(false)}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
    </FacultyGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f7f2' },
  content: { padding: 20, paddingTop: 48, paddingBottom: 60 },
  header: { marginBottom: 20 },
  eyebrow: { color: '#1f7a3f', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: '#17311f', fontSize: 30, fontWeight: '900', marginTop: 2 },
  subtitle: { color: '#667169', marginTop: 5, lineHeight: 19, maxWidth: 520 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  statCard: { width: '48%', backgroundColor: '#fff', borderRadius: 17, padding: 15 },
  statValue: { fontSize: 26, fontWeight: '900', color: '#17311f' },
  statLabel: { color: '#6a756d', marginTop: 2, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { color: '#17311f', fontSize: 17, fontWeight: '900', marginBottom: 10, marginTop: 4 },
  primarySmall: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1f7a3f', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  primarySmallText: { color: '#fff', fontWeight: '900' },
  empty: { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 22 },
  emptyTitle: { color: '#22352a', fontWeight: '900', fontSize: 16 },
  emptyText: { color: '#68736b', marginTop: 5, lineHeight: 19 },
  classCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 18, padding: 15, marginBottom: 10 },
  classIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#e8f4ea', alignItems: 'center', justifyContent: 'center' },
  classTitle: { color: '#203328', fontWeight: '900', fontSize: 16 },
  classMeta: { color: '#68736b', marginTop: 3 },
  toolCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#fff', borderRadius: 17, padding: 15, marginBottom: 9 },
  toolTitle: { color: '#24362b', fontWeight: '900' },
  toolText: { color: '#68736b', lineHeight: 18, marginTop: 3 },
  modalShade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#f7f8f6', borderRadius: 22, padding: 20 },
  modalTitle: { color: '#17311f', fontSize: 22, fontWeight: '900', marginBottom: 18 },
  label: { color: '#283b2e', fontWeight: '800', marginBottom: 6 },
  input: { backgroundColor: '#fff', borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 14, color: '#203026' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9, marginTop: 6 },
  secondary: { paddingHorizontal: 16, paddingVertical: 12 },
  secondaryText: { color: '#526057', fontWeight: '800' },
  primary: { backgroundColor: '#1f7a3f', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  primaryText: { color: '#fff', fontWeight: '900' },
});