import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { FacultyGate } from '@/components/faculty/FacultyGate';

type Category = {
  id: string;
  name: string;
  weight_percent?: number | null;
  weight?: number | null;
};

type LinkStatus = {
  assessment_id: string;
  assessment_title: string;
  total_points: number;
  sync_to_gradebook: boolean;
  grade_item_id: string | null;
  grade_item_title: string | null;
  category_id: string | null;
  category_name: string | null;
  category_weight: number | null;
};

export default function FacultyAssessmentGradebookScreen() {
  const params = useLocalSearchParams<{
    assessmentId?: string;
    classroomId?: string;
    name?: string;
  }>();

  const assessmentId = String(params.assessmentId ?? '');
  const classroomId = String(params.classroomId ?? '');
  const assessmentName = String(params.name ?? 'Assessment');

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [itemTitle, setItemTitle] = useState(assessmentName);
  const [status, setStatus] = useState<LinkStatus | null>(null);
  const [saving, setSaving] = useState(false);

  const totalWeight = useMemo(
    () =>
      categories.reduce(
        (sum, item) => sum + Number(item.weight_percent ?? item.weight ?? 0),
        0
      ),
    [categories]
  );

  const load = async () => {
    const [{ data: categoryData, error: categoryError }, { data: statusData, error: statusError }] =
      await Promise.all([
        supabase
          .from('buklod_education_grade_categories')
          .select('*')
          .eq('classroom_id', classroomId)
          .order('created_at', { ascending: true }),
        supabase.rpc('buklod_education_assessment_gradebook_status_v1', {
          p_assessment_id: assessmentId,
        }),
      ]);

    if (categoryError) return Alert.alert('Grade Categories', categoryError.message);
    if (statusError) return Alert.alert('Gradebook Link', statusError.message);

    const categoryRows = (categoryData ?? []) as Category[];
    setCategories(categoryRows);

    const rawStatus = Array.isArray(statusData) ? statusData[0] : statusData;
    const nextStatus = (rawStatus ?? null) as LinkStatus | null;
    setStatus(nextStatus);

    if (nextStatus?.category_id) setSelectedCategoryId(nextStatus.category_id);
    else if (categoryRows.length > 0) setSelectedCategoryId(categoryRows[0].id);

    if (nextStatus?.grade_item_title) setItemTitle(nextStatus.grade_item_title);
  };

  useEffect(() => {
    load();
  }, [assessmentId, classroomId]);

  const link = async () => {
    if (!selectedCategoryId) {
      return Alert.alert(
        'Gradebook Link',
        'Create/select a grade category first. Assessment scores should not be assigned to an undefined category.'
      );
    }

    if (!itemTitle.trim()) {
      return Alert.alert('Gradebook Link', 'Enter a grade item title.');
    }

    setSaving(true);
    try {
      const { error } = await supabase.rpc('buklod_education_link_assessment_gradebook_v1', {
        p_assessment_id: assessmentId,
        p_category_id: selectedCategoryId,
        p_item_title: itemTitle.trim(),
      });

      if (error) throw error;

      Alert.alert(
        'Gradebook Linked',
        'Future released assessment results will sync into this grade item. Existing released results were also synchronized.'
      );
      await load();
    } catch (error) {
      Alert.alert('Gradebook Link', error instanceof Error ? error.message : 'Could not link assessment.');
    } finally {
      setSaving(false);
    }
  };

  const unlink = async () => {
    const { error } = await supabase.rpc('buklod_education_unlink_assessment_gradebook_v1', {
      p_assessment_id: assessmentId,
    });

    if (error) return Alert.alert('Unlink Gradebook', error.message);

    Alert.alert(
      'Gradebook Unlinked',
      'Automatic syncing is disabled. Existing grade records are preserved for audit/history.'
    );
    await load();
  };

  return (
    <FacultyGate>
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable style={styles.back} onPress={() => router.back()}>
        <MaterialCommunityIcons name="arrow-left" size={22} color="#17311f" />
        <Text style={styles.backText}>{assessmentName}</Text>
      </Pressable>

      <Text style={styles.eyebrow}>ASSESSMENT â†’ GRADEBOOK</Text>
      <Text style={styles.title}>Grade Integration</Text>
      <Text style={styles.subtitle}>
        Faculty chooses where this assessment belongs. Only faculty-released assessment results are copied to the normal gradebook.
      </Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Current link</Text>
        <Text style={styles.statusValue}>
          {status?.sync_to_gradebook
            ? `${status.category_name || 'Category'} • ${status.grade_item_title || assessmentName}`
            : 'Not linked'}
        </Text>
        <Text style={styles.meta}>
          Assessment points: {status?.total_points ?? 0}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Grade category</Text>
      <Text style={styles.helper}>
        Current category total: {totalWeight}%.
      </Text>

      {categories.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            No grade categories found. Create grade categories first before linking an assessment.
          </Text>
        </View>
      ) : (
        categories.map(category => {
          const selected = selectedCategoryId === category.id;
          const weight = Number(category.weight_percent ?? category.weight ?? 0);

          return (
            <Pressable
              key={category.id}
              style={[styles.categoryCard, selected && styles.categorySelected]}
              onPress={() => setSelectedCategoryId(category.id)}
            >
              <MaterialCommunityIcons
                name={selected ? 'radiobox-marked' : 'radiobox-blank'}
                size={22}
                color={selected ? '#1f7a3f' : '#758078'}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.categoryName}>{category.name}</Text>
                <Text style={styles.categoryWeight}>{weight}% of final grade</Text>
              </View>
            </Pressable>
          );
        })
      )}

      <Text style={styles.sectionTitle}>Grade item title</Text>
      <TextInput
        value={itemTitle}
        onChangeText={setItemTitle}
        placeholder="e.g. Midterm Examination"
        style={styles.input}
      />

      <Pressable
        style={[styles.primary, (saving || categories.length === 0) && styles.disabled]}
        disabled={saving || categories.length === 0}
        onPress={link}
      >
        <MaterialCommunityIcons name="link-variant" size={20} color="#fff" />
        <Text style={styles.primaryText}>{saving ? 'Linking…' : 'Link & Sync Released Results'}</Text>
      </Pressable>

      {!!status?.sync_to_gradebook && (
        <Pressable
          style={styles.unlink}
          onPress={() =>
            Alert.alert(
              'Unlink Assessment',
              'Disable future automatic gradebook syncing? Existing grades will remain preserved.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Unlink', style: 'destructive', onPress: unlink },
              ]
            )
          }
        >
          <Text style={styles.unlinkText}>Disable Gradebook Sync</Text>
        </Pressable>
      )}

      <View style={styles.note}>
        <MaterialCommunityIcons name="shield-check-outline" size={20} color="#1f7a3f" />
        <Text style={styles.noteText}>
          Student exam scores cannot write directly to final grades. The server sync runs only after faculty releases the assessment result, and each grade change is audit logged.
        </Text>
      </View>
    </ScrollView>
    </FacultyGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f7f2' },
  content: { padding: 20, paddingTop: 42, paddingBottom: 60 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 18 },
  backText: { color: '#17311f', fontWeight: '800' },
  eyebrow: { color: '#1f7a3f', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#17311f', fontSize: 27, fontWeight: '900' },
  subtitle: { color: '#68736b', marginTop: 5, marginBottom: 18, lineHeight: 19 },
  statusCard: { backgroundColor: '#fff', borderRadius: 16, padding: 15, marginBottom: 18 },
  statusLabel: { color: '#748078', fontSize: 11, fontWeight: '900' },
  statusValue: { color: '#26392d', fontWeight: '900', fontSize: 16, marginTop: 4 },
  meta: { color: '#748078', marginTop: 4, fontSize: 12 },
  sectionTitle: { color: '#26392d', fontWeight: '900', marginBottom: 5, marginTop: 4 },
  helper: { color: '#7b857e', fontSize: 12, marginBottom: 10 },
  empty: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12 },
  emptyText: { color: '#68736b', lineHeight: 18 },
  categoryCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 13, padding: 13, marginBottom: 8, borderWidth: 1, borderColor: 'transparent' },
  categorySelected: { backgroundColor: '#edf7ef', borderColor: '#1f7a3f' },
  categoryName: { color: '#304137', fontWeight: '900' },
  categoryWeight: { color: '#748078', marginTop: 2, fontSize: 12 },
  input: { backgroundColor: '#fff', borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, marginTop: 5, marginBottom: 14 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1f7a3f', borderRadius: 12, paddingVertical: 13 },
  primaryText: { color: '#fff', fontWeight: '900' },
  disabled: { opacity: 0.5 },
  unlink: { alignItems: 'center', paddingVertical: 13 },
  unlinkText: { color: '#9a4e3e', fontWeight: '900' },
  note: { flexDirection: 'row', gap: 10, backgroundColor: '#eaf4eb', borderRadius: 14, padding: 13, marginTop: 10 },
  noteText: { color: '#435349', flex: 1, lineHeight: 18, fontSize: 12 },
});