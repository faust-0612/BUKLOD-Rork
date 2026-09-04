import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { FacultyGate } from '@/components/faculty/FacultyGate';
import { exportEducationClassCsv } from '@/lib/education/exportClassCsv';
import { FACULTY_AUTOPILOT_MODULES, openFacultyAutopilotModule } from '@/lib/education/facultyAutopilot';
import { supabase } from '@/lib/supabase';

type StudentRow = {
  id: string;
  student_user_id: string;
  status: string;
  display_name?: string | null;
  username?: string | null;
};

type Category = {
  id: string;
  term_key: string;
  name: string;
  weight_percent: number;
};

type GradeItem = {
  id: string;
  title: string;
  points_possible: number;
  category_id: string | null;
  term_key: string;
};

const TERM_KEYS = ['PRELIM', 'MIDTERM', 'SEMIFINALS', 'FINALS'];

export default function BuklodFacultyClassScreen() {
  const params = useLocalSearchParams<{ id?: string; classroomId?: string; name?: string }>();
  const classroomId = String(params.id ?? params.classroomId ?? '');
  const classroomName = String(params.name ?? 'Classroom');

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [gradeItems, setGradeItems] = useState<GradeItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedGradeItemId, setSelectedGradeItemId] = useState('');
  const [gradeScore, setGradeScore] = useState('');
  const [gradeReason, setGradeReason] = useState('Manual faculty entry');
  const [showGrade, setShowGrade] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!classroomId) return;

    const [studentRes, categoryRes, gradeItemRes] = await Promise.all([
      supabase.rpc('buklod_education_roster_v1', { p_classroom_id: classroomId }),
      supabase
        .from('buklod_education_grade_categories')
        .select('id,term_key,name,weight_percent')
        .eq('classroom_id', classroomId)
        .order('created_at', { ascending: true }),
      supabase
        .from('buklod_education_grade_items')
        .select('id,title,points_possible,category_id,term_key')
        .eq('classroom_id', classroomId)
        .order('created_at', { ascending: false }),
    ]);

    if (studentRes.error) throw studentRes.error;
    if (categoryRes.error) throw categoryRes.error;
    if (gradeItemRes.error) throw gradeItemRes.error;

    setStudents((studentRes.data ?? []) as StudentRow[]);
    setCategories((categoryRes.data ?? []) as Category[]);
    setGradeItems((gradeItemRes.data ?? []) as GradeItem[]);
  }, [classroomId]);

  useEffect(() => {
    load().catch(error => Alert.alert('BUKLOD Faculty', error?.message ?? 'Could not load class.'));
  }, [load]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(item =>
      [item.display_name, item.username, item.student_user_id]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(q))
    );
  }, [search, students]);

  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {
      PRELIM: 0,
      MIDTERM: 0,
      SEMIFINALS: 0,
      FINALS: 0,
    };
    categories.forEach(item => {
      const key = String(item.term_key || 'PRELIM').toUpperCase();
      if (key in totals) totals[key] += Number(item.weight_percent || 0);
    });
    return totals;
  }, [categories]);

  const gradingReady = TERM_KEYS.every(key => Math.abs((categoryTotals[key] ?? 0) - 100) < 0.0001);

  const selectedItem = gradeItems.find(item => item.id === selectedGradeItemId) ?? null;

  const saveManualGrade = async () => {
    const score = Number(gradeScore);
    if (!selectedStudentId || !selectedGradeItemId || !Number.isFinite(score)) {
      return Alert.alert('Manual Grade', 'Select a student, grade item, and valid score.');
    }
    if (!selectedItem) return;
    if (score < 0 || score > Number(selectedItem.points_possible)) {
      return Alert.alert('Manual Grade', `Score must be from 0 to ${selectedItem.points_possible}.`);
    }

    setBusy(true);
    const { error } = await supabase.rpc('buklod_education_set_manual_grade_v1', {
      p_classroom_id: classroomId,
      p_grade_item_id: selectedGradeItemId,
      p_student_user_id: selectedStudentId,
      p_score: score,
      p_reason: gradeReason.trim() || 'Manual faculty entry',
    });
    setBusy(false);

    if (error) return Alert.alert('Manual Grade', error.message);
    setGradeScore('');
    setShowGrade(false);
    Alert.alert('Manual Grade', 'Saved as faculty draft with audit trail. Release it when ready for the student.');
  };

  const releaseSelectedGrade = async () => {
    if (!selectedStudentId || !selectedGradeItemId) {
      return Alert.alert('Release Grade', 'Select a student and grade item first.');
    }

    setBusy(true);
    const { error } = await supabase.rpc('buklod_education_release_grade_v1', {
      p_grade_item_id: selectedGradeItemId,
      p_student_user_id: selectedStudentId,
      p_reason: 'Faculty released grade to student',
    });
    setBusy(false);

    if (error) return Alert.alert('Release Grade', error.message);
    Alert.alert('Grade Released', 'The released item can now contribute to the term/final grade engine.');
  };

  const exportCsv = async () => {
    try {
      await exportEducationClassCsv(classroomId, classroomName);
    } catch (error) {
      Alert.alert('Export', error instanceof Error ? error.message : 'Export failed.');
    }
  };

  return (
    <FacultyGate>
      <>
        <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
          <Pressable onPress={() => router.back()} style={styles.back}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#17311f" />
            <Text style={styles.backText}>BUKLOD Faculty</Text>
          </Pressable>

          <Text style={styles.eyebrow}>FACULTY CLASSROOM</Text>
          <Text style={styles.title}>{classroomName}</Text>

          <View style={styles.metrics}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{students.length}</Text>
              <Text style={styles.metricLabel}>Students</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>4</Text>
              <Text style={styles.metricLabel}>Grading Terms</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{gradeItems.length}</Text>
              <Text style={styles.metricLabel}>Grade Items</Text>
            </View>
          </View>

          <View style={[styles.gradingStatus, gradingReady ? styles.gradingReady : styles.gradingWarn]}>
            <MaterialCommunityIcons
              name={gradingReady ? 'check-circle-outline' : 'alert-circle-outline'}
              size={23}
              color={gradingReady ? '#1f7a3f' : '#9b6c32'}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.gradingTitle}>{gradingReady ? '4-term grading setup ready' : 'Grading setup needs attention'}</Text>
              <Text style={styles.gradingText}>
                Prelim {categoryTotals.PRELIM.toFixed(0)}% · Midterm {categoryTotals.MIDTERM.toFixed(0)}% · Semifinals {categoryTotals.SEMIFINALS.toFixed(0)}% · Finals {categoryTotals.FINALS.toFixed(0)}%
              </Text>
            </View>
            <Pressable
              style={styles.miniButton}
              onPress={() =>
                router.push({
                  pathname: '/profile/buklod-faculty-grading-setup' as any,
                  params: { id: classroomId, classroomId, name: classroomName },
                })
              }
            >
              <Text style={styles.miniButtonText}>Edit</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() =>
              router.push({
                pathname: '/profile/buklod-classroom' as any,
                params: { id: classroomId, name: classroomName },
              })
            }
            style={styles.classroomButton}
          >
            <View style={styles.classroomIcon}>
              <MaterialCommunityIcons name="google-classroom" size={27} color="#1f7a3f" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.classroomTitle}>Open BUKLOD Classroom</Text>
              <Text style={styles.classroomHint}>Live class, discussions, messages, activities, submissions and materials.</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={23} color="#fff" />
          </Pressable>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Roster</Text>
            <Pressable
              style={styles.smallButton}
              onPress={() =>
                router.push({
                  pathname: '/profile/buklod-faculty-roster' as any,
                  params: { id: classroomId, classroomId, name: classroomName },
                })
              }
            >
              <Text style={styles.smallButtonText}>Manage</Text>
            </Pressable>
          </View>

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search enrolled students"
            style={styles.search}
          />

          {filteredStudents.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No active students yet</Text>
              <Text style={styles.emptyText}>Use Roster & Groups to enroll students.</Text>
            </View>
          ) : (
            filteredStudents.map(student => (
              <Pressable
                key={student.id}
                style={[styles.studentCard, selectedStudentId === student.student_user_id && styles.studentSelected]}
                onPress={() => setSelectedStudentId(student.student_user_id)}
              >
                <View style={styles.avatar}>
                  <MaterialCommunityIcons name="account" size={23} color="#1f7a3f" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.studentName}>{student.display_name || student.username || 'BUKLOD Student'}</Text>
                  <Text style={styles.studentMeta}>{student.username ? `@${student.username}` : student.student_user_id.slice(0, 8)}</Text>
                </View>
                {selectedStudentId === student.student_user_id && (
                  <MaterialCommunityIcons name="check-circle" size={21} color="#1f7a3f" />
                )}
              </Pressable>
            ))
          )}

          <Text style={styles.sectionTitle}>Faculty Autopilot</Text>
          <View style={styles.actionGrid}>
            {FACULTY_AUTOPILOT_MODULES.map(module => (
              <Pressable
                key={module.key}
                style={styles.actionCard}
                onPress={() => openFacultyAutopilotModule(module, { id: classroomId, name: classroomName })}
              >
                <MaterialCommunityIcons name={module.icon as any} size={24} color="#1f7a3f" />
                <Text style={styles.actionTitle}>{module.title}</Text>
                <Text style={styles.actionHint}>{module.description}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Grade Actions</Text>
          <Pressable
            style={styles.wideTool}
            onPress={() =>
              router.push({
                pathname: '/profile/buklod-faculty-grade-scanner' as any,
                params: { id: classroomId, classroomId, name: classroomName },
              })
            }
          >
            <View style={styles.toolIcon}>
              <Text style={styles.aiText}>AI</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.toolTitle}>Grade Scanner</Text>
              <Text style={styles.toolHint}>Scan papers/PDFs, apply the teacher rubric, then review before gradebook entry.</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color="#1f7a3f" />
          </Pressable>

          <View style={styles.actionGrid}>
            <Pressable
              style={[styles.actionCard, (!selectedStudentId || gradeItems.length === 0) && styles.disabled]}
              disabled={!selectedStudentId || gradeItems.length === 0}
              onPress={() => setShowGrade(true)}
            >
              <MaterialCommunityIcons name="pencil-box-outline" size={24} color="#1f7a3f" />
              <Text style={styles.actionTitle}>Manual Grade</Text>
              <Text style={styles.actionHint}>Draft score with audit trail.</Text>
            </Pressable>

            <Pressable
              style={[styles.actionCard, (!selectedStudentId || !selectedGradeItemId || busy) && styles.disabled]}
              disabled={!selectedStudentId || !selectedGradeItemId || busy}
              onPress={releaseSelectedGrade}
            >
              <MaterialCommunityIcons name="lock-open-check-outline" size={24} color="#1f7a3f" />
              <Text style={styles.actionTitle}>Release Item Grade</Text>
              <Text style={styles.actionHint}>Only released/locked items count.</Text>
            </Pressable>

            <Pressable style={styles.actionCard} onPress={exportCsv}>
              <MaterialCommunityIcons name="file-delimited-outline" size={24} color="#1f7a3f" />
              <Text style={styles.actionTitle}>Export Class CSV</Text>
              <Text style={styles.actionHint}>Excel-ready faculty report.</Text>
            </Pressable>
          </View>

          <View style={styles.note}>
            <MaterialCommunityIcons name="shield-check-outline" size={20} color="#1f7a3f" />
            <Text style={styles.noteText}>
              BUKLOD Quiz and BUKLOD Attendance remain authoritative sources. Classroom composes released scores into the faculty-controlled gradebook; it does not reset attempts or attendance records.
            </Text>
          </View>
        </ScrollView>

        <Modal transparent visible={showGrade} animationType="fade" onRequestClose={() => setShowGrade(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Manual Grade</Text>
              <Text style={styles.modalHint}>Select a grade item for the chosen student. The score is saved as DRAFT first.</Text>

              <ScrollView style={{ maxHeight: 260 }}>
                {gradeItems.map(item => (
                  <Pressable
                    key={item.id}
                    style={[styles.choice, selectedGradeItemId === item.id && styles.choiceOn]}
                    onPress={() => setSelectedGradeItemId(item.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.choiceTitle, selectedGradeItemId === item.id && styles.choiceTitleOn]}>{item.title}</Text>
                      <Text style={styles.choiceMeta}>{item.term_key} · {item.points_possible} points</Text>
                    </View>
                    {selectedGradeItemId === item.id && <MaterialCommunityIcons name="check" size={19} color="#fff" />}
                  </Pressable>
                ))}
              </ScrollView>

              <TextInput
                value={gradeScore}
                onChangeText={setGradeScore}
                keyboardType="decimal-pad"
                placeholder={selectedItem ? `Score / ${selectedItem.points_possible}` : 'Score'}
                style={styles.input}
              />
              <TextInput
                value={gradeReason}
                onChangeText={setGradeReason}
                placeholder="Reason / note"
                style={styles.input}
              />

              <Pressable style={[styles.saveButton, busy && styles.disabled]} disabled={busy} onPress={saveManualGrade}>
                <Text style={styles.saveButtonText}>{busy ? 'Saving...' : 'Save Draft Grade'}</Text>
              </Pressable>
              <Pressable style={styles.cancelButton} onPress={() => setShowGrade(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </>
    </FacultyGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f7f2' },
  content: { padding: 20, paddingTop: 42, paddingBottom: 70 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 18 },
  backText: { color: '#17311f', fontWeight: '900' },
  eyebrow: { color: '#1f7a3f', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#17311f', fontSize: 27, fontWeight: '900', marginTop: 3, marginBottom: 14 },
  metrics: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  metricCard: { flex: 1, backgroundColor: '#fff', borderRadius: 13, padding: 11, borderWidth: 1, borderColor: '#e0e8e1' },
  metricValue: { color: '#1f7a3f', fontSize: 21, fontWeight: '900' },
  metricLabel: { color: '#748078', fontSize: 10, marginTop: 2 },
  gradingStatus: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 12, marginBottom: 14, borderWidth: 1 },
  gradingReady: { backgroundColor: '#e9f5eb', borderColor: '#c5dfca' },
  gradingWarn: { backgroundColor: '#fff1df', borderColor: '#efd2a7' },
  gradingTitle: { color: '#304137', fontWeight: '900' },
  gradingText: { color: '#6a766d', fontSize: 10, marginTop: 3, lineHeight: 15 },
  miniButton: { backgroundColor: '#fff', borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8 },
  miniButtonText: { color: '#1f7a3f', fontWeight: '900', fontSize: 11 },
  classroomButton: { backgroundColor: '#174c2b', borderRadius: 18, padding: 16, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  classroomIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#e7f4e9', alignItems: 'center', justifyContent: 'center' },
  classroomTitle: { color: '#fff', fontWeight: '900', fontSize: 17 },
  classroomHint: { color: '#d4e5d8', lineHeight: 17, fontSize: 11, marginTop: 3 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { color: '#26392d', fontWeight: '900', fontSize: 17, marginTop: 18, marginBottom: 10 },
  smallButton: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#e9f4eb', borderRadius: 9 },
  smallButtonText: { color: '#1f7a3f', fontWeight: '900', fontSize: 11 },
  search: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe8e1', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  empty: { backgroundColor: '#fff', borderRadius: 13, padding: 14 },
  emptyTitle: { color: '#304137', fontWeight: '900' },
  emptyText: { color: '#748078', marginTop: 3 },
  studentCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 13, padding: 11, marginBottom: 7, borderWidth: 1, borderColor: '#e4eae5' },
  studentSelected: { borderColor: '#79ad85', backgroundColor: '#f0f8f1' },
  avatar: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#e8f3ea', alignItems: 'center', justifyContent: 'center' },
  studentName: { color: '#2d4033', fontWeight: '900' },
  studentMeta: { color: '#7a857e', fontSize: 10, marginTop: 2 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  actionCard: { width: '48%', backgroundColor: '#fff', borderRadius: 14, padding: 13, borderWidth: 1, borderColor: '#e1e8e2', minHeight: 112 },
  actionTitle: { color: '#304137', fontWeight: '900', marginTop: 7 },
  actionHint: { color: '#748078', fontSize: 10, lineHeight: 15, marginTop: 3 },
  wideTool: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe8e1', borderRadius: 15, padding: 13, marginBottom: 9 },
  toolIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#e4efe6', alignItems: 'center', justifyContent: 'center' },
  aiText: { color: '#1f7a3f', fontWeight: '900', fontSize: 12 },
  toolTitle: { color: '#22382a', fontSize: 15, fontWeight: '900' },
  toolHint: { color: '#738078', fontSize: 10, lineHeight: 15, marginTop: 2 },
  disabled: { opacity: 0.4 },
  note: { flexDirection: 'row', gap: 10, backgroundColor: '#eaf4eb', borderRadius: 14, padding: 13, marginTop: 16 },
  noteText: { flex: 1, color: '#435349', lineHeight: 18, fontSize: 12 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, maxHeight: '82%' },
  modalTitle: { color: '#24382b', fontWeight: '900', fontSize: 20 },
  modalHint: { color: '#748078', lineHeight: 17, fontSize: 11, marginTop: 4, marginBottom: 10 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#dfe8e1', borderRadius: 11, padding: 10, marginBottom: 7 },
  choiceOn: { backgroundColor: '#1f7a3f', borderColor: '#1f7a3f' },
  choiceTitle: { color: '#304137', fontWeight: '900' },
  choiceTitleOn: { color: '#fff' },
  choiceMeta: { color: '#87928a', fontSize: 10, marginTop: 2 },
  input: { backgroundColor: '#f5f7f4', borderWidth: 1, borderColor: '#e0e6e1', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, marginTop: 8 },
  saveButton: { backgroundColor: '#1f7a3f', borderRadius: 11, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  saveButtonText: { color: '#fff', fontWeight: '900' },
  cancelButton: { alignItems: 'center', paddingVertical: 10 },
  cancelText: { color: '#6e786f', fontWeight: '800' },
});
