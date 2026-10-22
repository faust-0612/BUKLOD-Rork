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

import { FacultyClassroomHeader } from '@/components/classroom/FacultyClassroomHeader';
import { FacultyGate } from '@/components/faculty/FacultyGate';
import { useClassroomTheme } from '@/hooks/useClassroomTheme';
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
  const { theme, themeId, setThemeId } = useClassroomTheme();

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
        style={[styles.screen, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl tintColor={theme.primary} refreshing={refreshing} onRefresh={refresh} />}
      >
        <FacultyClassroomHeader
          classroomId={classroomId}
          classroomName={className}
          kicker="TERM-AWARE GRADEBOOK"
          title="Final Grade Engine"
          subtitle="A release desk for Prelim, Midterm, Semifinals and Finals. Released item grades flow through configured weights and the 50-base equivalent formula before faculty release or lock."
          icon="calculator-variant-outline"
          theme={theme}
          themeId={themeId}
          onThemeChange={setThemeId}
        />

        <View style={[styles.readiness, { backgroundColor: theme.surfaceRaised, borderColor: setupReady ? theme.success : theme.warning }]}>
          <View style={styles.readinessHeader}>
            <View style={[styles.readinessIcon, { backgroundColor: setupReady ? `${theme.success}20` : `${theme.warning}20` }]}>
              <MaterialCommunityIcons
                name={setupReady ? 'check-decagram-outline' : 'alert-outline'}
                size={26}
                color={setupReady ? theme.success : theme.warning}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.readinessKicker, { color: setupReady ? theme.success : theme.warning }]}>STRUCTURE CHECK</Text>
              <Text style={[styles.readinessTitle, { color: theme.ink }]}>{setupReady ? 'Grading structure ready' : 'Grading structure needs adjustment'}</Text>
              <Text style={[styles.readinessText, { color: theme.muted }]}>Term total {termWeightTotal.toFixed(1)}% · Passing grade {passingPercent.toFixed(1)}%</Text>
            </View>
          </View>

          <View style={styles.termRail}>
            {terms.map((term, index) => {
              const ok = Math.abs(categoryTotals[term.key] - 100) < 0.0001;
              const edge = index % 2 === 0 ? theme.primary : theme.secondary;
              return (
                <View key={term.key} style={[styles.termTicket, { backgroundColor: theme.background, borderColor: theme.border }, index % 2 === 1 && styles.termTicketDrop]}>
                  <View style={[styles.termEdge, { backgroundColor: edge }]} />
                  <Text style={[styles.termName, { color: theme.ink }]}>{term.label}</Text>
                  <Text style={[styles.termWeight, { color: edge }]}>{term.weight_percent.toFixed(1)}%</Text>
                  <Text style={[styles.termCaption, { color: theme.muted }]}>of final grade</Text>
                  <View style={[styles.categoryStamp, { backgroundColor: ok ? `${theme.success}18` : `${theme.warning}18` }]}>
                    <Text style={[styles.categoryStampText, { color: ok ? theme.success : theme.warning }]}>Categories {categoryTotals[term.key].toFixed(1)}%</Text>
                  </View>
                </View>
              );
            })}
          </View>

          <Pressable
            style={[styles.setupButton, { backgroundColor: theme.chip }]}
            onPress={() => router.push({ pathname: '/profile/buklod-faculty-grading-setup' as any, params: { classroomId, id: classroomId, name: className } })}
          >
            <MaterialCommunityIcons name="tune-variant" size={18} color={theme.ink} />
            <Text style={[styles.setupText, { color: theme.ink }]}>Edit grading setup</Text>
            <MaterialCommunityIcons name="arrow-top-right" size={15} color={theme.muted} />
          </Pressable>
        </View>

        <View style={[styles.formulaCard, { backgroundColor: theme.drawer }]}>
          <View style={[styles.formulaBadge, { backgroundColor: theme.accent }]}>
            <MaterialCommunityIcons name="function-variant" size={20} color={theme.drawer} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.formulaLabel, { color: theme.accent }]}>EQUIVALENT FORMULA</Text>
            <Text style={[styles.formula, { color: theme.drawerInk }]}>50 + (Raw ÷ Highest Possible × 50)</Text>
            <Text style={[styles.formulaHint, { color: `${theme.drawerInk}B7` }]}>Category weights apply inside each term; term weights then compose the overall final grade.</Text>
          </View>
        </View>

        <View style={styles.toolbar}>
          <Pressable
            style={[styles.toolbarButton, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}
            onPress={() => router.push({ pathname: '/profile/buklod-faculty-class' as any, params: { id: classroomId, classroomId, name: className } })}
          >
            <MaterialCommunityIcons name="format-list-numbered" size={19} color={theme.primary} />
            <Text style={[styles.toolbarText, { color: theme.ink }]}>Item-level grades</Text>
          </Pressable>
          <Pressable
            style={[styles.toolbarButton, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}
            onPress={() => router.push({ pathname: '/profile/buklod-faculty-progress' as any, params: { id: classroomId, classroomId, name: className } })}
          >
            <MaterialCommunityIcons name="chart-timeline-variant" size={19} color={theme.secondary} />
            <Text style={[styles.toolbarText, { color: theme.ink }]}>Progress</Text>
          </Pressable>
        </View>

        <View style={styles.sectionHead}>
          <Text style={[styles.sectionKicker, { color: theme.secondary }]}>RELEASE DESK</Text>
          <Text style={[styles.sectionTitle, { color: theme.ink }]}>Student final grades</Text>
        </View>

        {students.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
            <MaterialCommunityIcons name="account-school-outline" size={30} color={theme.muted} />
            <Text style={[styles.emptyTitle, { color: theme.ink }]}>No active students yet</Text>
            <Text style={[styles.emptyText, { color: theme.muted }]}>Enroll students first. Released Quiz, Attendance, activity and manual grades will feed this gradebook.</Text>
          </View>
        ) : (
          students.map((student, index) => {
            const busy = busyId === student.student_user_id;
            const status = student.final_status ?? 'NOT COMPUTED';
            const current = student.current_percent == null ? null : n(student.current_percent);
            const finalGrade = student.final_grade == null ? null : n(student.final_grade);
            const passed = (finalGrade ?? current ?? 0) >= passingPercent;
            const edge = index % 3 === 0 ? theme.primary : index % 3 === 1 ? theme.secondary : theme.accent;

            return (
              <View key={student.student_user_id} style={[styles.studentCard, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }, index % 2 === 1 && styles.studentCardInset]}>
                <View style={[styles.studentEdge, { backgroundColor: edge }]} />
                <View style={styles.studentHeader}>
                  <View style={[styles.studentAvatar, { backgroundColor: `${edge}1A` }]}>
                    <Text style={[styles.studentAvatarText, { color: edge }]}>{student.display_name?.trim()?.[0]?.toUpperCase() || 'S'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.studentName, { color: theme.ink }]}>{student.display_name}</Text>
                    <Text style={[styles.meta, { color: theme.muted }]}>Released coverage {n(student.covered_weight).toFixed(1)}%</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: theme.chip }]}>
                    <Text style={[styles.statusText, { color: theme.ink }]}>{status}</Text>
                  </View>
                </View>

                <View style={styles.metrics}>
                  <View style={[styles.metricMain, { backgroundColor: theme.background }]}>
                    <Text style={[styles.metricKicker, { color: theme.muted }]}>CURRENT</Text>
                    <Text style={[styles.metricBig, { color: theme.ink }]}>{current == null ? '—' : current.toFixed(2)}</Text>
                  </View>
                  <View style={styles.metricStack}>
                    <View style={[styles.metricSmall, { backgroundColor: theme.chip }]}>
                      <Text style={[styles.metricSmallValue, { color: theme.ink }]}>{n(student.weighted_points).toFixed(2)}</Text>
                      <Text style={[styles.metricSmallLabel, { color: theme.muted }]}>weighted</Text>
                    </View>
                    <View style={[styles.metricSmall, { backgroundColor: finalGrade == null ? theme.chip : passed ? `${theme.success}1D` : `${theme.danger}1D` }]}>
                      <Text style={[styles.metricSmallValue, { color: finalGrade == null ? theme.ink : passed ? theme.success : theme.danger }]}>{finalGrade == null ? '—' : finalGrade.toFixed(2)}</Text>
                      <Text style={[styles.metricSmallLabel, { color: theme.muted }]}>final</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.progressRow}>
                  <Text style={[styles.readyText, { color: student.ready_for_final ? theme.success : theme.warning }]}>
                    {student.ready_for_final
                      ? 'Ready for final computation'
                      : `${student.represented_categories}/${student.positive_categories} weighted categories represented`}
                  </Text>
                  {(current != null || finalGrade != null) && (
                    <View style={[styles.passStamp, { backgroundColor: passed ? `${theme.success}18` : `${theme.danger}18` }]}>
                      <Text style={[styles.passText, { color: passed ? theme.success : theme.danger }]}>{passed ? 'PASSING' : 'BELOW PASSING'}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.actions}>
                  <Pressable
                    disabled={busy || !setupReady || !student.ready_for_final || status === 'RELEASED' || status === 'LOCKED'}
                    style={[styles.actionPrimary, { backgroundColor: theme.primary }, (busy || !setupReady || !student.ready_for_final || status === 'RELEASED' || status === 'LOCKED') && styles.disabled]}
                    onPress={() => runAction(student.student_user_id, 'compute')}
                  >
                    <Text style={[styles.actionPrimaryText, { color: theme.primaryInk }]}>Compute</Text>
                  </Pressable>
                  <Pressable
                    disabled={busy || !['DRAFT', 'REVIEWED'].includes(status)}
                    style={[styles.action, { backgroundColor: theme.chip }, (busy || !['DRAFT', 'REVIEWED'].includes(status)) && styles.disabled]}
                    onPress={() => runAction(student.student_user_id, 'release')}
                  >
                    <Text style={[styles.actionText, { color: theme.ink }]}>Release</Text>
                  </Pressable>
                  <Pressable
                    disabled={busy || status !== 'RELEASED'}
                    style={[styles.action, { backgroundColor: theme.chip }, (busy || status !== 'RELEASED') && styles.disabled]}
                    onPress={() => runAction(student.student_user_id, 'lock')}
                  >
                    <Text style={[styles.actionText, { color: theme.ink }]}>Lock</Text>
                  </Pressable>
                  <Pressable
                    disabled={busy || !['RELEASED', 'LOCKED'].includes(status)}
                    style={[styles.action, { backgroundColor: theme.chip }, (busy || !['RELEASED', 'LOCKED'].includes(status)) && styles.disabled]}
                    onPress={() => runAction(student.student_user_id, 'reopen')}
                  >
                    <Text style={[styles.actionText, { color: theme.ink }]}>Reopen</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}

        <View style={[styles.note, { backgroundColor: theme.drawer }]}>
          <MaterialCommunityIcons name="shield-check-outline" size={21} color={theme.accent} />
          <Text style={[styles.noteText, { color: `${theme.drawerInk}D0` }]}>Final grades are faculty-controlled snapshots. Grading rules cannot be edited while a final grade is released or locked; reopen it first so every change remains auditable.</Text>
        </View>
      </ScrollView>
    </FacultyGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 38, paddingBottom: 76 },
  readiness: { borderWidth: 1, borderRadius: 20, padding: 14, marginBottom: 13 },
  readinessHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  readinessIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  readinessKicker: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  readinessTitle: { fontWeight: '900', fontSize: 15, marginTop: 2 },
  readinessText: { fontSize: 10, marginTop: 3 },
  termRail: { flexDirection: 'row', gap: 7, marginTop: 14, alignItems: 'flex-start' },
  termTicket: { flex: 1, minHeight: 126, borderWidth: 1, borderRadius: 15, padding: 10, overflow: 'hidden' },
  termTicketDrop: { marginTop: 12 },
  termEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  termName: { fontSize: 11, fontWeight: '900', marginTop: 4 },
  termWeight: { fontSize: 20, fontWeight: '900', marginTop: 8 },
  termCaption: { fontSize: 8, marginTop: 1 },
  categoryStamp: { alignSelf: 'flex-start', borderRadius: 7, paddingHorizontal: 5, paddingVertical: 4, marginTop: 'auto' },
  categoryStampText: { fontSize: 7, fontWeight: '900' },
  setupButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, paddingVertical: 10, marginTop: 13 },
  setupText: { fontSize: 11, fontWeight: '900' },
  formulaCard: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 19, padding: 15, marginBottom: 12 },
  formulaBadge: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }] },
  formulaLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  formula: { fontWeight: '900', fontSize: 15, marginTop: 3 },
  formulaHint: { fontSize: 9, lineHeight: 13, marginTop: 3 },
  toolbar: { flexDirection: 'row', gap: 8, marginBottom: 22 },
  toolbarButton: { flex: 1, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', borderRadius: 13, paddingVertical: 11, borderWidth: 1 },
  toolbarText: { fontWeight: '900', fontSize: 10 },
  sectionHead: { marginBottom: 10 },
  sectionKicker: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  sectionTitle: { fontWeight: '900', fontSize: 21, marginTop: 2 },
  empty: { borderWidth: 1, borderRadius: 17, padding: 18, alignItems: 'center' },
  emptyTitle: { fontWeight: '900', marginTop: 7 },
  emptyText: { textAlign: 'center', lineHeight: 17, fontSize: 10, marginTop: 4 },
  studentCard: { borderWidth: 1, borderRadius: 19, padding: 14, marginBottom: 10, overflow: 'hidden' },
  studentCardInset: { marginLeft: 14 },
  studentEdge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  studentHeader: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  studentAvatar: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  studentAvatarText: { fontSize: 16, fontWeight: '900' },
  studentName: { fontWeight: '900', fontSize: 14 },
  meta: { marginTop: 2, fontSize: 10 },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  statusText: { fontSize: 8, fontWeight: '900' },
  metrics: { flexDirection: 'row', gap: 8, marginTop: 13 },
  metricMain: { flex: 1.25, minHeight: 93, borderRadius: 15, padding: 11, justifyContent: 'flex-end' },
  metricKicker: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  metricBig: { fontSize: 28, fontWeight: '900', marginTop: 2 },
  metricStack: { flex: 1, gap: 7 },
  metricSmall: { flex: 1, borderRadius: 13, paddingHorizontal: 10, justifyContent: 'center' },
  metricSmallValue: { fontSize: 15, fontWeight: '900' },
  metricSmallLabel: { fontSize: 8, marginTop: 1 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginTop: 11 },
  readyText: { fontWeight: '800', fontSize: 9, flex: 1 },
  passStamp: { borderRadius: 7, paddingHorizontal: 6, paddingVertical: 4 },
  passText: { fontWeight: '900', fontSize: 7, letterSpacing: 0.5 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 11 },
  actionPrimary: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  actionPrimaryText: { fontWeight: '900', fontSize: 10 },
  action: { borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9 },
  actionText: { fontWeight: '900', fontSize: 10 },
  disabled: { opacity: 0.34 },
  note: { flexDirection: 'row', gap: 10, borderRadius: 17, padding: 14, marginTop: 10 },
  noteText: { flex: 1, lineHeight: 16, fontSize: 10 },
});