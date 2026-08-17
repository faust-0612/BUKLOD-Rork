import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
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
  supabase,
} from '@/lib/supabase';

import {
  colors,
} from '@/lib/theme';


type Row = {
  release_id: string;
  stage_code: number;
  release_number: number;

  title_fil: string;
  title_en: string | null;
  scripture_reference: string | null;

  content_fil: string;
  content_en: string | null;

  generated_questions_fil: any;
  generated_questions_en: any;

  audio_url: string | null;

  reward_amount: number;
  release_date: string;
  release_status: string;

  submission_id: string | null;
  submission_status: string | null;
  question_answers: any;
  reflection_text: string | null;
  submitted_at: string | null;
};


function fourQuestions(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const q = value
    .map(
      (x) =>
        String(x ?? '').trim()
    )
    .filter(Boolean);

  return q.length === 4
    ? q
    : [];
}


function MentoringAudio({
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
            'Mentoring Audio',
            'Could not play the audio.'
          );
        }
      }}
      style={styles.audio}
    >
      <Text style={styles.audioIcon}>
        ▶
      </Text>

      <View style={{ flex: 1 }}>
        <Text style={styles.audioTitle}>
          PLAY AUDIO LESSON
        </Text>

        <Text style={styles.audioSub}>
          Listen to this mentoring lesson.
        </Text>
      </View>
    </Pressable>
  );
}


export default function MentoringScreen() {
  const [
    rows,
    setRows,
  ] = useState<Row[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    busyId,
    setBusyId,
  ] = useState<string | null>(
    null
  );

  const [
    answers,
    setAnswers,
  ] = useState<
    Record<string,string[]>
  >({});

  const [
    reflections,
    setReflections,
  ] = useState<
    Record<string,string>
  >({});


  const load = useCallback(
    async () => {
      setLoading(true);

      const {
        data,
        error,
      } = await (
        supabase as any
      ).rpc(
        'get_my_mentoring_releases_v2'
      );

      if (error) {
        Alert.alert(
          'BUKLOD Mentoring',
          error.message
        );

        setRows([]);
        setLoading(false);
        return;
      }

      const next =
        (data ?? []) as Row[];

      setRows(next);

      const answerMap:
        Record<string,string[]> = {};

      const reflectionMap:
        Record<string,string> = {};

      next.forEach((row) => {
        const saved =
          Array.isArray(
            row.question_answers
          )
            ? row.question_answers.map(
                (x: any) =>
                  String(x ?? '')
              )
            : [];

        answerMap[row.release_id] =
          saved.length === 4
            ? saved
            : ['', '', '', ''];

        reflectionMap[row.release_id] =
          String(
            row.reflection_text ??
            ''
          );
      });

      setAnswers(answerMap);
      setReflections(reflectionMap);

      setLoading(false);
    },
    []
  );


  useEffect(() => {
    void load();
  }, [load]);


  const updateAnswer = (
    releaseId: string,
    index: number,
    value: string
  ) => {
    setAnswers((current) => {
      const next = [
        ...(
          current[releaseId] ??
          ['', '', '', '']
        ),
      ];

      while (next.length < 4) {
        next.push('');
      }

      next[index] = value;

      return {
        ...current,
        [releaseId]: next,
      };
    });
  };


  const submit = async (
    row: Row
  ) => {
    const filQuestions =
      fourQuestions(
        row.generated_questions_fil
      );

    const questions =
      filQuestions.length === 4
        ? filQuestions
        : fourQuestions(
            row.generated_questions_en
          );

    if (questions.length !== 4) {
      return Alert.alert(
        'Mentoring',
        'The four mentoring questions are not ready yet.'
      );
    }

    const finalAnswers =
      (
        answers[row.release_id] ??
        []
      ).map(
        (x) =>
          x.trim()
      );

    if (
      finalAnswers.length !== 4 ||
      finalAnswers.some(
        (x) =>
          x.length < 10
      )
    ) {
      return Alert.alert(
        'Answer All Questions',
        'Answer all four questions. Each answer must contain at least 10 characters.'
      );
    }

    const reflection =
      (
        reflections[
          row.release_id
        ] ??
        ''
      ).trim();

    if (reflection.length < 20) {
      return Alert.alert(
        'Personal Reflection',
        'Write a Personal Reflection with at least 20 characters.'
      );
    }

    setBusyId(
      row.release_id
    );

    const {
      error,
    } = await (
      supabase as any
    ).rpc(
      'submit_mentoring_release_response_v2',
      {
        p_release_id:
          row.release_id,

        p_question_answers:
          finalAnswers,

        p_reflection:
          reflection,

        p_language:
          'fil',
      }
    );

    setBusyId(null);

    if (error) {
      return Alert.alert(
        'Could Not Submit',
        error.message
      );
    }

    Alert.alert(
      'Mentoring Submitted',
      'Your answers and Personal Reflection were submitted for approval.'
    );

    await load();
  };


  return (
    <ScrollView
      style={shared.screen}
      contentContainerStyle={
        styles.content
      }
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={load}
        />
      }
    >
      <Text style={styles.eyebrow}>
        BUKLOD 106 • 107
      </Text>

      <Text style={shared.h1}>
        Mentoring
      </Text>

      <Text style={shared.muted}>
        Periodic mentoring lessons for
        Kamanggagawa and Pang-Misyong
        Gawain.
      </Text>


      <View style={styles.flow}>
        <Text style={styles.flowTitle}>
          LEARNING FLOW
        </Text>

        <Text style={styles.flowText}>
          Read / Listen → Answer 4 Questions
          → Personal Reflection → Submit
          → Approval
        </Text>
      </View>


      {loading && (
        <ActivityIndicator
          color={colors.green}
          style={{ marginTop: 24 }}
        />
      )}


      {!loading &&
        rows.length === 0 && (
          <Card>
            <Text style={shared.muted}>
              No mentoring lesson is
              currently assigned to your
              account.
            </Text>
          </Card>
        )}


      {rows.map((row) => {
        const fil =
          fourQuestions(
            row.generated_questions_fil
          );

        const questions =
          fil.length === 4
            ? fil
            : fourQuestions(
                row.generated_questions_en
              );

        const status =
          row.submission_status;

        const locked =
          status === 'approved' ||
          status === 'pending_admin';

        return (
          <View
            key={row.release_id}
          >
            <SectionTitle>
              {row.stage_code === 106
                ? 'BUKLOD 106 • KAMANGGAGAWA'
                : 'BUKLOD 107 • PANG-MISYONG GAWAIN'}
            </SectionTitle>

            <Card>
              <View style={styles.topRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lessonNo}>
                    RELEASE {row.release_number}
                  </Text>

                  <Text style={styles.title}>
                    {row.title_fil}
                  </Text>
                </View>

                <View style={styles.reward}>
                  <Text style={styles.rewardText}>
                    ₱{Number(
                      row.reward_amount ??
                      0
                    ).toFixed(0)}
                  </Text>
                </View>
              </View>

              {!!row.scripture_reference && (
                <Text style={styles.scripture}>
                  {row.scripture_reference}
                </Text>
              )}

              <Text style={styles.meta}>
                Released: {row.release_date}
              </Text>


              {!!row.audio_url && (
                <MentoringAudio
                  url={row.audio_url}
                />
              )}


              <View style={styles.lessonContent}>
                <Text style={styles.body}>
                  {row.content_fil}
                </Text>
              </View>


              {status && (
                <View
                  style={[
                    styles.status,
                    status === 'approved'
                      ? styles.approved
                      : status ===
                          'pending_admin'
                        ? styles.pending
                        : styles.rejected,
                  ]}
                >
                  <Text style={styles.statusTitle}>
                    {status === 'approved'
                      ? '✓ APPROVED'
                      : status ===
                          'pending_admin'
                        ? '⏳ WAITING FOR APPROVAL'
                        : '↻ RETURNED FOR REVISION'}
                  </Text>
                </View>
              )}


              {questions.length === 4 && (
                <>
                  <Text style={styles.qSection}>
                    FOUR REVIEW QUESTIONS
                  </Text>

                  {questions.map(
                    (
                      question,
                      index
                    ) => (
                      <View
                        key={index}
                        style={styles.qBlock}
                      >
                        <Text style={styles.qNo}>
                          QUESTION {index + 1}
                        </Text>

                        <Text style={styles.qText}>
                          {question}
                        </Text>

                        <TextInput
                          multiline
                          editable={!locked}
                          value={
                            answers[
                              row.release_id
                            ]?.[index] ??
                            ''
                          }
                          onChangeText={(
                            value
                          ) =>
                            updateAnswer(
                              row.release_id,
                              index,
                              value
                            )
                          }
                          style={[
                            styles.answer,
                            locked &&
                              styles.locked,
                          ]}
                          placeholder="Write your answer..."
                          placeholderTextColor={
                            colors.muted
                          }
                        />
                      </View>
                    )
                  )}


                  <Text style={styles.qSection}>
                    PERSONAL REFLECTION
                  </Text>

                  <TextInput
                    multiline
                    editable={!locked}
                    value={
                      reflections[
                        row.release_id
                      ] ??
                      ''
                    }
                    onChangeText={(
                      value
                    ) =>
                      setReflections(
                        (current) => ({
                          ...current,
                          [row.release_id]:
                            value,
                        })
                      )
                    }
                    style={[
                      styles.reflection,
                      locked &&
                        styles.locked,
                    ]}
                    placeholder="What did God teach you, and how will you apply it?"
                    placeholderTextColor={
                      colors.muted
                    }
                  />


                  {!locked && (
                    <View style={{ marginTop: 12 }}>
                      <Button
                        title={
                          busyId ===
                          row.release_id
                            ? 'SUBMITTING...'
                            : status ===
                                'rejected'
                              ? 'REVISE & RESUBMIT'
                              : 'SUBMIT MENTORING'
                        }
                        onPress={() =>
                          submit(row)
                        }
                      />
                    </View>
                  )}
                </>
              )}
            </Card>
          </View>
        );
      })}
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  content: {
    padding: 18,
    paddingBottom: 60,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    color: colors.greenDark,
    marginBottom: 5,
  },

  flow: {
    marginTop: 14,
    marginBottom: 8,
    padding: 12,
    borderRadius: 13,
    backgroundColor: '#EEF7F0',
    borderWidth: 1,
    borderColor: colors.line,
  },

  flowTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.greenDark,
  },

  flowText: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 17,
    color: colors.text,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },

  lessonNo: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: colors.greenDark,
  },

  title: {
    marginTop: 4,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
    color: colors.text,
  },

  reward: {
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 16,
    backgroundColor: '#EEF7F0',
  },

  rewardText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.greenDark,
  },

  scripture: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '900',
    color: colors.greenDark,
  },

  meta: {
    marginTop: 4,
    fontSize: 9.5,
    color: colors.muted,
  },

  audio: {
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
    borderRadius: 13,
    backgroundColor: '#EEF7F0',
  },

  audioIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: '#FFFFFF',
    backgroundColor: colors.greenDark,
    fontWeight: '900',
  },

  audioTitle: {
    fontSize: 10.5,
    fontWeight: '900',
    color: colors.greenDark,
  },

  audioSub: {
    marginTop: 3,
    fontSize: 9.5,
    color: colors.muted,
  },

  lessonContent: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },

  body: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.text,
  },

  status: {
    marginTop: 14,
    padding: 10,
    borderRadius: 11,
  },

  approved: {
    backgroundColor: '#E9F7EC',
  },

  pending: {
    backgroundColor: '#FFF7E5',
  },

  rejected: {
    backgroundColor: '#FCECEC',
  },

  statusTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.text,
  },

  qSection: {
    marginTop: 20,
    fontSize: 11,
    fontWeight: '900',
    color: colors.greenDark,
  },

  qBlock: {
    marginTop: 14,
  },

  qNo: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.greenDark,
  },

  qText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '800',
    color: colors.text,
  },

  answer: {
    minHeight: 85,
    marginTop: 8,
    padding: 11,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    backgroundColor: colors.white,
    textAlignVertical: 'top',
    color: colors.text,
  },

  reflection: {
    minHeight: 110,
    marginTop: 8,
    padding: 11,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    backgroundColor: colors.white,
    textAlignVertical: 'top',
    color: colors.text,
  },

  locked: {
    opacity: 0.72,
    backgroundColor: '#F4F4F4',
  },
});