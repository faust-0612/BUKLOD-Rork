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
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { supabase } from '@/lib/supabase';

type TermKey = 'PRELIM' | 'MIDTERM' | 'SEMIFINALS' | 'FINALS';

type BreakdownItem = {
  category_id: string;
  term_key: TermKey;
  term_label: string;
  term_weight_percent: number;
  category_name: string;
  category_weight_percent: number;
  weight_percent: number;
  earned: number;
  possible: number;
  raw_percent: number | null;
  equivalent_percent: number | null;
  weighted_points: number;
  represented: boolean;
};

type GradebookRow = {
  classroom_id: string;
  class_name: string;
  category_total: number;
  weighted_points: number;
  covered_weight: number;
  current_percent: number | null;
  breakdown: BreakdownItem[];
  final_grade: number | null;
  final_status: string | null;
  final_released_at: string | null;
};

const TERM_ORDER: TermKey[] = ['PRELIM', 'MIDTERM', 'SEMIFINALS', 'FINALS'];

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export default function BuklodClassroomGradesScreen() {
  const params = useLocalSearchParams<{ id?: string; classroomId?: string; name?: string }>();
  const classroomId = String(params.id ?? params.classroomId ?? '');
  const fallbackName = String(params.name ?? 'Classroom');

  const [gradebook, setGradebook] = useState<GradebookRow | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!classroomId) return;
    const { data, error } = await supabase.rpc('buklod_education_my_gradebook_v1', {
      p_classroom_id: classroomId,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    setGradebook((row ?? null) as GradebookRow | null);
  }, [classroomId]);

  useFocusEffect(
    useCallback(() => {
      load().catch(error => Alert.alert('My Grades', error?.message ?? 'Could not load grades.'));
    }, [load])
  );

  const breakdown = Array.isArray(gradebook?.breakdown) ? gradebook!.breakdown : [];

  const termSummaries = useMemo(() => {
    return TERM_ORDER.map(key => {
      const items = breakdown.filter(item => String(item.term_key).toUpperCase() === key);
      const label = items[0]?.term_label || (key === 'SEMIFINALS' ? 'Semifinals' : key[0] + key.slice(1).toLowerCase());
      const termWeight = num(items[0]?.term_weight_percent || 25);
      const coveredCategoryWeight = items.reduce(
        (sum, item) => sum + (item.represented ? num(item.category_weight_percent) : 0),
        0
      );
      const earnedWithinTerm = items.reduce((sum, item) => {
        if (!item.represented || item.equivalent_percent == null) return sum;
        return sum + (num(item.equivalent_percent) / 100) * num(item.category_weight_percent);
      }, 0);
      const current = coveredCategoryWeight > 0 ? (earnedWithinTerm / coveredCategoryWeight) * 100 : null;
      const complete = Math.abs(coveredCategoryWeight - 100) < 0.0001;
      return { key, label, termWeight, items, coveredCategoryWeight, current, complete };
    });
  }, [breakdown]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (error: any) {
      Alert.alert('My Grades', error?.message ?? 'Refresh failed.');
    } finally {
      setRefreshing(false);
    }
  };

  const className = gradebook?.class_name || fallbackName;
  const currentOverall = gradebook?.current_percent == null ? null : num(gradebook.current_percent);
  const releasedFinal = gradebook?.final_grade == null ? null : num(gradebook.final_grade);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <Pressable style={styles.back} onPress={() => router.back()}>
        <MaterialCommunityIcons name="arrow-left" size={22} color="#17311f" />
        <Text style={styles.backText}>{className}</Text>
      </Pressable>

      <Text style={styles.eyebrow}>GRADE CONSULTATION</Text>
      <Text style={styles.title}>My Grades</Text>
      <Text style={styles.subtitle}>
        Only faculty-released or locked item grades are included here. Draft grades stay private to faculty until released.
      </Text>

      <View style={styles.summaryCard}>
        <View style={styles.summaryMain}>
          <Text style={styles.summaryLabel}>{releasedFinal == null ? 'CURRENT STANDING' : 'RELEASED FINAL GRADE'}</Text>
          <Text style={styles.summaryValue}>
            {(releasedFinal ?? currentOverall) == null ? '—' : (releasedFinal ?? currentOverall)!.toFixed(2)}
          </Text>
          <Text style={styles.summaryMeta}>
            Released coverage: {num(gradebook?.covered_weight).toFixed(1)}%
          </Text>
        </View>
        <View style={styles.statusBox}>
          <MaterialCommunityIcons
            name={releasedFinal == null ? 'progress-clock' : 'check-decagram-outline'}
            size={23}
            color="#1f7a3f"
          />
          <Text style={styles.statusTitle}>{gradebook?.final_status || 'IN PROGRESS'}</Text>
          <Text style={styles.statusHint}>{releasedFinal == null ? 'Not final yet' : 'Faculty released'}</Text>
        </View>
      </View>

      <View style={styles.formulaCard}>
        <Text style={styles.formulaLabel}>GRADE EQUIVALENT</Text>
        <Text style={styles.formula}>50 + (Raw Score ÷ Highest Possible × 50)</Text>
        <Text style={styles.formulaHint}>Term and category weights are set by your faculty.</Text>
      </View>

      <Text style={styles.sectionTitle}>Grading Periods</Text>

      {termSummaries.map(term => (
        <View key={term.key} style={styles.termCard}>
          <View style={styles.termHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.termTitle}>{term.label}</Text>
              <Text style={styles.termMeta}>{term.termWeight.toFixed(1)}% of final grade</Text>
            </View>
            <View style={[styles.termStatus, term.complete && styles.termStatusComplete]}>
              <Text style={[styles.termStatusText, term.complete && styles.termStatusTextComplete]}>
                {term.current == null ? '—' : term.current.toFixed(2)}
              </Text>
              <Text style={styles.termStatusHint}>{term.complete ? 'Complete' : `${term.coveredCategoryWeight.toFixed(0)}% covered`}</Text>
            </View>
          </View>

          {term.items.length === 0 ? (
            <Text style={styles.noItems}>No grading categories available.</Text>
          ) : (
            term.items.map(item => (
              <View key={item.category_id} style={styles.categoryRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.categoryName}>{item.category_name}</Text>
                  <Text style={styles.categoryMeta}>{num(item.category_weight_percent).toFixed(1)}% inside {term.label}</Text>
                </View>
                <View style={styles.categoryNumbers}>
                  <Text style={styles.categoryScore}>
                    {item.represented ? `${num(item.earned).toFixed(0)}/${num(item.possible).toFixed(0)}` : '—'}
                  </Text>
                  <Text style={styles.categoryEquivalent}>
                    {item.equivalent_percent == null ? 'Not released' : `Eq ${num(item.equivalent_percent).toFixed(2)}`}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      ))}

      <View style={styles.note}>
        <MaterialCommunityIcons name="information-outline" size={20} color="#1f7a3f" />
        <Text style={styles.noteText}>
          A current standing can change while more activities, quizzes, attendance records, or exams are being released. The final grade shown here appears only after faculty release.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f7f2' },
  content: { padding: 20, paddingTop: 42, paddingBottom: 70 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 18 },
  backText: { color: '#17311f', fontWeight: '900' },
  eyebrow: { color: '#1f7a3f', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#17311f', fontSize: 28, fontWeight: '900', marginTop: 2 },
  subtitle: { color: '#68736b', lineHeight: 19, marginTop: 6, marginBottom: 16 },
  summaryCard: { flexDirection: 'row', gap: 10, backgroundColor: '#fff', borderRadius: 18, padding: 15, borderWidth: 1, borderColor: '#dfe8e1' },
  summaryMain: { flex: 1 },
  summaryLabel: { color: '#738078', fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  summaryValue: { color: '#17311f', fontSize: 34, fontWeight: '900', marginTop: 2 },
  summaryMeta: { color: '#748078', fontSize: 11, marginTop: 2 },
  statusBox: { width: 112, backgroundColor: '#edf5ee', borderRadius: 13, padding: 10, alignItems: 'center', justifyContent: 'center' },
  statusTitle: { color: '#1f7a3f', fontSize: 10, fontWeight: '900', marginTop: 4 },
  statusHint: { color: '#748078', fontSize: 9, marginTop: 2 },
  formulaCard: { backgroundColor: '#17311f', borderRadius: 15, padding: 14, marginTop: 12 },
  formulaLabel: { color: '#9fc3a7', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  formula: { color: '#fff', fontWeight: '900', fontSize: 15, marginTop: 4 },
  formulaHint: { color: '#c5d5c8', fontSize: 10, marginTop: 4 },
  sectionTitle: { color: '#26392d', fontWeight: '900', fontSize: 17, marginTop: 20, marginBottom: 10 },
  termCard: { backgroundColor: '#fff', borderRadius: 17, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e0e7e1' },
  termHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 },
  termTitle: { color: '#273a2e', fontWeight: '900', fontSize: 17 },
  termMeta: { color: '#748078', fontSize: 10, marginTop: 2 },
  termStatus: { minWidth: 84, borderRadius: 11, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: '#fff1df', alignItems: 'center' },
  termStatusComplete: { backgroundColor: '#e8f4e9' },
  termStatusText: { color: '#9b6c32', fontWeight: '900', fontSize: 15 },
  termStatusTextComplete: { color: '#1f7a3f' },
  termStatusHint: { color: '#748078', fontSize: 8, marginTop: 1 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e6ebe7' },
  categoryName: { color: '#324238', fontWeight: '800', fontSize: 12 },
  categoryMeta: { color: '#879087', fontSize: 9, marginTop: 2 },
  categoryNumbers: { alignItems: 'flex-end' },
  categoryScore: { color: '#33443a', fontWeight: '900', fontSize: 11 },
  categoryEquivalent: { color: '#1f7a3f', fontSize: 9, marginTop: 2 },
  noItems: { color: '#879087', fontSize: 11, paddingVertical: 8 },
  note: { flexDirection: 'row', gap: 9, backgroundColor: '#eaf4eb', borderRadius: 14, padding: 13, marginTop: 10 },
  noteText: { flex: 1, color: '#435349', lineHeight: 18, fontSize: 11 },
});
