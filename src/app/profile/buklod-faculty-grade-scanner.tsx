import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  BUKLOD_HIT_SLOP,
  BUKLOD_HIT_SLOP_TIGHT,
} from '@/lib/buklodTouch';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { supabase } from '@/lib/supabase';

type DocumentType = 'ESSAY' | 'SHORT_ANSWER' | 'ENUMERATION' | 'OBJECTIVE' | 'MATH_SCIENCE' | 'MIXED';

type RubricRow = {
  id: string;
  name: string;
  weight: string;
  description: string;
};

type LocalSource = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number | null;
};

type Assessment = {
  id: string;
  title: string;
  total_points: number | null;
  status: string;
  grade_item_id: string | null;
};

type GradeItem = {
  id: string;
  title: string;
  points_possible: number;
};

type Student = {
  student_user_id: string;
  display_name: string;
  username: string | null;
};

type CriterionResult = {
  criterion: string;
  max_score: number;
  score: number;
  rationale: string;
  evidence: string;
};

type ItemResult = {
  item_label: string;
  detected_answer: string;
  expected_answer: string;
  max_score: number;
  score: number;
  is_correct: boolean | null;
  rationale: string;
};

type AcademicIntegrityReview = {
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNDETERMINED';
  confidence: number;
  signals: string[];
  counter_signals: string[];
  verification_questions: string[];
  summary: string;
};

type GradeResult = {
  recognized_student_name: string | null;
  extracted_text: string;
  document_summary: string;
  total_score: number;
  max_score: number;
  confidence: number;
  needs_manual_review: boolean;
  review_reasons: string[];
  criteria: CriterionResult[];
  items: ItemResult[];
  strengths: string[];
  improvements: string[];
  academic_integrity?: AcademicIntegrityReview;
  faculty_feedback_draft: string;
};

type ScanJob = {
  id: string;
  title: string;
  document_type: DocumentType;
  status: string;
  ai_result: GradeResult | null;
  ai_score: number | null;
  ai_max_score: number | null;
  ai_confidence: number | null;
  needs_manual_review: boolean;
  faculty_final_score: number | null;
  faculty_feedback: string | null;
  student_user_id: string | null;
  grade_item_id: string | null;
  created_at: string;
};

const TYPES: Array<{ key: DocumentType; label: string }> = [
  { key: 'ESSAY', label: 'Essay' },
  { key: 'SHORT_ANSWER', label: 'Short Answer' },
  { key: 'ENUMERATION', label: 'Enumeration' },
  { key: 'OBJECTIVE', label: 'Objective' },
  { key: 'MATH_SCIENCE', label: 'Math / Science' },
  { key: 'MIXED', label: 'Mixed / All' },
];

const PRESETS: Record<DocumentType, Array<Omit<RubricRow, 'id'>>> = {
  ESSAY: [
    { name: 'Content / Accuracy', weight: '40', description: 'Correct, relevant, and sufficient content.' },
    { name: 'Understanding / Analysis', weight: '25', description: 'Depth of reasoning and understanding.' },
    { name: 'Organization', weight: '15', description: 'Logical flow and structure.' },
    { name: 'Evidence / Examples', weight: '10', description: 'Appropriate support, examples, or evidence.' },
    { name: 'Grammar / Clarity', weight: '10', description: 'Clear communication; grade language only under this criterion.' },
  ],
  SHORT_ANSWER: [
    { name: 'Accuracy', weight: '70', description: 'Correct answer and concepts.' },
    { name: 'Completeness', weight: '20', description: 'Required details are present.' },
    { name: 'Clarity', weight: '10', description: 'Answer is understandable and focused.' },
  ],
  ENUMERATION: [
    { name: 'Required Concepts', weight: '80', description: 'Correct required items or concepts.' },
    { name: 'Relevance', weight: '20', description: 'Listed items directly answer the prompt.' },
  ],
  OBJECTIVE: [
    { name: 'Correct Answers', weight: '100', description: 'Compare detected answers against the teacher key or linked assessment.' },
  ],
  MATH_SCIENCE: [
    { name: 'Process / Method', weight: '50', description: 'Appropriate formula, reasoning, and solution process.' },
    { name: 'Final Answer', weight: '30', description: 'Correct final result.' },
    { name: 'Units / Scientific Reasoning', weight: '20', description: 'Correct units, notation, interpretation, and reasoning.' },
  ],
  MIXED: [
    { name: 'Accuracy', weight: '50', description: 'Correctness across objective and written responses.' },
    { name: 'Completeness', weight: '30', description: 'All required parts are addressed.' },
    { name: 'Reasoning / Quality', weight: '20', description: 'Quality of explanation, analysis, or solution process where applicable.' },
  ],
};

const makeRubric = (type: DocumentType): RubricRow[] =>
  PRESETS[type].map((row, index) => ({ ...row, id: `${Date.now()}-${index}-${Math.random()}` }));

const cleanFileName = (value: string) =>
  value.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'scan';

const sourceFromAsset = (asset: any, fallbackName: string): LocalSource => ({
  uri: String(asset.uri),
  name: cleanFileName(String(asset.fileName || asset.name || fallbackName)),
  mimeType: String(asset.mimeType || asset.type || 'image/jpeg'),
  size: typeof asset.fileSize === 'number' ? asset.fileSize : typeof asset.size === 'number' ? asset.size : null,
});

export default function BuklodFacultyGradeScannerScreen() {
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const classroomId = String(params.id ?? '');
  const classroomName = String(params.name ?? 'Classroom');

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType>('ESSAY');
  const [title, setTitle] = useState('Scanned Paper');
  const [rubric, setRubric] = useState<RubricRow[]>(() => makeRubric('ESSAY'));
  const [referenceText, setReferenceText] = useState('');
  const [sources, setSources] = useState<LocalSource[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [assessmentId, setAssessmentId] = useState('');
  const [gradeItems, setGradeItems] = useState<GradeItem[]>([]);
  const [gradeItemId, setGradeItemId] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState('');
  const [jobs, setJobs] = useState<ScanJob[]>([]);
  const [jobId, setJobId] = useState('');
  const [result, setResult] = useState<GradeResult | null>(null);
  const [finalScore, setFinalScore] = useState('');
  const [facultyFeedback, setFacultyFeedback] = useState('');

  const rubricTotal = useMemo(
    () => rubric.reduce((sum, row) => sum + (Number(row.weight) || 0), 0),
    [rubric]
  );

  const selectedGradeItem = useMemo(
    () => gradeItems.find(item => item.id === gradeItemId) ?? null,
    [gradeItems, gradeItemId]
  );

  const load = async () => {
    if (!classroomId) return;
    setLoading(true);
    try {
      const [assessmentRes, gradeRes, rosterRes, jobsRes] = await Promise.all([
        supabase
          .from('buklod_education_assessments')
          .select('id,title,total_points,status,grade_item_id')
          .eq('classroom_id', classroomId)
          .order('created_at', { ascending: false }),
        supabase
          .from('buklod_education_grade_items')
          .select('id,title,points_possible')
          .eq('classroom_id', classroomId)
          .order('created_at', { ascending: false }),
        supabase.rpc('buklod_education_grade_scanner_roster_v1', { p_classroom_id: classroomId }),
        supabase
          .from('buklod_education_grade_scan_jobs')
          .select('id,title,document_type,status,ai_result,ai_score,ai_max_score,ai_confidence,needs_manual_review,faculty_final_score,faculty_feedback,student_user_id,grade_item_id,created_at')
          .eq('classroom_id', classroomId)
          .order('created_at', { ascending: false })
          .limit(12),
      ]);

      if (assessmentRes.error) throw assessmentRes.error;
      if (gradeRes.error) throw gradeRes.error;
      if (rosterRes.error) throw rosterRes.error;
      if (jobsRes.error) throw jobsRes.error;

      setAssessments((assessmentRes.data ?? []) as Assessment[]);
      setGradeItems((gradeRes.data ?? []).map((row: any) => ({
        ...row,
        points_possible: Number(row.points_possible || 0),
      })) as GradeItem[]);
      setStudents((rosterRes.data ?? []) as Student[]);
      setJobs((jobsRes.data ?? []) as ScanJob[]);
    } catch (error) {
      Alert.alert('Grade Scanner', error instanceof Error ? error.message : 'Unable to load scanner data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [classroomId]);

  const chooseType = (type: DocumentType) => {
    setDocumentType(type);
    setRubric(makeRubric(type));
    setResult(null);
    setJobId('');
  };

  const updateRubric = (id: string, patch: Partial<RubricRow>) => {
    setRubric(rows => rows.map(row => (row.id === id ? { ...row, ...patch } : row)));
  };

  const addCriterion = () => {
    setRubric(rows => [
      ...rows,
      { id: `${Date.now()}-${Math.random()}`, name: '', weight: '0', description: '' },
    ]);
  };

  const removeCriterion = (id: string) => {
    setRubric(rows => rows.filter(row => row.id !== id));
  };

  const scanPage = async () => {
    try {
      const picker = await import('expo-image-picker');
      const permission = await picker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        return Alert.alert('Camera Permission', 'Camera access is required to scan a paper.');
      }

      const picked = await picker.launchCameraAsync({
        quality: 0.65,
        exif: false,
      });

      if (!picked.canceled && picked.assets?.[0]) {
        const page = sourceFromAsset(picked.assets[0], `page-${sources.length + 1}.jpg`);
        setSources(current => [...current, page].slice(0, 25));
      }
    } catch (error) {
      Alert.alert('Scan Page', error instanceof Error ? error.message : 'Camera scan failed.');
    }
  };

  const addGallery = async () => {
    try {
      const picker = await import('expo-image-picker');
      const { ensureImagePickerLibraryAccess } = await import('@/lib/buklodImagePickerAccess');
      const permissionGranted = await ensureImagePickerLibraryAccess(
        picker.requestMediaLibraryPermissionsAsync
      );
      if (!permissionGranted) {
        return Alert.alert('Photo Permission', 'Photo access is required to import paper images.');
      }

      const picked = await picker.launchImageLibraryAsync({
        quality: 0.65,
        allowsMultipleSelection: true,
        selectionLimit: 20,
      } as any);

      if (!picked.canceled) {
        const next = (picked.assets ?? []).map((asset: any, index: number) =>
          sourceFromAsset(asset, `page-${sources.length + index + 1}.jpg`)
        );
        setSources(current => [...current, ...next].slice(0, 25));
      }
    } catch (error) {
      Alert.alert('Add Photos', error instanceof Error ? error.message : 'Photo import failed.');
    }
  };

  const addDocuments = async () => {
    try {
      const picker = await import('expo-document-picker');
      const picked = await picker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!picked.canceled) {
        const next = (picked.assets ?? []).map((asset: any, index: number) =>
          sourceFromAsset(asset, `document-${sources.length + index + 1}.pdf`)
        );
        setSources(current => [...current, ...next].slice(0, 25));
      }
    } catch (error) {
      Alert.alert('Import Document', error instanceof Error ? error.message : 'Document import failed.');
    }
  };

  const selectAssessment = (assessment: Assessment) => {
    const selected = assessmentId === assessment.id;
    setAssessmentId(selected ? '' : assessment.id);
    if (!selected && assessment.grade_item_id) setGradeItemId(assessment.grade_item_id);
  };

  const uploadSource = async (source: LocalSource, targetPath: string) => {
    const response = await fetch(source.uri);
    const bytes = await response.arrayBuffer();
    if (!bytes.byteLength) throw new Error(`Could not read ${source.name}.`);

    const { error } = await supabase.storage
      .from('buklod-grade-scans')
      .upload(targetPath, bytes, {
        contentType: source.mimeType || 'application/octet-stream',
        upsert: false,
      });

    if (error) throw new Error(`UPLOAD_STORAGE: ${error.message}`);
  };

  const runGrade = async () => {
    if (!classroomId) return Alert.alert('Grade Scanner', 'Missing classroom.');
    if (sources.length === 0) return Alert.alert('Grade Scanner', 'Scan or import at least one page/document.');
    if (!title.trim()) return Alert.alert('Grade Scanner', 'Enter a title for this scan.');
    if (Math.abs(rubricTotal - 100) > 0.01) {
      return Alert.alert('Rubric', `Rubric weights must total 100%. Current total: ${rubricTotal.toFixed(1)}%.`);
    }
    if (rubric.some(row => !row.name.trim() || Number(row.weight) < 0)) {
      return Alert.alert('Rubric', 'Each criterion needs a name and a valid non-negative weight.');
    }

    setBusy(true);
    let createdJobId = '';
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const userId = authData.user?.id;
      if (!userId) throw new Error('Sign in again before using Grade Scanner.');

      const payloadRubric = rubric.map(row => ({
        name: row.name.trim(),
        weight: Number(row.weight),
        description: row.description.trim(),
      }));

      const { data: createdJob, error: createError } = await supabase.rpc(
        'buklod_education_create_grade_scan_job_v2',
        {
          p_classroom_id: classroomId,
          p_assessment_id: assessmentId || null,
          p_grade_item_id: gradeItemId || null,
          p_student_user_id: studentId || null,
          p_title: title.trim(),
          p_document_type: documentType,
          p_rubric: payloadRubric,
          p_reference_text: referenceText.trim() || null,
          p_source_count: sources.length,
        },
      );

      if (createError) throw new Error(`CREATE_JOB: ${createError.message}`);
      createdJobId = String(createdJob || '');
      if (!createdJobId) throw new Error('CREATE_JOB: server returned no job id.');
      setJobId(createdJobId);

      for (let index = 0; index < sources.length; index += 1) {
        const source = sources[index];
        const storedName = `${String(index + 1).padStart(2, '0')}_${cleanFileName(source.name)}`;
        const storagePath = `${classroomId}/${userId}/${createdJobId}/${storedName}`;

        await uploadSource(source, storagePath);

        const { error: pageError } = await supabase
          .from('buklod_education_grade_scan_pages')
          .insert({
            job_id: createdJobId,
            page_no: index + 1,
            storage_path: storagePath,
            original_name: source.name,
            mime_type: source.mimeType,
            byte_size: source.size ?? null,
          });

        if (pageError) throw new Error(`CREATE_PAGE_ROW: ${pageError.message}`);
      }

      const { error: readyError } = await supabase
        .from('buklod_education_grade_scan_jobs')
        .update({ status: 'READY', updated_at: new Date().toISOString() })
        .eq('id', createdJobId);
      if (readyError) throw new Error(`MARK_READY: ${readyError.message}`);

      const { data: functionData, error: functionError } = await supabase.functions.invoke('buklod-grade-scanner', {
        body: { job_id: createdJobId },
      });

      if (functionError) {
        let functionDetail = functionError.message || 'Edge Function failed.';

        // Supabase FunctionsHttpError normally exposes the non-2xx Response as context.
        // Read its JSON body so the faculty sees the real provider failure instead of
        // only "Edge Function returned a non-2xx status code".
        try {
          const context = (functionError as any)?.context;
          if (context && typeof context.clone === 'function') {
            const payload = await context.clone().json();
            if (payload?.error) functionDetail = String(payload.error);
          } else if (context && typeof context.json === 'function') {
            const payload = await context.json();
            if (payload?.error) functionDetail = String(payload.error);
          }
        } catch {
          // Fall through to the job error_text lookup below.
        }

        // The Edge Function also stores its exact catch message in the scan job.
        // Use it as a second diagnostic path if the Response body is unavailable.
        if (createdJobId && /non-2xx|edge function failed/i.test(functionDetail)) {
          try {
            const { data: failedJob } = await supabase
              .from('buklod_education_grade_scan_jobs')
              .select('error_text')
              .eq('id', createdJobId)
              .maybeSingle();
            const backendDetail = String(failedJob?.error_text || '').trim();
            if (backendDetail && !/non-2xx/i.test(backendDetail)) functionDetail = backendDetail;
          } catch {
            // Keep the original function error if the diagnostic read fails.
          }
        }

        throw new Error(`AI_FUNCTION: ${functionDetail}`);
      }
      const nextResult = functionData?.result as GradeResult | undefined;
      if (!nextResult) throw new Error('AI grading completed without a readable result.');

      setResult(nextResult);
      setFinalScore(String(nextResult.total_score));
      setFacultyFeedback(nextResult.faculty_feedback_draft || '');
      await load();
    } catch (error) {
      if (createdJobId) {
        await supabase
          .from('buklod_education_grade_scan_jobs')
          .update({
            status: 'ERROR',
            error_text: error instanceof Error ? error.message : 'Grade Scanner failed.',
            updated_at: new Date().toISOString(),
          })
          .eq('id', createdJobId);
      }
      Alert.alert('Grade Scanner', error instanceof Error ? error.message : 'Unable to grade this document.');
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    if (!jobId || !result) return Alert.alert('Grade Scanner', 'Run or open a completed AI grade first.');
    if (!studentId) return Alert.alert('Student', 'Select the student before approving the result.');

    const value = Number(finalScore);
    const max = selectedGradeItem?.points_possible ?? result.max_score;
    if (!Number.isFinite(value) || value < 0 || value > max) {
      return Alert.alert('Final Score', `Faculty score must be from 0 to ${max}.`);
    }

    setBusy(true);
    try {
      const { error } = await supabase.rpc('buklod_education_approve_grade_scan_v1', {
        p_job_id: jobId,
        p_student_user_id: studentId,
        p_final_score: value,
        p_feedback: facultyFeedback.trim() || null,
        p_grade_item_id: gradeItemId || null,
      });
      if (error) throw error;

      Alert.alert(
        gradeItemId ? 'Sent to Gradebook' : 'Scanner Review Approved',
        gradeItemId
          ? 'The faculty-reviewed score is now in the selected grade item as REVIEWED. Release remains a separate faculty action.'
          : 'The faculty-reviewed scanner result was saved. No gradebook item was changed.'
      );
      await load();
    } catch (error) {
      Alert.alert('Approve Grade', error instanceof Error ? error.message : 'Could not approve this grade.');
    } finally {
      setBusy(false);
    }
  };

  const openJob = (job: ScanJob) => {
    setJobId(job.id);
    setResult(job.ai_result ?? null);
    setDocumentType(job.document_type);
    setStudentId(job.student_user_id ?? '');
    setGradeItemId(job.grade_item_id ?? '');
    setFinalScore(job.faculty_final_score == null ? String(job.ai_score ?? '') : String(job.faculty_final_score));
    setFacultyFeedback(job.faculty_feedback ?? job.ai_result?.faculty_feedback_draft ?? '');
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#1f7a3f" />
        <Text style={styles.loadingText}>Loading Grade Scanner...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable style={styles.back} onPress={() => router.back()}>
        <MaterialCommunityIcons name="arrow-left" size={22} color="#17311f" />
        <Text style={styles.backText}>{classroomName}</Text>
      </Pressable>

      <Text style={styles.eyebrow}>BUKLOD FACULTY</Text>
      <Text style={styles.title}>Grade Scanner</Text>
      <Text style={styles.subtitle}>
        Scan one page or many pages, apply teacher criteria/rubrics, let AI propose a grade, then review or adjust before anything reaches the gradebook.
      </Text>

      <Text style={styles.sectionTitle}>1. Grading Type</Text>
      <View style={styles.wrap}>
        {TYPES.map(type => (
          <Pressable
            key={type.key}
            style={[styles.chip, documentType === type.key && styles.chipOn]}
            onPress={() => chooseType(type.key)}
          >
            <Text style={[styles.chipText, documentType === type.key && styles.chipTextOn]}>{type.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>SCAN TITLE</Text>
        <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholder="e.g. Midterm Essay - Paper Submission" />

        <Text style={styles.label}>LINKED ASSESSMENT (OPTIONAL)</Text>
        <Text style={styles.hint}>Selecting an existing assessment lets AI use its questions, keys, points, and rubrics as grading reference.</Text>
        <View style={styles.wrap}>
          {assessments.length === 0 ? (
            <Text style={styles.emptyText}>No assessments yet.</Text>
          ) : assessments.map(item => (
            <Pressable
              key={item.id}
              style={[styles.choice, assessmentId === item.id && styles.choiceOn]}
              onPress={() => selectAssessment(item)}
            >
              <Text style={[styles.choiceText, assessmentId === item.id && styles.choiceTextOn]}>{item.title}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>GRADEBOOK ITEM (OPTIONAL)</Text>
        <Text style={styles.hint}>If selected, faculty approval writes a REVIEWED score only. It does not auto-release a final grade.</Text>
        <View style={styles.wrap}>
          {gradeItems.length === 0 ? (
            <Text style={styles.emptyText}>No grade items yet.</Text>
          ) : gradeItems.map(item => (
            <Pressable
              key={item.id}
              style={[styles.choice, gradeItemId === item.id && styles.choiceOn]}
              onPress={() => setGradeItemId(current => (current === item.id ? '' : item.id))}
            >
              <Text style={[styles.choiceText, gradeItemId === item.id && styles.choiceTextOn]}>{item.title} / {item.points_possible}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Text style={styles.sectionTitle}>2. Criteria / Rubric</Text>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Teacher-defined rubric</Text>
          <Text style={[styles.weightTotal, Math.abs(rubricTotal - 100) <= 0.01 ? styles.weightGood : styles.weightBad]}>
            {rubricTotal.toFixed(1)}%
          </Text>
        </View>
        <Text style={styles.hint}>AI must grade only from these criteria, the answer key/reference, and evidence visible in the submission.</Text>

        {rubric.map((row, index) => (
          <View key={row.id} style={styles.rubricRow}>
            <View style={styles.rowBetween}>
              <Text style={styles.rubricNumber}>Criterion {index + 1}</Text>
              <Pressable onPress={() => removeCriterion(row.id)} hitSlop={BUKLOD_HIT_SLOP}>
                <MaterialCommunityIcons name="close-circle-outline" size={21} color="#9b4b40" />
              </Pressable>
            </View>
            <TextInput
              value={row.name}
              onChangeText={value => updateRubric(row.id, { name: value })}
              style={styles.input}
              placeholder="Criterion name"
            />
            <TextInput
              value={row.weight}
              onChangeText={value => updateRubric(row.id, { weight: value })}
              style={styles.input}
              placeholder="Weight %"
              keyboardType="decimal-pad"
            />
            <TextInput
              value={row.description}
              onChangeText={value => updateRubric(row.id, { description: value })}
              style={[styles.input, styles.multiline]}
              placeholder="What earns full credit?"
              multiline
            />
          </View>
        ))}

        <Pressable style={styles.secondaryButton} onPress={addCriterion}>
          <MaterialCommunityIcons name="plus" size={19} color="#1f7a3f" />
          <Text style={styles.secondaryText}>Add Criterion</Text>
        </Pressable>

        <Text style={styles.label}>ANSWER KEY / REFERENCE / SPECIAL INSTRUCTIONS</Text>
        <TextInput
          value={referenceText}
          onChangeText={setReferenceText}
          style={[styles.input, styles.referenceInput]}
          placeholder={'Examples:\n1=A, 2=C, 3=False\nRequired concepts: ...\nAccept equivalent wording for ...'}
          multiline
        />
      </View>

      <Text style={styles.sectionTitle}>3. Scan / Import Paper</Text>
      <View style={styles.card}>
        <View style={styles.scanActions}>
          <Pressable style={styles.scanButton} onPress={scanPage} disabled={busy}>
            <MaterialCommunityIcons name="camera-outline" size={23} color="#1f7a3f" />
            <Text style={styles.scanButtonText}>Scan Page</Text>
          </Pressable>
          <Pressable style={styles.scanButton} onPress={addGallery} disabled={busy}>
            <MaterialCommunityIcons name="image-multiple-outline" size={23} color="#1f7a3f" />
            <Text style={styles.scanButtonText}>Photos</Text>
          </Pressable>
          <Pressable style={styles.scanButton} onPress={addDocuments} disabled={busy}>
            <MaterialCommunityIcons name="file-pdf-box" size={23} color="#1f7a3f" />
            <Text style={styles.scanButtonText}>PDF</Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>A PDF may already contain many pages. Camera/gallery pages are combined into one grading submission in the order shown.</Text>

        {sources.length === 0 ? (
          <View style={styles.emptyBox}><Text style={styles.emptyText}>No pages/documents added yet.</Text></View>
        ) : sources.map((source, index) => (
          <View key={`${source.uri}-${index}`} style={styles.sourceRow}>
            <Text style={styles.pageBadge}>{index + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.sourceName} numberOfLines={1}>{source.name}</Text>
              <Text style={styles.sourceMeta}>{source.mimeType}</Text>
            </View>
            <Pressable onPress={() => setSources(current => current.filter((_, i) => i !== index))} hitSlop={BUKLOD_HIT_SLOP}>
              <MaterialCommunityIcons name="delete-outline" size={20} color="#9b4b40" />
            </Pressable>
          </View>
        ))}

        <Pressable style={[styles.primaryButton, busy && styles.disabled]} onPress={runGrade} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <MaterialCommunityIcons name="text-recognition" size={21} color="#fff" />}
          <Text style={styles.primaryText}>{busy ? 'Processing...' : 'Scan & Propose Grade'}</Text>
        </Pressable>
      </View>

      {!!result && (
        <>
          <Text style={styles.sectionTitle}>4. AI Proposed Grade</Text>
          <View style={styles.resultCard}>
            <View style={styles.scoreRow}>
              <View>
                <Text style={styles.resultEyebrow}>PROPOSED SCORE</Text>
                <Text style={styles.score}>{result.total_score} / {result.max_score}</Text>
              </View>
              <View style={[styles.confidenceBadge, result.confidence < 0.75 && styles.confidenceWarn]}>
                <Text style={styles.confidenceText}>{Math.round(result.confidence * 100)}% confidence</Text>
              </View>
            </View>

            {!!result.recognized_student_name && (
              <Text style={styles.recognized}>Detected name: {result.recognized_student_name}</Text>
            )}
            <Text style={styles.summary}>{result.document_summary}</Text>

            {result.needs_manual_review && (
              <View style={styles.warningBox}>
                <Text style={styles.warningTitle}>Manual review required</Text>
                {result.review_reasons.map((reason, index) => <Text key={`${reason}-${index}`} style={styles.warningText}>- {reason}</Text>)}
              </View>
            )}


            {result.academic_integrity && (
              <View style={styles.integrityBox}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.integrityTitle}>Academic Integrity Review</Text>
                    <Text style={styles.integritySub}>AI-use risk signal only - not proof of cheating</Text>
                  </View>
                  <View
                    style={[
                      styles.integrityRisk,
                      result.academic_integrity.risk_level === 'LOW' && styles.integrityLow,
                      result.academic_integrity.risk_level === 'MEDIUM' && styles.integrityMedium,
                      result.academic_integrity.risk_level === 'HIGH' && styles.integrityHigh,
                    ]}
                  >
                    <Text style={styles.integrityRiskText}>{result.academic_integrity.risk_level}</Text>
                  </View>
                </View>
                <Text style={styles.integrityConfidence}>
                  Screening confidence: {Math.round(result.academic_integrity.confidence * 100)}%
                </Text>
                {!!result.academic_integrity.summary && (
                  <Text style={styles.integritySummary}>{result.academic_integrity.summary}</Text>
                )}
                {result.academic_integrity.signals.length > 0 && (
                  <>
                    <Text style={styles.integrityMini}>Signals noticed</Text>
                    {result.academic_integrity.signals.map((signal, index) => (
                      <Text key={`integrity-signal-${index}`} style={styles.integrityText}>- {signal}</Text>
                    ))}
                  </>
                )}
                {result.academic_integrity.counter_signals.length > 0 && (
                  <>
                    <Text style={styles.integrityMini}>Counter-signals / reasons for caution</Text>
                    {result.academic_integrity.counter_signals.map((signal, index) => (
                      <Text key={`integrity-counter-${index}`} style={styles.integrityText}>- {signal}</Text>
                    ))}
                  </>
                )}
                {result.academic_integrity.verification_questions.length > 0 && (
                  <>
                    <Text style={styles.integrityMini}>Suggested faculty verification</Text>
                    {result.academic_integrity.verification_questions.map((question, index) => (
                      <Text key={`integrity-question-${index}`} style={styles.integrityQuestion}>{index + 1}. {question}</Text>
                    ))}
                  </>
                )}
                <Text style={styles.integrityDisclaimer}>
                  This indicator never changes the proposed score and must not be used alone for a penalty or misconduct finding. Faculty verification is required.
                </Text>
              </View>
            )}
            {result.criteria.map((item, index) => (
              <View key={`${item.criterion}-${index}`} style={styles.resultLine}>
                <View style={styles.rowBetween}>
                  <Text style={styles.resultCriterion}>{item.criterion}</Text>
                  <Text style={styles.resultPoints}>{item.score} / {item.max_score}</Text>
                </View>
                <Text style={styles.resultRationale}>{item.rationale}</Text>
                {!!item.evidence && <Text style={styles.resultEvidence}>Evidence: {item.evidence}</Text>}
              </View>
            ))}

            {result.items.length > 0 && (
              <>
                <Text style={styles.miniTitle}>Item Analysis</Text>
                {result.items.slice(0, 30).map((item, index) => (
                  <View key={`${item.item_label}-${index}`} style={styles.itemLine}>
                    <Text style={styles.itemTitle}>{item.item_label}: {item.score} / {item.max_score}</Text>
                    <Text style={styles.itemText}>Detected: {item.detected_answer || '-'}</Text>
                    {!!item.expected_answer && <Text style={styles.itemText}>Expected: {item.expected_answer}</Text>}
                    <Text style={styles.itemReason}>{item.rationale}</Text>
                  </View>
                ))}
              </>
            )}
          </View>

          <Text style={styles.sectionTitle}>5. Faculty Review</Text>
          <View style={styles.card}>
            <Text style={styles.hint}>The AI score is a proposal only. Select the student, review the evidence, then approve or change the score.</Text>

            <Text style={styles.label}>STUDENT</Text>
            <View style={styles.wrap}>
              {students.map(student => (
                <Pressable
                  key={student.student_user_id}
                  style={[styles.choice, studentId === student.student_user_id && styles.choiceOn]}
                  onPress={() => setStudentId(student.student_user_id)}
                >
                  <Text style={[styles.choiceText, studentId === student.student_user_id && styles.choiceTextOn]}>
                    {student.display_name}{student.username ? ` (@${student.username})` : ''}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>FACULTY FINAL SCORE</Text>
            <TextInput value={finalScore} onChangeText={setFinalScore} keyboardType="decimal-pad" style={styles.input} placeholder="Score" />
            <Text style={styles.hint}>Maximum: {selectedGradeItem?.points_possible ?? result.max_score}</Text>

            <Text style={styles.label}>FACULTY FEEDBACK</Text>
            <TextInput
              value={facultyFeedback}
              onChangeText={setFacultyFeedback}
              style={[styles.input, styles.referenceInput]}
              placeholder="Feedback to retain with the reviewed grade"
              multiline
            />

            <Pressable style={[styles.primaryButton, busy && styles.disabled]} onPress={approve} disabled={busy}>
              <MaterialCommunityIcons name="check-decagram-outline" size={21} color="#fff" />
              <Text style={styles.primaryText}>{gradeItemId ? 'Approve & Send REVIEWED to Gradebook' : 'Approve Scanner Review'}</Text>
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={() => router.push({ pathname: '/profile/buklod-faculty-final-grades' as any, params: { classroomId, name: classroomName } })}
            >
              <MaterialCommunityIcons name="chart-box-outline" size={19} color="#1f7a3f" />
              <Text style={styles.secondaryText}>Open Gradebook & Final Grades</Text>
            </Pressable>
          </View>
        </>
      )}

      <Text style={styles.sectionTitle}>Recent Scans</Text>
      {jobs.length === 0 ? (
        <View style={styles.emptyBox}><Text style={styles.emptyText}>No Grade Scanner history yet.</Text></View>
      ) : jobs.map(job => (
        <Pressable key={job.id} style={styles.historyCard} onPress={() => openJob(job)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.historyTitle}>{job.title}</Text>
            <Text style={styles.historyMeta}>{job.document_type} - {job.status}</Text>
          </View>
          <Text style={styles.historyScore}>
            {job.faculty_final_score != null ? job.faculty_final_score : job.ai_score != null ? job.ai_score : '-'}
            {job.ai_max_score != null ? `/${job.ai_max_score}` : ''}
          </Text>
        </Pressable>
      ))}

      <View style={styles.safetyNote}>
        <MaterialCommunityIcons name="shield-check-outline" size={20} color="#526056" />
        <Text style={styles.safetyText}>
          Grade Scanner does not grade personality. It uses only teacher-defined criteria, answer keys/reference material, and evidence in the submitted work. Low-confidence or unreadable work must be reviewed by faculty.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f7f2', gap: 10 },
  loadingText: { color: '#526056', fontWeight: '800' },
  screen: { flex: 1, backgroundColor: '#f4f7f2' },
  content: { padding: 18, paddingTop: 48, paddingBottom: 70 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  backText: { color: '#17311f', fontWeight: '900', flex: 1 },
  eyebrow: { color: '#1f7a3f', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: '#17311f', fontSize: 30, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#526056', lineHeight: 20, marginTop: 8, marginBottom: 22 },
  sectionTitle: { color: '#17311f', fontSize: 17, fontWeight: '900', marginTop: 18, marginBottom: 10 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 15, gap: 10 },
  cardTitle: { color: '#17311f', fontWeight: '900', fontSize: 16 },
  label: { color: '#6e786f', fontWeight: '900', fontSize: 10, letterSpacing: 0.8, marginTop: 7 },
  hint: { color: '#738078', fontSize: 11, lineHeight: 16 },
  input: { backgroundColor: '#f3f6f2', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, color: '#24362b' },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  referenceInput: { minHeight: 110, textAlignVertical: 'top' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#e8ece7', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: '#1f7a3f' },
  chipText: { color: '#526056', fontSize: 12, fontWeight: '900' },
  chipTextOn: { color: '#fff' },
  choice: { backgroundColor: '#f0f4ef', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: 'transparent' },
  choiceOn: { backgroundColor: '#e5f4e8', borderColor: '#1f7a3f' },
  choiceText: { color: '#526056', fontWeight: '800', fontSize: 11 },
  choiceTextOn: { color: '#17311f' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  weightTotal: { fontWeight: '900', fontSize: 15 },
  weightGood: { color: '#1f7a3f' },
  weightBad: { color: '#a34b35' },
  rubricRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#dfe5df', paddingTop: 12, gap: 8 },
  rubricNumber: { color: '#1f7a3f', fontWeight: '900', fontSize: 11 },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: '#b9c8bc', borderRadius: 12, paddingVertical: 11, marginTop: 4 },
  secondaryText: { color: '#1f7a3f', fontWeight: '900' },
  scanActions: { flexDirection: 'row', gap: 8 },
  scanButton: { flex: 1, backgroundColor: '#edf4ee', borderRadius: 13, paddingVertical: 13, alignItems: 'center', gap: 5 },
  scanButtonText: { color: '#1f7a3f', fontWeight: '900', fontSize: 11 },
  emptyBox: { backgroundColor: '#eef2ed', borderRadius: 14, padding: 15 },
  emptyText: { color: '#738078', fontSize: 12 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e1e7e1', paddingTop: 9 },
  pageBadge: { width: 28, height: 28, borderRadius: 14, textAlign: 'center', textAlignVertical: 'center', backgroundColor: '#e4efe6', color: '#1f7a3f', fontWeight: '900' },
  sourceName: { color: '#26392d', fontWeight: '800' },
  sourceMeta: { color: '#899189', fontSize: 10, marginTop: 2 },
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1f7a3f', borderRadius: 13, paddingVertical: 13, marginTop: 8 },
  primaryText: { color: '#fff', fontWeight: '900' },
  disabled: { opacity: 0.55 },
  resultCard: { backgroundColor: '#17311f', borderRadius: 20, padding: 16 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  resultEyebrow: { color: '#9fc9a8', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  score: { color: '#fff', fontSize: 29, fontWeight: '900', marginTop: 3 },
  confidenceBadge: { backgroundColor: '#294f34', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  confidenceWarn: { backgroundColor: '#6e4a2f' },
  confidenceText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  recognized: { color: '#bfe2c5', fontWeight: '800', marginTop: 12 },
  summary: { color: '#e5eee7', lineHeight: 19, marginTop: 9 },
  warningBox: { backgroundColor: '#fff3dc', borderRadius: 12, padding: 11, marginTop: 12 },
  warningTitle: { color: '#8a5a1f', fontWeight: '900' },
  warningText: { color: '#765c35', fontSize: 11, lineHeight: 16, marginTop: 3 },
  resultLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#365842', paddingTop: 11, marginTop: 11 },
  resultCriterion: { color: '#fff', fontWeight: '900', flex: 1 },
  resultPoints: { color: '#bfe2c5', fontWeight: '900' },
  resultRationale: { color: '#d7e3d9', fontSize: 12, lineHeight: 17, marginTop: 4 },
  resultEvidence: { color: '#9fc9a8', fontSize: 11, lineHeight: 16, marginTop: 4 },
  miniTitle: { color: '#fff', fontWeight: '900', fontSize: 15, marginTop: 16, marginBottom: 6 },
  itemLine: { backgroundColor: '#203d29', borderRadius: 11, padding: 10, marginTop: 7 },
  itemTitle: { color: '#fff', fontWeight: '900', fontSize: 12 },
  itemText: { color: '#cfe0d2', fontSize: 11, marginTop: 3 },
  itemReason: { color: '#9fc9a8', fontSize: 10, marginTop: 4, lineHeight: 15 },
  integrityBox: { backgroundColor: '#edf4ee', borderRadius: 14, padding: 12, marginTop: 13, borderWidth: 1, borderColor: '#bad0bf' },
  integrityTitle: { color: '#17311f', fontWeight: '900', fontSize: 14 },
  integritySub: { color: '#6a796e', fontSize: 10, marginTop: 2 },
  integrityRisk: { backgroundColor: '#66736a', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  integrityLow: { backgroundColor: '#2f7043' },
  integrityMedium: { backgroundColor: '#8a662a' },
  integrityHigh: { backgroundColor: '#9a4437' },
  integrityRiskText: { color: '#fff', fontWeight: '900', fontSize: 10 },
  integrityConfidence: { color: '#526056', fontSize: 10, fontWeight: '800', marginTop: 8 },
  integritySummary: { color: '#314337', fontSize: 11, lineHeight: 16, marginTop: 7 },
  integrityMini: { color: '#17311f', fontWeight: '900', fontSize: 11, marginTop: 9 },
  integrityText: { color: '#526056', fontSize: 10, lineHeight: 15, marginTop: 2 },
  integrityQuestion: { color: '#314337', fontSize: 10, lineHeight: 15, marginTop: 3 },
  integrityDisclaimer: { color: '#6f5a38', fontSize: 10, lineHeight: 15, marginTop: 10, fontWeight: '700' },  historyCard: { backgroundColor: '#fff', borderRadius: 15, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  historyTitle: { color: '#26392d', fontWeight: '900' },
  historyMeta: { color: '#7a857d', fontSize: 10, marginTop: 3 },
  historyScore: { color: '#1f7a3f', fontWeight: '900', fontSize: 16 },
  safetyNote: { flexDirection: 'row', gap: 9, backgroundColor: '#e8ece7', borderRadius: 15, padding: 13, marginTop: 18 },
  safetyText: { flex: 1, color: '#526056', fontSize: 11, lineHeight: 16 },
});