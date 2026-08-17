import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';

import { supabase } from '@/lib/supabase';

type Category = {
  id: string;
  name: string;
  weight_percent: number;
  category_type: string;
  is_visible_to_students: boolean;
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

export default function BuklodFacultyFinalGradesScreen() {
  const params = useLocalSearchParams<{ classroomId?: string; name?: string }>();
  const classroomId = String(params.classroomId ?? '');
  const className = String(params.name ?? 'Class');

  const [categories, setCategories] = useState<Category[]>([]);
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryWeight, setCategoryWeight] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const totalWeight = useMemo(
    () => categories.reduce((sum, item) => sum + Number(item.weight_percent || 0), 0),
    [categories]
  );

  const load = useCallback(async () => {
    if (!classroomId) return;

    const [{ data: categoryData, error: categoryError }, { data: summaryData, error: summaryError }] =
      await Promise.all([
        supabase
          .from('buklod_education_grade_categories')
          .select('id,name,weight_percent,category_type,is_visible_to_students')
          .eq('classroom_id', classroomId)
          .order('created_at', { ascending: true }),
        supabase.rpc('buklod_education_faculty_final_grade_summary_v1', {
          p_classroom_id: classroomId,
        }),
      ]);

    if (categoryError) return Alert.alert('Grade Categories', categoryError.message);
    if (summaryError) return Alert.alert('Final Grades', summaryError.message);

    setCategories((categoryData ?? []) as Category[]);
    setStudents((summaryData ?? []) as StudentSummary[]);
  }, [classroomId]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const resetEditor = () => {
    setEditCategoryId(null);
    setCategoryName('');
    setCategoryWeight('');
  };

  const startEdit = (item: Category) => {
    setEditCategoryId(item.id);
    setCategoryName(item.name);
    setCategoryWeight(String(item.weight_percent));
  };

  const saveCategory = async () => {
    const nextName = categoryName.trim();
    const nextWeight = Number(categoryWeight);

    if (!nextName) return Alert.alert('Category', 'Enter a category name.');
    if (!Number.isFinite(nextWeight) || nextWeight < 0 || nextWeight > 100) {
      return Alert.alert('Category', 'Weight must be from 0 to 100.');
    }

    const { error } = await supabase.rpc('buklod_education_save_grade_category_v1', {
      p_classroom_id: classroomId,
      p_category_id: editCategoryId,
      p_name: nextName,
      p_weight_percent: nextWeight,
    });

    if (error) return Alert.alert('Category', error.message);

    resetEditor();
    await load();
  };

  const removeCategory = (item: Category) => {
    Alert.alert(
      'Delete Category',
      `Delete "${item.name}"? This is allowed only when no grade items use it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.rpc('buklod_education_delete_grade_category_v1', {
              p_category_id: item.id,
            });
            if (error) return Alert.alert('Delete Category', error.message);
            if (editCategoryId === item.id) resetEditor();
            await load();
          },
        },
      ]
    );
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
    } catch (error) {
      Alert.alert('Final Grade', error instanceof Error ? error.message : 'Action failed.');
    } finally {
      setBusyId(null);
    }
  };

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

      <Text style={styles.eyebrow}>COMPLETE GRADEBOOK</Text>
      <Text style={styles.title}>Final Grade Engine</Text>
      <Text style={styles.subtitle}>
        Finalization is allowed only when category weights equal exactly 100% and every positive-weight category has released or locked graded work.
      </Text>

      <View
        style={[
          styles.readiness,
          Math.abs(totalWeight - 100) < 0.0001 ? styles.ready : styles.notReady,
        ]}
      >
        <Text style={styles.readinessTitle}>Category total: {totalWeight.toFixed(1)}%</Text>
        <Text style={styles.readinessText}>
          {Math.abs(totalWeight - 100) < 0.0001
            ? 'Weight structure is ready for final-grade computation.'
            : 'Adjust categories until the total is exactly 100%.'}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Grade Categories</Text>

      {categories.map(item => (
        <View key={item.id} style={styles.categoryCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.categoryName}>{item.name}</Text>
            <Text style={styles.meta}>
              {Number(item.weight_percent).toFixed(1)}% of final grade
            </Text>
          </View>

          <Pressable style={styles.smallButton} onPress={() => startEdit(item)}>
            <Text style={styles.smallButtonText}>Edit</Text>
          </Pressable>

          <Pressable style={styles.deleteButton} onPress={() => removeCategory(item)}>
            <MaterialCommunityIcons name="delete-outline" size={18} color="#9b4b40" />
          </Pressable>
        </View>
      ))}

      <View style={styles.addCard}>
        <Text style={styles.cardTitle}>
          {editCategoryId ? 'Edit Category' : 'Add Category'}
        </Text>

        <TextInput
          value={categoryName}
          onChangeText={setCategoryName}
          placeholder="e.g. Written Works"
          style={styles.input}
        />

        <TextInput
          value={categoryWeight}
          onChangeText={setCategoryWeight}
          placeholder="Weight %"
          keyboardType="decimal-pad"
          style={styles.input}
        />

        <Pressable style={styles.primary} onPress={saveCategory}>
          <Text style={styles.primaryText}>
            {editCategoryId ? 'Save Category' : 'Add Category'}
          </Text>
        </Pressable>

        {!!editCategoryId && (
          <Pressable style={styles.cancelButton} onPress={resetEditor}>
            <Text style={styles.cancelText}>Cancel Edit</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.sectionTitle}>Student Final Grades</Text>

      {students.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No active enrolled students found.</Text>
        </View>
      ) : (
        students.map(student => {
          const busy = busyId === student.student_user_id;
          const status = student.final_status ?? 'NOT COMPUTED';

          return (
            <View key={student.student_user_id} style={styles.studentCard}>
              <View style={styles.studentHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.studentName}>{student.display_name}</Text>
                  <Text style={styles.meta}>
                    Covered weight: {Number(student.covered_weight || 0).toFixed(1)}%
                  </Text>
                </View>
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>{status}</Text>
                </View>
              </View>

              <View style={styles.metrics}>
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>
                    {student.current_percent == null
                      ? 'â€”'
                      : Number(student.current_percent).toFixed(2)}
                  </Text>
                  <Text style={styles.metricLabel}>Current %</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>
                    {Number(student.weighted_points || 0).toFixed(2)}
                  </Text>
                  <Text style={styles.metricLabel}>Weighted pts</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>
                    {student.final_grade == null ? 'â€”' : Number(student.final_grade).toFixed(2)}
                  </Text>
                  <Text style={styles.metricLabel}>Final</Text>
                </View>
              </View>

              <Text
                style={[styles.readyText, !student.ready_for_final && styles.notReadyText]}
              >
                {student.ready_for_final
                  ? 'Ready for final computation'
                  : `Incomplete: ${student.represented_categories}/${student.positive_categories} weighted categories represented`}
              </Text>

              <View style={styles.actions}>
                <Pressable
                  disabled={
                    busy ||
                    !student.ready_for_final ||
                    status === 'RELEASED' ||
                    status === 'LOCKED'
                  }
                  style={[
                    styles.action,
                    (busy ||
                      !student.ready_for_final ||
                      status === 'RELEASED' ||
                      status === 'LOCKED') &&
                      styles.disabled,
                  ]}
                  onPress={() => runAction(student.student_user_id, 'compute')}
                >
                  <Text style={styles.actionText}>Compute</Text>
                </Pressable>

                <Pressable
                  disabled={busy || !['DRAFT', 'REVIEWED'].includes(status)}
                  style={[
                    styles.action,
                    (busy || !['DRAFT', 'REVIEWED'].includes(status)) && styles.disabled,
                  ]}
                  onPress={() => runAction(student.student_user_id, 'release')}
                >
                  <Text style={styles.actionText}>Release</Text>
                </Pressable>

                <Pressable
                  disabled={busy || status !== 'RELEASED'}
                  style={[
                    styles.action,
                    (busy || status !== 'RELEASED') && styles.disabled,
                  ]}
                  onPress={() => runAction(student.student_user_id, 'lock')}
                >
                  <Text style={styles.actionText}>Lock</Text>
                </Pressable>

                <Pressable
                  disabled={busy || !['RELEASED', 'LOCKED'].includes(status)}
                  style={[
                    styles.action,
                    (busy || !['RELEASED', 'LOCKED'].includes(status)) && styles.disabled,
                  ]}
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
          Released and locked item grades are the only inputs to the final-grade calculation. Reopening a released final grade returns it to faculty review before any recomputation or re-release.
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
  title: { color: '#17311f', fontSize: 27, fontWeight: '900' },
  subtitle: { color: '#68736b', marginTop: 5, marginBottom: 16, lineHeight: 19 },
  readiness: { borderRadius: 15, padding: 14, marginBottom: 18 },
  ready: { backgroundColor: '#e8f4e9' },
  notReady: { backgroundColor: '#fff0dc' },
  readinessTitle: { color: '#26392d', fontWeight: '900', fontSize: 16 },
  readinessText: { color: '#68736b', marginTop: 4, lineHeight: 18 },
  sectionTitle: { color: '#26392d', fontWeight: '900', fontSize: 17, marginTop: 8, marginBottom: 10 },
  categoryCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 14, padding: 13, marginBottom: 8 },
  categoryName: { color: '#304137', fontWeight: '900' },
  meta: { color: '#748078', marginTop: 2, fontSize: 12 },
  smallButton: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#edf5ee', borderRadius: 9 },
  smallButtonText: { color: '#1f7a3f', fontWeight: '900' },
  deleteButton: { padding: 8 },
  addCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 18 },
  cardTitle: { color: '#304137', fontWeight: '900', marginBottom: 9 },
  input: { backgroundColor: '#f4f7f2', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 8 },
  primary: { backgroundColor: '#1f7a3f', borderRadius: 11, paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '900' },
  cancelButton: { alignItems: 'center', paddingVertical: 10 },
  cancelText: { color: '#6e786f', fontWeight: '800' },
  empty: { backgroundColor: '#fff', borderRadius: 14, padding: 14 },
  emptyText: { color: '#68736b' },
  studentCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10 },
  studentHeader: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  studentName: { color: '#26392d', fontWeight: '900', fontSize: 15 },
  statusPill: { backgroundColor: '#edf2ed', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { color: '#536057', fontSize: 10, fontWeight: '900' },
  metrics: { flexDirection: 'row', gap: 8, marginTop: 12 },
  metric: { flex: 1, backgroundColor: '#f5f7f4', borderRadius: 11, padding: 9 },
  metricValue: { color: '#21382a', fontWeight: '900', fontSize: 16 },
  metricLabel: { color: '#79827c', fontSize: 10, marginTop: 2 },
  readyText: { color: '#1f7a3f', fontWeight: '800', marginTop: 10, fontSize: 12 },
  notReadyText: { color: '#9b6c32' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  action: { backgroundColor: '#edf5ee', borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8 },
  actionText: { color: '#1f7a3f', fontWeight: '900', fontSize: 12 },
  disabled: { opacity: 0.35 },
  note: { flexDirection: 'row', gap: 10, backgroundColor: '#eaf4eb', borderRadius: 14, padding: 13, marginTop: 10 },
  noteText: { flex: 1, color: '#435349', lineHeight: 18, fontSize: 12 },
});