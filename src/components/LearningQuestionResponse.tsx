import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  useAudioPlayer,
} from 'expo-audio';

import {
  Button,
  Card,
  SectionTitle,
  shared,
} from '@/components/UI';

import {
  BuklodAnswerValidationFeedback,
} from '@/components/education/BuklodAnswerValidationGate';

import {
  buildGeneratedLessonQuestionContext,
  buildLessonReflectionContext,
  isValidationAcceptable,
  validateBuklodResponse,
} from '@/lib/buklodAiResponseValidation';

import {
  pickGeneratedQuestions,
} from '@/lib/buklodQuestionEngine';

import {
  supabase,
} from '@/lib/supabase';

import {
  colors,
} from '@/lib/theme';

import type {
  AIAnswerValidationResult,
} from '@/types/buklodAiValidation';


type Props = {
  lesson: any;
  enrollmentId: string | null | undefined;
  onSubmitted?: () => void | Promise<void>;
};


function LessonAudio({
  url,
}: {
  url: string;
}) {
  const player = useAudioPlayer(url);

  return (
    <Pressable
      onPress={() => {
        try {
          player.play();
        } catch {
          Alert.alert(
            'Lesson Audio',
            'Could not play this audio.'
          );
        }
      }}
      style={styles.audioButton}
    >
      <Text style={styles.audioIcon}>
        ▶
      </Text>

      <View style={{ flex: 1 }}>
        <Text style={styles.audioTitle}>
          PLAY LESSON AUDIO
        </Text>

        <Text style={styles.audioHint}>
          Listen while following the lesson.
        </Text>
      </View>
    </Pressable>
  );
}


function emptyAnswers(): string[] {
  return ['', '', '', ''];
}


export function LearningQuestionResponse({
  lesson,
  enrollmentId,
  onSubmitted,
}: Props) {
  const questions = useMemo(
    () =>
      pickGeneratedQuestions({
        fil: lesson?.generated_questions_fil,
        en: lesson?.generated_questions_en,
      }),
    [
      lesson?.id,
      lesson?.generated_questions_fil,
      lesson?.generated_questions_en,
    ],
  );

  const [
    answers,
    setAnswers,
  ] = useState<string[]>(
    emptyAnswers()
  );

  const [
    reflection,
    setReflection,
  ] = useState('');

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    validating,
    setValidating,
  ] = useState(false);

  const [
    answerValidations,
    setAnswerValidations,
  ] = useState<Array<AIAnswerValidationResult | null>>(
    emptyAnswers().map(() => null),
  );

  const [
    reflectionValidation,
    setReflectionValidation,
  ] = useState<AIAnswerValidationResult | null>(null);

  const [
    previouslySubmitted,
    setPreviouslySubmitted,
  ] = useState(false);


  useEffect(() => {
    let active = true;

    const loadExisting = async () => {
      if (
        !lesson?.id ||
        !enrollmentId
      ) {
        return;
      }

      const {
        data,
        error,
      } = await supabase
        .from('learning_lesson_responses')
        .select(
          'question_answers,reflection_text,submitted_at'
        )
        .eq(
          'lesson_id',
          lesson.id
        )
        .maybeSingle();

      if (!active || error) {
        return;
      }

      if (data) {
        const saved =
          Array.isArray(
            data.question_answers
          )
            ? data.question_answers.map(
                (x: any) =>
                  String(x ?? '')
              )
            : [];

        if (saved.length === 4) {
          setAnswers(saved);
        }

        setReflection(
          String(
            data.reflection_text ??
            ''
          )
        );

        setPreviouslySubmitted(true);
      }
    };

    void loadExisting();

    return () => {
      active = false;
    };
  }, [
    lesson?.id,
    enrollmentId,
  ]);


  const updateAnswer = (
    index: number,
    value: string
  ) => {
    setAnswers((current) => {
      const next = [
        ...current,
      ];

      while (next.length < 4) {
        next.push('');
      }

      next[index] = value;

      return next;
    });

    setAnswerValidations((current) => {
      const next = [...current];
      next[index] = null;
      return next;
    });
  };


  const validateAllFields = async (
    normalized: string[],
    reflectionText: string,
  ): Promise<boolean> => {
    setValidating(true);

    try {
      const nextAnswerValidations: Array<AIAnswerValidationResult | null> = [
        null,
        null,
        null,
        null,
      ];

      for (let index = 0; index < normalized.length; index += 1) {
        const result = await validateBuklodResponse({
          questionContext: buildGeneratedLessonQuestionContext({
            lessonId: lesson.id,
            trackId: lesson.track_id ?? null,
            enrollmentId: enrollmentId ?? null,
            questionIndex: index + 1,
            questionText: questions[index] ?? '',
            lessonTitle: lesson.title ?? null,
            scriptureReference: lesson.scripture_reference ?? null,
            aiValidationContext: lesson.ai_validation_context,
          }),
          response: normalized[index] ?? '',
        });

        nextAnswerValidations[index] = result;

        if (!isValidationAcceptable(result)) {
          setAnswerValidations(nextAnswerValidations);
          setReflectionValidation(null);
          return false;
        }
      }

      const reflectionResult = await validateBuklodResponse({
        questionContext: buildLessonReflectionContext({
          lessonId: lesson.id,
          trackId: lesson.track_id ?? null,
          enrollmentId: enrollmentId ?? null,
          questionText:
            lesson.reflection_question ??
            'Write your personal reflection.',
          lessonTitle: lesson.title ?? null,
          scriptureReference: lesson.scripture_reference ?? null,
          aiValidationContext: lesson.ai_validation_context,
        }),
        response: reflectionText,
      });

      setAnswerValidations(nextAnswerValidations);
      setReflectionValidation(reflectionResult);

      return isValidationAcceptable(reflectionResult);
    } finally {
      setValidating(false);
    }
  };


  const submit = async () => {
    if (!enrollmentId) {
      return Alert.alert(
        'Learning',
        'Start or enroll in this learning track first.'
      );
    }

    if (questions.length !== 4) {
      return Alert.alert(
        'Learning Questions',
        'The four review questions are not ready yet.'
      );
    }

    const normalized =
      answers.map(
        (value) =>
          value.trim()
      );

    if (
      normalized.length !== 4 ||
      normalized.some(
        (value) =>
          value.length < 10
      )
    ) {
      return Alert.alert(
        'Answer All Questions',
        'Answer all four questions. Each answer must contain at least 10 characters.'
      );
    }

    if (
      reflection.trim().length < 20
    ) {
      return Alert.alert(
        'Personal Reflection',
        'Write a Personal Reflection with at least 20 characters.'
      );
    }

    const validated = await validateAllFields(
      normalized,
      reflection.trim(),
    );

    if (!validated) {
      return Alert.alert(
        'Review your answers',
        'Please improve your answers using the guidance shown, then try again.',
      );
    }

    setBusy(true);

    try {
      const {
        error: responseError,
      } = await (
        supabase as any
      ).rpc(
        'submit_learning_lesson_response_v1',
        {
          p_enrollment_id:
            enrollmentId,

          p_lesson_id:
            lesson.id,

          p_question_answers:
            normalized,

          p_reflection:
            reflection.trim(),
        }
      );

      if (responseError) {
        throw responseError;
      }

      const {
        error: studyError,
      } = await (
        supabase as any
      ).rpc(
        'save_my_formation_lesson_study',
        {
          p_enrollment_id:
            enrollmentId,

          p_lesson_id:
            lesson.id,

          p_reflection:
            reflection.trim(),
        }
      );

      if (studyError) {
        throw studyError;
      }

      setPreviouslySubmitted(true);

      Alert.alert(
        'Study Submitted',
        'Your four answers and Personal Reflection were saved. This learning progress is now ready for Pastor validation.'
      );

      await onSubmitted?.();

    } catch (error: any) {
      
    // BUKLOD_QUICK_CHECK_SUBMIT_VALIDATION_R1
    const { error: formationSubmitError } = await (supabase as any).rpc(
      'submit_my_formation_lesson_for_validation_v1',
      {
        p_enrollment_id: enrollmentId,
        p_lesson_id: lesson.id,
      }
    );

    if (formationSubmitError) {
      Alert.alert(
        'Hindi naisumite para sa pagpapatunay',
        formationSubmitError.message
      );
      return;
    }
Alert.alert(
        'Could Not Submit Study',
        error?.message ??
          'Please try again.'
      );

    } finally {
      setBusy(false);
    }
  };


  if (questions.length !== 4) {
    return (
      <>
        <SectionTitle>
          STUDY & REFLECTION
        </SectionTitle>

        <Card>
          <Text style={shared.muted}>
            The four lesson questions are
            being prepared.
          </Text>
        </Card>
      </>
    );
  }


  return (
    <>
      {!!lesson?.audio_url && (
        <>
          <SectionTitle>
            LESSON AUDIO
          </SectionTitle>

          <Card>
            <LessonAudio
              url={lesson.audio_url}
            />
          </Card>
        </>
      )}

      <SectionTitle>
        QUICK CHECK
      </SectionTitle>

      <Card>
        <Text style={styles.intro}>
          Sagutin ang lahat ng tanong sa sariling salita batay sa aralin. Bawat sagot ay dapat direktang tumugon sa tanong at may maikling paliwanag.
        </Text>

        {questions.map(
          (
            question,
            index
          ) => (
            <View
              key={`${lesson.id}-${index}`}
              style={styles.questionBlock}
            >
              <Text style={styles.questionNo}>
                Question {index + 1} of {questions.length}
              </Text>

              <Text style={styles.question}>
                {question}
              </Text>

              <TextInput
                multiline
                value={
                  answers[index] ??
                  ''
                }
                onChangeText={(
                  value
                ) =>
                  updateAnswer(
                    index,
                    value
                  )
                }
                placeholder="Direktang sagot + maikling paliwanag..."
                placeholderTextColor={
                  colors.muted
                }
                style={styles.answer}
              />

              <BuklodAnswerValidationFeedback
                isValidating={validating}
                lastResult={answerValidations[index]}
                error={null}
              />
            </View>
          )
        )}
      </Card>


      <SectionTitle>
        PAGNINILAY
      </SectionTitle>

      <Card>
        {!!lesson?.reflection_question && (
          <Text style={styles.reflectionPrompt}>
            {lesson.reflection_question}
          </Text>
        )}

        <TextInput
          multiline
          value={reflection}
          onChangeText={(value) => {
            setReflection(value);
            setReflectionValidation(null);
          }}
          placeholder="Type your reflection..."
          placeholderTextColor={
            colors.muted
          }
          style={styles.reflection}
        />

        <BuklodAnswerValidationFeedback
          isValidating={validating}
          lastResult={reflectionValidation}
          error={null}
        />

        <Text style={styles.helper}>
          Minimum 20 characters.
        </Text>
      </Card>


      {previouslySubmitted && (
        <View style={styles.savedBanner}>
          <Text style={styles.savedTitle}>
            ✓ STUDY SAVED
          </Text>

          <Text style={styles.savedText}>
            You may revise and resubmit
            before final approval.
          </Text>
        </View>
      )}


      <Button
        title={
          busy || validating
            ? validating
              ? 'CHECKING...'
              : 'SUBMITTING...'
            : previouslySubmitted
              ? 'UPDATE & RESUBMIT STUDY'
              : 'ISUMITE PARA SA PAGPAPATUNAY'
        }
        onPress={submit}
      />
    </>
  );
}


const styles = StyleSheet.create({
  audioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 62,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#EEF7F0',
    borderWidth: 1,
    borderColor: colors.line,
  },

  audioIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    textAlign: 'center',
    textAlignVertical: 'center',
    backgroundColor: colors.greenDark,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },

  audioTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.greenDark,
  },

  audioHint: {
    marginTop: 3,
    fontSize: 10.5,
    color: colors.muted,
  },

  intro: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    color: colors.text,
  },

  questionBlock: {
    marginTop: 17,
  },

  questionNo: {
    fontSize: 9.5,
    letterSpacing: 0.8,
    fontWeight: '900',
    color: colors.greenDark,
  },

  question: {
    marginTop: 5,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '800',
    color: colors.text,
  },

  answer: {
    minHeight: 90,
    marginTop: 9,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.white,
    textAlignVertical: 'top',
    color: colors.text,
  },

  reflectionPrompt: {
    marginBottom: 10,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '800',
    color: colors.text,
  },

  reflection: {
    minHeight: 120,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.white,
    textAlignVertical: 'top',
    color: colors.text,
  },

  helper: {
    marginTop: 6,
    fontSize: 10,
    color: colors.muted,
  },

  savedBanner: {
    marginVertical: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#EEF7F0',
    borderWidth: 1,
    borderColor: colors.line,
  },

  savedTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.greenDark,
  },

  savedText: {
    marginTop: 4,
    fontSize: 11,
    color: colors.text,
  },
});
