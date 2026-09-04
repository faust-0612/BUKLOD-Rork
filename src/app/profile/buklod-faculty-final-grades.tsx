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
import { router, useLocalSearchParams } from 'expo-router';

import { FacultyGate } from '@/components/faculty/FacultyGate';
import { supabase } from '@/lib/supabase';

type TermKey = 'PRELIM' | 'MIDTERM' | 'SEMIFINALS' | 'FINALS';

type GradingTerm = {
  key: TermKey;
  label: string;
  weight_percent: number;
};

type Category = {
  id: string;
  term_key: TermKey;
  name: string;
  weight_percent: number;
};

type StudentSummary = {
  student_user_id: string;
  display_name: string;
  weighted_points: number;
  covered_weight: number;
  current_percent: number | null;
  positive_categories: number;
  represented_categories: number;
  ready_for_final: boolean;
  final_grade: number | null;
  final_status: string | null;
};

const TERM_ORDER: TermKey[] = ['PRELIM', 'MIDTERM', 'SEMIFINALS', 'FINALS'];
const FALLBACK_TERMS: GradingTerm[] = [
  { key: 'PRELIM', label: 'Prelim', weight_percent: 25 },
  { key: 'MIDTERM', label: 'Midterm', weight_percent: 25 },
  { key: 'SEMIFINALS', label: 'Semifinals', weight_percent: 25 },
  { key: 'FINALS', label: 'Finals', weight_percent: 25 },
];

function n(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

export default function BuklodFacultyFinalGradesScreen() {
  const params = useLocalSearchParams<{ classroomId?: string; id?: string; name?: string }>();
  const classroomId = String(params.classroomId ?? params.id ?? '');
  const className = String(params.name ?? 'Class');

  const [terms, setTerms] = useState<GradingTerm[]>(FALLBACK_TERMS);
  const [categories, setCategories] = useState<Category[]>([]);
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [passingPercent, setPassingPercent] = useState(75);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!classroomId) return;

    const [classRes, categoryRes, summaryRes] = await Promise.all([
      supabase
        .from('buklod_education_classrooms')
        .select('grading_terms,passing_percent')
        .eq('id', classroomId)
        .single(),
      supabase
        .from('buklod_education_grade_categories')
        .select('id,term_key,name,weight_percent')
        .eq('classroom_id', classroomId)
        .order('created_at', { ascending: true }),
      supabase.rpc('buklod_education_faculty_final_grade_summary_v1', {
        p_classroom_id: classroomId,
      }),
    ]);

    if (classRes.error) throw classRes.error;
    if (categoryRes.error) throw categoryRes.error;
    if (summaryRes.error) throw summaryRes.error;

    const loadedTerms = Array.isArray(classRes.data?.grading_terms)
      ? classRes.data.grading_terms.map((item: any) => ({
          key: String(item?.key ?? '').toUpperCase() as TermKey,
          label: String(item?.label ?? ''),
          weight_percent: n(item?.weight_percent),
        }))
      : [];

    setTerms(
      TERM_ORDER.map(key =>
        loadedTerms.find((item: GradingTerm) => item.key === key) ??
        FALLBACK_TERMS.find(item => item.key === key)!
      )
    );
    setCategories(
      (categoryRes.data ?? []).map((item: any) => ({
        id: String(item.id),
        term_key: String(item.term_key ?? 'PRELIM').toUpperCase() as TermKey,
        name: String(item.name ?? ''),
        weight_percent: n(item.weight_percent),
      }))
    );
    setStudents((summaryRes.data ?? []) as StudentSummary[]);
    setPassingPercent(n(classRes.data?.passing_percent || 75));
  }, [classroomId]);

  useEffect(() => {
    load().catch(error => Alert.alert('Final Grades', error?.message ?? 'Could not load final grades.'));
  }, [load]);

  const termWeightTotal = useMemo(
    () => terms.reduce((sum, item) => sum + n(item.weight_percent), 0),
    [terms]
  );

  const categoryTotals = useMemo(() => {
    const result: Record<TermKey, number> = { PRELIM: 0, MIDTERM: 0, SEMIFINALS: 0, FINALS: 0 };
    categories.forEach(item => {
      if (TERM_ORDER.includes(item.term_key)) result[item.term_key] += n(item.weight_percent);
    });
    return result;
  }, [categories]);

  const setupReady =
    Math.abs(termWeightTotal - 100) < 0.0001 &&
    TERM_ORDER.every(key => Math.abs(categoryTotals[key] - 100) < 0.0001);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (error: any) {
      Alert.alert('Final Grades', error?.message ?? 'Refresh failed.');
    } finally {
      setRefreshing(false);
    }
  };

  const runAction = async (
    studentId: string,
    action: 'compute' | 'release' | 'lock' | 'reopen'
  ) => {
    setBusyId(studentId);
    try {
      const rpcName = {
        compute: 'buklod_education_compute_final_grade_v1',
        release: 'buklod_education_release_final_grade_v1',
        lock: 'buklod_education_lock_final_grade_v1',
        reopen: 'buklod_education_reopen_final_grade_v1',
      }[action];

      const { error } = await supabase.rpc(rpcName, {
        p_classroom_id: classroomId,
        p_student_user_id: studentId,
      });
      if (error) throw error;
      await load();
    } catch (error: any) {
      Alert.alert('Final Grade', error?.message ?? 'Action failed.');
    } finally {
      setBusyId(null);
    }
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
          <Text style={styles.backText}>{className}</Text>
        </Pressable>

        <Text style={styles.eyebrow}>TERM-AWARE GRADEBOOK</Text>
        <Text style={styles.title}>Final Grade Engine</Text>
        <Text style={styles.subtitle}>
          Prelim, Midterm, Semifinals and Finals are computed from released/locked item grades using the configured term weights and the 50-base equivalent formula.
        </Text>

        <View style={[styles.readiness, setupReady ? styles.ready : styles.notReady]}>
          <View style={styles.readinessHeader}>
            <MaterialCommunityIcons
              name={setupReady ? 'check-circle-outline' : 'alert-circle-outline'}
              size={24}
              color={setupReady ? '#1f7a3f' : '#9b6c32'}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.readinessTitle}>{setupReady ? 'Grading structure ready' : 'Grading structure needs adjustment'}</Text>
              <Text style={styles.readinessText}>Term total: {termWeightTotal.toFixed(1)}% · Passing grade: {passingPercent.toFixed(1)}%</Text>
            </View>
          </View>

          <View style={styles.termGrid}>
            {terms.map(term => {
              const ok = Math.abs(categoryTotals[term.key] - 100) < 0.0001;
              return (
                <View key={term.key} style={styles.termCard}>
                  <Text style={styles.termName}>{term.label}</Text>
                  <Text style={styles.termWeight}>{term.weight_percent.toFixed(1)}% of final</Text>
                  <Text style={[styles.termCategories, !ok && styles.termBad]}>
                    Categories {categoryTotals[term.key].toFixed(1)}%
                  </Text>
                </View>
              );
            })}
          </View>

          <Pressable
            style={styles.setupButton}
            onPress={() =>
              router.push({
                pathname: '/profile/buklod-faculty-grading-setup' as any,
                params: { classroomId, id: classroomId, name: className },
              })
            }
          >
            <MaterialCommunityIcons name="tune-variant" size={19} color="#1f7a3f" />
            <Text style={styles.setupText}>Edit Grading Setup</Text>
          </Pressable>
        </View>

        <View style={styles.formulaCard}>
          <Text style={styles.formulaLabel}>EQUIVALENT FORMULA</Text>
          <Text style={styles.formula}>50 + (Raw ÷ Highest Possible × 50)</Text>
          <Text style={styles.formulaHint}>Category weights are applied inside each term; term weights are then applied to the overall final grade.</Text>
        </View>

        <View style={styles.toolbar}>
          <Pressable
            style={styles.toolbarButton}
            onPress={() =>
              router.push({
                pathname: '/profile/buklod-faculty-class' as any,
                params: { id: classroomId, classroomId, name: className },
              })
            }
          >
            <MaterialCommunityIcons name="format-list-numbered" size={19} color="#1f7a3f" />
            <Text style={styles.toolbarText}>Item-level Grades</Text>
          </Pressable>
          <Pressable
            style={styles.toolbarButton}
            onPress={() =>
              router.push({
                pathname: '/profile/buklod-faculty-progress' as any,
                params: { id: classroomId, classroomId, name: className },
              })
            }
          >
            <MaterialCommunityIcons name="chart-timeline-variant" size={19} color="#1f7a3f" />
            <Text style={styles.toolbarText}>Progress</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Student Final Grades</Text>

        {students.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="account-school-outline" size={30} color="#839087" />
            <Text style={styles.emptyTitle}>No active students yet</Text>
            <Text style={styles.emptyText}>Enroll students first. Their released Quiz, Attendance, activity and manual grades will feed this gradebook.</Text>
          </View>
        ) : (
          students.map(student => {
            const busy = busyId === student.student_user_id;
            const status = student.final_status ?? 'NOT COMPUTED';
            const current = student.current_percent == null ? null : n(student.current_percent);
            const finalGrade = student.final_grade == null ? null : n(student.final_grade);
            const passed = (finalGrade ?? current ?? 0) >= passingPercent;

            return (
              <View key={student.student_user_id} style={styles.studentCard}>
                <View style={styles.studentHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.studentName}>{student.display_name}</Text>
                    <Text style={styles.meta}>Released coverage: {n(student.covered_weight).toFixed(1)}%</Text>
                  </View>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusText}>{status}</Text>
                  </View>
                </View>

                <View style={styles.metrics}>
                  <View style={styles.metric}>
                    <Text style={styles.metricValue}>{current == null ? '—' : current.toFixed(2)}</Text>
                    <Text style={styles.metricLabel}>Current</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={styles.metricValue}>{n(student.weighted_points).toFixed(2)}</Text>
                    <Text style={styles.metricLabel}>Weighted</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={styles.metricValue}>{finalGrade == null ? '—' : finalGrade.toFixed(2)}</Text>
                    <Text style={styles.metricLabel}>Final</Text>
                  </View>
                </View>

                <View style={styles.progressRow}>
                  <Text style={[styles.readyText, !student.ready_for_final && styles.notReadyText]}>
                    {student.ready_for_final
                      ? 'Ready for final computation'
                      : `${student.represented_categories}/${student.positive_categories} weighted categories represented`}
                  </Text>
                  {(current != null || finalGrade != null) && (
                    <Text style={[styles.passText, !passed && styles.failText]}>{passed ? 'PASSING' : 'BELOW PASSING'}</Text>
                  )}
                </View>

                <View style={styles.actions}>
                  <Pressable
                    disabled={busy || !setupReady || !student.ready_for_final || status === 'RELEASED' || status === 'LOCKED'}
                    style={[styles.action, (busy || !setupReady || !student.ready_for_final || status === 'RELEASED' || status === 'LOCKED') && styles.disabled]}
                    onPress={() => runAction(student.student_user_id, 'compute')}
                  >
                    <Text style={styles.actionText}>Compute</Text>
                  </Pressable>
                  <Pressable
                    disabled={busy || !['DRAFT', 'REVIEWED'].includes(status)}
                    style={[styles.action, (busy || !['DRAFT', 'REVIEWED'].includes(status)) && styles.disabled]}
                    onPress={() => runAction(student.student_user_id, 'release')}
                  >
                    <Text style={styles.actionText}>Release</Text>
                  </Pressable>
                  <Pressable
                    disabled={busy || status !== 'RELEASED'}
                    style={[styles.action, (busy || status !== 'RELEASED') && styles.disabled]}
                    onPress={() => runAction(student.student_user_id, 'lock')}
                  >
                    <Text style={styles.actionText}>Lock</Text>
                  </Pressable>
                  <Pressable
                    disabled={busy || !['RELEASED', 'LOCKED'].includes(status)}
                    style={[styles.action, (busy || !['RELEASED', 'LOCKED'].includes(status)) && styles.disabled]}
                    onPress={() => runAction(student.student_user_id, 'reopen')}
                  >
                    <Text style={styles.actionText}>Reopen</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}

        <View style={styles.note}>
          <MaterialCommunityIcons name="shield-check-outline" size={20} color="#1f7a3f" />
          <Text style={styles.noteText}>
            Final grades are snapshots controlled by faculty. Editing grading rules is blocked while a final grade is released or locked; reopen it first so every change remains auditable.
          </Text>
        </View>
      </ScrollView>
    </FacultyGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f7f2' },
  content: { padding: 20, paddingTop: 42, paddingBottom: 70 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 18 },
  backText: { color: '#17311f', fontWeight: '900' },
  eyebrow: { color: '#1f7a3f', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#17311f', fontSize: 27, fontWeight: '900' },
  subtitle: { color: '#68736b', marginTop: 5, marginBottom: 16, lineHeight: 19 },
  readiness: { borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1 },
  ready: { backgroundColor: '#e8f4e9', borderColor: '#c4dfc9' },
  notReady: { backgroundColor: '#fff0dc', borderColor: '#efd2a7' },
  readinessHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  readinessTitle: { color: '#26392d', fontWeight: '900', fontSize: 16 },
  readinessText: { color: '#68736b', marginTop: 3, lineHeight: 18 },
  termGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  termCard: { width: '48%', backgroundColor: 'rgba(255,255,255,0.72)', borderRadius: 11, padding: 10 },
  termName: { color: '#2b3d31', fontWeight: '900' },
  termWeight: { color: '#5f6d63', fontSize: 11, marginTop: 2 },
  termCategories: { color: '#1f7a3f', fontSize: 10, fontWeight: '800', marginTop: 4 },
  termBad: { color: '#9b6c32' },
  setupButton: { flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 11, paddingVertical: 10, marginTop: 12 },
  setupText: { color: '#1f7a3f', fontWeight: '900' },
  formulaCard: { backgroundColor: '#17311f', borderRadius: 15, padding: 14, marginBottom: 14 },
  formulaLabel: { color: '#9fc3a7', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  formula: { color: '#fff', fontWeight: '900', fontSize: 16, marginTop: 4 },
  formulaHint: { color: '#c5d5c8', fontSize: 11, lineHeight: 17, marginTop: 5 },
  toolbar: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  toolbarButton: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 11, paddingVertical: 11, borderWidth: 1, borderColor: '#dfe8e1' },
  toolbarText: { color: '#1f7a3f', fontWeight: '900', fontSize: 11 },
  sectionTitle: { color: '#26392d', fontWeight: '900', fontSize: 17, marginTop: 8, marginBottom: 10 },
  empty: { backgroundColor: '#fff', borderRadius: 14, padding: 18, alignItems: 'center' },
  emptyTitle: { color: '#304137', fontWeight: '900', marginTop: 7 },
  emptyText: { color: '#68736b', textAlign: 'center', lineHeight: 18, marginTop: 4 },
  studentCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10 },
  studentHeader: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  studentName: { color: '#26392d', fontWeight: '900', fontSize: 15 },
  meta: { color: '#748078', marginTop: 2, fontSize: 12 },
  statusPill: { backgroundColor: '#edf2ed', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { color: '#536057', fontSize: 10, fontWeight: '900' },
  metrics: { flexDirection: 'row', gap: 8, marginTop: 12 },
  metric: { flex: 1, backgroundColor: '#f5f7f4', borderRadius: 11, padding: 9 },
  metricValue: { color: '#21382a', fontWeight: '900', fontSize: 16 },
  metricLabel: { color: '#79827c', fontSize: 10, marginTop: 2 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginTop: 10 },
  readyText: { color: '#1f7a3f', fontWeight: '800', fontSize: 11, flex: 1 },
  notReadyText: { color: '#9b6c32' },
  passText: { color: '#1f7a3f', fontWeight: '900', fontSize: 10 },
  failText: { color: '#b0473c' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  action: { backgroundColor: '#edf5ee', borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8 },
  actionText: { color: '#1f7a3f', fontWeight: '900', fontSize: 12 },
  disabled: { opacity: 0.35 },
  note: { flexDirection: 'row', gap: 10, backgroundColor: '#eaf4eb', borderRadius: 14, padding: 13, marginTop: 10 },
  noteText: { flex: 1, color: '#435349', lineHeight: 18, fontSize: 12 },
});
