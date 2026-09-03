import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { FacultyGate } from '@/components/faculty/FacultyGate';
import {
  getDedicatedQuizExamCatalog,
  syncFacultyRosterToDedicatedQuiz,
  type DedicatedQuizExam,
} from '@/lib/education/buklodQuizFacultyBridge';
import { supabase } from '@/lib/supabase';

type RosterRow = {
  student_user_id: string;
  display_name: string | null;
  username: string | null;
  status: string;
};

export default function BuklodFacultyQuizRosterSyncScreen() {
  const params = useLocalSearchParams<{ classroomId?: string; id?: string; name?: string }>();
  const classroomId = String(params.classroomId ?? params.id ?? '');
  const className = String(params.name ?? 'Class');

  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [exams, setExams] = useState<DedicatedQuizExam[]>([]);
  const [examId, setExamId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const selectedExam = useMemo(
    () => exams.find(item => item.id === examId) ?? null,
    [examId, exams]
  );

  const selectedSection = useMemo(
    () => selectedExam?.sections.find(item => item.id === sectionId) ?? null,
    [sectionId, selectedExam]
  );

  const load = useCallback(async () => {
    if (!classroomId) return;
    try {
      const [rosterRes, catalog] = await Promise.all([
        supabase.rpc('buklod_education_roster_v1', { p_classroom_id: classroomId }),
        getDedicatedQuizExamCatalog(),
      ]);
      if (rosterRes.error) throw rosterRes.error;

      const activeRoster = ((rosterRes.data ?? []) as RosterRow[]).filter(item => item.status === 'ACTIVE');
      setRoster(activeRoster);
      setExams(catalog);

      const nextExamId = examId && catalog.some(item => item.id === examId) ? examId : catalog[0]?.id ?? '';
      setExamId(nextExamId);
      const nextExam = catalog.find(item => item.id === nextExamId);
      const nextSectionId = sectionId && nextExam?.sections.some(item => item.id === sectionId)
        ? sectionId
        : nextExam?.sections[0]?.id ?? '';
      setSectionId(nextSectionId);
    } catch (error: any) {
      Alert.alert('Quiz Roster Sync', String(error?.message ?? error));
    }
  }, [classroomId, examId, sectionId]);

  useEffect(() => {
    void load();
    // Initial load is intentionally keyed to the Faculty classroom only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classroomId]);

  const selectExam = (nextExam: DedicatedQuizExam) => {
    setExamId(nextExam.id);
    setSectionId(nextExam.sections[0]?.id ?? '');
  };

  const sync = () => {
    if (!selectedExam || !selectedSection) {
      Alert.alert('Quiz Roster Sync', 'Choose a BUKLOD Quiz exam and active section first.');
      return;
    }
    if (roster.length === 0) {
      Alert.alert('Quiz Roster Sync', 'This Faculty class has no active enrolled students.');
      return;
    }

    Alert.alert(
      'Send Faculty Roster to BUKLOD Quiz',
      `Sync ${roster.length} active student(s) from ${className} into ${selectedExam.title} · ${selectedSection.name}? Existing Quiz roster rows for these students will be updated, not duplicated.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sync Roster',
          onPress: async () => {
            setBusy(true);
            try {
              const result = await syncFacultyRosterToDedicatedQuiz({
                examId: selectedExam.id,
                sectionId: selectedSection.id,
                students: roster.map(item => ({
                  student_user_id: item.student_user_id,
                  display_name: item.display_name || item.username || 'BUKLOD Student',
                })),
              });
              Alert.alert(
                'Quiz Roster Synced',
                `${result.exam_title} · ${result.section_name}\n\nFaculty roster sent: ${result.requested}\nQuiz roster synced: ${result.synced}\nDedicated Quiz profiles found: ${result.dedicated_profiles_found}\n\nStudents still need a usable BUKLOD Quiz account/session to take the exam.`
              );
            } catch (error: any) {
              Alert.alert('Quiz Roster Sync', String(error?.message ?? error));
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

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

        <Text style={styles.eyebrow}>FACULTY ROSTER → BUKLOD QUIZ</Text>
        <Text style={styles.title}>Quiz Roster Sync</Text>
        <Text style={styles.subtitle}>
          Stop retyping the same student list. Choose the faculty-owned Quiz exam and section, then send the active Faculty roster into the Dedicated BUKLOD Quiz roster.
        </Text>

        <View style={styles.summaryCard}>
          <MaterialCommunityIcons name="account-group-outline" size={25} color="#1f7a3f" />
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryTitle}>{roster.length} active Faculty student(s)</Text>
            <Text style={styles.summaryText}>Only ACTIVE Faculty enrollments are sent. Dropped students are not re-added by this sync.</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>1. Choose BUKLOD Quiz Exam</Text>
        {exams.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No faculty-owned Quiz exam found</Text>
            <Text style={styles.emptyText}>Create an exam in BUKLOD Quiz first, then return here and refresh.</Text>
            <Pressable style={styles.primary} onPress={() => void Linking.openURL('https://buklod-quiz.expo.app')}>
              <Text style={styles.primaryText}>Open BUKLOD Quiz</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {exams.map(exam => {
              const selected = exam.id === examId;
              return (
                <Pressable
                  key={exam.id}
                  onPress={() => selectExam(exam)}
                  style={[styles.examChip, selected && styles.examChipActive]}
                >
                  <Text style={[styles.examTitle, selected && styles.examTitleActive]}>{exam.title}</Text>
                  <Text style={[styles.examMeta, selected && styles.examMetaActive]}>{exam.status} · {exam.sections.length} section(s)</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {!!selectedExam && (
          <>
            <Text style={styles.sectionTitle}>2. Choose Quiz Section</Text>
            {selectedExam.sections.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No active Quiz section</Text>
                <Text style={styles.emptyText}>Add a section to this exam in BUKLOD Quiz before syncing the Faculty roster.</Text>
              </View>
            ) : (
              <View style={styles.sectionGrid}>
                {selectedExam.sections.map(section => {
                  const selected = section.id === sectionId;
                  return (
                    <Pressable
                      key={section.id}
                      onPress={() => setSectionId(section.id)}
                      style={[styles.sectionChip, selected && styles.sectionChipActive]}
                    >
                      <MaterialCommunityIcons
                        name={selected ? 'radiobox-marked' : 'radiobox-blank'}
                        size={18}
                        color={selected ? '#1f7a3f' : '#8b978e'}
                      />
                      <Text style={[styles.sectionName, selected && styles.sectionNameActive]}>{section.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        )}

        <Pressable
          disabled={busy || !selectedExam || !selectedSection || roster.length === 0}
          style={[styles.syncButton, (busy || !selectedExam || !selectedSection || roster.length === 0) && styles.disabled]}
          onPress={sync}
        >
          <MaterialCommunityIcons name="account-sync-outline" size={21} color="#fff" />
          <Text style={styles.syncButtonText}>{busy ? 'Syncing Faculty Roster…' : 'Sync Faculty Roster to Quiz Section'}</Text>
        </Pressable>

        <View style={styles.ruleCard}>
          <Text style={styles.ruleTitle}>How this works</Text>
          <Text style={styles.ruleText}>• Faculty classroom remains the master roster.</Text>
          <Text style={styles.ruleText}>• Quiz receives the selected class roster for the chosen exam section.</Text>
          <Text style={styles.ruleText}>• Re-sync updates existing exam/student roster rows instead of duplicating them.</Text>
          <Text style={styles.ruleText}>• Quiz results still return to Faculty only after the examiner officially RELEASES them.</Text>
        </View>
      </ScrollView>
    </FacultyGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f7f2' },
  content: { padding: 20, paddingTop: 42, paddingBottom: 80 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 18 },
  backText: { color: '#17311f', fontWeight: '900' },
  eyebrow: { color: '#1f7a3f', fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  title: { color: '#17311f', fontSize: 28, fontWeight: '900', marginTop: 2 },
  subtitle: { color: '#667169', marginTop: 6, lineHeight: 20, marginBottom: 15 },
  summaryCard: { flexDirection: 'row', gap: 11, alignItems: 'flex-start', backgroundColor: '#e8f4ea', borderRadius: 16, padding: 14, marginBottom: 10 },
  summaryTitle: { color: '#17311f', fontWeight: '900' },
  summaryText: { color: '#53665a', fontSize: 11, lineHeight: 17, marginTop: 3 },
  sectionTitle: { color: '#203328', fontWeight: '900', fontSize: 16, marginTop: 14, marginBottom: 9 },
  chipRow: { gap: 8, paddingBottom: 4 },
  examChip: { width: 220, backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#dce5dd' },
  examChipActive: { backgroundColor: '#1f7a3f', borderColor: '#1f7a3f' },
  examTitle: { color: '#203328', fontWeight: '900' },
  examTitleActive: { color: '#fff' },
  examMeta: { color: '#748078', fontSize: 10, marginTop: 3 },
  examMetaActive: { color: '#dcefe0' },
  sectionGrid: { gap: 7 },
  sectionChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 12, padding: 11, borderWidth: 1, borderColor: '#e0e7e1' },
  sectionChipActive: { backgroundColor: '#edf7ef', borderColor: '#b8d8bf' },
  sectionName: { color: '#607067', fontWeight: '800' },
  sectionNameActive: { color: '#1f7a3f' },
  empty: { backgroundColor: '#fff', borderRadius: 15, padding: 15 },
  emptyTitle: { color: '#203328', fontWeight: '900' },
  emptyText: { color: '#68736b', marginTop: 4, lineHeight: 18, fontSize: 12 },
  primary: { backgroundColor: '#1f7a3f', borderRadius: 11, paddingVertical: 11, alignItems: 'center', marginTop: 10 },
  primaryText: { color: '#fff', fontWeight: '900' },
  syncButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1f7a3f', borderRadius: 13, paddingVertical: 14, marginTop: 18 },
  syncButtonText: { color: '#fff', fontWeight: '900', textAlign: 'center' },
  disabled: { opacity: 0.45 },
  ruleCard: { backgroundColor: '#fff8e9', borderRadius: 15, padding: 14, marginTop: 12 },
  ruleTitle: { color: '#594a2a', fontWeight: '900', marginBottom: 5 },
  ruleText: { color: '#756848', fontSize: 11, lineHeight: 18 },
});