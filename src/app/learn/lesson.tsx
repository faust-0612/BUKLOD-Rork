import { LearningQuestionResponse } from '@/components/LearningQuestionResponse';
import {
  BuklodAnswerValidationGate,
} from '@/components/education/BuklodAnswerValidationGate';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useNetwork } from '@/providers/NetworkProvider';
import { getOfflineCache, setOfflineCache } from '@/lib/offlineCache';
import { warmBuklodAdOpportunity, showBuklodAdOpportunity } from '@/lib/buklodAdOpportunities';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { VoiceReader } from '@/components/VoiceReader';
import { colors } from '@/lib/theme';
import {
  canAccessFormationLesson,
  canAccessFormationTrackLesson,
  loadFormationEngineEnabled,
  loadFormationTrackLesson,
} from '@/lib/buklodFormationProgress';
import {
  isEarlyFormationStage,
  mergeLessonAccessWithLegacySequentialLock,
  requiresFormationSequentialLock,
} from '@/lib/formationPacing';
import {
  buildLessonAssignmentContext,
  buildLessonReflectionContext,
} from '@/lib/buklodAiResponseValidation';
import { useBuklodAnswerValidation } from '@/hooks/useBuklodAnswerValidation';
import { friendlyLessonBlockingReason, formationCopy, lessonBlockingGuide } from '@/lib/formationCopy';
import type { FormationLessonAccess } from '@/types/buklodFormation';

export default function LessonDetail() {
  const { lessonId, enrollmentId, trackLessonId } =
    useLocalSearchParams<{
      lessonId: string;
      enrollmentId: string;
      trackLessonId: string;
    }>();

  const { user } = useAuth();
  const { online } = useNetwork();
  const accountId = user?.id ?? '';
  const [lesson, setLesson] = useState<any>(null);
  const [formationLesson, setFormationLesson] = useState<any>(null);
  const [track, setTrack] = useState<any>(null);
  const [reflection, setReflection] = useState('');
  const [assignment, setAssignment] = useState('');
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [formationStatus, setFormationStatus] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [readerScale, setReaderScale] = useState(1);
  const [lessonAccess, setLessonAccess] = useState<FormationLessonAccess | null>(
    null,
  );
  const [loadState, setLoadState] = useState<
    'loading' | 'ready' | 'unavailable'
  >('loading');
  const [loadMessage, setLoadMessage] = useState<string | null>(null);

  useEffect(() => {
    // Prepare during reading, not after the learner is waiting to continue.
    if (lesson && !formationLesson) warmBuklodAdOpportunity('formation_lesson_success');
  }, [lesson?.id, formationLesson]);

  const reflectionQuestionContext = useMemo(() => {
    if (!lesson?.id) {
      return null;
    }

    return buildLessonReflectionContext({
      lessonId: lesson.id,
      trackId: lesson.track_id ?? track?.id ?? null,
      enrollmentId: enrollmentId ?? null,
      stageCode:
        track?.stage_code == null ? null : Number(track.stage_code),
      questionText:
        lesson.reflection_question ??
        'Write your reflection on this lesson.',
      lessonTitle: lesson.title ?? null,
      scriptureReference: lesson.scripture_reference ?? null,
      aiValidationContext: lesson.ai_validation_context,
    });
  }, [lesson, track, enrollmentId]);

  const assignmentQuestionContext = useMemo(() => {
    if (!lesson?.id) {
      return null;
    }

    return buildLessonAssignmentContext({
      lessonId: lesson.id,
      trackId: lesson.track_id ?? track?.id ?? null,
      enrollmentId: enrollmentId ?? null,
      prompt: lesson.assignment_prompt || 'Complete the assignment.',
      lessonTitle: lesson.title ?? null,
    });
  }, [lesson, track, enrollmentId]);

  const reflectionValidation = useBuklodAnswerValidation(
    reflectionQuestionContext ?? {
      questionId: 'lesson:pending:reflection',
      module: 'lesson',
      questionText: 'Reflection',
    },
    reflection,
  );

  const assignmentValidation = useBuklodAnswerValidation(
    assignmentQuestionContext ?? {
      questionId: 'lesson:pending:assignment',
      module: 'lesson',
      questionText: 'Assignment',
    },
    assignment,
  );

  const load = useCallback(async () => {
    if (!lessonId && !trackLessonId) {
      setLoadState('unavailable');
      setLoadMessage(formationCopy.lessonCouldNotOpenGuide);
      return;
    }

    setLoadState('loading');
    setLoadMessage(null);
    if (!online) {
      const key = 'learning-lesson-content-v1:' + (trackLessonId || lessonId);
      const cached = accountId ? await getOfflineCache<any>(key, { userId: accountId, allowStale: true }) : null;
      const data = cached?.data;
      if (data?.lesson && data?.verified === true &&
          Date.now() - cached!.storedAt <= 30 * 24 * 60 * 60 * 1000 &&
          data.lessonAccess?.allowed !== false) {
        setLesson(data.lesson);
        setFormationLesson(data.formationLesson ?? null);
        setTrack(data.track ?? null);
        setQuestions(data.questions ?? []);
        setFormationStatus(data.formationStatus ?? null);
        setLessonAccess(data.lessonAccess ?? null);
        setLoadMessage('Saved lesson available offline. Reconnect to submit, validate, or update progress.');
        setLoadState('ready');
      } else {
        setLoadState('unavailable');
        setLoadMessage('This lesson has not been downloaded and authorized on this device. Connect once to save it.');
      }
      return;
    }
    let resolvedAccess: FormationLessonAccess | null = null;
    let engineOn = false;
    let trackStageCode: number | null = null;
    let authorizedTrack: any = null;
    let cachedQuestions: any[] = [];
    let cachedFormationStatus: any = null;

    try {
      engineOn = await loadFormationEngineEnabled();
      if (engineOn) {
        if (trackLessonId) {
          const access = await canAccessFormationTrackLesson(trackLessonId);
          resolvedAccess = access;
          setLessonAccess(access);
          if (!access || !access.allowed) {
            setLoadState('unavailable');
            return;
          }

          const payload = await loadFormationTrackLesson(trackLessonId);
          if (!payload) {
            setLoadState('unavailable');
            setLoadMessage(formationCopy.lessonCouldNotOpenGuide);
            return;
          }

          setFormationLesson(payload);
          const preparedLesson = {
            id: trackLessonId,
            title: payload?.title ?? 'Formation Lesson',
            content:
              typeof payload?.lesson_content === 'object'
                ? String(
                    (payload.lesson_content as Record<string, unknown>)
                      .core_teaching ??
                      (payload.lesson_content as Record<string, unknown>)
                        .content ??
                      JSON.stringify(payload.lesson_content, null, 2),
                  )
                : '',
            track_id: null,
          };
          setLesson(preparedLesson);
          const preparedTrack = {
            stage_code: payload?.stage_code,
            title: payload?.role_track_title_en ?? 'Formation',
          };
          setTrack(preparedTrack);
          if (accountId && access.allowed) {
            void setOfflineCache('learning-lesson-content-v1:' + trackLessonId, {
              verified: true, lesson: preparedLesson, formationLesson: payload,
              track: preparedTrack, questions: [], formationStatus: null, lessonAccess: access,
            }, { userId: accountId, ttlMs: 30 * 24 * 60 * 60 * 1000 }).catch(() => undefined);
          }
          setLoadState('ready');
          return;
        }

        if (lessonId) {
          const access = await canAccessFormationLesson(lessonId);
          resolvedAccess = access;
          setLessonAccess(access);
        }
      } else {
        setLessonAccess(null);
      }
    } catch {
      setLessonAccess(null);
      setLoadState('unavailable');
      setLoadMessage(formationCopy.lessonCouldNotOpenGuide);
      return;
    }

    if (!lessonId) {
      setLoadState('unavailable');
      setLoadMessage(formationCopy.lessonCouldNotOpenGuide);
      return;
    }

    const { data: l, error: lessonError } = await supabase
      .from('learning_lessons')
      .select('*')
      .eq('id', lessonId)
      .single();

    if (lessonError) {
      setLoadState('unavailable');
      setLoadMessage(formationCopy.lessonCouldNotOpenGuide);
      return;
    }

    setLesson(l);

    if (l?.track_id) {
      const { data: t } = await supabase
        .from('learning_tracks')
        .select('id,title,formation_program,stage_code,status')
        .eq('id', l.track_id)
        .single();

      setTrack(t);
      authorizedTrack = t;
      trackStageCode =
        t?.stage_code == null ? null : Number(t.stage_code);

      if (
        t?.formation_program === 'ccp' ||
        t?.formation_program === 'discipleship'
      ) {
        const [{ data: statusData }, { data: trackLessons }] = await Promise.all([
          supabase.rpc('get_my_formation_track_lesson_status', {
            p_track_id: l.track_id,
          }),
          supabase
            .from('learning_lessons')
            .select('id,lesson_number')
            .eq('track_id', l.track_id)
            .order('lesson_number'),
        ]);

        const current = (statusData ?? []).find(
          (x: any) => x.lesson_id === lessonId
        );

        setFormationStatus(current ?? null);
        cachedFormationStatus = current ?? null;

        const applySequentialLock = requiresFormationSequentialLock(
          trackStageCode,
          engineOn,
        );

        if (applySequentialLock) {
          const statusByLessonId = new Map<string, { official_status?: string }>(
            (statusData ?? []).map((row: any) => [row.lesson_id, row]),
          );
          const merged = mergeLessonAccessWithLegacySequentialLock(
            resolvedAccess,
            {
              engineEnabled: engineOn,
              isFormation: true,
              lessonId,
              stageCode: trackStageCode,
              lessons: (trackLessons ?? []).map(
                (row: { id: string; lesson_number: number }) => ({
                  id: row.id,
                  lesson_number: row.lesson_number,
                }),
              ),
              statusByLessonId,
            },
          );

          if (merged) {
            resolvedAccess = merged;
            setLessonAccess(merged);
            if (!merged.allowed) {
              setLoadState('unavailable');
              return;
            }
          } else if (!resolvedAccess && isEarlyFormationStage(trackStageCode)) {
            setLoadState('unavailable');
            return;
          }
        } else if (engineOn && resolvedAccess && !resolvedAccess.allowed) {
          setLoadState('unavailable');
          return;
        }
      }
    }

    if (l?.lesson_type === 'quiz') {
      const { data: q } = await supabase
        .from('quiz_questions')
        .select(
          'id,question_text,question_order,quiz_choices(id,choice_text,choice_order)'
        )
        .eq('lesson_id', lessonId)
        .order('question_order');

      setQuestions(q ?? []);
      cachedQuestions = q ?? [];
    }

    if (enrollmentId) {
      const { data: existing } = await supabase
        .from('lesson_progress')
        .select('reflection_text')
        .eq('enrollment_id', enrollmentId)
        .eq('lesson_id', lessonId)
        .maybeSingle();

      if (existing?.reflection_text) {
        setReflection(existing.reflection_text);
      }
    }

    // Cache only a published lesson that passed its current server access gate.
    // Offline reads never perform server progress/points mutations.
    const isManagedFormation =
      authorizedTrack?.formation_program === 'ccp' ||
      authorizedTrack?.formation_program === 'discipleship';
    if (accountId && l && authorizedTrack?.status === 'published' &&
        (!isManagedFormation || !engineOn || resolvedAccess?.allowed === true)) {
      void setOfflineCache('learning-lesson-content-v1:' + lessonId, {
        verified: true, lesson: l, formationLesson: null, track: authorizedTrack,
        questions: cachedQuestions, formationStatus: cachedFormationStatus,
        lessonAccess: resolvedAccess,
      }, { userId: accountId, ttlMs: 30 * 24 * 60 * 60 * 1000 }).catch(() => undefined);
    }
    setLoadState('ready');
  }, [lessonId, enrollmentId, trackLessonId, online, accountId]);

  useEffect(() => {
    load();
  }, [load]);

  const isFormation =
    track?.formation_program === 'ccp' ||
    track?.formation_program === 'discipleship';

  const officialStatus =
    formationStatus?.official_status ?? 'awaiting_cluster_admin';

  const statusInfo = useMemo(() => {
    switch (officialStatus) {
      case 'approved':
        return {
          title: 'AUTOMATICALLY APPROVED',
          detail: 'This lesson is officially completed after automatic BUKLOD checking.',
        };

      case 'pending_admin':
      case 'awaiting_pastor':
      case 'awaiting_cluster_admin':
        return {
          title: 'AUTOMATIC CHECKING',
          detail: 'This lesson is being checked automatically. No Pastor, Cluster Admin, or System Admin approval is required.',
        };

      case 'rejected':
        return {
          title: 'REVISION NEEDED',
          detail:
            'Improve the required response and complete the lesson again. BUKLOD will recheck it automatically.',
        };

      default:
        return {
          title: formationStatus?.studied
            ? 'STUDIED'
            : 'NOT YET COMPLETED',
          detail: formationStatus?.studied
            ? 'Your study progress is saved. Complete the required response when ready; BUKLOD will save, submit, and check it automatically.'
            : 'Read and study the lesson, then complete the required response. BUKLOD handles submission and checking automatically.',
        };
    }
  }, [officialStatus, formationStatus?.studied]);

  const saveFormationStudy = async () => {
    if (!lesson || !enrollmentId) {
      Alert.alert(
        'BUKLOD Formation',
        'Enrollment information is missing.'
      );
      return;
    }

    if (reflection.trim()) {
      const validated = await reflectionValidation.validateBeforeSubmit({
        response: reflection,
      });

      if (!validated) {
        Alert.alert(
          'Balikan ang iyong sagot',
          'Para tanggapin ang sagot: direktang sagutin ang tanong, ipaliwanag ang natutuhan sa sariling salita, at magbigay ng personal na aplikasyon. Tinatanggap ang Filipino, Taglish, o English; hindi kailangang eksaktong kopya ng aralin.',
        );
        // R1.3: advisory feedback only during draft save; server submit rules still apply.
      }
    }

    setBusy(true);

    const { error } = await supabase.rpc(
      'save_my_formation_lesson_study',
      {
        p_enrollment_id: enrollmentId,
        p_lesson_id: lesson.id,
        p_reflection: reflection.trim() || null,
      }
    );

    setBusy(false);

    if (error) {
      Alert.alert('Hindi ma-save ang draft', error.message);
      return;
    }

    await load();

    Alert.alert(
      'Na-save ang draft',
      'Na-save ang draft. Kumpletuhin ang Quick Check; kapag pinili ang COMPLETE LESSON, awtomatikong ise-save, isusumite, at iche-check ng BUKLOD.'
    );
  };

  const completeLegacyLesson = async () => {
    if (!lesson || !enrollmentId) return;

    if (reflection.trim()) {
      const validated = await reflectionValidation.validateBeforeSubmit({
        response: reflection,
      });

      if (!validated) {
        Alert.alert(
          'Balikan ang iyong sagot',
          'Para tanggapin ang sagot: direktang sagutin ang tanong, ipaliwanag ang natutuhan sa sariling salita, at magbigay ng personal na aplikasyon. Tinatanggap ang Filipino, Taglish, o English; hindi kailangang eksaktong kopya ng aralin.',
        );
        // R1.3: advisory feedback only during draft save; server submit rules still apply.
      }
    }

    setBusy(true);

    const { error } = await supabase.rpc(
      'complete_learning_lesson',
      {
        p_enrollment_id: enrollmentId,
        p_lesson_id: lesson.id,
        p_reflection: reflection.trim() || null,
      }
    );

    setBusy(false);

    if (error) {
      Alert.alert('Could not complete lesson', error.message);
      return;
    }

    await showBuklodAdOpportunity('formation_lesson_success');
    Alert.alert('Lesson completed', 'Your progress has been saved.');
    router.back();
  };

  const submitAssignment = async () => {
    if (!lesson || !enrollmentId || !assignment.trim()) {
      Alert.alert('Assignment', 'Write your response first.');
      return;
    }

    const validated = await assignmentValidation.validateBeforeSubmit({
      response: assignment,
    });

    if (!validated) {
      Alert.alert(
        'Review your assignment',
        'Please improve your answer using the guidance shown, then try again.',
      );
      return;
    }

    warmBuklodAdOpportunity('learning_assignment_success');
    setBusy(true);

    const { error } = await supabase.rpc(
      'submit_learning_assignment',
      {
        p_enrollment_id: enrollmentId,
        p_lesson_id: lesson.id,
        p_response: assignment.trim(),
      }
    );

    setBusy(false);

    if (error) {
      Alert.alert('Could not submit', error.message);
      return;
    }

    await showBuklodAdOpportunity('learning_assignment_success');
    Alert.alert('Submitted', 'Your assignment has been submitted.');
    router.back();
  };

  const submitQuiz = async () => {
    if (!lesson || !enrollmentId) return;

    setBusy(true);

    const { data, error } = await supabase.rpc(
      'submit_quiz_attempt',
      {
        p_enrollment_id: enrollmentId,
        p_lesson_id: lesson.id,
        p_answers: answers,
      }
    );

    setBusy(false);

    if (error) {
      Alert.alert('Quiz', error.message);
      return;
    }

    Alert.alert(
      data?.passed ? 'Quiz passed' : 'Try again',
      `${data?.score ?? 0}/${data?.total ?? 0} correct`
    );

    if (data?.passed) {
      router.back();
    }
  };

  if (loadState === 'loading') {
    return (
      <SafeAreaView style={shared.screen} edges={['top', 'bottom']}>
        <View style={[shared.content, styles.centered]}>
          <ActivityIndicator color={colors.green} size="large" />
          <Text style={shared.h1}>{formationCopy.lessonOpeningTitle}</Text>
          <Text style={shared.body}>
            Please wait while we prepare your lesson.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (lessonAccess && !lessonAccess.allowed) {
    return (
      <SafeAreaView style={shared.screen} edges={['top', 'bottom']}>
        <View style={shared.content}>
          <Text style={shared.h1}>{formationCopy.lessonUnavailableTitle}</Text>
          <Card>
            <Text style={shared.body}>
              {friendlyLessonBlockingReason(lessonAccess.blocking_reason)}
            </Text>
            {lessonBlockingGuide(lessonAccess.blocking_reason) ? (
              <Text style={[shared.muted, styles.guideSpacing]}>
                {lessonBlockingGuide(lessonAccess.blocking_reason)}
              </Text>
            ) : null}
          </Card>
          <Button title="BACK" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  if (loadState === 'unavailable' || !lesson) {
    return (
      <SafeAreaView style={shared.screen} edges={['top', 'bottom']}>
        <View style={shared.content}>
          <Text style={shared.h1}>{formationCopy.lessonUnavailableTitle}</Text>
          <Card>
            <Text style={shared.body}>
              {loadMessage ?? formationCopy.lessonCouldNotOpenGuide}
            </Text>
          </Card>
          <Button title="BACK" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      {/* LESSON_SAFE_AREA */}
      <SafeAreaView
        style={{ flex: 1 }}
        edges={['top', 'bottom']}
      >
        <ScrollView contentContainerStyle={shared.content}>
      <Text style={styles.eyebrow}>
        {track?.stage_code ? `BUKLOD ${track.stage_code} ? ` : ''}
        Lesson {lesson.lesson_number}
      </Text>

      <Text style={shared.h1}>{lesson.title}</Text>

      {!!lesson.scripture_reference && (
        <Text style={styles.scripture}>
          ?? {lesson.scripture_reference}
        </Text>
      )}

      {/* PATCH_155B_4Q_FLOW */}
      {isFormation &&
        Array.isArray(
          lesson?.generated_questions_fil
        ) &&
        lesson.generated_questions_fil.length === 4 && (
          <LearningQuestionResponse
            lesson={lesson}
            enrollmentId={enrollmentId}
            onSubmitted={load}
          />
        )}

      {isFormation &&
        !(
          Array.isArray(
            lesson?.generated_questions_fil
          ) &&
          lesson.generated_questions_fil.length === 4
        ) && (
        <>
          <SectionTitle>OFFICIAL FORMATION STATUS</SectionTitle>

          <Card>
            <Text style={styles.statusTitle}>
              {statusInfo.title}
            </Text>

            <Text style={shared.body}>
              {statusInfo.detail}
            </Text>

            <View style={styles.statusDivider} />

            <Text style={styles.note}>
              BUKLOD Points are posted automatically after automatic checking and approval.
            </Text>
          </Card>
        </>
      )}

      <SectionTitle>LESSON</SectionTitle>

      {/* LESSON_TAGALOG_VOICE_READER_V2 */}
      <VoiceReader
        title="PAKINGGAN ANG LESSON"
        subtitle="Malinaw na Tagalog / Filipino voice"
        language="fil-PH"
        text={[
          String(
            lesson.title ?? ''
          ),

          String(
            lesson.content ?? ''
          ),
        ]
          .filter(Boolean)
          .join('. ')}
      />

      <View style={styles.readerToolbar}>
        <View>
          <Text style={styles.readerLabel}>READING SIZE</Text>
          <Text style={styles.readerHint}>
            Adjust the lesson text for comfortable reading.
          </Text>
        </View>

        <View style={styles.readerControls}>
          <Pressable
            style={styles.readerButton}
            onPress={() =>
              setReaderScale((current) =>
                Math.max(0.9, Number((current - 0.1).toFixed(1)))
              )
            }
          >
            <Text style={styles.readerButtonText}>A-</Text>
          </Pressable>

          <View style={styles.readerPercent}>
            <Text style={styles.readerPercentText}>
              {Math.round(readerScale * 100)}%
            </Text>
          </View>

          <Pressable
            style={styles.readerButton}
            onPress={() =>
              setReaderScale((current) =>
                Math.min(1.6, Number((current + 0.1).toFixed(1)))
              )
            }
          >
            <Text style={styles.readerButtonText}>A+</Text>
          </Pressable>

          <Pressable
            style={styles.readerReset}
            onPress={() => setReaderScale(1)}
          >
            <Text style={styles.readerResetText}>RESET</Text>
          </Pressable>
        </View>
      </View>

      <Card>
        <Text
          allowFontScaling
          maxFontSizeMultiplier={2}
          style={[
            shared.body,
            styles.lessonText,
            {
              fontSize: 17 * readerScale,
              lineHeight: 28 * readerScale,
            },
          ]}
        >
          {lesson.content}
        </Text>
      </Card>

      {isFormation && (
        <>
          <SectionTitle>STUDY & REFLECTION</SectionTitle>

          <Card>
            {!!lesson.reflection_question && (
              <Text style={shared.h2}>
                {lesson.reflection_question}
              </Text>
            )}

            <BuklodAnswerValidationGate
              isValidating={reflectionValidation.isValidating}
              lastResult={reflectionValidation.lastResult}
              error={reflectionValidation.error}
            >
              <TextInput
                multiline
                value={reflection}
                onChangeText={(value) => {
                  setReflection(value);
                  reflectionValidation.reset();
                }}
                style={styles.area}
                placeholder="Write your reflection or personal notes..."
                placeholderTextColor={colors.muted}
              />
            </BuklodAnswerValidationGate>

            <Text style={styles.note}>
              Saving your study does not mark this lesson as officially
              completed.
            </Text>
          </Card>

          <Button
            title={
              busy
                ? 'SAVING...'
                : formationStatus?.studied
                  ? 'UPDATE STUDY'
                  : 'I-SAVE ANG DRAFT'
            }
            onPress={saveFormationStudy}
          />

          {(officialStatus === 'awaiting_pastor' ||
            officialStatus === 'awaiting_cluster_admin' ||
            officialStatus === 'pending_admin') && (
            <Card>
              <Text style={styles.waitingTitle}>AUTOMATIC CHECKING</Text>

              <Text style={shared.body}>
                BUKLOD is checking this lesson automatically. No Pastor,
                Cluster Admin, or System Admin needs to approve it manually.
                If a revision is requested, improve the response and complete
                the lesson again for automatic rechecking.
              </Text>
            </Card>
          )}

          <SectionTitle>HAMON SA LINGGONG ITO</SectionTitle>
          <Card>
            <Text style={shared.body}>
              Complete the practical challenge connected to this lesson. Mark
              your service action for mentor verification when done.
            </Text>
            <View style={{ marginTop: 10 }}>
              <Button
                title="SUBMIT BAYANIHAN / MISSION ACTION"
                onPress={() =>
                  router.push({
                    pathname: '/formation/bayanihan-action',
                    params: {
                      stage: String(track?.stage_code ?? 106),
                      lessonId: lesson.id,
                    },
                  } as any)
                }
              />
            </View>
          </Card>
        </>
      )}

      {!isFormation && !!lesson.reflection_question && (
        <>
          <SectionTitle>REFLECTION</SectionTitle>

          <Card>
            <Text style={shared.h2}>
              {lesson.reflection_question}
            </Text>

            <BuklodAnswerValidationGate
              isValidating={reflectionValidation.isValidating}
              lastResult={reflectionValidation.lastResult}
              error={reflectionValidation.error}
            >
              <TextInput
                multiline
                value={reflection}
                onChangeText={(value) => {
                  setReflection(value);
                  reflectionValidation.reset();
                }}
                style={styles.area}
                placeholder="Ano ang natutuhan mo, at paano mo ito isasabuhay?"
                placeholderTextColor={colors.muted}
              />
            </BuklodAnswerValidationGate>
          </Card>
        </>
      )}

      {!isFormation && lesson.lesson_type === 'quiz' && (
        <>
          <SectionTitle>QUIZ</SectionTitle>

          {questions.map((q) => (
            <Card key={q.id}>
              <Text style={shared.h2}>
                {q.question_text}
              </Text>

              <View style={{ gap: 7, marginTop: 9 }}>
                {(q.quiz_choices ?? [])
                  .sort(
                    (a: any, b: any) =>
                      a.choice_order - b.choice_order
                  )
                  .map((c: any) => (
                    <Pressable
                      key={c.id}
                      onPress={() =>
                        setAnswers((current) => ({
                          ...current,
                          [q.id]: c.id,
                        }))
                      }
                      style={[
                        styles.choice,
                        answers[q.id] === c.id && styles.choiceOn,
                      ]}
                    >
                      <Text>{c.choice_text}</Text>
                    </Pressable>
                  ))}
              </View>
            </Card>
          ))}

          <Button
            title={busy ? 'SUBMITTING...' : 'SUBMIT QUIZ'}
            onPress={submitQuiz}
          />
        </>
      )}

      {!isFormation && lesson.lesson_type === 'assignment' && (
        <>
          <SectionTitle>ASSIGNMENT</SectionTitle>

          <Card>
            <Text style={shared.h2}>
              {lesson.assignment_prompt || 'Complete the assignment.'}
            </Text>

            <BuklodAnswerValidationGate
              isValidating={assignmentValidation.isValidating}
              lastResult={assignmentValidation.lastResult}
              error={assignmentValidation.error}
            >
              <TextInput
                multiline
                value={assignment}
                onChangeText={(value) => {
                  setAssignment(value);
                  assignmentValidation.reset();
                }}
                style={styles.area}
                placeholder="Write your assignment response..."
                placeholderTextColor={colors.muted}
              />
            </BuklodAnswerValidationGate>
          </Card>

          <Button
            title={busy ? 'SUBMITTING...' : 'SUBMIT ASSIGNMENT'}
            onPress={submitAssignment}
          />
        </>
      )}

      {!isFormation &&
        !['quiz', 'assignment'].includes(lesson.lesson_type) && (
          <Button
            title={busy ? 'SAVING...' : '? COMPLETE LESSON'}
            onPress={completeLegacyLesson}
          />
        )}
    </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  readerToolbar: {
    marginBottom: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    gap: 10,
  },

  readerLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.green,
    letterSpacing: 0.8,
  },

  readerHint: {
    marginTop: 2,
    fontSize: 12,
    color: colors.muted,
  },

  readerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
  },

  readerButton: {
    minWidth: 44,
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },

  readerButtonText: {
    color: colors.green,
    fontSize: 16,
    fontWeight: '900',
  },

  readerPercent: {
    minWidth: 58,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(39,93,69,0.08)',
  },

  readerPercentText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },

  readerReset: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },

  readerResetText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
  },

  lessonText: {
    color: colors.text,
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  scripture: {
    fontWeight: '900',
    color: colors.green,
    marginBottom: 8,
  },

  area: {
    minHeight: 130,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    padding: 12,
    textAlignVertical: 'top',
    marginTop: 9,
    color: colors.text,
  },

  choice: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    padding: 12,
  },

  choiceOn: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },

  statusTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.green,
    marginBottom: 6,
  },

  statusDivider: {
    height: 1,
    backgroundColor: colors.line,
    marginVertical: 12,
  },

  reward: {
    fontWeight: '900',
    color: colors.text,
  },

  note: {
    marginTop: 7,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },

  waitingTitle: {
    fontWeight: '900',
    color: colors.green,
    marginBottom: 6,
  },

  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingTop: 48,
  },

  guideSpacing: {
    marginTop: 10,
  },
});

