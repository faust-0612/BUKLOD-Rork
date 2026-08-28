import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { FacultyGate } from '@/components/faculty/FacultyGate';

type Assessment = {
  id: string;
  title: string;
  assessment_type: string;
  instructions: string | null;
  duration_minutes: number;
  max_attempts: number;
  status: string;
  randomize_questions: boolean;
  one_question_at_a_time: boolean;
  no_backtracking: boolean;
  total_points: number;
  available_from: string | null;
  available_until: string | null;
};

type Question = {
  id: string;
  question_type: string;
  prompt: string;
  options: unknown;
  correct_answer: unknown;
  points: number;
  sort_order: number;
};

export default function FacultyAssessmentsScreen() {
  const params = useLocalSearchParams<{ id?: string; classroomId?: string; name?: string }>();
  const classroomId = String(params.id ?? params.classroomId ?? '');
  const classroomName = String(params.name ?? 'Classroom');

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [showQuestion, setShowQuestion] = useState(false);

  const [title, setTitle] = useState('');
  const [assessmentType, setAssessmentType] = useState('QUIZ');
  const [instructions, setInstructions] = useState('');
  const [duration, setDuration] = useState('30');
  const [maxAttempts, setMaxAttempts] = useState('1');
  const [randomize, setRandomize] = useState(true);
  const [oneAtATime, setOneAtATime] = useState(true);
  const [noBack, setNoBack] = useState(false);

  const [questionType, setQuestionType] = useState('MCQ');
  const [prompt, setPrompt] = useState('');
  const [optionsText, setOptionsText] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [points, setPoints] = useState('1');

  const selectedQuestionPoints = useMemo(
    () => questions.reduce((sum, q) => sum + Number(q.points || 0), 0),
    [questions]
  );

  const loadAssessments = async () => {
    const { data, error } = await supabase
      .from('buklod_education_assessments')
      .select('id,title,assessment_type,instructions,duration_minutes,max_attempts,status,randomize_questions,one_question_at_a_time,no_backtracking,total_points,available_from,available_until')
      .eq('classroom_id', classroomId)
      .order('created_at', { ascending: false });

    if (error) return Alert.alert('Assessments', error.message);
    setAssessments((data ?? []) as Assessment[]);
  };

  const loadQuestions = async (assessmentId: string) => {
    const { data, error } = await supabase
      .from('buklod_education_assessment_questions')
      .select('id,question_type,prompt,options,correct_answer,points,sort_order')
      .eq('assessment_id', assessmentId)
      .order('sort_order', { ascending: true });

    if (error) return Alert.alert('Questions', error.message);
    setQuestions((data ?? []) as Question[]);
  };

  useEffect(() => {
    loadAssessments();
  }, [classroomId]);

  useEffect(() => {
    if (selectedAssessment) loadQuestions(selectedAssessment.id);
    else setQuestions([]);
  }, [selectedAssessment?.id]);

  const createAssessment = async () => {
    const minutes = Number(duration);
    const attempts = Number(maxAttempts);

    if (!title.trim() || !Number.isFinite(minutes) || minutes < 1 || !Number.isFinite(attempts) || attempts < 1) {
      return Alert.alert('Create Assessment', 'Enter a title, valid duration, and max attempts.');
    }

    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;

    const { data, error } = await supabase
      .from('buklod_education_assessments')
      .insert({
        classroom_id: classroomId,
        title: title.trim(),
        assessment_type: assessmentType.trim().toUpperCase() || 'QUIZ',
        instructions: instructions.trim() || null,
        duration_minutes: Math.round(minutes),
        max_attempts: Math.round(attempts),
        randomize_questions: randomize,
        one_question_at_a_time: oneAtATime,
        no_backtracking: noBack,
        status: 'DRAFT',
        created_by: uid,
      })
      .select('id,title,assessment_type,instructions,duration_minutes,max_attempts,status,randomize_questions,one_question_at_a_time,no_backtracking,total_points,available_from,available_until')
      .single();

    if (error) return Alert.alert('Create Assessment', error.message);

    setTitle('');
    setInstructions('');
    setShowCreate(false);
    setSelectedAssessment(data as Assessment);
    await loadAssessments();
  };

  const addQuestion = async () => {
    if (!selectedAssessment) return;
    const pts = Number(points);

    if (!prompt.trim() || !Number.isFinite(pts) || pts <= 0) {
      return Alert.alert('Question', 'Enter a question and valid point value.');
    }

    const type = questionType.trim().toUpperCase();
    const objective = ['MCQ', 'TRUE_FALSE', 'SHORT_TEXT', 'NUMERIC'].includes(type);

    if (objective && !correctAnswer.trim()) {
      return Alert.alert('Question', 'Objective questions require a correct answer.');
    }

    const options =
      type === 'MCQ'
        ? optionsText.split('|').map(x => x.trim()).filter(Boolean)
        : null;

    if (type === 'MCQ' && (!options || options.length < 2)) {
      return Alert.alert('Question', 'For MCQ, enter at least two choices separated by |');
    }

    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;

    const { error } = await supabase
      .from('buklod_education_assessment_questions')
      .insert({
        assessment_id: selectedAssessment.id,
        classroom_id: classroomId,
        question_type: type,
        prompt: prompt.trim(),
        options,
        correct_answer: objective ? correctAnswer.trim() : null,
        points: pts,
        sort_order: questions.length + 1,
        created_by: uid,
      });

    if (error) return Alert.alert('Question', error.message);

    setPrompt('');
    setOptionsText('');
    setCorrectAnswer('');
    setPoints('1');
    setShowQuestion(false);
    await loadQuestions(selectedAssessment.id);
    await loadAssessments();
  };

  const publish = async () => {
    if (!selectedAssessment) return;
    if (questions.length === 0) return Alert.alert('Publish', 'Add at least one question first.');

    const { error } = await supabase.rpc('buklod_education_publish_assessment_v1', {
      p_assessment_id: selectedAssessment.id,
    });

    if (error) return Alert.alert('Publish Assessment', error.message);
    Alert.alert('Assessment Published', 'Enrolled students can now see and start this assessment.');
    await loadAssessments();

    setSelectedAssessment(current =>
      current ? { ...current, status: 'PUBLISHED', total_points: selectedQuestionPoints } : current
    );
  };

  const unpublish = async () => {
    if (!selectedAssessment) return;

    const { error } = await supabase.rpc('buklod_education_unpublish_assessment_v1', {
      p_assessment_id: selectedAssessment.id,
    });

    if (error) return Alert.alert('Unpublish Assessment', error.message);
    Alert.alert('Assessment', 'Returned to DRAFT. Existing attempts are preserved.');
    await loadAssessments();
    setSelectedAssessment(current => current ? { ...current, status: 'DRAFT' } : current);
  };

  const openReview = () => {
    if (!selectedAssessment) return;
    router.push({
      pathname: '/profile/buklod-faculty-assessment-review' as any,
      params: {
        assessmentId: selectedAssessment.id,
        classroomId,
        name: selectedAssessment.title,
      },
    });
  };
  const openGradebook = () => {
    if (!selectedAssessment) return;
    router.push({
      pathname: '/profile/buklod-faculty-assessment-gradebook' as any,
      params: {
        assessmentId: selectedAssessment.id,
        classroomId,
        name: selectedAssessment.title,
      },
    });
  };

  return (
    <FacultyGate>
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#17311f" />
          <Text style={styles.backText}>{classroomName}</Text>
        </Pressable>

        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>ASSESSMENT ENGINE</Text>
            <Text style={styles.title}>Quizzes & Exams</Text>
          </View>
          <Pressable style={styles.smallButton} onPress={() => setShowCreate(true)}>
            <Text style={styles.smallButtonText}>+ New</Text>
          </Pressable>
        </View>

        {assessments.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No assessments yet.</Text>
          </View>
        ) : (
          assessments.map(item => (
            <Pressable
              key={item.id}
              style={[
                styles.assessmentCard,
                selectedAssessment?.id === item.id && styles.selectedCard,
              ]}
              onPress={() => setSelectedAssessment(item)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.assessmentTitle}>{item.title}</Text>
                <Text style={styles.meta}>
                  {item.assessment_type} • {item.duration_minutes} min • {item.max_attempts} attempt(s)
                </Text>
              </View>
              <Text style={item.status === 'PUBLISHED' ? styles.live : styles.draft}>{item.status}</Text>
            </Pressable>
          ))
        )}

        {!!selectedAssessment && (
          <>
            <View style={styles.selectedHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>{selectedAssessment.title}</Text>
                <Text style={styles.meta}>
                  {questions.length} question(s) • {selectedQuestionPoints} pts
                </Text>
              </View>
              <Pressable style={styles.smallButton} onPress={() => setShowQuestion(true)}>
                <Text style={styles.smallButtonText}>+ Question</Text>
              </Pressable>
            </View>

            <View style={styles.toolRow}>
              {selectedAssessment.status === 'PUBLISHED' ? (
                <Pressable style={styles.secondaryTool} onPress={unpublish}>
                  <MaterialCommunityIcons name="eye-off-outline" size={20} color="#7a5120" />
                  <Text style={styles.secondaryToolText}>Unpublish</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.primaryTool} onPress={publish}>
                  <MaterialCommunityIcons name="publish" size={20} color="#fff" />
                  <Text style={styles.primaryToolText}>Publish</Text>
                </Pressable>
              )}

              <Pressable style={styles.reviewTool} onPress={openReview}>
                <MaterialCommunityIcons name="clipboard-check-outline" size={20} color="#1f7a3f" />
                <Text style={styles.reviewToolText}>Review Queue</Text>
              </Pressable>
              <Pressable style={styles.reviewTool} onPress={openGradebook}>
                <MaterialCommunityIcons name="book-open-variant-outline" size={20} color="#1f7a3f" />
                <Text style={styles.reviewToolText}>Gradebook</Text>
              </Pressable>
            </View>

            {questions.map((item, index) => (
              <View key={item.id} style={styles.questionCard}>
                <Text style={styles.questionNumber}>Q{index + 1} • {item.question_type} • {item.points} pt(s)</Text>
                <Text style={styles.questionPrompt}>{item.prompt}</Text>
                {item.question_type === 'MCQ' && Array.isArray(item.options) && (
                  <Text style={styles.optionsText}>{item.options.join(' • ')}</Text>
                )}
                {['MCQ', 'TRUE_FALSE', 'SHORT_TEXT', 'NUMERIC'].includes(item.question_type) && (
                  <Text style={styles.answerKey}>Key: {String(item.correct_answer ?? '')}</Text>
                )}
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalShade}>
          <ScrollView contentContainerStyle={styles.modalCard}>
            <Text style={styles.modalTitle}>New Assessment</Text>
            <TextInput value={title} onChangeText={setTitle} placeholder="Assessment title" style={styles.input} />
            <TextInput value={assessmentType} onChangeText={setAssessmentType} placeholder="QUIZ or EXAM" style={styles.input} autoCapitalize="characters" />
            <TextInput value={instructions} onChangeText={setInstructions} placeholder="Instructions" style={[styles.input, styles.multiline]} multiline />
            <TextInput value={duration} onChangeText={setDuration} placeholder="Duration in minutes" keyboardType="number-pad" style={styles.input} />
            <TextInput value={maxAttempts} onChangeText={setMaxAttempts} placeholder="Max attempts" keyboardType="number-pad" style={styles.input} />

            <View style={styles.switchRow}><Text style={styles.switchLabel}>Randomize question order</Text><Switch value={randomize} onValueChange={setRandomize} /></View>
            <View style={styles.switchRow}><Text style={styles.switchLabel}>One question at a time</Text><Switch value={oneAtATime} onValueChange={setOneAtATime} /></View>
            <View style={styles.switchRow}><Text style={styles.switchLabel}>No backtracking</Text><Switch value={noBack} onValueChange={setNoBack} /></View>

            <Pressable style={styles.primary} onPress={createAssessment}>
              <Text style={styles.primaryText}>Create Draft</Text>
            </Pressable>
            <Pressable style={styles.cancel} onPress={() => setShowCreate(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showQuestion} transparent animationType="fade" onRequestClose={() => setShowQuestion(false)}>
        <View style={styles.modalShade}>
          <ScrollView contentContainerStyle={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Question</Text>
            <TextInput value={questionType} onChangeText={setQuestionType} placeholder="MCQ / TRUE_FALSE / SHORT_TEXT / NUMERIC / ESSAY" style={styles.input} autoCapitalize="characters" />
            <TextInput value={prompt} onChangeText={setPrompt} placeholder="Question / prompt" style={[styles.input, styles.multiline]} multiline />

            {questionType.trim().toUpperCase() === 'MCQ' && (
              <TextInput
                value={optionsText}
                onChangeText={setOptionsText}
                placeholder="Choices separated by | e.g. A | B | C | D"
                style={[styles.input, styles.multiline]}
                multiline
              />
            )}

            {['MCQ', 'TRUE_FALSE', 'SHORT_TEXT', 'NUMERIC'].includes(questionType.trim().toUpperCase()) && (
              <TextInput value={correctAnswer} onChangeText={setCorrectAnswer} placeholder="Correct answer" style={styles.input} />
            )}

            <TextInput value={points} onChangeText={setPoints} placeholder="Points" keyboardType="decimal-pad" style={styles.input} />

            <Pressable style={styles.primary} onPress={addQuestion}>
              <Text style={styles.primaryText}>Add Question</Text>
            </Pressable>
            <Pressable style={styles.cancel} onPress={() => setShowQuestion(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </>
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  smallButton: { backgroundColor: '#1f7a3f', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 8 },
  smallButtonText: { color: '#fff', fontWeight: '900' },
  empty: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  emptyText: { color: '#68736b' },
  assessmentCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 15, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: 'transparent' },
  selectedCard: { borderColor: '#1f7a3f', backgroundColor: '#edf7ef' },
  assessmentTitle: { color: '#26392d', fontWeight: '900' },
  meta: { color: '#778178', marginTop: 3, fontSize: 12 },
  live: { color: '#1f7a3f', fontWeight: '900', fontSize: 11 },
  draft: { color: '#8a6a2d', fontWeight: '900', fontSize: 11 },
  selectedHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 9 },
  sectionTitle: { color: '#17311f', fontWeight: '900', fontSize: 18 },
  toolRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  primaryTool: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#1f7a3f', borderRadius: 12, paddingVertical: 11 },
  primaryToolText: { color: '#fff', fontWeight: '900' },
  secondaryTool: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#f7efd9', borderRadius: 12, paddingVertical: 11 },
  secondaryToolText: { color: '#7a5120', fontWeight: '900' },
  reviewTool: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#e8f4ea', borderRadius: 12, paddingVertical: 11 },
  reviewToolText: { color: '#1f7a3f', fontWeight: '900' },
  questionCard: { backgroundColor: '#fff', borderRadius: 15, padding: 14, marginBottom: 8 },
  questionNumber: { color: '#1f7a3f', fontWeight: '900', fontSize: 11 },
  questionPrompt: { color: '#26392d', fontWeight: '800', marginTop: 5, lineHeight: 20 },
  optionsText: { color: '#667168', marginTop: 7 },
  answerKey: { color: '#7a5120', marginTop: 7, fontWeight: '800' },
  modalShade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#f7f8f6', borderRadius: 22, padding: 20, maxHeight: '88%' },
  modalTitle: { color: '#17311f', fontSize: 21, fontWeight: '900', marginBottom: 14 },
  input: { backgroundColor: '#fff', borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 11 },
  multiline: { minHeight: 78, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9 },
  switchLabel: { color: '#425149', fontWeight: '700', flex: 1, paddingRight: 12 },
  primary: { backgroundColor: '#1f7a3f', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 10 },
  primaryText: { color: '#fff', fontWeight: '900' },
  cancel: { paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: '#627067', fontWeight: '800' },
});