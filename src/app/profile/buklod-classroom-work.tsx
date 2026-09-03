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
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { supabase } from '@/lib/supabase';

const CLASSROOM_BUCKET = 'buklod-classroom';
const R1_UPLOAD_LIMIT = 40 * 1024 * 1024;

type Context = { role: 'FACULTY' | 'STUDENT'; allow_student_uploads: boolean };
type Category = { id: string; name: string; weight_percent: number };
type Assignment = {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  points_possible: number;
  rubric: any;
  submission_types: string[];
  auto_grading_mode: string;
  auto_grade_requires_review: boolean;
  grade_category_id: string | null;
  due_at: string | null;
  closes_at: string | null;
  status: string;
  created_at: string;
};
type Submission = {
  id: string;
  assignment_id: string;
  student_user_id: string;
  attempt_no: number;
  text_response: string | null;
  link_url: string | null;
  status: string;
  submitted_at: string | null;
  ai_suggested_score: number | null;
  ai_suggested_feedback: string | null;
  score: number | null;
  faculty_feedback: string | null;
};
type NameMap = Record<string, string>;

type PickedFile = { uri: string; name: string; mimeType?: string | null; size?: number | null };

function parseRubric(raw: string) {
  const criteria = raw
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [criterion, pointsRaw] = line.split('|').map(part => part.trim());
      const points = Number(pointsRaw);
      return { criterion: criterion || `Criterion ${index + 1}`, points: Number.isFinite(points) && points > 0 ? points : null };
    });
  return { criteria };
}

function rubricLabel(rubric: any) {
  const criteria = Array.isArray(rubric?.criteria) ? rubric.criteria : [];
  if (!criteria.length) return 'No rubric criteria yet';
  return criteria.map((row: any) => `${row.criterion}${row.points ? ` (${row.points})` : ''}`).join(' • ');
}

export default function BuklodClassroomWorkScreen() {
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const classroomId = String(params.id ?? '');
  const classroomName = String(params.name ?? 'Classroom');

  const [context, setContext] = useState<Context | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [names, setNames] = useState<NameMap>({});
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [points, setPoints] = useState('100');
  const [rubricText, setRubricText] = useState('Content accuracy | 50\nApplication / reasoning | 30\nClarity / completeness | 20');
  const [categoryId, setCategoryId] = useState('');
  const [autoMode, setAutoMode] = useState<'NONE' | 'OBJECTIVE' | 'RUBRIC_SUGGEST'>('RUBRIC_SUGGEST');

  const [responseText, setResponseText] = useState<Record<string, string>>({});
  const [responseLink, setResponseLink] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, PickedFile | null>>({});
  const [gradeScore, setGradeScore] = useState<Record<string, string>>({});
  const [gradeFeedback, setGradeFeedback] = useState<Record<string, string>>({});

  const isFaculty = context?.role === 'FACULTY';

  const load = useCallback(async () => {
    if (!classroomId) return;
    const [contextRes, categoryRes, assignmentRes, submissionRes] = await Promise.all([
      supabase.rpc('buklod_classroom_context_v1', { p_classroom_id: classroomId }),
      supabase.from('buklod_education_grade_categories').select('id,name,weight_percent').eq('classroom_id', classroomId).order('created_at'),
      supabase.from('buklod_education_classroom_assignments').select('id,title,description,instructions,points_possible,rubric,submission_types,auto_grading_mode,auto_grade_requires_review,grade_category_id,due_at,closes_at,status,created_at').eq('classroom_id', classroomId).order('created_at', { ascending: false }),
      supabase.from('buklod_education_classroom_submissions').select('id,assignment_id,student_user_id,attempt_no,text_response,link_url,status,submitted_at,ai_suggested_score,ai_suggested_feedback,score,faculty_feedback').eq('classroom_id', classroomId).order('created_at', { ascending: false }),
    ]);
    if (contextRes.error) return Alert.alert('Activities', contextRes.error.message);
    if (categoryRes.error) return Alert.alert('Grade Categories', categoryRes.error.message);
    if (assignmentRes.error) return Alert.alert('Activities', assignmentRes.error.message);
    if (submissionRes.error) return Alert.alert('Submissions', submissionRes.error.message);

    const nextContext = contextRes.data as Context;
    const nextCategories = (categoryRes.data ?? []) as Category[];
    const nextAssignments = (assignmentRes.data ?? []) as Assignment[];
    const nextSubmissions = (submissionRes.data ?? []) as Submission[];
    setContext(nextContext);
    setCategories(nextCategories);
    setAssignments(nextAssignments);
    setSubmissions(nextSubmissions);
    setCategoryId(current => current || nextCategories[0]?.id || '');

    if (nextContext.role === 'FACULTY') {
      const ids = Array.from(new Set(nextSubmissions.map(row => row.student_user_id)));
      if (ids.length) {
        const { data } = await supabase.from('profiles').select('id,full_name,first_name,surname,username').in('id', ids);
        const map: NameMap = {};
        for (const row of data ?? []) {
          const r = row as any;
          map[r.id] = r.full_name || [r.first_name, r.surname].filter(Boolean).join(' ') || r.username || 'BUKLOD Student';
        }
        setNames(map);
      }
    }
  }, [classroomId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const published = useMemo(() => assignments.filter(row => isFaculty || row.status !== 'DRAFT'), [assignments, isFaculty]);

  const createAssignment = async () => {
    const maxPoints = Number(points);
    if (!title.trim()) return Alert.alert('Activity', 'Enter an activity title.');
    if (!Number.isFinite(maxPoints) || maxPoints <= 0) return Alert.alert('Activity', 'Enter valid points possible.');
    if (!categoryId) return Alert.alert('Activity', 'Create/select a grade category in BUKLOD Faculty first.');
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error('Please sign in again.');
      const { error } = await supabase.from('buklod_education_classroom_assignments').insert({
        classroom_id: classroomId,
        title: title.trim(),
        instructions: instructions.trim() || null,
        points_possible: maxPoints,
        rubric: parseRubric(rubricText),
        submission_types: ['TEXT', 'FILE', 'PHOTO', 'VIDEO', 'LINK'],
        auto_grading_mode: autoMode,
        auto_grade_requires_review: autoMode !== 'OBJECTIVE',
        grade_category_id: categoryId,
        status: 'PUBLISHED',
        created_by: uid,
      });
      if (error) throw error;
      setTitle('');
      setInstructions('');
      await load();
    } catch (error) {
      Alert.alert('Create Activity', error instanceof Error ? error.message : 'Could not create activity.');
    } finally {
      setBusy(false);
    }
  };

  const chooseFile = async (assignmentId: string) => {
    const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    if (asset.size && asset.size > R1_UPLOAD_LIMIT) {
      return Alert.alert('Attachment Too Large', 'R1 direct mobile submission is limited to 40 MB per attachment. The Classroom storage backend is already prepared for larger media; resumable large-video upload will use the same private bucket.');
    }
    setFiles(prev => ({ ...prev, [assignmentId]: { uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size } }));
  };

  const uploadSubmissionFile = async (submissionId: string, file: PickedFile, uid: string) => {
    const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120);
    const path = `${classroomId}/${uid}/submission/${submissionId}_${Date.now()}_${safeName}`;
    const { error: uploadError } = await supabase.storage.from(CLASSROOM_BUCKET).upload(path, decode(base64), {
      contentType: file.mimeType ?? 'application/octet-stream',
      cacheControl: '3600',
      upsert: false,
    });
    if (uploadError) throw uploadError;
    const fileKind = file.mimeType?.startsWith('image/') ? 'PHOTO' : file.mimeType?.startsWith('video/') ? 'VIDEO' : 'FILE';
    const { error: metadataError } = await supabase.from('buklod_education_classroom_files').insert({
      classroom_id: classroomId,
      owner_user_id: uid,
      entity_type: 'SUBMISSION',
      entity_id: submissionId,
      file_kind: fileKind,
      storage_bucket: CLASSROOM_BUCKET,
      storage_path: path,
      original_name: file.name,
      mime_type: file.mimeType ?? null,
      file_size: file.size ?? null,
    });
    if (metadataError) throw metadataError;
  };

  const submitAssignment = async (assignment: Assignment) => {
    if (busy) return;
    const text = (responseText[assignment.id] ?? '').trim();
    const link = (responseLink[assignment.id] ?? '').trim();
    const file = files[assignment.id];
    if (!text && !link && !file) return Alert.alert('Submit Activity', 'Add a response, link or attachment first.');
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error('Please sign in again.');
      const mine = submissions.filter(row => row.assignment_id === assignment.id && row.student_user_id === uid);
      const attemptNo = Math.max(0, ...mine.map(row => Number(row.attempt_no || 0))) + 1;
      const { data: submission, error } = await supabase.from('buklod_education_classroom_submissions').insert({
        classroom_id: classroomId,
        assignment_id: assignment.id,
        student_user_id: uid,
        attempt_no: attemptNo,
        text_response: text || null,
        link_url: link || null,
        status: 'SUBMITTED',
        submitted_at: new Date().toISOString(),
      }).select('id').single();
      if (error || !submission?.id) throw error ?? new Error('Submission record was not created.');
      if (file) await uploadSubmissionFile(String(submission.id), file, uid);
      await supabase.from('buklod_education_classroom_engagement_events').insert({ classroom_id: classroomId, user_id: uid, event_type: 'ASSIGNMENT_SUBMITTED', source_type: 'ASSIGNMENT', source_id: assignment.id });
      // BUKLOD_CLASSROOM_AUTO_GRADE_R1
      if (assignment.auto_grading_mode === 'RUBRIC_SUGGEST' && text) {
        const { error: autoGradeError } = await supabase.functions.invoke('buklod-classroom-auto-grade', {
          body: { submission_id: String(submission.id) },
        });
        if (autoGradeError) {
          console.warn('BUKLOD Classroom auto-grade suggestion:', autoGradeError.message);
        }
      }
      setResponseText(prev => ({ ...prev, [assignment.id]: '' }));
      setResponseLink(prev => ({ ...prev, [assignment.id]: '' }));
      setFiles(prev => ({ ...prev, [assignment.id]: null }));
      await load();
      Alert.alert('Submitted', 'Your activity was submitted to the classroom.');
    } catch (error) {
      Alert.alert('Submit Activity', error instanceof Error ? error.message : 'Submission failed.');
    } finally {
      setBusy(false);
    }
  };

  const gradeSubmission = async (submission: Submission, assignment: Assignment, release: boolean) => {
    const score = Number(gradeScore[submission.id]);
    if (!Number.isFinite(score) || score < 0 || score > Number(assignment.points_possible)) {
      return Alert.alert('Grade', `Enter a score from 0 to ${assignment.points_possible}.`);
    }
    const { error } = await supabase.rpc('buklod_classroom_grade_submission_v1', {
      p_submission_id: submission.id,
      p_score: score,
      p_feedback: (gradeFeedback[submission.id] ?? '').trim() || null,
      p_release: release,
    });
    if (error) return Alert.alert('Grade Submission', error.message);
    await load();
    Alert.alert('Grade Saved', release ? 'Grade was saved and released to the student.' : 'Grade was saved as faculty draft.');
  };

  const submissionsFor = (assignmentId: string) => submissions.filter(row => row.assignment_id === assignmentId);

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
      <Text style={styles.eyebrow}>ACTIVITIES & SUBMISSIONS</Text>
      <Text style={styles.title}>{isFaculty ? 'Class Work' : 'My Class Work'}</Text>
      <Text style={styles.subtitle}>Rubrics, attachments, feedback and grades connect to the same Faculty gradebook.</Text>

      {isFaculty && (
        <View style={styles.createCard}>
          <Text style={styles.cardTitle}>Create Activity</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="Activity title" style={styles.input} />
          <TextInput value={instructions} onChangeText={setInstructions} placeholder="Instructions" multiline style={[styles.input, styles.multiline]} />
          <TextInput value={points} onChangeText={setPoints} placeholder="Points" keyboardType="decimal-pad" style={styles.input} />
          <Text style={styles.label}>Grade category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {categories.map(category => (
              <Pressable key={category.id} onPress={() => setCategoryId(category.id)} style={[styles.pill, categoryId === category.id && styles.pillSelected]}>
                <Text style={[styles.pillText, categoryId === category.id && styles.pillTextSelected]}>{category.name} {Number(category.weight_percent).toFixed(0)}%</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={styles.label}>Rubric — one criterion per line: Criterion | points</Text>
          <TextInput value={rubricText} onChangeText={setRubricText} multiline style={[styles.input, styles.rubricInput]} />
          <Text style={styles.label}>Auto grading</Text>
          <View style={styles.modeRow}>
            {(['NONE', 'OBJECTIVE', 'RUBRIC_SUGGEST'] as const).map(mode => (
              <Pressable key={mode} onPress={() => setAutoMode(mode)} style={[styles.mode, autoMode === mode && styles.modeSelected]}>
                <Text style={[styles.modeText, autoMode === mode && styles.modeTextSelected]}>{mode === 'RUBRIC_SUGGEST' ? 'AI RUBRIC SUGGEST' : mode}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.autoNote}>AI rubric scoring is a suggestion for faculty review. It is not silently released as a final grade.</Text>
          <Pressable disabled={busy} style={[styles.primary, busy && styles.disabled]} onPress={createAssignment}>
            <Text style={styles.primaryText}>{busy ? 'Creating…' : 'Publish Activity'}</Text>
          </Pressable>
        </View>
      )}

      {published.length === 0 ? (
        <View style={styles.empty}><Text style={styles.emptyText}>No classroom activity yet.</Text></View>
      ) : published.map(assignment => {
        const rows = submissionsFor(assignment.id);
        return (
          <View key={assignment.id} style={styles.assignmentCard}>
            <View style={styles.assignmentTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.assignmentTitle}>{assignment.title}</Text>
                <Text style={styles.assignmentMeta}>{Number(assignment.points_possible).toFixed(0)} pts • {assignment.auto_grading_mode}</Text>
              </View>
              <View style={styles.statusPill}><Text style={styles.statusText}>{assignment.status}</Text></View>
            </View>
            {!!assignment.instructions && <Text style={styles.instructions}>{assignment.instructions}</Text>}
            <Text style={styles.rubricLabel}>Rubric: {rubricLabel(assignment.rubric)}</Text>

            {!isFaculty ? (
              <>
                <TextInput value={responseText[assignment.id] ?? ''} onChangeText={value => setResponseText(prev => ({ ...prev, [assignment.id]: value }))} placeholder="Write your response…" multiline style={[styles.input, styles.multiline]} />
                <TextInput value={responseLink[assignment.id] ?? ''} onChangeText={value => setResponseLink(prev => ({ ...prev, [assignment.id]: value }))} placeholder="Optional link / URL" autoCapitalize="none" style={styles.input} />
                <Pressable style={styles.attach} onPress={() => chooseFile(assignment.id)}>
                  <MaterialCommunityIcons name="paperclip" size={19} color="#1f7a3f" />
                  <Text style={styles.attachText}>{files[assignment.id]?.name || 'Attach file / photo / video'}</Text>
                </Pressable>
                <Pressable disabled={busy} style={[styles.primary, busy && styles.disabled]} onPress={() => submitAssignment(assignment)}>
                  <Text style={styles.primaryText}>Submit Activity</Text>
                </Pressable>
                {rows.map(row => (
                  <View key={row.id} style={styles.mySubmission}>
                    <Text style={styles.submissionName}>Attempt {row.attempt_no} • {row.status}</Text>
                    {row.score != null && <Text style={styles.score}>Score: {Number(row.score).toFixed(2)} / {Number(assignment.points_possible).toFixed(2)}</Text>}
                    {!!row.faculty_feedback && <Text style={styles.feedback}>Faculty: {row.faculty_feedback}</Text>}
                    {row.ai_suggested_score != null && <Text style={styles.aiText}>AI suggestion: {Number(row.ai_suggested_score).toFixed(2)} — faculty review required</Text>}
                  </View>
                ))}
              </>
            ) : (
              <>
                <Text style={styles.subHeader}>Submissions ({rows.length})</Text>
                {rows.length === 0 ? <Text style={styles.noSub}>No submission yet.</Text> : rows.map(row => (
                  <View key={row.id} style={styles.submissionCard}>
                    <Text style={styles.submissionName}>{names[row.student_user_id] || 'BUKLOD Student'} • Attempt {row.attempt_no}</Text>
                    {!!row.text_response && <Text style={styles.response}>{row.text_response}</Text>}
                    {!!row.link_url && <Text style={styles.link}>{row.link_url}</Text>}
                    {row.ai_suggested_score != null && <Text style={styles.aiText}>AI suggested {Number(row.ai_suggested_score).toFixed(2)} — verify before applying.</Text>}
                    <TextInput value={gradeScore[row.id] ?? (row.score == null ? '' : String(row.score))} onChangeText={value => setGradeScore(prev => ({ ...prev, [row.id]: value }))} placeholder={`Score / ${assignment.points_possible}`} keyboardType="decimal-pad" style={styles.input} />
                    <TextInput value={gradeFeedback[row.id] ?? row.faculty_feedback ?? ''} onChangeText={value => setGradeFeedback(prev => ({ ...prev, [row.id]: value }))} placeholder="Faculty feedback" style={styles.input} />
                    <View style={styles.gradeActions}>
                      <Pressable style={styles.secondary} onPress={() => gradeSubmission(row, assignment, false)}><Text style={styles.secondaryText}>Save Draft</Text></Pressable>
                      <Pressable style={styles.primarySmall} onPress={() => gradeSubmission(row, assignment, true)}><Text style={styles.primaryText}>Grade & Release</Text></Pressable>
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f6f2' },
  content: { padding: 20, paddingTop: 43, paddingBottom: 80 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 15 },
  backText: { color: '#17311f', fontWeight: '900' },
  eyebrow: { color: '#1f7a3f', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#17311f', fontSize: 28, fontWeight: '900' },
  subtitle: { color: '#6d7970', lineHeight: 19, marginTop: 4, marginBottom: 15 },
  createCard: { backgroundColor: '#fff', borderRadius: 19, padding: 15, marginBottom: 15 },
  cardTitle: { color: '#26392d', fontWeight: '900', fontSize: 17, marginBottom: 10 },
  input: { backgroundColor: '#f2f5f2', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, color: '#27382e', marginBottom: 8 },
  multiline: { minHeight: 78, textAlignVertical: 'top' },
  rubricInput: { minHeight: 98, textAlignVertical: 'top' },
  label: { color: '#536159', fontSize: 10, fontWeight: '900', marginBottom: 6, marginTop: 3 },
  pillRow: { gap: 6, paddingBottom: 9 },
  pill: { backgroundColor: '#edf3ee', borderRadius: 18, paddingHorizontal: 9, paddingVertical: 6 },
  pillSelected: { backgroundColor: '#1f7a3f' },
  pillText: { color: '#5c685f', fontSize: 9, fontWeight: '900' },
  pillTextSelected: { color: '#fff' },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  mode: { backgroundColor: '#eef3ef', borderRadius: 16, paddingHorizontal: 9, paddingVertical: 6 },
  modeSelected: { backgroundColor: '#1f7a3f' },
  modeText: { color: '#5d6961', fontSize: 8, fontWeight: '900' },
  modeTextSelected: { color: '#fff' },
  autoNote: { color: '#7b7668', fontSize: 10, lineHeight: 15, marginBottom: 10 },
  primary: { backgroundColor: '#1f7a3f', borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  primarySmall: { flex: 1, backgroundColor: '#1f7a3f', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '900' },
  disabled: { opacity: 0.45 },
  empty: { backgroundColor: '#fff', borderRadius: 16, padding: 18 },
  emptyText: { color: '#718077' },
  assignmentCard: { backgroundColor: '#fff', borderRadius: 19, padding: 15, marginBottom: 12 },
  assignmentTop: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  assignmentTitle: { color: '#27392e', fontWeight: '900', fontSize: 16 },
  assignmentMeta: { color: '#758078', fontSize: 10, marginTop: 3 },
  statusPill: { backgroundColor: '#eaf3eb', borderRadius: 14, paddingHorizontal: 8, paddingVertical: 5 },
  statusText: { color: '#1f7a3f', fontSize: 8, fontWeight: '900' },
  instructions: { color: '#4f5e55', lineHeight: 18, marginTop: 9 },
  rubricLabel: { color: '#768178', fontSize: 10, lineHeight: 15, marginTop: 7, marginBottom: 10 },
  attach: { flexDirection: 'row', gap: 7, alignItems: 'center', backgroundColor: '#edf5ee', borderRadius: 11, padding: 11, marginBottom: 8 },
  attachText: { color: '#1f7a3f', fontWeight: '800', fontSize: 11, flex: 1 },
  mySubmission: { backgroundColor: '#f2f6f2', borderRadius: 12, padding: 11, marginTop: 9 },
  submissionName: { color: '#304238', fontWeight: '900', fontSize: 11 },
  score: { color: '#1f7a3f', fontWeight: '900', marginTop: 5 },
  feedback: { color: '#59665e', marginTop: 4, lineHeight: 17 },
  aiText: { color: '#795f35', fontSize: 10, marginTop: 5, lineHeight: 15 },
  subHeader: { color: '#33453a', fontWeight: '900', marginTop: 7, marginBottom: 7 },
  noSub: { color: '#77837b', fontSize: 11 },
  submissionCard: { backgroundColor: '#f3f6f3', borderRadius: 13, padding: 11, marginBottom: 8 },
  response: { color: '#4b5a51', lineHeight: 17, marginTop: 5 },
  link: { color: '#1f65a8', fontSize: 11, marginTop: 5 },
  gradeActions: { flexDirection: 'row', gap: 7 },
  secondary: { flex: 1, backgroundColor: '#e8ede9', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  secondaryText: { color: '#506057', fontWeight: '900' },
});
