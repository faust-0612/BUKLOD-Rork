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
  const { theme, themeId, setThemeId } = useClassroomTheme();

  const [gradebook, setGradebook] = useState<GradebookRow | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={theme.primary} onRefresh={refresh} />}
      >
        <View style={styles.topBar}>
          <Pressable onPress={() => setDrawerOpen(true)} style={[styles.menuButton, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
            <MaterialCommunityIcons name="menu" size={22} color={theme.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.topKicker, { color: theme.muted }]}>GRADE CONSULTATION</Text>
            <Text numberOfLines={1} style={[styles.topName, { color: theme.ink }]}>{className}</Text>
          </View>
          <Pressable onPress={() => router.back()} style={[styles.backButton, { borderColor: theme.border }]}>
            <MaterialCommunityIcons name="arrow-left" size={18} color={theme.ink} />
          </Pressable>
        </View>

        <LinearGradient colors={[theme.heroStart, theme.heroEnd]} style={styles.hero}>
          <View style={[styles.reportTab, { backgroundColor: theme.accent }]}>
            <Text style={[styles.reportTabText, { color: theme.drawer }]}>REPORT</Text>
          </View>
          <Text style={styles.heroKicker}>{releasedFinal == null ? 'CURRENT ACADEMIC STANDING' : 'FACULTY-RELEASED FINAL'}</Text>
          <Text style={styles.heroGrade}>{(releasedFinal ?? currentOverall) == null ? '—' : (releasedFinal ?? currentOverall)!.toFixed(2)}</Text>
          <View style={styles.heroRow}>
            <Text style={styles.heroText}>Released coverage {num(gradebook?.covered_weight).toFixed(1)}%</Text>
            <Text style={styles.heroText}>{gradebook?.final_status || 'IN PROGRESS'}</Text>
          </View>
        </LinearGradient>

        <View style={[styles.formulaStrip, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
          <View style={[styles.formulaIcon, { backgroundColor: theme.chip }]}>
            <MaterialCommunityIcons name="function-variant" size={20} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.formulaKicker, { color: theme.muted }]}>GRADE EQUIVALENT</Text>
            <Text style={[styles.formula, { color: theme.ink }]}>50 + (Raw ÷ Highest Possible × 50)</Text>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionKicker, { color: theme.muted }]}>FOUR GRADING PERIODS</Text>
          <Text style={[styles.sectionCount, { color: theme.ink }]}>4</Text>
        </View>

        {termSummaries.map((term, index) => {
          const tone = index % 2 === 0 ? theme.primary : theme.secondary;
          return (
            <View key={term.key} style={[styles.termCard, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
              <View style={[styles.termSpine, { backgroundColor: tone }]} />
              <View style={styles.termHeader}>
                <View style={[styles.termNumber, { backgroundColor: `${tone}1C` }]}>
                  <Text style={[styles.termNumberText, { color: tone }]}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.termTitle, { color: theme.ink }]}>{term.label}</Text>
                  <Text style={[styles.termMeta, { color: theme.muted }]}>{term.termWeight.toFixed(1)}% of final grade</Text>
                </View>
                <View style={[styles.termScoreBox, { backgroundColor: term.complete ? `${theme.success}1E` : theme.chip }]}>
                  <Text style={[styles.termScore, { color: term.complete ? theme.success : theme.ink }]}>{term.current == null ? '—' : term.current.toFixed(2)}</Text>
                  <Text style={[styles.termCoverage, { color: theme.muted }]}>{term.complete ? 'complete' : `${term.coveredCategoryWeight.toFixed(0)}% covered`}</Text>
                </View>
              </View>

              {term.items.length === 0 ? (
                <Text style={[styles.noItems, { color: theme.muted }]}>No released grading categories yet.</Text>
              ) : (
                term.items.map((item, itemIndex) => (
                  <View key={item.category_id} style={[styles.categoryRow, itemIndex > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.categoryName, { color: theme.ink }]}>{item.category_name}</Text>
                      <Text style={[styles.categoryMeta, { color: theme.muted }]}>{num(item.category_weight_percent).toFixed(1)}% inside {term.label}</Text>
                    </View>
                    <View style={styles.categoryNumbers}>
                      <Text style={[styles.categoryScore, { color: theme.ink }]}>{item.represented ? `${num(item.earned).toFixed(0)}/${num(item.possible).toFixed(0)}` : '—'}</Text>
                      <Text style={[styles.categoryEquivalent, { color: item.equivalent_percent == null ? theme.muted : tone }]}>{item.equivalent_percent == null ? 'not released' : `Eq ${num(item.equivalent_percent).toFixed(2)}`}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          );
        })}

        <View style={[styles.note, { borderColor: theme.border }]}>
          <MaterialCommunityIcons name="information-outline" size={19} color={theme.primary} />
          <Text style={[styles.noteText, { color: theme.muted }]}>Draft faculty grades never appear here. A current standing can still move as Attendance, activities, Quiz results, recitation and exams are released. Final grade appears only after faculty release.</Text>
        </View>
      </ScrollView>

      <ClassroomDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        classroomId={classroomId}
        classroomName={className}
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
  hero: { borderRadius: 22, padding: 18, position: 'relative', overflow: 'hidden' },
  reportTab: { position: 'absolute', top: 14, right: -11, paddingHorizontal: 18, paddingVertical: 6, transform: [{ rotate: '8deg' }] },
  reportTabText: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  heroKicker: { color: 'rgba(255,255,255,0.68)', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  heroGrade: { color: '#fff', fontSize: 52, lineHeight: 58, fontWeight: '900', marginTop: 5 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 6 },
  heroText: { color: 'rgba(255,255,255,0.72)', fontSize: 9, fontWeight: '800' },
  formulaStrip: { borderWidth: 1, borderRadius: 15, padding: 11, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  formulaIcon: { width: 37, height: 37, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  formulaKicker: { fontSize: 8, fontWeight: '900', letterSpacing: 0.9 },
  formula: { fontSize: 11, fontWeight: '900', marginTop: 2 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 23, marginBottom: 8 },
  sectionKicker: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  sectionCount: { fontSize: 18, fontWeight: '900' },
  termCard: { position: 'relative', overflow: 'hidden', borderWidth: 1, borderRadius: 17, padding: 13, paddingLeft: 17, marginBottom: 9 },
  termSpine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  termHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  termNumber: { width: 38, height: 45, borderRadius: 9, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-2deg' }] },
  termNumberText: { fontSize: 18, fontWeight: '900' },
  termTitle: { fontSize: 16, fontWeight: '900' },
  termMeta: { fontSize: 8, marginTop: 2 },
  termScoreBox: { minWidth: 82, borderRadius: 10, padding: 8, alignItems: 'center' },
  termScore: { fontSize: 15, fontWeight: '900' },
  termCoverage: { fontSize: 7, marginTop: 1 },
  categoryRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, marginLeft: 47 },
  categoryName: { fontSize: 10, fontWeight: '900' },
  categoryMeta: { fontSize: 8, marginTop: 2 },
  categoryNumbers: { alignItems: 'flex-end' },
  categoryScore: { fontSize: 10, fontWeight: '900' },
  categoryEquivalent: { fontSize: 8, marginTop: 2, fontWeight: '800' },
  noItems: { marginLeft: 47, paddingVertical: 10, fontSize: 9 },
  note: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12, paddingTop: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  noteText: { flex: 1, fontSize: 9, lineHeight: 14 },
});
