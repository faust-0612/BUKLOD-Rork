import { LearningQuestionResponse } from '@/components/LearningQuestionResponse';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { VoiceReader } from '@/components/VoiceReader';
import { colors } from '@/lib/theme';

export default function LessonDetail() {
  const { lessonId, enrollmentId } =
    useLocalSearchParams<{
      lessonId: string;
      enrollmentId: string;
    }>();

  const [lesson, setLesson] = useState<any>(null);
  const [track, setTrack] = useState<any>(null);
  const [reflection, setReflection] = useState('');
  const [assignment, setAssignment] = useState('');
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [formationStatus, setFormationStatus] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [readerScale, setReaderScale] = useState(1);

  const load = useCallback(async () => {
    if (!lessonId) return;

    const { data: l, error: lessonError } = await supabase
      .from('learning_lessons')
      .select('*')
      .eq('id', lessonId)
      .single();

    if (lessonError) {
      Alert.alert('Lesson', lessonError.message);
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

      if (
        t?.formation_program === 'ccp' ||
        t?.formation_program === 'discipleship'
      ) {
        const { data: statusData } = await supabase.rpc(
          'get_my_formation_track_lesson_status',
          {
            p_track_id: l.track_id,
          }
        );

        const current = (statusData ?? []).find(
          (x: any) => x.lesson_id === lessonId
        );

        setFormationStatus(current ?? null);
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
  }, [lessonId, enrollmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const isFormation =
    track?.formation_program === 'ccp' ||
    track?.formation_program === 'discipleship';

  const officialStatus =
    formationStatus?.official_status ?? 'awaiting_pastor';

  const reward = Number(
    formationStatus?.bayanihan_reward ??
      lesson?.bayanihan_reward ??
      0
  );

  const statusInfo = useMemo(() => {
    switch (officialStatus) {
      case 'approved':
        return {
          title: 'ADMIN APPROVED',
          detail: 'This lesson is officially completed.',
        };

      case 'pending_admin':
        return {
          title: 'PASTOR VALIDATED',
          detail: 'Waiting for System Admin final approval.',
        };

      case 'rejected':
        return {
          title: 'REVIEW REQUIRED',
          detail:
            'The previous validation was not approved. Please coordinate with your Pastor.',
        };

      default:
        return {
          title: formationStatus?.studied
            ? 'STUDIED'
            : 'NOT YET VALIDATED',
          detail: formationStatus?.studied
            ? 'Your study progress is saved. Pastor validation is still required for official completion.'
            : 'Read and study the lesson. Official completion requires Pastor validation.',
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
      Alert.alert('Could not save study', error.message);
      return;
    }

    await load();

    Alert.alert(
      'Study saved',
      'Your study progress has been saved. Pastor validation and System Admin approval are still required for official completion.'
    );
  };

  const completeLegacyLesson = async () => {
    if (!lesson || !enrollmentId) return;

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

    Alert.alert('Lesson completed', 'Your progress has been saved.');
    router.back();
  };

  const submitAssignment = async () => {
    if (!lesson || !enrollmentId || !assignment.trim()) {
      Alert.alert('Assignment', 'Write your response first.');
      return;
    }

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

  if (!lesson) return null;

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

            <Text style={styles.reward}>
              Bayanihan Value: ?{reward.toFixed(2)}
            </Text>

            <Text style={styles.note}>
              Bayanihan is credited only after Pastor validation and
              System Admin final approval.
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

            <TextInput
              multiline
              value={reflection}
              onChangeText={setReflection}
              style={styles.area}
              placeholder="Write your reflection or personal notes..."
              placeholderTextColor={colors.muted}
            />

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
                  : 'SAVE STUDY'
            }
            onPress={saveFormationStudy}
          />

          {officialStatus === 'awaiting_pastor' && (
            <Card>
              <Text style={styles.waitingTitle}>NEXT STEP</Text>

              <Text style={shared.body}>
                After studying this lesson, your Pastor validates your
                official completion. System Admin gives the final approval
                before Bayanihan credit is posted.
              </Text>
            </Card>
          )}
        </>
      )}

      {!isFormation && !!lesson.reflection_question && (
        <>
          <SectionTitle>REFLECTION</SectionTitle>

          <Card>
            <Text style={shared.h2}>
              {lesson.reflection_question}
            </Text>

            <TextInput
              multiline
              value={reflection}
              onChangeText={setReflection}
              style={styles.area}
              placeholder="Write your reflection..."
              placeholderTextColor={colors.muted}
            />
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

            <TextInput
              multiline
              value={assignment}
              onChangeText={setAssignment}
              style={styles.area}
              placeholder="Write your assignment response..."
              placeholderTextColor={colors.muted}
            />
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
});


