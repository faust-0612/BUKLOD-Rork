import { useEffect, useMemo, useState } from 'react';
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

import { supabase } from '@/lib/supabase';
import { exportEducationClassCsv } from '@/lib/education/exportClassCsv';
import { FACULTY_AUTOPILOT_MODULES, openFacultyAutopilotModule } from '@/lib/education/facultyAutopilot';
import { FacultyGate } from '@/components/faculty/FacultyGate';

type StudentRow = {
  id: string;
  student_user_id: string;
  status: string;
  display_name?: string | null;
  username?: string | null;
};

type Category = {
  id: string;
  name: string;
  weight_percent: number;
};

type GradeItem = {
  id: string;
  title: string;
  points_possible: number;
  category_id: string | null;
};

export default function BuklodFacultyClassScreen() {
  const params = useLocalSearchParams<{ id?: string; classroomId?: string; name?: string }>();
  const classroomId = String(params.id ?? params.classroomId ?? '');
  const classroomName = String(params.name ?? 'Classroom');

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [gradeItems, setGradeItems] = useState<GradeItem[]>([]);
  const [search, setSearch] = useState('');
  const [showEnroll, setShowEnroll] = useState(false);
  const [showGrade, setShowGrade] = useState(false);
  const [showObservation, setShowObservation] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedGradeItemId, setSelectedGradeItemId] = useState('');
  const [gradeScore, setGradeScore] = useState('');
  const [gradeReason, setGradeReason] = useState('Manual faculty entry');
  const [obsType, setObsType] = useState('PARTICIPATION');
  const [obsScore, setObsScore] = useState('');
  const [obsPoints, setObsPoints] = useState('10');
  const [obsNote, setObsNote] = useState('');

  const totalWeight = useMemo(
    () => categories.reduce((sum, item) => sum + Number(item.weight_percent || 0), 0),
    [categories]
  );

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(item =>
      [item.display_name, item.username, item.student_user_id]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(q))
    );
  }, [search, students]);

  const load = async () => {
    if (!classroomId) return;

    const [studentRes, categoryRes, gradeItemRes] = await Promise.all([
      supabase.rpc('buklod_education_roster_v1', { p_classroom_id: classroomId }),
      supabase
        .from('buklod_education_grade_categories')
        .select('id,name,weight_percent')
        .eq('classroom_id', classroomId)
        .order('created_at', { ascending: true }),
      supabase
        .from('buklod_education_grade_items')
        .select('id,title,points_possible,category_id')
        .eq('classroom_id', classroomId)
        .order('created_at', { ascending: false }),
    ]);

    if (studentRes.error) Alert.alert('Roster', studentRes.error.message);
    if (categoryRes.error) Alert.alert('Grade Categories', categoryRes.error.message);
    if (gradeItemRes.error) Alert.alert('Grade Items', gradeItemRes.error.message);

    setStudents((studentRes.data ?? []) as StudentRow[]);
    setCategories((categoryRes.data ?? []) as Category[]);
    setGradeItems((gradeItemRes.data ?? []) as GradeItem[]);
  };

  useEffect(() => {
    load();
  }, [classroomId]);

  const enrollByUsername = async () => {
    const username = search.trim();
    if (!username) return Alert.alert('Enroll Student', 'Enter the student BUKLOD username.');

    const { data, error } = await supabase.rpc('buklod_education_enroll_by_username_v1', {
      p_classroom_id: classroomId,
      p_username: username,
    });

    if (error) return Alert.alert('Enroll Student', error.message);
    Alert.alert('Enrollment', String(data ?? 'Student enrolled.'));
    setShowEnroll(false);
    setSearch('');
    load();
  };

  const saveManualGrade = async () => {
    const score = Number(gradeScore);
    if (!selectedStudentId || !selectedGradeItemId || !Number.isFinite(score)) {
      return Alert.alert('Manual Grade', 'Select a student, grade item, and valid score.');
    }

    const item = gradeItems.find(x => x.id === selectedGradeItemId);
    if (!item) return;
    if (score < 0 || score > Number(item.points_possible)) {
      return Alert.alert('Manual Grade', `Score must be from 0 to ${item.points_possible}.`);
    }

    const { error } = await supabase.rpc('buklod_education_set_manual_grade_v1', {
      p_classroom_id: classroomId,
      p_grade_item_id: selectedGradeItemId,
      p_student_user_id: selectedStudentId,
      p_score: score,
      p_reason: gradeReason.trim() || 'Manual faculty entry',
    });

    if (error) return Alert.alert('Manual Grade', error.message);
    setGradeScore('');
    setShowGrade(false);
    Alert.alert('Manual Grade', 'Grade saved as draft with audit trail.');
  };

  const releaseSelectedGrade = async () => {
    if (!selectedStudentId || !selectedGradeItemId) {
      return Alert.alert('Release Grade', 'Select a student and grade item first.');
    }

    const { error } = await supabase.rpc('buklod_education_release_grade_v1', {
      p_grade_item_id: selectedGradeItemId,
      p_student_user_id: selectedStudentId,
      p_reason: 'Faculty released grade to student',
    });

    if (error) return Alert.alert('Release Grade', error.message);
    Alert.alert('Grade Released', 'The student can now see this grade.');
  };

  const saveObservation = async () => {
    const score = Number(obsScore);
    const points = Number(obsPoints);

    if (!selectedStudentId || !Number.isFinite(score) || !Number.isFinite(points) || points <= 0) {
      return Alert.alert('Observation', 'Select a student and enter valid score/points.');
    }

    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;

    const { error } = await supabase
      .from('buklod_education_observations')
      .insert({
        classroom_id: classroomId,
        student_user_id: selectedStudentId,
        observation_type: obsType,
        criterion: obsType,
        score,
        points_possible: points,
        note: obsNote.trim() || null,
        observed_by: uid,
        released_to_student: false,
      });

    if (error) return Alert.alert('Observation', error.message);
    setObsScore('');
    setObsNote('');
    setShowObservation(false);
    Alert.alert('Observation', 'Saved as faculty-only draft.');
  };

  const createQuickGradeItem = async () => {
    if (categories.length === 0) return Alert.alert('Grade Item', 'Create at least one grade category first.');

    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;

    const { error } = await supabase
      .from('buklod_education_grade_items')
      .insert({
        classroom_id: classroomId,
        category_id: categories[0].id,
        title: `Manual Activity ${gradeItems.length + 1}`,
        points_possible: 100,
        item_type: 'MANUAL',
        created_by: uid,
      });

    if (error) return Alert.alert('Grade Item', error.message);
    load();
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

        <Text style={styles.eyebrow}>FACULTY OPERATIONS</Text>
        <Text style={styles.title}>{classroomName}</Text>

        <View style={styles.metrics}>
          <View style={styles.metricCard}><Text style={styles.metricValue}>{students.length}</Text><Text style={styles.metricLabel}>Students</Text></View>
          <View style={styles.metricCard}><Text style={styles.metricValue}>{totalWeight.toFixed(0)}%</Text><Text style={styles.metricLabel}>Grade Weights</Text></View>
          <View style={styles.metricCard}><Text style={styles.metricValue}>{gradeItems.length}</Text><Text style={styles.metricLabel}>Grade Items</Text></View>
        </View>

        {/* BUKLOD_CLASSROOM_R4_ACADEMIC_CONTROL */}
        <Pressable
          onPress={() => router.push({ pathname: '/profile/buklod-faculty-academic-control' as any, params: { id: classroomId, classroomId, name: classroomName } })}
          style={({ pressed }) => [styles.academicControl, pressed && { opacity: 0.84 }]}
        >
          <View style={styles.academicControlIcon}><MaterialCommunityIcons name="school-outline" size={27} color="#1f7a3f" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.academicControlTitle}>Academic Control Center</Text>
            <Text style={styles.academicControlText}>Adaptive terms, grading, syllabus flow, RLE/OJT, monitoring, interventions and grade governance.</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={23} color="#fff" />
        </Pressable>

        {/* BUKLOD_CLASSROOM_R1_FACULTY_ENTRY */}
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/profile/buklod-classroom' as any,
              params: { id: classroomId, name: classroomName },
            })
          }
          style={({ pressed }) => ({
            backgroundColor: '#174c2b',
            borderRadius: 18,
            padding: 16,
            marginBottom: 18,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            opacity: pressed ? 0.84 : 1,
          })}
        >
          <View style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: '#e7f4e9', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="google-classroom" size={27} color="#1f7a3f" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 17 }}>Open BUKLOD Classroom</Text>
            <Text style={{ color: '#d4e5d8', lineHeight: 17, fontSize: 11, marginTop: 3 }}>Live class, discussions, messages, activities, submissions, materials and asynchronous monitoring.</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={23} color="#fff" />
        </Pressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Roster</Text>
          <Pressable style={styles.smallButton} onPress={() => setShowEnroll(true)}>
            <Text style={styles.smallButtonText}>+ Enroll</Text>
          </Pressable>
        </View>

        <TextInput value={search} onChangeText={setSearch} placeholder="Search enrolled students" style={styles.search} />

        {filteredStudents.map(student => (
          <Pressable
            key={student.id}
            style={styles.studentCard}
            onPress={() => setSelectedStudentId(student.student_user_id)}
          >
            <View style={styles.avatar}>
              <MaterialCommunityIcons name="account" size={23} color="#1f7a3f" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.studentName}>{student.display_name || student.username || 'BUKLOD Student'}</Text>
              <Text style={styles.studentMeta}>{student.username ? `@${student.username}` : student.student_user_id.slice(0, 8)}</Text>
            </View>
            {selectedStudentId === student.student_user_id && <MaterialCommunityIcons name="check-circle" size={21} color="#1f7a3f" />}
          </Pressable>
        ))}

        <Text style={styles.sectionTitle}>Faculty Autopilot</Text>
        <View style={styles.actionGrid}>
          {FACULTY_AUTOPILOT_MODULES.map(module => (
            <Pressable
              key={module.key}
              style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.88 }]}
              onPress={() => openFacultyAutopilotModule(module, { id: classroomId, name: classroomName })}
            >
              <MaterialCommunityIcons name={module.icon as any} size={24} color="#1f7a3f" />
              <Text style={styles.actionTitle}>{module.title}</Text>
              <Text style={styles.actionHint}>{module.description}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Faculty Tools</Text>
          <Pressable
            onPress={() => router.push({ pathname: '/profile/buklod-faculty-grade-scanner' as any, params: { id: classroomId, name: classroomName } })}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: '#ffffff',
              borderWidth: 1,
              borderColor: '#dfe8e1',
              borderRadius: 16,
              paddingHorizontal: 14,
              paddingVertical: 13,
              marginTop: 10,
              opacity: pressed ? 0.78 : 1,
            })}
          >
            <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e4efe6' }}>
              <Text style={{ color: '#1f7a3f', fontWeight: '900', fontSize: 12 }}>AI</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#22382a', fontSize: 15, fontWeight: '900' }}>Grade Scanner</Text>
              <Text style={{ color: '#738078', fontSize: 11, lineHeight: 16, marginTop: 2 }}>Scan papers or PDFs, apply rubrics, then review the AI-proposed grade.</Text>
            </View>
            <Text style={{ color: '#1f7a3f', fontSize: 22, fontWeight: '700' }}>{'>'}</Text>
          </Pressable>
        <View style={styles.actionGrid}>
          <Pressable style={styles.actionCard} onPress={createQuickGradeItem}>
            <MaterialCommunityIcons name="playlist-plus" size={24} color="#1f7a3f" />
            <Text style={styles.actionTitle}>New Grade Item</Text>
          </Pressable>

          <Pressable
            style={styles.actionCard}
            onPress={() => {
              if (!selectedStudentId) return Alert.alert('Manual Grade', 'Select a student first.');
              setShowGrade(true);
            }}
          >
            <MaterialCommunityIcons name="pencil-box-outline" size={24} color="#1f7a3f" />
            <Text style={styles.actionTitle}>Manual Grade</Text>
          </Pressable>

          <Pressable style={styles.actionCard} onPress={releaseSelectedGrade}>
            <MaterialCommunityIcons name="lock-open-check-outline" size={24} color="#1f7a3f" />
            <Text style={styles.actionTitle}>Release Grade</Text>
            <Text style={styles.actionHint}>Selected student + item</Text>
          </Pressable>

          <Pressable
            style={styles.actionCard}
            onPress={() => {
              if (!selectedStudentId) return Alert.alert('Observation', 'Select a student first.');
              setShowObservation(true);
            }}
          >
            <MaterialCommunityIcons name="account-star-outline" size={24} color="#1f7a3f" />
            <Text style={styles.actionTitle}>Quick Observation</Text>
          </Pressable>

          <Pressable style={styles.actionCard} onPress={exportCsv}>
            <MaterialCommunityIcons name="file-excel-outline" size={24} color="#1f7a3f" />
            <Text style={styles.actionTitle}>Export Class</Text>
            <Text style={styles.actionHint}>Excel-compatible CSV</Text>
          </Pressable>
        </View>

        <View style={{ marginBottom: 14 }}>
        <Pressable
          style={{ backgroundColor: '#1f7a3f', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
          onPress={() =>
            router.push({
              pathname: '/profile/buklod-faculty-final-grades' as any,
              params: { classroomId, id: classroomId, name: classroomName },
            })
          }
        >
          <Text style={{ color: '#fff', fontWeight: '900' }}>Gradebook & Final Grades</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Grade Categories</Text>
        {categories.map(item => (
          <View key={item.id} style={styles.categoryRow}>
            <Text style={styles.categoryName}>{item.name}</Text>
            <Text style={styles.categoryWeight}>{Number(item.weight_percent).toFixed(1)}%</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Grade Items</Text>
        {gradeItems.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyText}>No grade items yet.</Text></View>
        ) : (
          gradeItems.map(item => (
            <Pressable
              key={item.id}
              style={styles.gradeRow}
              onPress={() => setSelectedGradeItemId(item.id)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.gradeTitle}>{item.title}</Text>
                <Text style={styles.gradeMeta}>Out of {item.points_possible}</Text>
              </View>
              {selectedGradeItemId === item.id && <MaterialCommunityIcons name="check-circle" size={21} color="#1f7a3f" />}
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal visible={showEnroll} transparent animationType="fade" onRequestClose={() => setShowEnroll(false)}>
        <View style={styles.modalShade}><View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Enroll by BUKLOD Username</Text>
          <TextInput value={search} onChangeText={setSearch} placeholder="student.username" style={styles.input} autoCapitalize="none" />
          <Pressable style={styles.primary} onPress={enrollByUsername}><Text style={styles.primaryText}>Enroll Student</Text></Pressable>
          <Pressable style={styles.cancel} onPress={() => setShowEnroll(false)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
        </View></View>
      </Modal>

      <Modal visible={showGrade} transparent animationType="fade" onRequestClose={() => setShowGrade(false)}>
        <View style={styles.modalShade}><View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Manual Grade</Text>
          <Text style={styles.help}>Select a grade item from the list before opening this form.</Text>
          <TextInput value={gradeScore} onChangeText={setGradeScore} placeholder="Score" keyboardType="decimal-pad" style={styles.input} />
          <TextInput value={gradeReason} onChangeText={setGradeReason} placeholder="Reason / note" style={styles.input} />
          <Pressable style={styles.primary} onPress={saveManualGrade}><Text style={styles.primaryText}>Save with Audit Trail</Text></Pressable>
          <Pressable style={styles.cancel} onPress={() => setShowGrade(false)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
        </View></View>
      </Modal>

      <Modal visible={showObservation} transparent animationType="fade" onRequestClose={() => setShowObservation(false)}>
        <View style={styles.modalShade}><View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Participation / Conduct</Text>
          <TextInput value={obsType} onChangeText={setObsType} placeholder="PARTICIPATION" style={styles.input} />
          <TextInput value={obsScore} onChangeText={setObsScore} placeholder="Score" keyboardType="decimal-pad" style={styles.input} />
          <TextInput value={obsPoints} onChangeText={setObsPoints} placeholder="Points possible" keyboardType="decimal-pad" style={styles.input} />
          <TextInput value={obsNote} onChangeText={setObsNote} placeholder="Evidence / observation note" style={styles.input} />
          <Pressable style={styles.primary} onPress={saveObservation}><Text style={styles.primaryText}>Save Draft Observation</Text></Pressable>
          <Pressable style={styles.cancel} onPress={() => setShowObservation(false)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
        </View></View>
      </Modal>
    </>
    </FacultyGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f7f2' },
  content: { padding: 20, paddingTop: 42, paddingBottom: 60 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18 },
  backText: { color: '#17311f', fontWeight: '800' },
  eyebrow: { color: '#1f7a3f', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#17311f', fontSize: 27, fontWeight: '900', marginBottom: 18 },
  metrics: { flexDirection: 'row', gap: 8, marginBottom: 22 },
  metricCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 13 },
  metricValue: { color: '#17311f', fontSize: 22, fontWeight: '900' },
  metricLabel: { color: '#68736b', marginTop: 2, fontSize: 12 },
  academicControl: { backgroundColor: '#17311f', borderRadius: 18, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  academicControlIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#e7f4e9', alignItems: 'center', justifyContent: 'center' },
  academicControlTitle: { color: '#fff', fontWeight: '900', fontSize: 17 },
  academicControlText: { color: '#d4e5d8', lineHeight: 17, fontSize: 11, marginTop: 3 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: '#17311f', fontSize: 17, fontWeight: '900', marginTop: 6, marginBottom: 10 },
  smallButton: { backgroundColor: '#1f7a3f', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 8 },
  smallButtonText: { color: '#fff', fontWeight: '900' },
  search: { backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10 },
  studentCard: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#fff', borderRadius: 15, padding: 13, marginBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e8f4ea', alignItems: 'center', justifyContent: 'center' },
  studentName: { color: '#24362b', fontWeight: '900' },
  studentMeta: { color: '#778178', marginTop: 2, fontSize: 12 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 20 },
  actionCard: { width: '48%', backgroundColor: '#fff', borderRadius: 16, padding: 14, minHeight: 100 },
  actionTitle: { color: '#24362b', fontWeight: '900', marginTop: 8 },
  actionHint: { color: '#7a847d', fontSize: 11, marginTop: 5, lineHeight: 15 },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 14, padding: 13, marginBottom: 7 },
  categoryName: { color: '#26392d', fontWeight: '800' },
  categoryWeight: { color: '#1f7a3f', fontWeight: '900' },
  gradeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 13, marginBottom: 7 },
  gradeTitle: { color: '#26392d', fontWeight: '900' },
  gradeMeta: { color: '#778178', marginTop: 2, fontSize: 12 },
  empty: { backgroundColor: '#fff', borderRadius: 14, padding: 15 },
  emptyText: { color: '#68736b' },
  modalShade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#f7f8f6', borderRadius: 22, padding: 20 },
  modalTitle: { color: '#17311f', fontSize: 21, fontWeight: '900', marginBottom: 14 },
  help: { color: '#68736b', marginBottom: 10, lineHeight: 17 },
  input: { backgroundColor: '#fff', borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 12 },
  primary: { backgroundColor: '#1f7a3f', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '900' },
  cancel: { paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: '#627067', fontWeight: '800' },
});