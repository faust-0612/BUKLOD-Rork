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

import { FacultyGate } from '@/components/faculty/FacultyGate';
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
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#1f7a3f" />
          <Text style={styles.muted}>Loading grading setup...</Text>
        </View>
      </FacultyGate>
    );
  }

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

        <Text style={styles.eyebrow}>BUKLOD CLASSROOM</Text>
        <Text style={styles.title}>Grading Setup</Text>
        <Text style={styles.subtitle}>
          Excel default is preloaded, but faculty can manually update term and category weights. Final grades remain faculty-reviewed before release.
        </Text>

        <View style={[styles.statusCard, setupReady ? styles.readyCard : styles.warnCard]}>
          <View style={styles.statusIcon}>
            <MaterialCommunityIcons
              name={setupReady ? 'check-circle-outline' : 'alert-circle-outline'}
              size={25}
              color={setupReady ? '#1f7a3f' : '#a05c00'}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>{setupReady ? 'Setup ready' : 'Setup needs adjustment'}</Text>
            <Text style={styles.statusText}>Term total: {termWeightTotal.toFixed(1)}% · Passing: {passingPercent || '0'}%</Text>
          </View>
        </View>

        <View style={styles.formulaCard}>
          <Text style={styles.label}>GRADE EQUIVALENT FORMULA</Text>
          <Text style={styles.formula}>50 + (Raw Score ÷ Highest Possible Score × 50)</Text>
          <Text style={styles.hint}>Example: 40/50 = 90 equivalent. Released/locked item grades only are included in final computation.</Text>
        </View>

        <Text style={styles.sectionTitle}>Grading Periods</Text>
        <View style={styles.termWeightGrid}>
          {terms.map(term => (
            <View key={term.key} style={styles.termWeightCard}>
              <Text style={styles.termName}>{term.label}</Text>
              <View style={styles.percentInputWrap}>
                <TextInput
                  value={String(term.weight_percent)}
                  onChangeText={value => updateTermWeight(term.key, value)}
                  keyboardType="decimal-pad"
                  style={styles.percentInput}
                />
                <Text style={styles.percentSuffix}>%</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.inlineRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>PASSING GRADE</Text>
            <TextInput
              value={passingPercent}
              onChangeText={setPassingPercent}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>
          <Pressable style={styles.secondaryButton} onPress={applyDefault} disabled={saving}>
            <MaterialCommunityIcons name="restore" size={20} color="#1f7a3f" />
            <Text style={styles.secondaryText}>Excel Default</Text>
          </Pressable>
        </View>

        {terms.map(term => {
          const rows = categories.filter(item => item.term_key === term.key);
          const total = categoryTotals[term.key];
          const ok = Math.abs(total - 100) < 0.0001;
          return (
            <View key={term.key} style={styles.termSection}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>{term.label}</Text>
                  <Text style={[styles.totalText, !ok && styles.totalWarn]}>Category total: {total.toFixed(1)}%</Text>
                </View>
                <Pressable style={styles.addButton} onPress={() => addCategory(term.key)}>
                  <MaterialCommunityIcons name="plus" size={19} color="#1f7a3f" />
                  <Text style={styles.addText}>Category</Text>
                </Pressable>
              </View>

              {rows.map(item => (
                <View key={item.client_key} style={styles.categoryCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>CATEGORY</Text>
                    <TextInput
                      value={item.name}
                      onChangeText={value => updateCategory(item.client_key, { name: value })}
                      style={styles.input}
                    />
                  </View>
                  <View style={styles.categoryWeightBox}>
                    <Text style={styles.label}>WEIGHT</Text>
                    <View style={styles.percentInputWrap}>
                      <TextInput
                        value={String(item.weight_percent)}
                        onChangeText={value => updateCategory(item.client_key, { weight_percent: numberOrZero(value) })}
                        keyboardType="decimal-pad"
                        style={styles.percentInput}
                      />
                      <Text style={styles.percentSuffix}>%</Text>
                    </View>
                  </View>
                  <Pressable style={styles.removeButton} onPress={() => removeCategory(item)}>
                    <MaterialCommunityIcons name="trash-can-outline" size={20} color="#b33a3a" />
                  </Pressable>
                </View>
              ))}
            </View>
          );
        })}

        <Pressable
          style={[styles.saveButton, (!setupReady || saving) && styles.disabled]}
          onPress={saveSetup}
          disabled={!setupReady || saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <MaterialCommunityIcons name="content-save-check-outline" size={21} color="#fff" />}
          <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Grading Setup'}</Text>
        </Pressable>

        <Pressable
          style={styles.gradebookButton}
          onPress={() =>
            router.push({
              pathname: '/profile/buklod-faculty-final-grades' as any,
              params: { classroomId, id: classroomId, name: className },
            })
          }
        >
          <Text style={styles.gradebookText}>Continue to Gradebook & Final Grades</Text>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#1f7a3f" />
        </Pressable>
      </ScrollView>
    </FacultyGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f8f5' },
  content: { padding: 18, paddingBottom: 48 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#f5f8f5' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  backText: { color: '#17311f', fontWeight: '800', fontSize: 14 },
  eyebrow: { color: '#1f7a3f', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#17311f', fontSize: 29, fontWeight: '900', marginTop: 5 },
  subtitle: { color: '#657269', lineHeight: 20, marginTop: 8, marginBottom: 18 },
  muted: { color: '#738078' },
  statusCard: { flexDirection: 'row', gap: 12, borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1 },
  readyCard: { backgroundColor: '#edf8ef', borderColor: '#b9dec0' },
  warnCard: { backgroundColor: '#fff7e8', borderColor: '#efd29d' },
  statusIcon: { paddingTop: 1 },
  statusTitle: { fontSize: 15, fontWeight: '900', color: '#24382b' },
  statusText: { fontSize: 12, color: '#647168', marginTop: 3 },
  formulaCard: { backgroundColor: '#17311f', borderRadius: 17, padding: 16, marginBottom: 22 },
  formula: { color: '#fff', fontSize: 16, fontWeight: '900', marginTop: 5 },
  hint: { color: '#b9cbbd', lineHeight: 17, fontSize: 11, marginTop: 6 },
  sectionTitle: { color: '#24382b', fontSize: 18, fontWeight: '900', marginBottom: 8 },
  termWeightGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  termWeightCard: { width: '48%', backgroundColor: '#fff', borderRadius: 15, padding: 13, borderWidth: 1, borderColor: '#dfe8e1' },
  termName: { color: '#24382b', fontWeight: '900', marginBottom: 7 },
  percentInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f7faf7', borderWidth: 1, borderColor: '#dbe4dd', borderRadius: 11, paddingHorizontal: 10 },
  percentInput: { flex: 1, paddingVertical: 9, color: '#17311f', fontWeight: '800', minWidth: 42 },
  percentSuffix: { color: '#66736a', fontWeight: '800' },
  inlineRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 22 },
  label: { color: '#6a786e', fontSize: 10, fontWeight: '900', letterSpacing: 0.7, marginBottom: 5 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe4dd', borderRadius: 11, paddingHorizontal: 11, paddingVertical: 10, color: '#17311f' },
  secondaryButton: { height: 43, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#e9f4eb', borderRadius: 11, paddingHorizontal: 13 },
  secondaryText: { color: '#1f7a3f', fontWeight: '900', fontSize: 12 },
  termSection: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  totalText: { color: '#1f7a3f', fontSize: 11, fontWeight: '800' },
  totalWarn: { color: '#a05c00' },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: '#e9f4eb' },
  addText: { color: '#1f7a3f', fontWeight: '900', fontSize: 11 },
  categoryCard: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe8e1', borderRadius: 14, padding: 11, marginBottom: 8 },
  categoryWeightBox: { width: 92 },
  removeButton: { height: 41, width: 39, borderRadius: 10, backgroundColor: '#fff0f0', alignItems: 'center', justifyContent: 'center' },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1f7a3f', borderRadius: 14, paddingVertical: 14, marginTop: 4 },
  saveText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  disabled: { opacity: 0.45 },
  gradebookButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe8e1', borderRadius: 14, padding: 14 },
  gradebookText: { color: '#1f7a3f', fontWeight: '900' },
});
