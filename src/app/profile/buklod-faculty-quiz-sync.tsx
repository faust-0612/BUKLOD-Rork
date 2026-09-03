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

type ReleasedQuizResult = {
  attempt_id: string;
  exam_id: string;
  exam_title: string;
  section_id: string | null;
  section_name: string | null;
  student_user_id: string;
  student_name: string;
  student_no: string | null;
  attempt_no: number;
  total_score: number | null;
  max_score: number | null;
  score_percent: number | null;
  released_at: string;
};

type Category = {
  id: string;
  name: string;
  weight_percent: number;
};

type QuizGroup = {
  key: string;
  exam_id: string;
  exam_title: string;
  section_id: string | null;
  section_name: string | null;
  releasedStudents: number;
  releasedAttempts: number;
  latestRelease: string | null;
};

type SyncResult = {
  exam_title?: string;
  synced?: number;
  released_students?: number;
  active_enrolled_students?: number;
  not_in_faculty_roster?: number;
  strategy?: string;
};

function formatWhen(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

export default function BuklodFacultyQuizSyncScreen() {
  const params = useLocalSearchParams<{ classroomId?: string; id?: string; name?: string }>();
  const classroomId = String(params.classroomId ?? params.id ?? '');
  const className = String(params.name ?? 'Class');

  const [rows, setRows] = useState<ReleasedQuizResult[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [strategy, setStrategy] = useState<'LATEST' | 'HIGHEST'>('LATEST');
  const [refreshing, setRefreshing] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const groups = useMemo<QuizGroup[]>(() => {
    const map = new Map<string, ReleasedQuizResult[]>();
    for (const row of rows) {
      const key = `${row.exam_id}:${row.section_id ?? 'ALL'}`;
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }

    return Array.from(map.entries())
      .map(([key, list]) => {
        const first = list[0];
        const students = new Set(list.map(item => item.student_user_id));
        const latest = list
          .map(item => item.released_at)
          .filter(Boolean)
          .sort()
          .at(-1) ?? null;
        return {
          key,
          exam_id: first.exam_id,
          exam_title: first.exam_title,
          section_id: first.section_id,
          section_name: first.section_name,
          releasedStudents: students.size,
          releasedAttempts: list.length,
          latestRelease: latest,
        };
      })
      .sort((a, b) => String(b.latestRelease ?? '').localeCompare(String(a.latestRelease ?? '')));
  }, [rows]);

  const load = useCallback(async () => {
    if (!classroomId) return;
    const [quizRes, categoryRes] = await Promise.all([
      supabase.rpc('buklod_quiz_faculty_released_results_v1', { p_limit: 1000 }),
      supabase
        .from('buklod_education_grade_categories')
        .select('id,name,weight_percent')
        .eq('classroom_id', classroomId)
        .order('created_at', { ascending: true }),
    ]);

    if (quizRes.error) Alert.alert('BUKLOD Quiz Sync', quizRes.error.message);
    if (categoryRes.error) Alert.alert('Grade Categories', categoryRes.error.message);

    const nextCategories = (categoryRes.data ?? []) as Category[];
    setRows((quizRes.data ?? []) as ReleasedQuizResult[]);
    setCategories(nextCategories);
    setSelectedCategoryId(current =>
      current && nextCategories.some(item => item.id === current)
        ? current
        : nextCategories[0]?.id ?? ''
    );
  }, [classroomId]);

  useEffect(() => {
    void load();
  }, [load]);

  const syncGroup = async (group: QuizGroup, silent = false) => {
    if (!selectedCategoryId) {
      if (!silent) {
        Alert.alert(
          'Grade Category Required',
          'Create/select a Faculty grade category first so the Quiz score contributes to the correct final-grade weight.'
        );
      }
      return null;
    }

    setBusyKey(group.key);
    try {
      const { data, error } = await supabase.rpc('buklod_education_sync_quiz_exam_to_gradebook_v2', {
        p_classroom_id: classroomId,
        p_exam_id: group.exam_id,
        p_section_id: group.section_id,
        p_category_id: selectedCategoryId,
        p_strategy: strategy,
      });
      if (error) throw error;
      const result = (data ?? {}) as SyncResult;
      if (!silent) {
        Alert.alert(
          'Quiz Scores Synced',
          `${result.exam_title ?? group.exam_title}\n\nSynced to Faculty gradebook: ${Number(result.synced ?? 0)}\nReleased students: ${Number(result.released_students ?? 0)}\nNot in Faculty roster: ${Number(result.not_in_faculty_roster ?? 0)}\nAttempt rule: ${result.strategy ?? strategy}`
        );
      }
      return result;
    } catch (error: any) {
      if (!silent) Alert.alert('BUKLOD Quiz Sync', String(error?.message ?? error));
      return { error: String(error?.message ?? error) } as any;
    } finally {
      setBusyKey(null);
    }
  };

  const syncAll = () => {
    if (groups.length === 0) return;
    if (!selectedCategoryId) {
      Alert.alert('Grade Category Required', 'Select a Faculty grade category before syncing.');
      return;
    }

    const category = categories.find(item => item.id === selectedCategoryId);
    Alert.alert(
      'Sync All Released Quiz Results',
      `Sync ${groups.length} released exam/section set(s) to "${category?.name ?? 'selected category'}" using the ${strategy} attempt rule? Existing linked items are updated instead of duplicated.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sync All',
          onPress: async () => {
            setBusyKey('ALL');
            let synced = 0;
            let failed = 0;
            let outOfRoster = 0;
            for (const group of groups) {
              const result: any = await syncGroup(group, true);
              if (result?.error) failed += 1;
              else {
                synced += Number(result?.synced ?? 0);
                outOfRoster += Number(result?.not_in_faculty_roster ?? 0);
              }
            }
            setBusyKey(null);
            Alert.alert(
              'Quiz Sync Complete',
              `Grade rows synchronized: ${synced}\nExam/section failures: ${failed}\nReleased students not in Faculty roster: ${outOfRoster}`
            );
          },
        },
      ]
    );
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
          <Text style={styles.backText}>{className}</Text>
        </Pressable>

        <Text style={styles.eyebrow}>BUKLOD QUIZ → FACULTY</Text>
        <Text style={styles.title}>Released Score Sync</Text>
        <Text style={styles.subtitle}>
          Only officially RELEASED BUKLOD Quiz results are eligible. Draft, live, pending-review, and unreleased attempts never enter the Faculty gradebook.
        </Text>

        <View style={styles.notice}>
          <MaterialCommunityIcons name="shield-check-outline" size={22} color="#1f7a3f" />
          <Text style={styles.noticeText}>
            The Faculty classroom roster is authoritative. A released Quiz student who is not enrolled in this Faculty class is reported but not silently added or graded.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Target Grade Category</Text>
        {categories.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No grading categories yet</Text>
            <Text style={styles.emptyText}>Set grade categories and weights before syncing Quiz scores.</Text>
            <Pressable
              style={styles.primary}
              onPress={() =>
                router.push({
                  pathname: '/profile/buklod-faculty-final-grades' as any,
                  params: { id: classroomId, name: className },
                })
              }
            >
              <Text style={styles.primaryText}>Open Grading System</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {categories.map(item => {
              const selected = item.id === selectedCategoryId;
              return (
                <Pressable
                  key={item.id}
                  style={[styles.chip, selected && styles.chipActive]}
                  onPress={() => setSelectedCategoryId(item.id)}
                >
                  <Text style={[styles.chipTitle, selected && styles.chipTitleActive]}>{item.name}</Text>
                  <Text style={[styles.chipMeta, selected && styles.chipMetaActive]}>{Number(item.weight_percent).toFixed(1)}%</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <Text style={styles.sectionTitle}>Multiple Attempt Rule</Text>
        <View style={styles.strategyRow}>
          {(['LATEST', 'HIGHEST'] as const).map(item => (
            <Pressable
              key={item}
              onPress={() => setStrategy(item)}
              style={[styles.strategy, strategy === item && styles.strategyActive]}
            >
              <Text style={[styles.strategyText, strategy === item && styles.strategyTextActive]}>
                {item === 'LATEST' ? 'Latest Released Attempt' : 'Highest Released Attempt'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.primaryFlex} onPress={syncAll} disabled={busyKey != null || groups.length === 0}>
            <MaterialCommunityIcons name="sync" size={19} color="#fff" />
            <Text style={styles.primaryText}>{busyKey === 'ALL' ? 'Syncing…' : 'Sync All Released'}</Text>
          </Pressable>
          <Pressable style={styles.secondaryFlex} onPress={() => void Linking.openURL('https://buklod-quiz.expo.app/records')}>
            <MaterialCommunityIcons name="open-in-new" size={18} color="#1f7a3f" />
            <Text style={styles.secondaryText}>Quiz Records</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Released Exam Sets ({groups.length})</Text>
        {groups.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No released Quiz results</Text>
            <Text style={styles.emptyText}>After the examiner officially releases a result in BUKLOD Quiz, it will be available for Faculty gradebook sync.</Text>
          </View>
        ) : (
          groups.map(group => (
            <View key={group.key} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.exam}>{group.exam_title}</Text>
                  <Text style={styles.meta}>{group.section_name || 'All / no Quiz section'}</Text>
                </View>
                <View style={styles.countBox}>
                  <Text style={styles.countValue}>{group.releasedStudents}</Text>
                  <Text style={styles.countLabel}>students</Text>
                </View>
              </View>
              <Text style={styles.meta}>Released attempts: {group.releasedAttempts}</Text>
              <Text style={styles.meta}>Latest release: {formatWhen(group.latestRelease)}</Text>
              <Pressable
                disabled={busyKey != null}
                style={styles.syncButton}
                onPress={() => void syncGroup(group)}
              >
                <MaterialCommunityIcons name="database-sync-outline" size={18} color="#1f7a3f" />
                <Text style={styles.syncButtonText}>{busyKey === group.key ? 'Syncing…' : 'Sync to Faculty Gradebook'}</Text>
              </Pressable>
            </View>
          ))
        )}

        <View style={styles.footerNote}>
          <Text style={styles.footerTitle}>Safe re-sync behavior</Text>
          <Text style={styles.footerText}>Re-syncing the same exam/section updates its linked Faculty grade item instead of creating duplicates. Faculty grades already LOCKED are not overwritten.</Text>
        </View>
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
  title: { color: '#17311f', fontSize: 28, fontWeight: '900', marginTop: 2 },
  subtitle: { color: '#667169', marginTop: 6, lineHeight: 20, marginBottom: 14 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: '#e8f4ea', borderRadius: 15, padding: 14, marginBottom: 14 },
  noticeText: { flex: 1, color: '#53665a', fontSize: 12, lineHeight: 18 },
  sectionTitle: { color: '#203328', fontSize: 16, fontWeight: '900', marginTop: 9, marginBottom: 9 },
  chipRow: { gap: 7, paddingBottom: 4 },
  chip: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: '#dce5dd' },
  chipActive: { backgroundColor: '#1f7a3f', borderColor: '#1f7a3f' },
  chipTitle: { color: '#25382d', fontWeight: '900', fontSize: 12 },
  chipTitleActive: { color: '#fff' },
  chipMeta: { color: '#748078', fontSize: 10, marginTop: 2 },
  chipMetaActive: { color: '#dcefe0' },
  strategyRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  strategy: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 11, alignItems: 'center', borderWidth: 1, borderColor: '#dce5dd' },
  strategyActive: { borderColor: '#1f7a3f', backgroundColor: '#edf7ef' },
  strategyText: { color: '#667169', fontWeight: '800', fontSize: 11, textAlign: 'center' },
  strategyTextActive: { color: '#1f7a3f' },
  actionRow: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  primaryFlex: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#1f7a3f', borderRadius: 12, paddingVertical: 12 },
  secondaryFlex: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 12, borderWidth: 1, borderColor: '#cfe0d2' },
  primary: { backgroundColor: '#1f7a3f', borderRadius: 11, paddingVertical: 11, alignItems: 'center', marginTop: 10 },
  primaryText: { color: '#fff', fontWeight: '900', fontSize: 11, textAlign: 'center' },
  secondaryText: { color: '#1f7a3f', fontWeight: '900', fontSize: 11 },
  empty: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10 },
  emptyTitle: { color: '#203328', fontWeight: '900' },
  emptyText: { color: '#68736b', marginTop: 4, lineHeight: 18, fontSize: 12 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 9 },
  cardTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  exam: { color: '#203328', fontWeight: '900', fontSize: 15 },
  meta: { color: '#748078', fontSize: 11, marginTop: 3 },
  countBox: { alignItems: 'center', backgroundColor: '#edf6ef', borderRadius: 11, paddingHorizontal: 10, paddingVertical: 7 },
  countValue: { color: '#1f7a3f', fontWeight: '900', fontSize: 17 },
  countLabel: { color: '#65756a', fontSize: 9 },
  syncButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#edf6ef', borderRadius: 11, paddingVertical: 10, marginTop: 10 },
  syncButtonText: { color: '#1f7a3f', fontWeight: '900', fontSize: 11 },
  footerNote: { backgroundColor: '#fff8e9', borderRadius: 15, padding: 14, marginTop: 8 },
  footerTitle: { color: '#594a2a', fontWeight: '900' },
  footerText: { color: '#756848', fontSize: 11, lineHeight: 17, marginTop: 4 },
});