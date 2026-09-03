import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { FacultyGate } from '@/components/faculty/FacultyGate';
import { supabase } from '@/lib/supabase';

type Classroom = {
  id: string;
  name: string;
  subject_code: string | null;
  section_name: string | null;
  status: string;
};

type GradeCategory = {
  id: string;
  name: string;
  weight_percent: number;
  rubric: Record<string, unknown> | null;
  is_visible_to_students: boolean;
};

type QuizResult = {
  attempt_id: string;
  exam_id: string;
  exam_title: string;
  section_id: string | null;
  section_name: string | null;
  student_user_id: string;
  released_at: string;
};

type BulkResult = {
  action?: string;
  processed?: number;
  skipped?: number;
  failed?: number;
};

const GRADING_REFERENCE_URL =
  'https://docs.google.com/spreadsheets/d/1alCWxVUlVPz8GYfa6Bb8wPCoehxsW_og/edit?usp=drive_link&ouid=100282509908765974298&rtpof=true&sd=true';

const ACADEMIC_RUBRIC = {
  version: 1,
  title: 'Standard Academic Rubric',
  criteria: [
    { name: 'Knowledge / Accuracy', weight: 40 },
    { name: 'Application / Reasoning', weight: 30 },
    { name: 'Clarity / Organization', weight: 20 },
    { name: 'Professionalism / Mechanics', weight: 10 },
  ],
};

const PERFORMANCE_RUBRIC = {
  version: 1,
  title: 'Performance / Practical Rubric',
  criteria: [
    { name: 'Preparation', weight: 20 },
    { name: 'Execution / Technique', weight: 40 },
    { name: 'Quality / Outcome', weight: 30 },
    { name: 'Professionalism / Safety', weight: 10 },
  ],
};

function FlowCard({
  step,
  icon,
  title,
  description,
  action,
  actionLabel,
  secondaryAction,
  secondaryLabel,
}: {
  step: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  description: string;
  action: () => void;
  actionLabel: string;
  secondaryAction?: () => void;
  secondaryLabel?: string;
}) {
  return (
    <View style={styles.flowCard}>
      <View style={styles.stepBubble}>
        <Text style={styles.stepText}>{step}</Text>
      </View>
      <View style={styles.flowIcon}>
        <MaterialCommunityIcons name={icon} size={23} color="#1f7a3f" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.flowTitle}>{title}</Text>
        <Text style={styles.flowDescription}>{description}</Text>
        <View style={styles.flowActions}>
          <Pressable style={styles.linkButton} onPress={action}>
            <Text style={styles.linkButtonText}>{actionLabel}</Text>
          </Pressable>
          {!!secondaryAction && !!secondaryLabel && (
            <Pressable style={styles.secondaryLink} onPress={secondaryAction}>
              <Text style={styles.secondaryLinkText}>{secondaryLabel}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

export default function BuklodFacultyAcademicFlowScreen() {
  const params = useLocalSearchParams<{ classroomId?: string; id?: string }>();
  const initialClassroomId = String(params.classroomId ?? params.id ?? '');

  const [classes, setClasses] = useState<Classroom[]>([]);
  const [selectedId, setSelectedId] = useState(initialClassroomId);
  const [categories, setCategories] = useState<GradeCategory[]>([]);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [rosterCount, setRosterCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const selectedClass = useMemo(
    () => classes.find(item => item.id === selectedId) ?? null,
    [classes, selectedId]
  );

  const totalWeight = useMemo(
    () => categories.reduce((sum, item) => sum + Number(item.weight_percent || 0), 0),
    [categories]
  );

  const releasedExamCount = useMemo(
    () => new Set(quizResults.map(item => `${item.exam_id}:${item.section_id ?? 'ALL'}`)).size,
    [quizResults]
  );

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;

    const { data: classData, error: classError } = await supabase
      .from('buklod_education_classrooms')
      .select('id,name,subject_code,section_name,status')
      .eq('faculty_user_id', uid)
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false });

    if (classError) {
      Alert.alert('Academic Flow', classError.message);
      return;
    }

    const rows = (classData ?? []) as Classroom[];
    setClasses(rows);

    let nextId = selectedId;
    if (!nextId || !rows.some(item => item.id === nextId)) {
      nextId = rows[0]?.id ?? '';
      setSelectedId(nextId);
    }

    if (!nextId) {
      setCategories([]);
      setRosterCount(0);
      setQuizResults([]);
      return;
    }

    const [categoryRes, rosterRes, quizRes] = await Promise.all([
      supabase
        .from('buklod_education_grade_categories')
        .select('id,name,weight_percent,rubric,is_visible_to_students')
        .eq('classroom_id', nextId)
        .order('created_at', { ascending: true }),
      supabase
        .from('buklod_education_enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('classroom_id', nextId)
        .eq('status', 'ACTIVE'),
      supabase.rpc('buklod_quiz_faculty_released_results_v1', { p_limit: 1000 }),
    ]);

    if (categoryRes.error) Alert.alert('Grading Setup', categoryRes.error.message);
    if (quizRes.error) console.warn('Faculty Quiz released results:', quizRes.error.message);

    setCategories((categoryRes.data ?? []) as GradeCategory[]);
    setRosterCount(rosterRes.count ?? 0);
    setQuizResults((quizRes.data ?? []) as QuizResult[]);
  }, [selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openClassRoute = (pathname: string) => {
    if (!selectedClass) {
      Alert.alert('Academic Flow', 'Create or select an active Faculty class first.');
      return;
    }
    router.push({
      pathname: pathname as any,
      params: { id: selectedClass.id, classroomId: selectedClass.id, name: selectedClass.name },
    });
  };

  const openBuklodQuiz = async () => {
    setBusy('quiz');
    try {
      const { data, error } = await supabase.rpc('buklod_quiz_examiner_access_status_v1');
      if (error) throw error;
      const access: any = Array.isArray(data) ? data[0] : data;
      if (!access?.can_conduct) {
        Alert.alert(
          'BUKLOD Quiz Examiner Locked',
          'Examiner access requires an active BUKLOD Faculty entitlement, Faculty classroom ownership, and an active Quiz examiner role.'
        );
        return;
      }
      await Linking.openURL('https://buklod-quiz.expo.app');
    } catch (error: any) {
      Alert.alert('BUKLOD Quiz', String(error?.message ?? error));
    } finally {
      setBusy(null);
    }
  };

  const openBuklodAttendance = async () => {
    try {
      const nativeUrl = 'buklod-attendance://';
      if (await Linking.canOpenURL(nativeUrl)) {
        await Linking.openURL(nativeUrl);
        return;
      }
      openClassRoute('/profile/buklod-faculty-attendance');
      Alert.alert(
        'BUKLOD Attendance',
        'The dedicated BUKLOD Attendance app is not available on this device, so the Faculty attendance record was opened instead.'
      );
    } catch {
      openClassRoute('/profile/buklod-faculty-attendance');
    }
  };

  const applyRubric = async (category: GradeCategory, preset: 'ACADEMIC' | 'PERFORMANCE') => {
    if (!selectedClass) return;
    setBusy(`rubric:${category.id}`);
    try {
      const { error } = await supabase.rpc('buklod_education_update_category_rubric_v2', {
        p_classroom_id: selectedClass.id,
        p_category_id: category.id,
        p_rubric: preset === 'ACADEMIC' ? ACADEMIC_RUBRIC : PERFORMANCE_RUBRIC,
        p_visible_to_students: true,
      });
      if (error) throw error;
      await load();
      Alert.alert('Rubric Saved', `${category.name} now uses the ${preset === 'ACADEMIC' ? 'standard academic' : 'performance / practical'} rubric.`);
    } catch (error: any) {
      Alert.alert('Rubric', String(error?.message ?? error));
    } finally {
      setBusy(null);
    }
  };

  const bulkFinalAction = (action: 'COMPUTE' | 'RELEASE' | 'LOCK') => {
    if (!selectedClass) return;
    const message = {
      COMPUTE: 'Compute final grades for all eligible active students? Released/locked finals are skipped.',
      RELEASE: 'Release all final grades currently in DRAFT or REVIEWED status? Students may see released grades according to the Faculty grade visibility rules.',
      LOCK: 'Lock all currently RELEASED final grades? Locked grades require reopening before changes.',
    }[action];

    Alert.alert(`Final Grades · ${action}`, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: action === 'RELEASE' ? 'Release Grades' : action === 'LOCK' ? 'Lock Grades' : 'Compute',
        style: action === 'RELEASE' || action === 'LOCK' ? 'destructive' : 'default',
        onPress: async () => {
          setBusy(`final:${action}`);
          try {
            const { data, error } = await supabase.rpc('buklod_education_bulk_final_grade_action_v2', {
              p_classroom_id: selectedClass.id,
              p_action: action,
            });
            if (error) throw error;
            const result = (data ?? {}) as BulkResult;
            Alert.alert(
              `Final Grades · ${action}`,
              `Processed: ${Number(result.processed ?? 0)}\nSkipped: ${Number(result.skipped ?? 0)}\nFailed: ${Number(result.failed ?? 0)}`
            );
            await load();
          } catch (error: any) {
            Alert.alert('Final Grades', String(error?.message ?? error));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <FacultyGate>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <Pressable style={styles.back} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#17311f" />
          <Text style={styles.backText}>BUKLOD Faculty</Text>
        </Pressable>

        <Text style={styles.eyebrow}>FACULTY × QUIZ × ATTENDANCE</Text>
        <Text style={styles.title}>Academic Control Center</Text>
        <Text style={styles.subtitle}>
          Faculty is the academic source of truth. Roster and grading begin here; BUKLOD Quiz supplies officially released exam scores, while Attendance supplies attendance evidence and records.
        </Text>

        {classes.length === 0 ? (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>No active Faculty class</Text>
            <Text style={styles.warningText}>Create a class in BUKLOD Faculty before setting up the academic workflow.</Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Working Class</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.classRow}>
              {classes.map(item => {
                const selected = item.id === selectedId;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setSelectedId(item.id)}
                    style={[styles.classChip, selected && styles.classChipActive]}
                  >
                    <Text style={[styles.classChipTitle, selected && styles.classChipTitleActive]}>{item.name}</Text>
                    <Text style={[styles.classChipMeta, selected && styles.classChipMetaActive]}>
                      {[item.subject_code, item.section_name].filter(Boolean).join(' • ') || 'Active class'}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{rosterCount}</Text>
                <Text style={styles.summaryLabel}>Active students</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{totalWeight.toFixed(0)}%</Text>
                <Text style={styles.summaryLabel}>Grade weights</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{releasedExamCount}</Text>
                <Text style={styles.summaryLabel}>Released Quiz sets</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Recommended Academic Flow</Text>

            <FlowCard
              step="1"
              icon="account-group-outline"
              title="Build the official class roster"
              description="Enroll manually or upload an Excel/CSV/student-list file. BUKLOD auto-matches username, email, mobile, or unique student name before anything is committed."
              action={() => openClassRoute('/profile/buklod-faculty-import-roster')}
              actionLabel="Import Student List"
              secondaryAction={() => openClassRoute('/profile/buklod-faculty-roster')}
              secondaryLabel="Open Roster"
            />

            <FlowCard
              step="2"
              icon="scale-balance"
              title="Set grading weights and rubrics"
              description="Create grade categories totaling exactly 100%. Category rubrics stay attached to Faculty grading and can be made visible to students."
              action={() => openClassRoute('/profile/buklod-faculty-final-grades')}
              actionLabel="Open Grading System"
              secondaryAction={() => void Linking.openURL(GRADING_REFERENCE_URL)}
              secondaryLabel="Reference Grading Sheet"
            />

            <View style={styles.rubricCard}>
              <Text style={styles.rubricTitle}>Quick Rubric Setup</Text>
              <Text style={styles.rubricNote}>
                Apply a standard rubric per grade category, then refine individual activity/assessment scoring inside Faculty.
              </Text>
              {categories.length === 0 ? (
                <Text style={styles.muted}>Create grade categories first.</Text>
              ) : (
                categories.map(category => (
                  <View key={category.id} style={styles.rubricRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rubricCategory}>{category.name}</Text>
                      <Text style={styles.muted}>{Number(category.weight_percent).toFixed(1)}% · {category.rubric && Object.keys(category.rubric).length > 0 ? 'Rubric configured' : 'No rubric yet'}</Text>
                    </View>
                    <Pressable
                      disabled={busy === `rubric:${category.id}`}
                      style={styles.rubricButton}
                      onPress={() => void applyRubric(category, 'ACADEMIC')}
                    >
                      <Text style={styles.rubricButtonText}>Academic</Text>
                    </Pressable>
                    <Pressable
                      disabled={busy === `rubric:${category.id}`}
                      style={styles.rubricButtonAlt}
                      onPress={() => void applyRubric(category, 'PERFORMANCE')}
                    >
                      <Text style={styles.rubricButtonAltText}>Practical</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </View>

            <FlowCard
              step="3"
              icon="calendar-check-outline"
              title="Record attendance"
              description="Use the Faculty attendance record for the class. The dedicated BUKLOD Attendance app can be opened for its operational attendance workflow when installed."
              action={() => openClassRoute('/profile/buklod-faculty-attendance')}
              actionLabel="Faculty Attendance"
              secondaryAction={() => void openBuklodAttendance()}
              secondaryLabel="Open BUKLOD Attendance"
            />

            <FlowCard
              step="4"
              icon="clipboard-text-outline"
              title="Conduct quizzes and examinations"
              description="Start from Faculty, then open BUKLOD Quiz as the exam engine. Quiz security, live monitoring, checking, and result release stay inside BUKLOD Quiz."
              action={() => void openBuklodQuiz()}
              actionLabel={busy === 'quiz' ? 'Checking Access…' : 'Open BUKLOD Quiz'}
              secondaryAction={() => void Linking.openURL('https://buklod-quiz.expo.app/records')}
              secondaryLabel="Quiz Class Records"
            />

            <FlowCard
              step="5"
              icon="sync-circle"
              title="Sync only officially RELEASED Quiz scores"
              description="Released exam results are converted into Faculty grade items. Duplicate syncs update the same linked item, and locked Faculty grades are never overwritten."
              action={() => openClassRoute('/profile/buklod-faculty-quiz-sync')}
              actionLabel="Sync Released Quiz Results"
            />

            <FlowCard
              step="6"
              icon="account-check-outline"
              title="Review, compute, release, and lock final grades"
              description="Faculty reviews the complete gradebook. Final grades compute only when the category structure is complete and all required weighted categories have released/locked work."
              action={() => openClassRoute('/profile/buklod-faculty-final-grades')}
              actionLabel="Review Final Grades"
            />

            <View style={styles.finalCard}>
              <View style={styles.finalHeader}>
                <MaterialCommunityIcons name="shield-check-outline" size={24} color="#1f7a3f" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.finalTitle}>Controlled Final Grade Release</Text>
                  <Text style={styles.finalText}>Compute → faculty review → release → lock. Bulk actions honor the same per-student safeguards as the existing Final Grade Engine.</Text>
                </View>
              </View>
              <View style={styles.bulkRow}>
                <Pressable style={styles.bulkButton} onPress={() => bulkFinalAction('COMPUTE')}>
                  <Text style={styles.bulkButtonText}>Compute Eligible</Text>
                </Pressable>
                <Pressable style={styles.bulkRelease} onPress={() => bulkFinalAction('RELEASE')}>
                  <Text style={styles.bulkReleaseText}>Release Drafts</Text>
                </Pressable>
                <Pressable style={styles.bulkLock} onPress={() => bulkFinalAction('LOCK')}>
                  <Text style={styles.bulkLockText}>Lock Released</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.policyCard}>
              <Text style={styles.policyTitle}>Academic release rules</Text>
              <Text style={styles.policyLine}>• Student roster is owned by the Faculty classroom.</Text>
              <Text style={styles.policyLine}>• BUKLOD Quiz contributes only officially RELEASED exam scores.</Text>
              <Text style={styles.policyLine}>• Attendance does not automatically become a grade unless the faculty grading policy includes it.</Text>
              <Text style={styles.policyLine}>• Category weights must total exactly 100% before final computation.</Text>
              <Text style={styles.policyLine}>• Final grades are never auto-released. Faculty controls release and locking.</Text>
            </View>
          </>
        )}
      </ScrollView>
    </FacultyGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f7f2' },
  content: { padding: 20, paddingTop: 42, paddingBottom: 80 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 18 },
  backText: { color: '#17311f', fontWeight: '900' },
  eyebrow: { color: '#1f7a3f', fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  title: { color: '#17311f', fontSize: 29, fontWeight: '900', marginTop: 2 },
  subtitle: { color: '#667169', marginTop: 6, lineHeight: 20, marginBottom: 18 },
  sectionTitle: { color: '#203328', fontSize: 17, fontWeight: '900', marginTop: 10, marginBottom: 10 },
  warningCard: { backgroundColor: '#fff0dc', borderRadius: 17, padding: 17 },
  warningTitle: { color: '#65491e', fontSize: 16, fontWeight: '900' },
  warningText: { color: '#7c6747', marginTop: 4, lineHeight: 19 },
  classRow: { gap: 8, paddingBottom: 6 },
  classChip: { width: 210, borderRadius: 15, padding: 13, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e9e3' },
  classChipActive: { backgroundColor: '#1f7a3f', borderColor: '#1f7a3f' },
  classChipTitle: { color: '#203328', fontWeight: '900' },
  classChipTitleActive: { color: '#fff' },
  classChipMeta: { color: '#768078', fontSize: 11, marginTop: 3 },
  classChipMetaActive: { color: '#dcefe0' },
  summaryRow: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 8 },
  summaryCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12 },
  summaryValue: { color: '#17311f', fontSize: 21, fontWeight: '900' },
  summaryLabel: { color: '#748078', fontSize: 10, lineHeight: 14, marginTop: 2 },
  flowCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#fff', borderRadius: 17, padding: 15, marginBottom: 9 },
  stepBubble: { width: 25, height: 25, borderRadius: 13, backgroundColor: '#17311f', alignItems: 'center', justifyContent: 'center' },
  stepText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  flowIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#e8f4ea', alignItems: 'center', justifyContent: 'center' },
  flowTitle: { color: '#24362b', fontWeight: '900', fontSize: 15 },
  flowDescription: { color: '#68736b', lineHeight: 18, marginTop: 4, fontSize: 12 },
  flowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  linkButton: { backgroundColor: '#1f7a3f', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8 },
  linkButtonText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  secondaryLink: { backgroundColor: '#edf4ee', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8 },
  secondaryLinkText: { color: '#1f7a3f', fontWeight: '900', fontSize: 11 },
  rubricCard: { backgroundColor: '#fdfbf4', borderRadius: 17, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: '#eee5c9' },
  rubricTitle: { color: '#423b24', fontWeight: '900', fontSize: 15 },
  rubricNote: { color: '#756e56', lineHeight: 18, marginTop: 4, marginBottom: 10, fontSize: 12 },
  rubricRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e3ddc8' },
  rubricCategory: { color: '#423b24', fontWeight: '900' },
  muted: { color: '#807a68', fontSize: 11, marginTop: 2 },
  rubricButton: { backgroundColor: '#1f7a3f', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7 },
  rubricButtonText: { color: '#fff', fontWeight: '900', fontSize: 10 },
  rubricButtonAlt: { backgroundColor: '#fff', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7, borderWidth: 1, borderColor: '#b9cdbd' },
  rubricButtonAltText: { color: '#1f7a3f', fontWeight: '900', fontSize: 10 },
  finalCard: { backgroundColor: '#e8f4ea', borderRadius: 18, padding: 16, marginTop: 6 },
  finalHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  finalTitle: { color: '#17311f', fontWeight: '900', fontSize: 16 },
  finalText: { color: '#53665a', lineHeight: 18, marginTop: 4, fontSize: 12 },
  bulkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 13 },
  bulkButton: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9 },
  bulkButtonText: { color: '#1f7a3f', fontWeight: '900', fontSize: 11 },
  bulkRelease: { backgroundColor: '#1f7a3f', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9 },
  bulkReleaseText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  bulkLock: { backgroundColor: '#17311f', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9 },
  bulkLockText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  policyCard: { backgroundColor: '#fff', borderRadius: 17, padding: 15, marginTop: 12 },
  policyTitle: { color: '#203328', fontWeight: '900', marginBottom: 7 },
  policyLine: { color: '#667169', lineHeight: 19, fontSize: 12 },
});