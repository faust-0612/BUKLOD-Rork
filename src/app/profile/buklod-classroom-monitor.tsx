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

import { supabase } from '@/lib/supabase';

type Context = { role: 'FACULTY' | 'STUDENT' };
type Student = { student_user_id: string; display_name?: string | null; username?: string | null; status: string };
type Category = { id: string; name: string; weight_percent: number };
type EventRow = { id: number; user_id: string; event_type: string; source_type: string | null; created_at: string };
type LiveRow = { id: string; session_id: string; user_id: string; participant_role: string; joined_at: string; left_at: string | null; total_seconds: number };
type Performance = {
  id: string;
  student_user_id: string;
  performance_type: string;
  title: string;
  score: number | null;
  points_possible: number;
  feedback: string | null;
  released_to_student: boolean;
  created_at: string;
};

type StudentStats = {
  id: string;
  name: string;
  events: number;
  liveSeconds: number;
  latest: string | null;
  performances: number;
};

function duration(seconds: number) {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function BuklodClassroomMonitorScreen() {
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const classroomId = String(params.id ?? '');
  const classroomName = String(params.name ?? 'Classroom');

  const [context, setContext] = useState<Context | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [liveRows, setLiveRows] = useState<LiveRow[]>([]);
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState('');
  const [performanceType, setPerformanceType] = useState('RECITATION');
  const [performanceTitle, setPerformanceTitle] = useState('Recitation');
  const [score, setScore] = useState('');
  const [points, setPoints] = useState('10');
  const [feedback, setFeedback] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [release, setRelease] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!classroomId) return;
    const [contextRes, rosterRes, categoryRes, eventRes, liveRes, performanceRes] = await Promise.all([
      supabase.rpc('buklod_classroom_context_v1', { p_classroom_id: classroomId }),
      supabase.rpc('buklod_education_roster_v1', { p_classroom_id: classroomId }),
      supabase.from('buklod_education_grade_categories').select('id,name,weight_percent').eq('classroom_id', classroomId).order('created_at'),
      supabase.from('buklod_education_classroom_engagement_events').select('id,user_id,event_type,source_type,created_at').eq('classroom_id', classroomId).order('created_at', { ascending: false }).limit(1000),
      supabase.from('buklod_education_classroom_live_participants').select('id,session_id,user_id,participant_role,joined_at,left_at,total_seconds').eq('classroom_id', classroomId).order('joined_at', { ascending: false }).limit(1000),
      supabase.from('buklod_education_classroom_performance').select('id,student_user_id,performance_type,title,score,points_possible,feedback,released_to_student,created_at').eq('classroom_id', classroomId).order('created_at', { ascending: false }).limit(500),
    ]);
    if (contextRes.error) return Alert.alert('Class Monitor', contextRes.error.message);
    if (eventRes.error) return Alert.alert('Class Monitor', eventRes.error.message);
    if (liveRes.error) return Alert.alert('Live Monitor', liveRes.error.message);
    if (performanceRes.error) return Alert.alert('Performance', performanceRes.error.message);

    const nextContext = contextRes.data as Context;
    const nextStudents = rosterRes.error ? [] : ((rosterRes.data ?? []) as Student[]).filter(row => row.status === 'ACTIVE');
    const nextCategories = categoryRes.error ? [] : (categoryRes.data ?? []) as Category[];
    setContext(nextContext);
    setStudents(nextStudents);
    setCategories(nextCategories);
    setEvents((eventRes.data ?? []) as EventRow[]);
    setLiveRows((liveRes.data ?? []) as LiveRow[]);
    setPerformances((performanceRes.data ?? []) as Performance[]);
    setSelectedStudent(current => current || nextStudents[0]?.student_user_id || '');
    setCategoryId(current => current || nextCategories[0]?.id || '');
  }, [classroomId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const isFaculty = context?.role === 'FACULTY';

  const stats = useMemo<StudentStats[]>(() => {
    return students.map(student => {
      const id = student.student_user_id;
      const studentEvents = events.filter(row => row.user_id === id);
      const studentLive = liveRows.filter(row => row.user_id === id);
      const studentPerformance = performances.filter(row => row.student_user_id === id);
      const timestamps = [
        ...studentEvents.map(row => row.created_at),
        ...studentLive.map(row => row.left_at || row.joined_at),
        ...studentPerformance.map(row => row.created_at),
      ].filter(Boolean);
      const latest = timestamps.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
      return {
        id,
        name: student.display_name || student.username || 'BUKLOD Student',
        events: studentEvents.length,
        liveSeconds: studentLive.reduce((sum, row) => sum + Number(row.total_seconds || 0), 0),
        latest,
        performances: studentPerformance.length,
      };
    });
  }, [students, events, liveRows, performances]);

  const recordPerformance = async () => {
    const numericScore = Number(score);
    const numericPoints = Number(points);
    if (!selectedStudent) return Alert.alert('Performance', 'Select a student.');
    if (!Number.isFinite(numericScore) || !Number.isFinite(numericPoints) || numericPoints <= 0 || numericScore < 0 || numericScore > numericPoints) {
      return Alert.alert('Performance', 'Enter a valid score and points possible.');
    }
    setBusy(true);
    try {
      const { error } = await supabase.rpc('buklod_classroom_record_performance_v1', {
        p_classroom_id: classroomId,
        p_student_user_id: selectedStudent,
        p_performance_type: performanceType,
        p_title: performanceTitle.trim() || performanceType,
        p_score: numericScore,
        p_points_possible: numericPoints,
        p_feedback: feedback.trim() || null,
        p_rubric: {},
        p_grade_category_id: categoryId || null,
        p_release: release,
        p_live_session_id: null,
      });
      if (error) throw error;
      setScore('');
      setFeedback('');
      await load();
      Alert.alert('Performance Saved', categoryId ? 'Record saved and linked to the Faculty gradebook.' : 'Record saved for classroom monitoring.');
    } catch (error) {
      Alert.alert('Performance', error instanceof Error ? error.message : 'Could not save the performance record.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      <Pressable style={styles.back} onPress={() => router.back()}>
        <MaterialCommunityIcons name="arrow-left" size={22} color="#17311f" />
        <Text style={styles.backText}>{classroomName}</Text>
      </Pressable>
      <Text style={styles.eyebrow}>CLASSROOM MONITOR</Text>
      <Text style={styles.title}>{isFaculty ? 'Engagement & Performance' : 'My Classroom Progress'}</Text>
      <Text style={styles.subtitle}>
        Monitor meaningful class participation across live and asynchronous learning. Activity counts are context—not a hidden automatic grade.
      </Text>

      {isFaculty && (
        <View style={styles.recordCard}>
          <Text style={styles.cardTitle}>Quick Recitation / Presentation Record</Text>
          <Text style={styles.label}>Student</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {students.map(student => (
              <Pressable key={student.student_user_id} style={[styles.pill, selectedStudent === student.student_user_id && styles.pillSelected]} onPress={() => setSelectedStudent(student.student_user_id)}>
                <Text style={[styles.pillText, selectedStudent === student.student_user_id && styles.pillTextSelected]}>{student.display_name || student.username || 'Student'}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={styles.label}>Type</Text>
          <View style={styles.typeRow}>
            {['RECITATION', 'PRESENTATION', 'PARTICIPATION', 'SKILL_DEMO'].map(type => (
              <Pressable key={type} style={[styles.typePill, performanceType === type && styles.typeSelected]} onPress={() => { setPerformanceType(type); setPerformanceTitle(type.replace('_', ' ')); }}>
                <Text style={[styles.typeText, performanceType === type && styles.typeTextSelected]}>{type.replace('_', ' ')}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput value={performanceTitle} onChangeText={setPerformanceTitle} placeholder="Record title" style={styles.input} />
          <View style={styles.twoCol}>
            <TextInput value={score} onChangeText={setScore} placeholder="Score" keyboardType="decimal-pad" style={[styles.input, { flex: 1 }]} />
            <TextInput value={points} onChangeText={setPoints} placeholder="Points" keyboardType="decimal-pad" style={[styles.input, { flex: 1 }]} />
          </View>
          <TextInput value={feedback} onChangeText={setFeedback} placeholder="Feedback / observation" multiline style={[styles.input, styles.multiline]} />
          <Text style={styles.label}>Optional gradebook category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            <Pressable style={[styles.pill, !categoryId && styles.pillSelected]} onPress={() => setCategoryId('')}>
              <Text style={[styles.pillText, !categoryId && styles.pillTextSelected]}>Monitor only</Text>
            </Pressable>
            {categories.map(category => (
              <Pressable key={category.id} style={[styles.pill, categoryId === category.id && styles.pillSelected]} onPress={() => setCategoryId(category.id)}>
                <Text style={[styles.pillText, categoryId === category.id && styles.pillTextSelected]}>{category.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.releaseRow} onPress={() => setRelease(value => !value)}>
            <MaterialCommunityIcons name={release ? 'checkbox-marked' : 'checkbox-blank-outline'} size={21} color="#1f7a3f" />
            <Text style={styles.releaseText}>Release this performance record/grade to student</Text>
          </Pressable>
          <Pressable disabled={busy} style={[styles.primary, busy && styles.disabled]} onPress={recordPerformance}>
            <Text style={styles.primaryText}>{busy ? 'Saving…' : 'Save Performance'}</Text>
          </Pressable>
        </View>
      )}

      {isFaculty && <Text style={styles.sectionTitle}>Student Engagement Snapshot</Text>}
      {isFaculty && stats.map(row => (
        <View key={row.id} style={styles.statCard}>
          <View style={styles.avatar}><MaterialCommunityIcons name="account" size={22} color="#1f7a3f" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.studentName}>{row.name}</Text>
            <Text style={styles.studentMeta}>
              {row.events} async actions • {duration(row.liveSeconds)} live • {row.performances} performance records
            </Text>
            <Text style={styles.latest}>Last tracked: {row.latest ? new Date(row.latest).toLocaleString() : 'No activity yet'}</Text>
          </View>
        </View>
      ))}

      <Text style={styles.sectionTitle}>{isFaculty ? 'Recent Performance Records' : 'Released Performance Records'}</Text>
      {performances.length === 0 ? (
        <View style={styles.empty}><Text style={styles.emptyText}>No performance record yet.</Text></View>
      ) : performances.map(row => (
        <View key={row.id} style={styles.performanceCard}>
          <View style={styles.performanceTop}>
            <Text style={styles.performanceType}>{row.performance_type.replace('_', ' ')}</Text>
            {row.released_to_student && <MaterialCommunityIcons name="eye-check-outline" size={18} color="#1f7a3f" />}
          </View>
          <Text style={styles.performanceTitle}>{row.title}</Text>
          <Text style={styles.performanceScore}>{row.score == null ? 'No score' : `${Number(row.score).toFixed(2)} / ${Number(row.points_possible).toFixed(2)}`}</Text>
          {!!row.feedback && <Text style={styles.performanceFeedback}>{row.feedback}</Text>}
        </View>
      ))}

      <View style={styles.note}>
        <MaterialCommunityIcons name="shield-check-outline" size={20} color="#1f7a3f" />
        <Text style={styles.noteText}>BUKLOD Classroom logs participation for visibility and follow-up. It does not secretly convert message counts, clicks or screen time into a final academic grade.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f6f2' },
  content: { padding: 20, paddingTop: 43, paddingBottom: 80 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 15 },
  backText: { color: '#17311f', fontWeight: '900' },
  eyebrow: { color: '#1f7a3f', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#17311f', fontSize: 27, fontWeight: '900' },
  subtitle: { color: '#6d7970', lineHeight: 19, marginTop: 4, marginBottom: 15 },
  recordCard: { backgroundColor: '#fff', borderRadius: 19, padding: 15, marginBottom: 17 },
  cardTitle: { color: '#293b30', fontWeight: '900', fontSize: 16, marginBottom: 10 },
  label: { color: '#56645b', fontWeight: '900', fontSize: 10, marginBottom: 6, marginTop: 3 },
  pillRow: { gap: 6, paddingBottom: 10 },
  pill: { backgroundColor: '#edf3ee', borderRadius: 18, paddingHorizontal: 9, paddingVertical: 6 },
  pillSelected: { backgroundColor: '#1f7a3f' },
  pillText: { color: '#59675e', fontSize: 9, fontWeight: '900' },
  pillTextSelected: { color: '#fff' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 9 },
  typePill: { backgroundColor: '#eef3ef', borderRadius: 16, paddingHorizontal: 8, paddingVertical: 6 },
  typeSelected: { backgroundColor: '#1f7a3f' },
  typeText: { color: '#5d6961', fontSize: 8, fontWeight: '900' },
  typeTextSelected: { color: '#fff' },
  input: { backgroundColor: '#f2f5f2', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, color: '#26382d', marginBottom: 8 },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  twoCol: { flexDirection: 'row', gap: 7 },
  releaseRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginVertical: 8 },
  releaseText: { color: '#4f5e55', fontSize: 10, fontWeight: '800', flex: 1 },
  primary: { backgroundColor: '#1f7a3f', borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '900' },
  disabled: { opacity: 0.45 },
  sectionTitle: { color: '#283a2f', fontWeight: '900', fontSize: 16, marginTop: 5, marginBottom: 9 },
  statCard: { backgroundColor: '#fff', borderRadius: 16, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e7f4e9', alignItems: 'center', justifyContent: 'center' },
  studentName: { color: '#2c3e33', fontWeight: '900' },
  studentMeta: { color: '#6f7d74', fontSize: 10, marginTop: 3 },
  latest: { color: '#89938c', fontSize: 9, marginTop: 2 },
  performanceCard: { backgroundColor: '#fff', borderRadius: 16, padding: 13, marginBottom: 8 },
  performanceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  performanceType: { color: '#1f7a3f', fontSize: 9, fontWeight: '900' },
  performanceTitle: { color: '#2c3e33', fontWeight: '900', marginTop: 5 },
  performanceScore: { color: '#1f7a3f', fontWeight: '900', fontSize: 16, marginTop: 5 },
  performanceFeedback: { color: '#66736b', lineHeight: 17, marginTop: 4 },
  empty: { backgroundColor: '#fff', borderRadius: 16, padding: 17 },
  emptyText: { color: '#748078' },
  note: { backgroundColor: '#e8f4ea', borderRadius: 15, padding: 13, flexDirection: 'row', gap: 9, marginTop: 16 },
  noteText: { color: '#46604d', flex: 1, lineHeight: 17, fontSize: 10 },
});
