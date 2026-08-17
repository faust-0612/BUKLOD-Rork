import { useEffect, useState } from 'react';
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

type ReviewRow = {
  attempt_id: string;
  response_id: string;
  student_user_id: string;
  display_name: string | null;
  username: string | null;
  question_id: string;
  prompt: string;
  question_type: string;
  points: number;
  answer_text: string | null;
  manual_score: number | null;
  feedback: string | null;
};

export default function FacultyAssessmentReviewScreen() {
  const params = useLocalSearchParams<{
    assessmentId?: string;
    classroomId?: string;
    name?: string;
  }>();

  const assessmentId = String(params.assessmentId ?? '');
  const assessmentName = String(params.name ?? 'Assessment');

  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  const load = async () => {
    const { data, error } = await supabase.rpc('buklod_education_assessment_review_queue_v1', {
      p_assessment_id: assessmentId,
    });

    if (error) return Alert.alert('Review Queue', error.message);

    const list = (data ?? []) as ReviewRow[];
    setRows(list);

    const nextScores: Record<string, string> = {};
    const nextFeedback: Record<string, string> = {};
    for (const row of list) {
      nextScores[row.response_id] = row.manual_score == null ? '' : String(row.manual_score);
      nextFeedback[row.response_id] = row.feedback ?? '';
    }
    setScores(nextScores);
    setFeedback(nextFeedback);
  };

  useEffect(() => {
    load();
  }, [assessmentId]);

  const saveReview = async (row: ReviewRow) => {
    const value = Number(scores[row.response_id]);
    if (!Number.isFinite(value) || value < 0 || value > Number(row.points)) {
      return Alert.alert('Review Score', `Score must be from 0 to ${row.points}.`);
    }

    const { error } = await supabase.rpc('buklod_education_review_assessment_response_v1', {
      p_response_id: row.response_id,
      p_manual_score: value,
      p_feedback: feedback[row.response_id]?.trim() || null,
    });

    if (error) return Alert.alert('Review', error.message);
    Alert.alert('Review Saved', 'Manual score and feedback saved.');
    load();
  };

  const finalizeAttempt = async (attemptId: string) => {
    const { error } = await supabase.rpc('buklod_education_finalize_assessment_attempt_v1', {
      p_attempt_id: attemptId,
    });

    if (error) return Alert.alert('Finalize Attempt', error.message);
    Alert.alert('Attempt Finalized', 'All reviewed items were calculated. Result remains faculty-controlled until released.');
    load();
  };

  const releaseAttempt = async (attemptId: string) => {
    const { error } = await supabase.rpc('buklod_education_release_assessment_attempt_v1', {
      p_attempt_id: attemptId,
    });

    if (error) return Alert.alert('Release Result', error.message);
    Alert.alert('Result Released', 'The student can now see the final assessment score.');
    load();
  };

  const grouped = rows.reduce<Record<string, ReviewRow[]>>((acc, row) => {
    (acc[row.attempt_id] ??= []).push(row);
    return acc;
  }, {});

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable style={styles.back} onPress={() => router.back()}>
        <MaterialCommunityIcons name="arrow-left" size={22} color="#17311f" />
        <Text style={styles.backText}>{assessmentName}</Text>
      </Pressable>

      <Text style={styles.eyebrow}>FACULTY REVIEW QUEUE</Text>
      <Text style={styles.title}>Manual Review</Text>
      <Text style={styles.subtitle}>Essay/manual items require faculty scoring. Objective items are already server-checked.</Text>

      {Object.keys(grouped).length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No manual-review responses pending.</Text>
        </View>
      ) : (
        Object.entries(grouped).map(([attemptId, attemptRows]) => (
          <View key={attemptId} style={styles.attemptCard}>
            <Text style={styles.student}>
              {attemptRows[0].display_name || attemptRows[0].username || 'BUKLOD Student'}
            </Text>
            {!!attemptRows[0].username && <Text style={styles.username}>@{attemptRows[0].username}</Text>}

            {attemptRows.map(row => (
              <View key={row.response_id} style={styles.responseCard}>
                <Text style={styles.questionType}>{row.question_type} â€¢ {row.points} pt(s)</Text>
                <Text style={styles.prompt}>{row.prompt}</Text>
                <Text style={styles.answerLabel}>Student answer</Text>
                <Text style={styles.answer}>{row.answer_text || '(No answer)'}</Text>

                <TextInput
                  value={scores[row.response_id] ?? ''}
                  onChangeText={value => setScores(current => ({ ...current, [row.response_id]: value }))}
                  placeholder={`Manual score / ${row.points}`}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />

                <TextInput
                  value={feedback[row.response_id] ?? ''}
                  onChangeText={value => setFeedback(current => ({ ...current, [row.response_id]: value }))}
                  placeholder="Feedback / rubric note"
                  style={styles.input}
                />

                <Pressable style={styles.saveButton} onPress={() => saveReview(row)}>
                  <Text style={styles.saveText}>Save Review</Text>
                </Pressable>
              </View>
            ))}

            <View style={styles.attemptActions}>
              <Pressable style={styles.finalizeButton} onPress={() => finalizeAttempt(attemptId)}>
                <Text style={styles.finalizeText}>Finalize Attempt</Text>
              </Pressable>
              <Pressable style={styles.releaseButton} onPress={() => releaseAttempt(attemptId)}>
                <Text style={styles.releaseText}>Release Result</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f7f2' },
  content: { padding: 20, paddingTop: 42, paddingBottom: 60 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 18 },
  backText: { color: '#17311f', fontWeight: '800' },
  eyebrow: { color: '#1f7a3f', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#17311f', fontSize: 27, fontWeight: '900' },
  subtitle: { color: '#68736b', marginTop: 4, marginBottom: 18, lineHeight: 18 },
  empty: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  emptyText: { color: '#68736b' },
  attemptCard: { backgroundColor: '#fff', borderRadius: 18, padding: 15, marginBottom: 14 },
  student: { color: '#24362b', fontWeight: '900', fontSize: 17 },
  username: { color: '#778178', marginTop: 2, marginBottom: 10 },
  responseCard: { backgroundColor: '#f5f7f4', borderRadius: 14, padding: 13, marginTop: 9 },
  questionType: { color: '#1f7a3f', fontWeight: '900', fontSize: 11 },
  prompt: { color: '#26392d', fontWeight: '800', marginTop: 5, lineHeight: 20 },
  answerLabel: { color: '#7a847d', fontSize: 11, marginTop: 10, fontWeight: '800' },
  answer: { color: '#3d4c43', marginTop: 3, marginBottom: 10, lineHeight: 19 },
  input: { backgroundColor: '#fff', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 8 },
  saveButton: { backgroundColor: '#e8f4ea', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  saveText: { color: '#1f7a3f', fontWeight: '900' },
  attemptActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  finalizeButton: { flex: 1, backgroundColor: '#eef0ed', borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  finalizeText: { color: '#405146', fontWeight: '900' },
  releaseButton: { flex: 1, backgroundColor: '#1f7a3f', borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  releaseText: { color: '#fff', fontWeight: '900' },
});