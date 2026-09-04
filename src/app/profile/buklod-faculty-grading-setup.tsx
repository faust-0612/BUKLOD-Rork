import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

type GradeCategory = {
  id: string | null;
  client_key: string;
  term_key: TermKey;
  name: string;
  weight_percent: number;
};

const TERM_ORDER: TermKey[] = ['PRELIM', 'MIDTERM', 'SEMIFINALS', 'FINALS'];

const DEFAULT_TERMS: GradingTerm[] = [
  { key: 'PRELIM', label: 'Prelim', weight_percent: 25 },
  { key: 'MIDTERM', label: 'Midterm', weight_percent: 25 },
  { key: 'SEMIFINALS', label: 'Semifinals', weight_percent: 25 },
  { key: 'FINALS', label: 'Finals', weight_percent: 25 },
];

const DEFAULT_CATEGORIES = [
  ['Attendance', 10],
  ['Participation / Recitation', 10],
  ['Quizzes', 20],
  ['Activity / Seatworks', 10],
  ['Attitude', 10],
  ['Major Exam', 40],
] as const;

function numberOrZero(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function makeClientKey() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function BuklodFacultyGradingSetupScreen() {
  const params = useLocalSearchParams<{ id?: string; classroomId?: string; name?: string }>();
  const classroomId = String(params.classroomId ?? params.id ?? '');
  const className = String(params.name ?? 'Classroom');
  const { theme, themeId, setThemeId } = useClassroomTheme();

  const [terms, setTerms] = useState<GradingTerm[]>(DEFAULT_TERMS);
  const [categories, setCategories] = useState<GradeCategory[]>([]);
  const [passingPercent, setPassingPercent] = useState('75');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!classroomId) return;

    const [classRes, categoryRes] = await Promise.all([
      supabase
        .from('buklod_education_classrooms')
        .select('grading_terms,grading_policy,passing_percent')
        .eq('id', classroomId)
        .single(),
      supabase
        .from('buklod_education_grade_categories')
        .select('id,term_key,name,weight_percent')
        .eq('classroom_id', classroomId)
        .order('created_at', { ascending: true }),
    ]);

    if (classRes.error) throw classRes.error;
    if (categoryRes.error) throw categoryRes.error;

    const loadedTerms = Array.isArray(classRes.data?.grading_terms)
      ? classRes.data.grading_terms
          .map((item: any) => ({
            key: String(item?.key ?? '').toUpperCase() as TermKey,
            label: String(item?.label ?? ''),
            weight_percent: numberOrZero(item?.weight_percent),
          }))
          .filter((item: GradingTerm) => TERM_ORDER.includes(item.key))
      : [];

    setTerms(
      TERM_ORDER.map(key => {
        const found = loadedTerms.find((item: GradingTerm) => item.key === key);
        return found ?? DEFAULT_TERMS.find(item => item.key === key)!;
      })
    );

    setCategories(
      (categoryRes.data ?? [])
        .map((item: any) => ({
          id: String(item.id),
          client_key: String(item.id),
          term_key: String(item.term_key ?? 'PRELIM').toUpperCase() as TermKey,
          name: String(item.name ?? ''),
          weight_percent: numberOrZero(item.weight_percent),
        }))
        .filter((item: GradeCategory) => TERM_ORDER.includes(item.term_key))
    );
    setPassingPercent(String(numberOrZero(classRes.data?.passing_percent || 75)));
  }, [classroomId]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch(error => Alert.alert('Grading Setup', error?.message ?? 'Could not load grading setup.'))
      .finally(() => setLoading(false));
  }, [load]);

  const termWeightTotal = useMemo(
    () => terms.reduce((sum, item) => sum + numberOrZero(item.weight_percent), 0),
    [terms]
  );

  const categoryTotals = useMemo(() => {
    const totals: Record<TermKey, number> = {
      PRELIM: 0,
      MIDTERM: 0,
      SEMIFINALS: 0,
      FINALS: 0,
    };
    categories.forEach(item => {
      totals[item.term_key] += numberOrZero(item.weight_percent);
    });
    return totals;
  }, [categories]);

  const setupReady =
    Math.abs(termWeightTotal - 100) < 0.0001 &&
    TERM_ORDER.every(key => Math.abs(categoryTotals[key] - 100) < 0.0001) &&
    categories.every(item => item.name.trim().length > 0);

  const updateTermWeight = (key: TermKey, raw: string) => {
    const value = raw === '' ? 0 : numberOrZero(raw);
    setTerms(current => current.map(item => (item.key === key ? { ...item, weight_percent: value } : item)));
  };

  const updateCategory = (clientKey: string, patch: Partial<GradeCategory>) => {
    setCategories(current => current.map(item => (item.client_key === clientKey ? { ...item, ...patch } : item)));
  };

  const addCategory = (termKey: TermKey) => {
    setCategories(current => [
      ...current,
      {
        id: null,
        client_key: makeClientKey(),
        term_key: termKey,
        name: 'New Category',
        weight_percent: 0,
      },
    ]);
  };

  const removeCategory = (item: GradeCategory) => {
    Alert.alert(
      'Remove category?',
      item.id
        ? 'It will be removed when you save. Categories already used by grade items are protected and cannot be deleted.'
        : 'This unsaved category will be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => setCategories(current => current.filter(row => row.client_key !== item.client_key)),
        },
      ]
    );
  };

  const applyDefault = () => {
    Alert.alert(
      'Apply Excel default?',
      'This restores 25% per term and 10/10/20/10/10/40 categories. Reset is blocked by the backend when existing grade items make deletion unsafe.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply Default',
          onPress: async () => {
            setSaving(true);
            const { error } = await supabase.rpc('buklod_education_apply_default_grading_template_v1', {
              p_classroom_id: classroomId,
              p_replace: true,
            });
            setSaving(false);
            if (error) return Alert.alert('Grading Setup', error.message);
            await load();
            Alert.alert('Grading Setup', 'Excel default restored. You can still edit it manually.');
          },
        },
      ]
    );
  };

  const saveSetup = async () => {
    const passing = Number(passingPercent);
    if (!Number.isFinite(passing) || passing < 0 || passing > 100) {
      return Alert.alert('Grading Setup', 'Passing grade must be from 0 to 100.');
    }
    if (Math.abs(termWeightTotal - 100) >= 0.0001) {
      return Alert.alert('Grading Setup', `Term weights are ${termWeightTotal.toFixed(1)}%. They must total 100%.`);
    }
    for (const key of TERM_ORDER) {
      if (Math.abs(categoryTotals[key] - 100) >= 0.0001) {
        return Alert.alert(
          'Grading Setup',
          `${terms.find(item => item.key === key)?.label ?? key} categories total ${categoryTotals[key].toFixed(1)}%. They must total 100%.`
        );
      }
    }
    if (categories.some(item => !item.name.trim())) {
      return Alert.alert('Grading Setup', 'Every category needs a name.');
    }

    const duplicate = TERM_ORDER.find(key => {
      const names = categories
        .filter(item => item.term_key === key)
        .map(item => item.name.trim().toLowerCase());
      return new Set(names).size !== names.length;
    });
    if (duplicate) {
      return Alert.alert('Grading Setup', 'Category names must be unique inside each grading term.');
    }

    setSaving(true);
    const { error } = await supabase.rpc('buklod_education_save_grading_setup_v1', {
      p_classroom_id: classroomId,
      p_terms: terms.map(item => ({
        key: item.key,
        label: item.label,
        weight_percent: numberOrZero(item.weight_percent),
      })),
      p_categories: categories.map(item => ({
        id: item.id,
        term_key: item.term_key,
        name: item.name.trim(),
        weight_percent: numberOrZero(item.weight_percent),
      })),
      p_passing_percent: passing,
    });
    setSaving(false);

    if (error) return Alert.alert('Grading Setup', error.message);
    await load();
    Alert.alert('Saved', 'Grading setup updated. Existing released/locked grade safeguards remain active.');
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <FacultyGate>
        <View style={[styles.loading, { backgroundColor: theme.background }]}>
          <View style={[styles.loadingMark, { backgroundColor: theme.chip }]}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
          <Text style={[styles.loadingTitle, { color: theme.ink }]}>Opening grading workbook</Text>
          <Text style={[styles.muted, { color: theme.muted }]}>Loading term and category rules...</Text>
        </View>
      </FacultyGate>
    );
  }

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
          kicker="FACULTY GRADING WORKBOOK"
          title="Grading Setup"
          subtitle="Shape the four grading periods and their category weights here. The familiar Excel default is available, but every term remains manually editable and faculty-controlled."
          icon="notebook-edit-outline"
          theme={theme}
          themeId={themeId}
          onThemeChange={setThemeId}
        />

        <View style={[styles.statusCard, { backgroundColor: theme.surfaceRaised, borderColor: setupReady ? theme.success : theme.warning }]}>
          <View style={[styles.statusIcon, { backgroundColor: setupReady ? `${theme.success}20` : `${theme.warning}20` }]}>
            <MaterialCommunityIcons name={setupReady ? 'check-decagram-outline' : 'alert-outline'} size={26} color={setupReady ? theme.success : theme.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusKicker, { color: setupReady ? theme.success : theme.warning }]}>WORKBOOK CHECK</Text>
            <Text style={[styles.statusTitle, { color: theme.ink }]}>{setupReady ? 'Setup ready to save' : 'Weights need adjustment'}</Text>
            <Text style={[styles.statusText, { color: theme.muted }]}>Term total {termWeightTotal.toFixed(1)}% · Passing {passingPercent || '0'}%</Text>
          </View>
        </View>

        <View style={[styles.formulaCard, { backgroundColor: theme.drawer }]}>
          <View style={[styles.formulaBadge, { backgroundColor: theme.accent }]}>
            <MaterialCommunityIcons name="function-variant" size={20} color={theme.drawer} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.labelDark, { color: theme.accent }]}>GRADE EQUIVALENT FORMULA</Text>
            <Text style={[styles.formula, { color: theme.drawerInk }]}>50 + (Raw Score ÷ Highest Possible Score × 50)</Text>
            <Text style={[styles.hint, { color: `${theme.drawerInk}B8` }]}>Example: 40/50 = 90 equivalent. Only released/locked item grades are included in final computation.</Text>
          </View>
        </View>

        <View style={styles.sectionIntro}>
          <Text style={[styles.sectionKicker, { color: theme.secondary }]}>STEP 01 · SHAPE THE YEAR</Text>
          <Text style={[styles.sectionTitle, { color: theme.ink }]}>Grading periods</Text>
        </View>

        <View style={styles.termWeightGrid}>
          {terms.map((term, index) => {
            const edge = index % 2 === 0 ? theme.primary : theme.secondary;
            return (
              <View key={term.key} style={[styles.termWeightCard, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }, index % 2 === 1 && styles.termWeightCardDrop]}>
                <View style={[styles.termEdge, { backgroundColor: edge }]} />
                <Text style={[styles.termOrdinal, { color: theme.muted }]}>0{index + 1}</Text>
                <Text style={[styles.termName, { color: theme.ink }]}>{term.label}</Text>
                <View style={[styles.percentInputWrap, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <TextInput
                    value={String(term.weight_percent)}
                    onChangeText={value => updateTermWeight(term.key, value)}
                    keyboardType="decimal-pad"
                    style={[styles.percentInput, { color: theme.ink }]}
                  />
                  <Text style={[styles.percentSuffix, { color: edge }]}>%</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={[styles.controlStrip, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: theme.muted }]}>PASSING GRADE</Text>
            <View style={[styles.passingInput, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <TextInput
                value={passingPercent}
                onChangeText={setPassingPercent}
                keyboardType="decimal-pad"
                style={[styles.passingText, { color: theme.ink }]}
              />
              <Text style={[styles.percentSuffix, { color: theme.secondary }]}>%</Text>
            </View>
          </View>
          <Pressable style={[styles.defaultButton, { backgroundColor: theme.chip }]} onPress={applyDefault} disabled={saving}>
            <MaterialCommunityIcons name="restore" size={20} color={theme.primary} />
            <View>
              <Text style={[styles.defaultKicker, { color: theme.muted }]}>RESET TO</Text>
              <Text style={[styles.defaultText, { color: theme.ink }]}>Excel Default</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.sectionIntro}>
          <Text style={[styles.sectionKicker, { color: theme.secondary }]}>STEP 02 · DEFINE THE MIX</Text>
          <Text style={[styles.sectionTitle, { color: theme.ink }]}>Category weights</Text>
        </View>

        {terms.map((term, termIndex) => {
          const rows = categories.filter(item => item.term_key === term.key);
          const total = categoryTotals[term.key];
          const ok = Math.abs(total - 100) < 0.0001;
          const edge = termIndex % 2 === 0 ? theme.primary : theme.secondary;
          return (
            <View key={term.key} style={[styles.termSection, { borderColor: theme.border }]}>
              <View style={styles.sectionHeader}>
                <View style={styles.termHeadingRow}>
                  <View style={[styles.termBullet, { backgroundColor: edge }]} />
                  <View>
                    <Text style={[styles.termSectionTitle, { color: theme.ink }]}>{term.label}</Text>
                    <Text style={[styles.totalText, { color: ok ? theme.success : theme.warning }]}>Category total {total.toFixed(1)}%</Text>
                  </View>
                </View>
                <Pressable style={[styles.addButton, { backgroundColor: theme.chip }]} onPress={() => addCategory(term.key)}>
                  <MaterialCommunityIcons name="plus" size={18} color={theme.ink} />
                  <Text style={[styles.addText, { color: theme.ink }]}>Category</Text>
                </Pressable>
              </View>

              {rows.map((item, rowIndex) => (
                <View key={item.client_key} style={[styles.categoryCard, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }, rowIndex % 2 === 1 && styles.categoryCardInset]}>
                  <View style={[styles.rowNumber, { backgroundColor: `${edge}1B` }]}>
                    <Text style={[styles.rowNumberText, { color: edge }]}>{String(rowIndex + 1).padStart(2, '0')}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.muted }]}>CATEGORY</Text>
                    <TextInput
                      value={item.name}
                      onChangeText={value => updateCategory(item.client_key, { name: value })}
                      placeholderTextColor={theme.muted}
                      style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.ink }]}
                    />
                  </View>
                  <View style={styles.categoryWeightBox}>
                    <Text style={[styles.label, { color: theme.muted }]}>WEIGHT</Text>
                    <View style={[styles.percentInputWrap, { backgroundColor: theme.background, borderColor: theme.border }]}>
                      <TextInput
                        value={String(item.weight_percent)}
                        onChangeText={value => updateCategory(item.client_key, { weight_percent: numberOrZero(value) })}
                        keyboardType="decimal-pad"
                        style={[styles.percentInput, { color: theme.ink }]}
                      />
                      <Text style={[styles.percentSuffix, { color: edge }]}>%</Text>
                    </View>
                  </View>
                  <Pressable style={[styles.removeButton, { backgroundColor: `${theme.danger}16` }]} onPress={() => removeCategory(item)}>
                    <MaterialCommunityIcons name="trash-can-outline" size={19} color={theme.danger} />
                  </Pressable>
                </View>
              ))}
            </View>
          );
        })}

        <View style={styles.saveZone}>
          <Text style={[styles.sectionKicker, { color: theme.secondary }]}>STEP 03 · COMMIT THE WORKBOOK</Text>
          <Pressable
            style={[styles.saveButton, { backgroundColor: theme.secondary }, (!setupReady || saving) && styles.disabled]}
            onPress={saveSetup}
            disabled={!setupReady || saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <MaterialCommunityIcons name="content-save-check-outline" size={21} color="#fff" />}
            <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Grading Setup'}</Text>
          </Pressable>

          <Pressable
            style={[styles.gradebookButton, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}
            onPress={() => router.push({ pathname: '/profile/buklod-faculty-final-grades' as any, params: { classroomId, id: classroomId, name: className } })}
          >
            <View>
              <Text style={[styles.gradebookKicker, { color: theme.muted }]}>NEXT DESK</Text>
              <Text style={[styles.gradebookText, { color: theme.ink }]}>Gradebook & Final Grades</Text>
            </View>
            <View style={[styles.nextIcon, { backgroundColor: theme.chip }]}>
              <MaterialCommunityIcons name="arrow-right" size={20} color={theme.ink} />
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </FacultyGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 38, paddingBottom: 70 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  loadingMark: { width: 70, height: 70, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  loadingTitle: { fontSize: 16, fontWeight: '900' },
  muted: { fontSize: 11 },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 19, padding: 14, marginBottom: 12, borderWidth: 1 },
  statusIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  statusKicker: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  statusTitle: { fontSize: 15, fontWeight: '900', marginTop: 2 },
  statusText: { fontSize: 10, marginTop: 3 },
  formulaCard: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 19, padding: 15, marginBottom: 24 },
  formulaBadge: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }] },
  labelDark: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  formula: { fontSize: 14, fontWeight: '900', marginTop: 3 },
  hint: { lineHeight: 14, fontSize: 9, marginTop: 4 },
  sectionIntro: { marginBottom: 10 },
  sectionKicker: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  sectionTitle: { fontSize: 21, fontWeight: '900', marginTop: 2 },
  termWeightGrid: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 14 },
  termWeightCard: { flex: 1, minHeight: 137, borderWidth: 1, borderRadius: 16, padding: 10, overflow: 'hidden' },
  termWeightCardDrop: { marginTop: 13 },
  termEdge: { position: 'absolute', left: 0, top: 0, right: 0, height: 4 },
  termOrdinal: { fontSize: 9, fontWeight: '900', marginTop: 4 },
  termName: { fontSize: 11, fontWeight: '900', marginTop: 8, marginBottom: 'auto' },
  percentInputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 8 },
  percentInput: { flex: 1, paddingVertical: 8, fontWeight: '900', minWidth: 30, fontSize: 12 },
  percentSuffix: { fontWeight: '900', fontSize: 11 },
  controlStrip: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, borderWidth: 1, borderRadius: 17, padding: 13, marginBottom: 26 },
  label: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8, marginBottom: 5 },
  passingInput: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 11, paddingHorizontal: 10 },
  passingText: { flex: 1, paddingVertical: 9, fontWeight: '900' },
  defaultButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12 },
  defaultKicker: { fontSize: 7, fontWeight: '900', letterSpacing: 0.7 },
  defaultText: { fontSize: 11, fontWeight: '900', marginTop: 1 },
  termSection: { borderTopWidth: 1, paddingTop: 14, marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  termHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  termBullet: { width: 5, height: 35, borderRadius: 3 },
  termSectionTitle: { fontSize: 17, fontWeight: '900' },
  totalText: { fontSize: 9, fontWeight: '900', marginTop: 2 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  addText: { fontWeight: '900', fontSize: 10 },
  categoryCard: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderWidth: 1, borderRadius: 15, padding: 10, marginBottom: 8 },
  categoryCardInset: { marginLeft: 13 },
  rowNumber: { width: 31, height: 41, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowNumberText: { fontSize: 9, fontWeight: '900' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, fontSize: 11 },
  categoryWeightBox: { width: 88 },
  removeButton: { height: 41, width: 37, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  saveZone: { marginTop: 2 },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14, marginTop: 8 },
  saveText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  disabled: { opacity: 0.42 },
  gradebookButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, borderWidth: 1, borderRadius: 15, padding: 13 },
  gradebookKicker: { fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  gradebookText: { fontWeight: '900', fontSize: 13, marginTop: 2 },
  nextIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});