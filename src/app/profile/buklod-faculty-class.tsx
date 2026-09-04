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

import { FacultyClassroomHeader } from '@/components/classroom/FacultyClassroomHeader';
import { FacultyGate } from '@/components/faculty/FacultyGate';
import { useClassroomTheme } from '@/hooks/useClassroomTheme';
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
  const { theme, themeId, setThemeId } = useClassroomTheme();

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
  const selectedStudent = students.find(item => item.student_user_id === selectedStudentId) ?? null;

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
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <ScrollView contentContainerStyle={styles.content}>
          <FacultyClassroomHeader
            classroomId={classroomId}
            classroomName={classroomName}
            kicker="CLASSROOM CONTROL ROOM"
            title="Faculty Command Center"
            subtitle="Run the class from one desk: roster, teaching tools, attendance, grading and release controls—without turning every screen into the same green dashboard."
            theme={theme}
            themeId={themeId}
            onThemeChange={setThemeId}
          />

          <View style={styles.metricRail}>
            <View style={[styles.metricPrimary, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
              <Text style={[styles.metricKicker, { color: theme.secondary }]}>ENROLLED</Text>
              <Text style={[styles.metricBig, { color: theme.ink }]}>{students.length}</Text>
              <Text style={[styles.metricFoot, { color: theme.muted }]}>students on the class roster</Text>
            </View>
            <View style={styles.metricStack}>
              <View style={[styles.metricSmall, { backgroundColor: theme.primary }]}>
                <Text style={[styles.metricSmallValue, { color: theme.primaryInk }]}>4</Text>
                <Text style={[styles.metricSmallLabel, { color: `${theme.primaryInk}CC` }]}>grading periods</Text>
              </View>
              <View style={[styles.metricSmall, { backgroundColor: theme.secondary }]}>
                <Text style={styles.metricSmallValueLight}>{gradeItems.length}</Text>
                <Text style={styles.metricSmallLabelLight}>grade items</Text>
              </View>
            </View>
          </View>

          <View style={[styles.readiness, { backgroundColor: theme.surfaceRaised, borderColor: gradingReady ? theme.success : theme.warning }]}>
            <View style={[styles.readinessMark, { backgroundColor: gradingReady ? `${theme.success}22` : `${theme.warning}22` }]}>
              <MaterialCommunityIcons
                name={gradingReady ? 'check-decagram-outline' : 'progress-alert'}
                size={27}
                color={gradingReady ? theme.success : theme.warning}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.readinessKicker, { color: gradingReady ? theme.success : theme.warning }]}>GRADEBOOK READINESS</Text>
              <Text style={[styles.readinessTitle, { color: theme.ink }]}>{gradingReady ? 'All four terms are balanced' : 'Weights need attention'}</Text>
              <Text style={[styles.readinessText, { color: theme.muted }]}>
                P {categoryTotals.PRELIM.toFixed(0)}%  ·  M {categoryTotals.MIDTERM.toFixed(0)}%  ·  S {categoryTotals.SEMIFINALS.toFixed(0)}%  ·  F {categoryTotals.FINALS.toFixed(0)}%
              </Text>
            </View>
            <Pressable
              style={[styles.editStamp, { backgroundColor: theme.chip }]}
              onPress={() => router.push({ pathname: '/profile/buklod-faculty-grading-setup' as any, params: { id: classroomId, classroomId, name: classroomName } })}
            >
              <Text style={[styles.editStampText, { color: theme.ink }]}>EDIT</Text>
              <MaterialCommunityIcons name="arrow-top-right" size={14} color={theme.ink} />
            </Pressable>
          </View>

          <Pressable
            onPress={() => router.push({ pathname: '/profile/buklod-classroom' as any, params: { id: classroomId, name: classroomName } })}
            style={[styles.studentView, { backgroundColor: theme.drawer }]}
          >
            <View style={[styles.studentViewIcon, { backgroundColor: theme.accent }]}>
              <MaterialCommunityIcons name="door-open" size={25} color={theme.drawer} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.studentViewKicker, { color: theme.accent }]}>STEP INTO THE CLASS</Text>
              <Text style={[styles.studentViewTitle, { color: theme.drawerInk }]}>Open Classroom Home</Text>
              <Text style={[styles.studentViewText, { color: `${theme.drawerInk}B8` }]}>Live class, feed, messages, activities, submissions and materials.</Text>
            </View>
            <MaterialCommunityIcons name="arrow-right" size={22} color={theme.drawerInk} />
          </Pressable>

          <View style={styles.sectionHead}>
            <View>
              <Text style={[styles.sectionKicker, { color: theme.secondary }]}>WHO'S IN THE ROOM</Text>
              <Text style={[styles.sectionTitle, { color: theme.ink }]}>Roster</Text>
            </View>
            <Pressable
              style={[styles.manageButton, { borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}
              onPress={() => router.push({ pathname: '/profile/buklod-faculty-roster' as any, params: { id: classroomId, classroomId, name: classroomName } })}
            >
              <Text style={[styles.manageText, { color: theme.ink }]}>Manage roster</Text>
            </Pressable>
          </View>

          <View style={[styles.searchShell, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
            <MaterialCommunityIcons name="magnify" size={19} color={theme.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search enrolled students"
              placeholderTextColor={theme.muted}
              style={[styles.search, { color: theme.ink }]}
            />
          </View>

          {filteredStudents.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
              <MaterialCommunityIcons name="account-search-outline" size={27} color={theme.muted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.emptyTitle, { color: theme.ink }]}>No active students yet</Text>
                <Text style={[styles.emptyText, { color: theme.muted }]}>Use Roster & Groups to enroll students.</Text>
              </View>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rosterRail}>
              {filteredStudents.map((student, index) => {
                const selected = selectedStudentId === student.student_user_id;
                return (
                  <Pressable
                    key={student.id}
                    style={[
                      styles.studentTicket,
                      { backgroundColor: selected ? theme.primary : theme.surfaceRaised, borderColor: selected ? theme.primary : theme.border },
                      index % 2 === 1 && styles.studentTicketDrop,
                    ]}
                    onPress={() => setSelectedStudentId(student.student_user_id)}
                  >
                    <View style={[styles.avatar, { backgroundColor: selected ? `${theme.primaryInk}1F` : theme.chip }]}>
                      <MaterialCommunityIcons name="account" size={23} color={selected ? theme.primaryInk : theme.primary} />
                    </View>
                    <Text numberOfLines={2} style={[styles.studentName, { color: selected ? theme.primaryInk : theme.ink }]}>
                      {student.display_name || student.username || 'BUKLOD Student'}
                    </Text>
                    <Text numberOfLines={1} style={[styles.studentMeta, { color: selected ? `${theme.primaryInk}B8` : theme.muted }]}>
                      {student.username ? `@${student.username}` : student.student_user_id.slice(0, 8)}
                    </Text>
                    {selected && (
                      <View style={[styles.selectedTag, { backgroundColor: theme.accent }]}>
                        <Text style={[styles.selectedTagText, { color: theme.drawer }]}>SELECTED</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {!!selectedStudent && (
            <View style={[styles.selectionNote, { backgroundColor: theme.chip }]}>
              <MaterialCommunityIcons name="cursor-default-click-outline" size={17} color={theme.secondary} />
              <Text style={[styles.selectionText, { color: theme.ink }]}>Working on: {selectedStudent.display_name || selectedStudent.username || 'Selected student'}</Text>
            </View>
          )}

          <View style={styles.sectionHeadSolo}>
            <Text style={[styles.sectionKicker, { color: theme.secondary }]}>TEACHING WORKBENCH</Text>
            <Text style={[styles.sectionTitle, { color: theme.ink }]}>Faculty tools</Text>
          </View>

          <View style={styles.toolList}>
            {FACULTY_AUTOPILOT_MODULES.map((module, index) => {
              const edge = index % 3 === 0 ? theme.primary : index % 3 === 1 ? theme.secondary : theme.accent;
              return (
                <Pressable
                  key={module.key}
                  style={[
                    styles.toolRow,
                    { backgroundColor: theme.surfaceRaised, borderColor: theme.border },
                    index % 3 === 1 && styles.toolRowInset,
                  ]}
                  onPress={() => openFacultyAutopilotModule(module, { id: classroomId, name: classroomName })}
                >
                  <View style={[styles.toolEdge, { backgroundColor: edge }]} />
                  <View style={[styles.toolGlyph, { backgroundColor: `${edge}1D` }]}>
                    <MaterialCommunityIcons name={module.icon as any} size={23} color={edge} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.toolTitle, { color: theme.ink }]}>{module.title}</Text>
                    <Text style={[styles.toolHint, { color: theme.muted }]}>{module.description}</Text>
                  </View>
                  <MaterialCommunityIcons name="arrow-top-right" size={17} color={theme.muted} />
                </Pressable>
              );
            })}
          </View>

          <View style={styles.sectionHeadSolo}>
            <Text style={[styles.sectionKicker, { color: theme.secondary }]}>ASSESS → REVIEW → RELEASE</Text>
            <Text style={[styles.sectionTitle, { color: theme.ink }]}>Grade desk</Text>
          </View>

          <Pressable
            style={[styles.scannerCard, { backgroundColor: theme.primary }]}
            onPress={() => router.push({ pathname: '/profile/buklod-faculty-grade-scanner' as any, params: { id: classroomId, classroomId, name: classroomName } })}
          >
            <View style={[styles.scannerBadge, { backgroundColor: theme.accent }]}>
              <Text style={[styles.scannerBadgeText, { color: theme.drawer }]}>SCAN</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.scannerTitle, { color: theme.primaryInk }]}>Grade Scanner</Text>
              <Text style={[styles.scannerText, { color: `${theme.primaryInk}C2` }]}>Scan paper or PDF work, apply the teacher rubric, then review before gradebook entry.</Text>
            </View>
            <MaterialCommunityIcons name="line-scan" size={29} color={theme.primaryInk} />
          </Pressable>

          <View style={styles.gradeActions}>
            <Pressable
              style={[
                styles.gradeActionMain,
                { backgroundColor: theme.surfaceRaised, borderColor: theme.border },
                (!selectedStudentId || gradeItems.length === 0) && styles.disabled,
              ]}
              disabled={!selectedStudentId || gradeItems.length === 0}
              onPress={() => setShowGrade(true)}
            >
              <View style={[styles.gradeActionIcon, { backgroundColor: `${theme.secondary}1D` }]}>
                <MaterialCommunityIcons name="pencil-box-outline" size={24} color={theme.secondary} />
              </View>
              <Text style={[styles.gradeActionTitle, { color: theme.ink }]}>Manual grade</Text>
              <Text style={[styles.gradeActionHint, { color: theme.muted }]}>Draft a score with an audit trail first.</Text>
            </Pressable>

            <View style={styles.gradeActionStack}>
              <Pressable
                style={[
                  styles.gradeActionSmall,
                  { backgroundColor: theme.surfaceRaised, borderColor: theme.border },
                  (!selectedStudentId || !selectedGradeItemId || busy) && styles.disabled,
                ]}
                disabled={!selectedStudentId || !selectedGradeItemId || busy}
                onPress={releaseSelectedGrade}
              >
                <MaterialCommunityIcons name="lock-open-check-outline" size={21} color={theme.success} />
                <Text style={[styles.gradeSmallTitle, { color: theme.ink }]}>Release item</Text>
              </Pressable>
              <Pressable style={[styles.gradeActionSmall, { backgroundColor: theme.chip, borderColor: theme.border }]} onPress={exportCsv}>
                <MaterialCommunityIcons name="file-delimited-outline" size={21} color={theme.primary} />
                <Text style={[styles.gradeSmallTitle, { color: theme.ink }]}>Export CSV</Text>
              </Pressable>
            </View>
          </View>

          <View style={[styles.authorityNote, { backgroundColor: theme.drawer }]}>
            <MaterialCommunityIcons name="shield-check-outline" size={22} color={theme.accent} />
            <Text style={[styles.authorityText, { color: `${theme.drawerInk}D2` }]}>
              BUKLOD Quiz and BUKLOD Attendance remain the authoritative sources. Classroom composes released scores into the faculty-controlled gradebook; it never resets attempts or attendance records.
            </Text>
          </View>
        </ScrollView>

        <Modal transparent visible={showGrade} animationType="fade" onRequestClose={() => setShowGrade(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
              <View style={styles.modalTop}>
                <View>
                  <Text style={[styles.modalKicker, { color: theme.secondary }]}>FACULTY DRAFT</Text>
                  <Text style={[styles.modalTitle, { color: theme.ink }]}>Manual Grade</Text>
                </View>
                <Pressable onPress={() => setShowGrade(false)} style={[styles.modalClose, { backgroundColor: theme.chip }]}>
                  <MaterialCommunityIcons name="close" size={19} color={theme.ink} />
                </Pressable>
              </View>
              <Text style={[styles.modalHint, { color: theme.muted }]}>Select a grade item for the chosen student. The score is saved as DRAFT first.</Text>

              <ScrollView style={{ maxHeight: 260 }}>
                {gradeItems.map(item => {
                  const selected = selectedGradeItemId === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.choice, { borderColor: selected ? theme.primary : theme.border, backgroundColor: selected ? theme.primary : theme.background }]}
                      onPress={() => setSelectedGradeItemId(item.id)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.choiceTitle, { color: selected ? theme.primaryInk : theme.ink }]}>{item.title}</Text>
                        <Text style={[styles.choiceMeta, { color: selected ? `${theme.primaryInk}B6` : theme.muted }]}>{item.term_key} · {item.points_possible} points</Text>
                      </View>
                      {selected && <MaterialCommunityIcons name="check" size={19} color={theme.primaryInk} />}
                    </Pressable>
                  );
                })}
              </ScrollView>

              <TextInput
                value={gradeScore}
                onChangeText={setGradeScore}
                keyboardType="decimal-pad"
                placeholder={selectedItem ? `Score / ${selectedItem.points_possible}` : 'Score'}
                placeholderTextColor={theme.muted}
                style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.ink }]}
              />
              <TextInput
                value={gradeReason}
                onChangeText={setGradeReason}
                placeholder="Reason / note"
                placeholderTextColor={theme.muted}
                style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.ink }]}
              />

              <Pressable style={[styles.saveButton, { backgroundColor: theme.secondary }, busy && styles.disabled]} disabled={busy} onPress={saveManualGrade}>
                <Text style={styles.saveButtonText}>{busy ? 'Saving...' : 'Save Draft Grade'}</Text>
                <MaterialCommunityIcons name="content-save-outline" size={17} color="#fff" />
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </FacultyGate>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 38, paddingBottom: 76 },
  metricRail: { flexDirection: 'row', gap: 9, marginBottom: 13 },
  metricPrimary: { flex: 1.4, minHeight: 136, borderWidth: 1, borderRadius: 20, padding: 16, justifyContent: 'flex-end' },
  metricKicker: { fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  metricBig: { fontSize: 43, lineHeight: 45, fontWeight: '900', marginTop: 4 },
  metricFoot: { fontSize: 10, marginTop: 3 },
  metricStack: { flex: 1, gap: 8 },
  metricSmall: { flex: 1, minHeight: 64, borderRadius: 17, paddingHorizontal: 13, paddingVertical: 10, justifyContent: 'center' },
  metricSmallValue: { fontSize: 23, fontWeight: '900' },
  metricSmallLabel: { fontSize: 9, marginTop: 1 },
  metricSmallValueLight: { color: '#fff', fontSize: 23, fontWeight: '900' },
  metricSmallLabelLight: { color: 'rgba(255,255,255,0.82)', fontSize: 9, marginTop: 1 },
  readiness: { flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderRadius: 18, padding: 13, marginBottom: 13 },
  readinessMark: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  readinessKicker: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  readinessTitle: { fontSize: 14, fontWeight: '900', marginTop: 2 },
  readinessText: { fontSize: 9, lineHeight: 14, marginTop: 3 },
  editStamp: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 8 },
  editStampText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  studentView: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 15, marginBottom: 24 },
  studentViewIcon: { width: 47, height: 47, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  studentViewKicker: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  studentViewTitle: { fontSize: 16, fontWeight: '900', marginTop: 2 },
  studentViewText: { fontSize: 10, lineHeight: 14, marginTop: 2 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 2, marginBottom: 10 },
  sectionHeadSolo: { marginTop: 25, marginBottom: 11 },
  sectionKicker: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  sectionTitle: { fontSize: 21, lineHeight: 24, fontWeight: '900', marginTop: 2 },
  manageButton: { borderWidth: 1, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 8 },
  manageText: { fontSize: 10, fontWeight: '900' },
  searchShell: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, marginBottom: 9 },
  search: { flex: 1, paddingVertical: 11, fontSize: 13 },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderRadius: 16, padding: 14 },
  emptyTitle: { fontWeight: '900' },
  emptyText: { fontSize: 10, marginTop: 2 },
  rosterRail: { gap: 9, paddingBottom: 9, paddingRight: 20 },
  studentTicket: { width: 142, minHeight: 142, borderWidth: 1, borderRadius: 18, padding: 12 },
  studentTicketDrop: { marginTop: 12 },
  avatar: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  studentName: { fontSize: 13, lineHeight: 16, fontWeight: '900', minHeight: 32 },
  studentMeta: { fontSize: 9, marginTop: 4 },
  selectedTag: { alignSelf: 'flex-start', borderRadius: 7, paddingHorizontal: 6, paddingVertical: 4, marginTop: 'auto' },
  selectedTagText: { fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  selectionNote: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 11, paddingHorizontal: 10, paddingVertical: 8, marginTop: 4 },
  selectionText: { fontSize: 10, fontWeight: '800' },
  toolList: { gap: 8 },
  toolRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderRadius: 17, padding: 11, overflow: 'hidden' },
  toolRowInset: { marginLeft: 17 },
  toolEdge: { width: 5, position: 'absolute', left: 0, top: 0, bottom: 0 },
  toolGlyph: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  toolTitle: { fontSize: 14, fontWeight: '900' },
  toolHint: { fontSize: 10, lineHeight: 14, marginTop: 3 },
  scannerCard: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 19, padding: 15, marginBottom: 10 },
  scannerBadge: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }] },
  scannerBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  scannerTitle: { fontSize: 17, fontWeight: '900' },
  scannerText: { fontSize: 10, lineHeight: 14, marginTop: 3 },
  gradeActions: { flexDirection: 'row', gap: 9 },
  gradeActionMain: { flex: 1.1, minHeight: 142, borderWidth: 1, borderRadius: 18, padding: 13 },
  gradeActionIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  gradeActionTitle: { fontSize: 15, fontWeight: '900', marginTop: 12 },
  gradeActionHint: { fontSize: 10, lineHeight: 14, marginTop: 3 },
  gradeActionStack: { flex: 1, gap: 8 },
  gradeActionSmall: { flex: 1, minHeight: 67, borderWidth: 1, borderRadius: 16, padding: 11, justifyContent: 'center' },
  gradeSmallTitle: { fontSize: 11, fontWeight: '900', marginTop: 5 },
  disabled: { opacity: 0.38 },
  authorityNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 17, padding: 14, marginTop: 18 },
  authorityText: { flex: 1, fontSize: 10, lineHeight: 16 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.58)', justifyContent: 'center', padding: 20 },
  modalCard: { borderWidth: 1, borderRadius: 22, padding: 16, maxHeight: '84%' },
  modalTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalKicker: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  modalTitle: { fontWeight: '900', fontSize: 22, marginTop: 2 },
  modalClose: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  modalHint: { lineHeight: 17, fontSize: 11, marginTop: 6, marginBottom: 11 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 7 },
  choiceTitle: { fontWeight: '900' },
  choiceMeta: { fontSize: 10, marginTop: 2 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 8 },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, paddingVertical: 13, marginTop: 11 },
  saveButtonText: { color: '#fff', fontWeight: '900' },
});