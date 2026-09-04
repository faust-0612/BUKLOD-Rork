import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useLocalSearchParams } from 'expo-router';

import { FacultyClassroomHeader } from '@/components/classroom/FacultyClassroomHeader';
import { FacultyGate } from '@/components/faculty/FacultyGate';
import { useClassroomTheme } from '@/hooks/useClassroomTheme';
import {
  exportQuizDedicatedReleasedResults,
  getQuizDedicatedExamCatalog,
  type QuizDedicatedExam,
} from '@/lib/education/quizDedicatedGradebook';
import { supabase } from '@/lib/supabase';

type TermKey = 'PRELIM' | 'MIDTERM' | 'SEMIFINALS' | 'FINALS';
type Category = {
  id: string;
  term_key: TermKey;
  name: string;
  category_type: string;
  weight_percent: number;
};
type SyncResult = {
  grade_item_id: string;
  exam_title: string;
  strategy: 'LATEST' | 'HIGHEST';
  term_key: TermKey;
  category_name: string;
  released_students: number;
  active_enrolled_students: number;
  finalized_students_blocked: number;
  synced: number;
  not_in_faculty_roster: number;
  points_possible: number;
};

const TERMS: { key: TermKey; label: string }[] = [
  { key: 'PRELIM', label: 'Prelim' },
  { key: 'MIDTERM', label: 'Midterm' },
  { key: 'SEMIFINALS', label: 'Semifinals' },
  { key: 'FINALS', label: 'Finals' },
];

export default function BuklodFacultyQuizDedicatedScreen() {
  const params = useLocalSearchParams<{ id?: string; classroomId?: string; name?: string }>();
  const classroomId = String(params.classroomId ?? params.id ?? '');
  const classroomName = String(params.name ?? 'Classroom');
  const { theme, themeId, setThemeId } = useClassroomTheme();

  const [categories, setCategories] = useState<Category[]>([]);
  const [exams, setExams] = useState<QuizDedicatedExam[]>([]);
  const [termKey, setTermKey] = useState<TermKey>('PRELIM');
  const [categoryId, setCategoryId] = useState('');
  const [examId, setExamId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [strategy, setStrategy] = useState<'LATEST' | 'HIGHEST'>('LATEST');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);

  const selectedExam = useMemo(
    () => exams.find(item => item.id === examId) ?? null,
    [examId, exams]
  );
  const termCategories = useMemo(
    () => categories.filter(item => item.term_key === termKey),
    [categories, termKey]
  );

  const chooseDefaultCategory = useCallback((rows: Category[], term: TermKey) => {
    const inside = rows.filter(row => row.term_key === term);
    return (
      inside.find(row => row.category_type === 'QUIZ')?.id ||
      inside.find(row => row.category_type === 'EXAM')?.id ||
      inside[0]?.id ||
      ''
    );
  }, []);

  const load = useCallback(async () => {
    if (!classroomId) return;
    const [categoryRes, catalog] = await Promise.all([
      supabase
        .from('buklod_education_grade_categories')
        .select('id,term_key,name,category_type,weight_percent')
        .eq('classroom_id', classroomId)
        .order('created_at', { ascending: true }),
      getQuizDedicatedExamCatalog(),
    ]);
    if (categoryRes.error) throw categoryRes.error;

    const nextCategories = (categoryRes.data ?? []) as Category[];
    setCategories(nextCategories);
    setExams(catalog);
    setCategoryId(current =>
      current && nextCategories.some(row => row.id === current)
        ? current
        : chooseDefaultCategory(nextCategories, termKey)
    );
    setExamId(current =>
      current && catalog.some(row => row.id === current) ? current : catalog[0]?.id || ''
    );
  }, [chooseDefaultCategory, classroomId, termKey]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch(error =>
        Alert.alert(
          'Quiz Dedicated',
          error instanceof Error ? error.message : 'Could not load Quiz Dedicated exams.'
        )
      )
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    setCategoryId(current => {
      if (current && categories.some(row => row.id === current && row.term_key === termKey)) {
        return current;
      }
      return chooseDefaultCategory(categories, termKey);
    });
  }, [categories, chooseDefaultCategory, termKey]);

  useEffect(() => {
    if (!selectedExam?.sections?.some(section => section.id === sectionId)) setSectionId('');
  }, [sectionId, selectedExam]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (error) {
      Alert.alert('Quiz Dedicated', error instanceof Error ? error.message : 'Refresh failed.');
    } finally {
      setRefreshing(false);
    }
  };

  const sync = async () => {
    if (!examId) return Alert.alert('Quiz Dedicated', 'Select an exam first.');
    if (!categoryId) return Alert.alert('Gradebook', 'Select a grading category first.');

    setBusy(true);
    try {
      const exported = await exportQuizDedicatedReleasedResults(examId, sectionId || null);
      if (!exported.released_rows.length) {
        return Alert.alert(
          'No released results',
          sectionId
            ? 'This exam section has no officially released Quiz results yet.'
            : 'This exam has no officially released Quiz results yet.'
        );
      }

      const { data, error } = await supabase.rpc('buklod_education_import_quiz_scores_v4', {
        p_classroom_id: classroomId,
        p_exam_id: exported.exam_id,
        p_section_id: exported.section_id,
        p_exam_title: exported.exam_title,
        p_points_possible: exported.points_possible,
        p_category_id: categoryId,
        p_strategy: strategy,
        p_rows: exported.released_rows,
      });
      if (error) throw error;

      const result = data as SyncResult;
      setLastResult(result);
      Alert.alert(
        'Quiz Gradebook Synced',
        `${result.synced} student grade(s) synchronized to ${result.term_key} · ${result.category_name}.` +
          (result.finalized_students_blocked
            ? ` ${result.finalized_students_blocked} finalized student(s) were protected; reopen their final grade before resyncing.`
            : '') +
          (result.not_in_faculty_roster
            ? ` ${result.not_in_faculty_roster} released Quiz student(s) are not in this Classroom roster.`
            : '')
      );
    } catch (error) {
      Alert.alert(
        'Quiz Gradebook Sync',
        error instanceof Error ? error.message : 'Could not synchronize released Quiz results.'
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <FacultyGate>
        <View style={[styles.loading, { backgroundColor: theme.background }]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingTitle, { color: theme.ink }]}>Opening Quiz bridge</Text>
          <Text style={[styles.helper, { color: theme.muted }]}>Reading your owned exams from BUKLOD Quiz Dedicated…</Text>
        </View>
      </FacultyGate>
    );
  }

  return (
    <FacultyGate>
      <ScrollView
        style={[styles.screen, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />}
      >
        <FacultyClassroomHeader
          classroomId={classroomId}
          classroomName={classroomName}
          kicker="QUIZ DEDICATED → CLASSROOM"
          title="Quiz Gradebook Sync"
          subtitle="Bring only officially released Quiz Dedicated scores into this Classroom. Student IDs stay authoritative; passwords, attempts, answers and exam records are never copied into the Classroom database."
          icon="database-sync-outline"
          theme={theme}
          themeId={themeId}
          onThemeChange={setThemeId}
        />

        <View style={[styles.shield, { backgroundColor: theme.drawer }]}>
          <MaterialCommunityIcons name="shield-check-outline" size={25} color={theme.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.shieldTitle, { color: theme.drawerInk }]}>One identity, separate authorities</Text>
            <Text style={[styles.shieldText, { color: `${theme.drawerInk}B8` }]}>
              Main BUKLOD session verifies faculty ownership. Quiz Dedicated remains the exam source of truth; Classroom stores only the released gradebook projection with source reference and audit trail.
            </Text>
          </View>
        </View>

        <Text style={[styles.kicker, { color: theme.secondary }]}>STEP 01</Text>
        <Text style={[styles.sectionTitle, { color: theme.ink }]}>Choose grading period</Text>
        <View style={styles.wrapRow}>
          {TERMS.map(term => {
            const selected = termKey === term.key;
            return (
              <Pressable
                key={term.key}
                onPress={() => setTermKey(term.key)}
                style={[
                  styles.pill,
                  {
                    backgroundColor: selected ? theme.primary : theme.surfaceRaised,
                    borderColor: selected ? theme.primary : theme.border,
                  },
                ]}
              >
                <Text style={[styles.pillText, { color: selected ? theme.primaryInk : theme.ink }]}>{term.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.kicker, { color: theme.secondary }]}>STEP 02</Text>
        <Text style={[styles.sectionTitle, { color: theme.ink }]}>Choose category</Text>
        {termCategories.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
            <Text style={[styles.helper, { color: theme.muted }]}>No categories exist for {termKey}. Fix Grading Setup first.</Text>
          </View>
        ) : (
          <View style={styles.cardList}>
            {termCategories.map(category => {
              const selected = category.id === categoryId;
              return (
                <Pressable
                  key={category.id}
                  onPress={() => setCategoryId(category.id)}
                  style={[
                    styles.optionCard,
                    {
                      backgroundColor: selected ? theme.chip : theme.surfaceRaised,
                      borderColor: selected ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={selected ? 'radiobox-marked' : 'radiobox-blank'}
                    size={21}
                    color={selected ? theme.primary : theme.muted}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionTitle, { color: theme.ink }]}>{category.name}</Text>
                    <Text style={[styles.helper, { color: theme.muted }]}>{category.weight_percent}% within {category.term_key}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <Text style={[styles.kicker, { color: theme.secondary }]}>STEP 03</Text>
        <Text style={[styles.sectionTitle, { color: theme.ink }]}>Choose Dedicated exam</Text>
        {exams.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
            <Text style={[styles.helper, { color: theme.muted }]}>No Quiz Dedicated exam owned by this faculty account.</Text>
          </View>
        ) : (
          <View style={styles.cardList}>
            {exams.map(exam => {
              const selected = exam.id === examId;
              return (
                <Pressable
                  key={exam.id}
                  onPress={() => {
                    setExamId(exam.id);
                    setSectionId('');
                  }}
                  style={[
                    styles.optionCard,
                    {
                      backgroundColor: selected ? theme.chip : theme.surfaceRaised,
                      borderColor: selected ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <MaterialCommunityIcons name="file-document-check-outline" size={22} color={selected ? theme.primary : theme.muted} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionTitle, { color: theme.ink }]}>{exam.title}</Text>
                    <Text style={[styles.helper, { color: theme.muted }]}>{exam.status} · {Number(exam.total_points || 0)} pts · {exam.sections?.length || 0} section(s)</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {!!selectedExam && (
          <>
            <Text style={[styles.kicker, { color: theme.secondary }]}>STEP 04</Text>
            <Text style={[styles.sectionTitle, { color: theme.ink }]}>Section scope</Text>
            <View style={styles.wrapRow}>
              <Pressable
                onPress={() => setSectionId('')}
                style={[styles.pill, { backgroundColor: !sectionId ? theme.primary : theme.surfaceRaised, borderColor: !sectionId ? theme.primary : theme.border }]}
              >
                <Text style={[styles.pillText, { color: !sectionId ? theme.primaryInk : theme.ink }]}>All sections</Text>
              </Pressable>
              {(selectedExam.sections ?? []).map(section => {
                const selected = section.id === sectionId;
                return (
                  <Pressable
                    key={section.id}
                    onPress={() => setSectionId(section.id)}
                    style={[styles.pill, { backgroundColor: selected ? theme.primary : theme.surfaceRaised, borderColor: selected ? theme.primary : theme.border }]}
                  >
                    <Text style={[styles.pillText, { color: selected ? theme.primaryInk : theme.ink }]}>{section.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        <Text style={[styles.kicker, { color: theme.secondary }]}>STEP 05</Text>
        <Text style={[styles.sectionTitle, { color: theme.ink }]}>Retake rule</Text>
        <View style={styles.strategyRow}>
          {(['LATEST', 'HIGHEST'] as const).map(value => {
            const selected = strategy === value;
            return (
              <Pressable
                key={value}
                onPress={() => setStrategy(value)}
                style={[styles.strategy, { backgroundColor: selected ? theme.secondary : theme.surfaceRaised, borderColor: selected ? theme.secondary : theme.border }]}
              >
                <Text style={[styles.strategyTitle, { color: selected ? '#fff' : theme.ink }]}>{value}</Text>
                <Text style={[styles.strategyText, { color: selected ? '#FFFFFFCC' : theme.muted }]}>
                  {value === 'LATEST' ? 'Use the latest officially released attempt.' : 'Use the highest released percentage.'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          disabled={busy || !examId || !categoryId}
          onPress={sync}
          style={[
            styles.syncButton,
            { backgroundColor: theme.primary },
            (busy || !examId || !categoryId) && styles.disabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={theme.primaryInk} />
          ) : (
            <MaterialCommunityIcons name="database-arrow-left-outline" size={22} color={theme.primaryInk} />
          )}
          <Text style={[styles.syncText, { color: theme.primaryInk }]}>{busy ? 'Synchronizing…' : 'Sync Released Quiz Results'}</Text>
        </Pressable>

        {!!lastResult && (
          <View style={[styles.result, { backgroundColor: theme.surfaceRaised, borderColor: theme.success }]}>
            <MaterialCommunityIcons name="check-decagram-outline" size={25} color={theme.success} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.resultTitle, { color: theme.ink }]}>Last sync complete</Text>
              <Text style={[styles.helper, { color: theme.muted }]}>Synced {lastResult.synced} · Roster matched {lastResult.active_enrolled_students} · Finalized protected {lastResult.finalized_students_blocked} · Outside roster {lastResult.not_in_faculty_roster}</Text>
            </View>
          </View>
        )}

        <View style={[styles.note, { borderColor: theme.border }]}>
          <Text style={[styles.noteTitle, { color: theme.ink }]}>Safety behavior</Text>
          <Text style={[styles.helper, { color: theme.muted }]}>• Only RELEASED Quiz Dedicated attempts can enter the Classroom gradebook.</Text>
          <Text style={[styles.helper, { color: theme.muted }]}>• Individual LOCKED grades are never overwritten.</Text>
          <Text style={[styles.helper, { color: theme.muted }]}>• Students with RELEASED/LOCKED final grades are protected until faculty explicitly reopens the final grade.</Text>
          <Text style={[styles.helper, { color: theme.muted }]}>• Quiz answers, violations, attempts and passwords stay in Quiz Dedicated.</Text>
        </View>
      </ScrollView>
    </FacultyGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 18, paddingTop: 28, paddingBottom: 70 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  loadingTitle: { marginTop: 14, fontSize: 18, fontWeight: '900' },
  shield: { flexDirection: 'row', gap: 12, borderRadius: 18, padding: 15, marginBottom: 24 },
  shieldTitle: { fontWeight: '900', fontSize: 15 },
  shieldText: { marginTop: 4, lineHeight: 18, fontSize: 12 },
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginTop: 18, marginBottom: 3 },
  sectionTitle: { fontSize: 18, fontWeight: '900', marginBottom: 10 },
  helper: { fontSize: 12, lineHeight: 17 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9 },
  pillText: { fontSize: 12, fontWeight: '900' },
  cardList: { gap: 8, marginBottom: 4 },
  optionCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 13 },
  optionTitle: { fontSize: 14, fontWeight: '900' },
  empty: { borderWidth: 1, borderRadius: 14, padding: 14 },
  strategyRow: { flexDirection: 'row', gap: 9 },
  strategy: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 13, minHeight: 92 },
  strategyTitle: { fontWeight: '900', fontSize: 14 },
  strategyText: { marginTop: 5, fontSize: 11, lineHeight: 16 },
  syncButton: { marginTop: 24, borderRadius: 15, minHeight: 54, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  syncText: { fontWeight: '900', fontSize: 14 },
  disabled: { opacity: 0.5 },
  result: { marginTop: 14, borderWidth: 1, borderRadius: 15, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  resultTitle: { fontWeight: '900', fontSize: 14, marginBottom: 3 },
  note: { marginTop: 18, borderTopWidth: 1, paddingTop: 14, gap: 3 },
  noteTitle: { fontWeight: '900', marginBottom: 4 },
});
