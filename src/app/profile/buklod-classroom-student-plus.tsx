import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { useClassroomTheme } from '@/hooks/useClassroomTheme';
import { supabase } from '@/lib/supabase';

type PlusAccess = {
  active: boolean;
  monthly_php: number;
  yearly_php: number;
  core_free: boolean;
  features: string[];
};

type TodoRow = {
  classroom_id: string;
  class_name: string;
  assignment_id: string;
  title: string;
  term_key: string | null;
  points_possible: number;
  due_at: string | null;
  closes_at: string | null;
  submission_status: string | null;
  is_overdue: boolean;
};

type BreakdownItem = {
  category_id: string;
  term_key: string;
  term_label: string;
  category_name: string;
  category_weight_percent: number;
  equivalent_percent: number | null;
  represented: boolean;
};

type GradebookRow = {
  classroom_id: string;
  class_name: string;
  weighted_points: number;
  covered_weight: number;
  current_percent: number | null;
  breakdown: BreakdownItem[];
  final_grade: number | null;
  final_status: string | null;
};

function n(value: unknown) {
  const x = Number(value);
  return Number.isFinite(x) ? x : 0;
}

function formatDue(value: string | null) {
  if (!value) return 'No due date';
  const date = new Date(value);
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function BuklodClassroomStudentPlusScreen() {
  const params = useLocalSearchParams<{ id?: string; classroomId?: string; name?: string }>();
  const classroomId = String(params.classroomId ?? params.id ?? '');
  const className = String(params.name ?? 'Classroom');
  const { theme } = useClassroomTheme();

  const [access, setAccess] = useState<PlusAccess | null>(null);
  const [todos, setTodos] = useState<TodoRow[]>([]);
  const [gradebook, setGradebook] = useState<GradebookRow | null>(null);
  const [targetGrade, setTargetGrade] = useState('85');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const accessRes = await supabase.rpc('buklod_classroom_student_plus_access_v1');
    if (accessRes.error) throw accessRes.error;
    const nextAccess = accessRes.data as PlusAccess;
    setAccess(nextAccess);

    if (!nextAccess?.active) {
      setTodos([]);
      setGradebook(null);
      return;
    }

    const [todoRes, gradeRes] = await Promise.all([
      supabase.rpc('buklod_classroom_student_todo_v1'),
      classroomId
        ? supabase.rpc('buklod_education_my_gradebook_v1', { p_classroom_id: classroomId })
        : Promise.resolve({ data: null, error: null } as any),
    ]);

    if (todoRes.error) throw todoRes.error;
    if (gradeRes.error) throw gradeRes.error;

    setTodos((todoRes.data ?? []) as TodoRow[]);
    const gradeRow = Array.isArray(gradeRes.data) ? gradeRes.data[0] : gradeRes.data;
    setGradebook((gradeRow ?? null) as GradebookRow | null);
  }, [classroomId]);

  useFocusEffect(
    useCallback(() => {
      load().catch(error => Alert.alert('Student Plus', error?.message ?? 'Could not load Student Plus.'));
    }, [load])
  );

  const remainingWeight = Math.max(0, 100 - n(gradebook?.covered_weight));
  const target = n(targetGrade);
  const currentWeightedPoints = n(gradebook?.weighted_points);
  const neededOnRemaining = remainingWeight > 0
    ? ((target - currentWeightedPoints) / remainingWeight) * 100
    : null;

  const weakAreas = useMemo(() => {
    const rows = Array.isArray(gradebook?.breakdown) ? gradebook!.breakdown : [];
    return rows
      .filter(item => item.represented && item.equivalent_percent != null)
      .sort((a, b) => n(a.equivalent_percent) - n(b.equivalent_percent))
      .slice(0, 4);
  }, [gradebook]);

  const urgentTodos = useMemo(() => {
    return [...todos]
      .sort((a, b) => {
        if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1;
        if (!a.due_at) return 1;
        if (!b.due_at) return -1;
        return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
      })
      .slice(0, 8);
  }, [todos]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (error: any) {
      Alert.alert('Student Plus', error?.message ?? 'Refresh failed.');
    } finally {
      setRefreshing(false);
    }
  };

  if (access && !access.active) {
    return (
      <ScrollView style={[styles.screen, { backgroundColor: theme.background }]} contentContainerStyle={styles.content}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={theme.ink} />
          <Text style={[styles.backText, { color: theme.ink }]}>{className}</Text>
        </Pressable>

        <View style={[styles.hero, { backgroundColor: theme.drawer }]}>
          <View style={[styles.plusBadge, { backgroundColor: theme.accent }]}>
            <MaterialCommunityIcons name="star-four-points-outline" size={24} color={theme.drawer} />
          </View>
          <Text style={[styles.kicker, { color: theme.accent }]}>OPTIONAL STUDENT UPGRADE</Text>
          <Text style={[styles.heroTitle, { color: theme.drawerInk }]}>BUKLOD Student Plus</Text>
          <Text style={[styles.heroText, { color: theme.muted }]}>Core Classroom stays free. Plus unlocks personal study tools that help you plan, forecast and focus without blocking any school requirement.</Text>
          <Text style={[styles.price, { color: theme.drawerInk }]}>₱{access.monthly_php}/month  •  ₱{access.yearly_php}/year</Text>
        </View>

        {[
          ['chart-line', 'Grade Forecast', 'Estimate what average you still need to hit a target final grade.'],
          ['bullseye-arrow', 'Weak-Area Insights', 'See the released categories where your equivalent grade is lowest.'],
          ['calendar-clock-outline', 'Deadline Radar', 'See upcoming and overdue work across all enrolled classes in one priority view.'],
          ['clipboard-text-clock-outline', 'Study Planner', 'Turn real deadlines and weak areas into a practical review queue.'],
          ['chart-box-outline', 'Progress Analytics', 'Track released coverage, current standing and remaining grade weight.'],
        ].map(([icon, title, text]) => (
          <View key={title} style={[styles.featureCard, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
            <View style={[styles.iconBox, { backgroundColor: theme.chip }]}>
              <MaterialCommunityIcons name={icon as any} size={22} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.featureTitle, { color: theme.ink }]}>{title}</Text>
              <Text style={[styles.featureText, { color: theme.muted }]}>{text}</Text>
            </View>
            <MaterialCommunityIcons name="lock-outline" size={18} color={theme.muted} />
          </View>
        ))}

        <Pressable style={[styles.upgradeButton, { backgroundColor: theme.primary }]} onPress={() => router.push('/profile/focus-apps' as any)}>
          <MaterialCommunityIcons name="star-four-points" size={20} color="#fff" />
          <Text style={styles.upgradeText}>View Student Plus Plan</Text>
        </Pressable>

        <Text style={[styles.freeNote, { color: theme.muted }]}>Attendance, quizzes, materials, submissions, discussions, messages, and released grades remain FREE.</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />}
    >
      <Pressable style={styles.back} onPress={() => router.back()}>
        <MaterialCommunityIcons name="arrow-left" size={22} color={theme.ink} />
        <Text style={[styles.backText, { color: theme.ink }]}>{className}</Text>
      </Pressable>

      <View style={[styles.hero, { backgroundColor: theme.drawer }]}>
        <View style={[styles.plusBadge, { backgroundColor: theme.accent }]}>
          <MaterialCommunityIcons name="star-four-points" size={24} color={theme.drawer} />
        </View>
        <Text style={[styles.kicker, { color: theme.accent }]}>STUDENT PLUS</Text>
        <Text style={[styles.heroTitle, { color: theme.drawerInk }]}>Study Dashboard</Text>
        <Text style={[styles.heroText, { color: theme.muted }]}>Personal insights only. Faculty records remain authoritative and cannot be changed from here.</Text>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.ink }]}>Grade Forecast</Text>
      <View style={[styles.panel, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
        <View style={styles.metricRow}>
          <View style={styles.metric}>
            <Text style={[styles.metricValue, { color: theme.primary }]}>{gradebook?.current_percent == null ? '—' : n(gradebook.current_percent).toFixed(2)}</Text>
            <Text style={[styles.metricLabel, { color: theme.muted }]}>current standing</Text>
          </View>
          <View style={styles.metric}>
            <Text style={[styles.metricValue, { color: theme.secondary }]}>{n(gradebook?.covered_weight).toFixed(1)}%</Text>
            <Text style={[styles.metricLabel, { color: theme.muted }]}>released weight</Text>
          </View>
          <View style={styles.metric}>
            <Text style={[styles.metricValue, { color: theme.accent }]}>{remainingWeight.toFixed(1)}%</Text>
            <Text style={[styles.metricLabel, { color: theme.muted }]}>remaining</Text>
          </View>
        </View>

        <Text style={[styles.inputLabel, { color: theme.muted }]}>TARGET FINAL GRADE</Text>
        <TextInput value={targetGrade} onChangeText={setTargetGrade} keyboardType="decimal-pad" style={[styles.input, { color: theme.ink, borderColor: theme.border, backgroundColor: theme.surface }]} />

        <View style={[styles.forecastBox, { backgroundColor: theme.chip }]}>
          <Text style={[styles.forecastLabel, { color: theme.muted }]}>AVERAGE NEEDED ON REMAINING WEIGHT</Text>
          <Text style={[styles.forecastValue, { color: neededOnRemaining != null && neededOnRemaining > 100 ? '#b33a3a' : theme.primary }]}>
            {neededOnRemaining == null ? 'FINALIZED' : `${neededOnRemaining.toFixed(2)}%`}
          </Text>
          <Text style={[styles.forecastHint, { color: theme.muted }]}>
            {neededOnRemaining == null
              ? 'No remaining configured grade weight.'
              : neededOnRemaining <= 0
                ? 'Your released weighted points already meet this target.'
                : neededOnRemaining > 100
                  ? 'This target is above what the remaining configured weight can mathematically deliver.'
                  : 'This is a planning estimate based only on released gradebook coverage.'}
          </Text>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.ink }]}>Weak-Area Insights</Text>
      <View style={[styles.panel, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
        {weakAreas.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.muted }]}>Not enough released category grades yet.</Text>
        ) : weakAreas.map((item, index) => (
          <View key={`${item.term_key}-${item.category_id}`} style={[styles.insightRow, index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <View style={[styles.rank, { backgroundColor: theme.chip }]}><Text style={[styles.rankText, { color: theme.primary }]}>{index + 1}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.insightTitle, { color: theme.ink }]}>{item.category_name}</Text>
              <Text style={[styles.insightMeta, { color: theme.muted }]}>{item.term_label} • {n(item.category_weight_percent).toFixed(0)}% category weight</Text>
            </View>
            <Text style={[styles.insightScore, { color: theme.secondary }]}>{n(item.equivalent_percent).toFixed(2)}</Text>
          </View>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: theme.ink }]}>Deadline Radar</Text>
      <View style={[styles.panel, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
        {urgentTodos.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.muted }]}>No open classroom tasks right now.</Text>
        ) : urgentTodos.map((item, index) => (
          <View key={item.assignment_id} style={[styles.todoRow, index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <MaterialCommunityIcons name={item.is_overdue ? 'alert-circle-outline' : 'calendar-clock-outline'} size={21} color={item.is_overdue ? '#b33a3a' : theme.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.todoTitle, { color: theme.ink }]}>{item.title}</Text>
              <Text style={[styles.todoMeta, { color: theme.muted }]}>{item.class_name} • {formatDue(item.due_at)}</Text>
            </View>
            <Text style={[styles.todoState, { color: item.is_overdue ? '#b33a3a' : theme.secondary }]}>{item.is_overdue ? 'OVERDUE' : 'OPEN'}</Text>
          </View>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: theme.ink }]}>Suggested Review Queue</Text>
      <View style={[styles.panel, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
        {[...weakAreas.map(item => `Review ${item.category_name} (${item.term_label})`), ...urgentTodos.slice(0, 3).map(item => `Finish ${item.title} — ${item.class_name}`)].slice(0, 7).map((text, index) => (
          <View key={`${text}-${index}`} style={styles.checkRow}>
            <MaterialCommunityIcons name="checkbox-blank-circle-outline" size={18} color={theme.primary} />
            <Text style={[styles.checkText, { color: theme.ink }]}>{text}</Text>
          </View>
        ))}
        {weakAreas.length === 0 && urgentTodos.length === 0 && <Text style={[styles.emptyText, { color: theme.muted }]}>Your review queue will build automatically from released grades and open tasks.</Text>}
      </View>

      <Text style={[styles.disclaimer, { color: theme.muted }]}>Student Plus forecasts are planning aids. Official grades, attendance and exam results remain controlled by faculty and their authoritative BUKLOD services.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 18, paddingTop: 42, paddingBottom: 70 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 16, minHeight: 42 },
  backText: { fontWeight: '900', flex: 1 },
  hero: { borderRadius: 22, padding: 18, marginBottom: 18 },
  plusBadge: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  kicker: { fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  heroTitle: { fontSize: 27, fontWeight: '900', marginTop: 3 },
  heroText: { fontSize: 11, lineHeight: 18, marginTop: 7 },
  price: { fontSize: 17, fontWeight: '900', marginTop: 14 },
  featureCard: { borderWidth: 1, borderRadius: 15, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { fontWeight: '900', fontSize: 13 },
  featureText: { fontSize: 9, lineHeight: 14, marginTop: 2 },
  upgradeButton: { borderRadius: 14, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 },
  upgradeText: { color: '#fff', fontWeight: '900' },
  freeNote: { textAlign: 'center', lineHeight: 16, fontSize: 10, marginTop: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '900', marginTop: 12, marginBottom: 8 },
  panel: { borderWidth: 1, borderRadius: 17, padding: 13, marginBottom: 10 },
  metricRow: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1 },
  metricValue: { fontWeight: '900', fontSize: 18 },
  metricLabel: { fontSize: 8, marginTop: 2 },
  inputLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 14, marginBottom: 5 },
  input: { borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, fontWeight: '900' },
  forecastBox: { borderRadius: 13, padding: 12, marginTop: 10 },
  forecastLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  forecastValue: { fontSize: 25, fontWeight: '900', marginTop: 3 },
  forecastHint: { fontSize: 9, lineHeight: 14, marginTop: 4 },
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 9 },
  rank: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontWeight: '900' },
  insightTitle: { fontWeight: '900', fontSize: 12 },
  insightMeta: { fontSize: 8, marginTop: 2 },
  insightScore: { fontWeight: '900', fontSize: 14 },
  todoRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 10 },
  todoTitle: { fontWeight: '900', fontSize: 12 },
  todoMeta: { fontSize: 8, marginTop: 2 },
  todoState: { fontWeight: '900', fontSize: 8 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7 },
  checkText: { flex: 1, fontSize: 11, fontWeight: '700' },
  emptyText: { fontSize: 10, lineHeight: 16, paddingVertical: 5 },
  disclaimer: { fontSize: 9, lineHeight: 14, marginTop: 8, textAlign: 'center' },
});
