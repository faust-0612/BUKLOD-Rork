import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  Button,
  Card,
  SectionTitle,
  shared,
} from '@/components/UI';

import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';


type Assignment = {
  id: string;
  reading_date: string;
  bible_reference: string;
};


type Row = {
  assignment_id: string;
  reading_date: string;
  bible_reference: string;

  user_id: string;
  full_name: string;

  church_id: string | null;
  church_name: string;

  submission_id: string | null;

  bible_text: string | null;
  bible_photo_path: string | null;

  chapter_questions_fil: unknown;
  chapter_questions_en: unknown;
  question_answers: unknown;
  answer_language: string | null;

  reflection_text: string | null;
  reflection_photo_path: string | null;

  submission_status: string;

  submitted_at: string | null;
  submitted_on_time: boolean;

  has_bible_photo: boolean;
  has_reflection_photo: boolean;

  reviewer_can_act: boolean;
};


const BUCKET =
  'daily-bible-evidence';


function date(
  value?: string | null
) {
  if (!value) return '';

  const d = new Date(value);

  return Number.isNaN(
    d.getTime()
  )
    ? value
    : d.toLocaleString();
}


function label(
  status: string
) {
  const labels: Record<
    string,
    string
  > = {
    pending_admin:
      'AUTOMATIC AI CHECKING',

    approved:
      'APPROVED',

    rejected:
      'RETURNED / REVISION',

    missed:
      'MISSED',

    not_submitted:
      'NOT SUBMITTED',
  };

  return (
    labels[status] ??
    String(
      status || 'UNKNOWN'
    ).toUpperCase()
  );
}


function jsonTextArray(
  value: unknown
): string[] {

  if (Array.isArray(value)) {
    return value.map(
      item =>
        String(
          item ?? ''
        ).trim()
    );
  }

  if (
    typeof value ===
    'string'
  ) {
    try {

      const parsed =
        JSON.parse(value);

      if (
        Array.isArray(parsed)
      ) {
        return parsed.map(
          item =>
            String(
              item ?? ''
            ).trim()
        );
      }

    } catch {
      return [];
    }
  }

  return [];
}


export function BibleReadingMonitor() {

  const [
    assignments,
    setAssignments,
  ] =
    useState<Assignment[]>([]);


  const [
    assignmentId,
    setAssignmentId,
  ] =
    useState('');


  const [
    rows,
    setRows,
  ] =
    useState<Row[]>([]);


  const [
    search,
    setSearch,
  ] =
    useState('');


  const [
    loadingAssignments,
    setLoadingAssignments,
  ] =
    useState(true);


  const [
    loadingRows,
    setLoadingRows,
  ] =
    useState(false);


  const loadAssignments =
    useCallback(
      async () => {

        setLoadingAssignments(
          true
        );

        const {
          data,
          error,
        } =
          await (
            supabase as any
          ).rpc(
            'reviewer_list_daily_bible_assignments_v2'
          );


        if (error) {

          Alert.alert(
            'Bible Reading AI Results',
            error.message
          );

          setAssignments([]);

          setLoadingAssignments(
            false
          );

          return;
        }


        const next =
          (
            data ?? []
          ) as Assignment[];


        setAssignments(
          next
        );


        setAssignmentId(
          current =>
            current &&
            next.some(
              item =>
                item.id ===
                current
            )
              ? current
              : (
                  next[0]?.id ??
                  ''
                )
        );


        setLoadingAssignments(
          false
        );

      },
      []
    );


  const loadRows =
    useCallback(
      async () => {

        if (
          !assignmentId
        ) {
          setRows([]);
          return;
        }


        setLoadingRows(
          true
        );


        const {
          data,
          error,
        } =
          await (
            supabase as any
          ).rpc(
            'reviewer_get_daily_bible_monitor_v3',
            {
              p_assignment_id:
                assignmentId,
            }
          );


        if (error) {

          Alert.alert(
            'Bible Reading Validation',
            error.message
          );

          setRows([]);

        } else {

          setRows(
            (
              data ?? []
            ) as Row[]
          );
        }


        setLoadingRows(
          false
        );

      },
      [
        assignmentId,
      ]
    );


  useEffect(
    () => {
      void loadAssignments();
    },
    [
      loadAssignments,
    ]
  );


  useEffect(
    () => {
      void loadRows();
    },
    [
      loadRows,
    ]
  );


  const query =
    search
      .trim()
      .toLowerCase();


  const visible =
    useMemo(
      () => {

        if (!query) {
          return rows;
        }

        return rows.filter(
          row =>
            [
              row.full_name,
              row.church_name,
              row.submission_status,
              row.bible_reference,
            ]
              .join(' ')
              .toLowerCase()
              .includes(
                query
              )
        );

      },
      [
        rows,
        query,
      ]
    );


  const openPhoto =
    async (
      photoPath: string | null,
      title: string
    ) => {

      if (!photoPath) {

        Alert.alert(
          title,
          'No photo was submitted.'
        );

        return;
      }


      const {
        data,
        error,
      } =
        await supabase.storage
          .from(BUCKET)
          .createSignedUrl(
            photoPath,
            600
          );


      if (
        error ||
        !data?.signedUrl
      ) {

        Alert.alert(
          title,
          error?.message ??
            'Could not open evidence photo.'
        );

        return;
      }


      const okay =
        await Linking.canOpenURL(
          data.signedUrl
        );


      if (!okay) {

        Alert.alert(
          title,
          'This device could not open the evidence photo.'
        );

        return;
      }


      await Linking.openURL(
        data.signedUrl
      );

    };


  return (
    <ScrollView
      style={
        shared.screen
      }

      contentContainerStyle={
        s.content
      }

      refreshControl={
        <RefreshControl
          refreshing={
            loadingRows
          }

          onRefresh={
            async () => {
              await loadAssignments();
              await loadRows();
            }
          }
        />
      }
    >

      <Text
        style={
          s.eyebrow
        }
      >
        AUTOMATIC AI MONITOR
      </Text>


      <Text
        style={
          shared.h1
        }
      >
        Bible Reading Validation
      </Text>


      <Text
        style={
          shared.muted
        }
      >
        This is a read-only dashboard. BUKLOD AI checks all four Scripture answers and Personal Reflection, then awards qualified points automatically.
      </Text>


      <View
        style={
          s.rules
        }
      >

        <Text
          style={
            s.rulesTitle
          }
        >
          VALIDATION RULES
        </Text>


        <Text
          style={
            s.ruleLine
          }
        >
          • All 4 generated Scripture questions must be answered.
        </Text>


        <Text
          style={
            s.ruleLine
          }
        >
          • Each question answer must contain a meaningful response.
        </Text>


        <Text
          style={
            s.ruleLine
          }
        >
          • Personal Reflection is separate from the four answers.
        </Text>


        <Text
          style={
            s.ruleLine
          }
        >
          • No manual approval is needed. AI-validated submissions receive points and eligible quality bonuses automatically.
        </Text>

      </View>


      <SectionTitle>
        SELECT READING DATE
      </SectionTitle>


      {loadingAssignments
        ? (
          <ActivityIndicator
            color={
              colors.green
            }
          />
        )
        : (
          <ScrollView
            horizontal

            showsHorizontalScrollIndicator={
              false
            }

            contentContainerStyle={
              s.strip
            }
          >

            {assignments.map(
              item => {

                const active =
                  item.id ===
                  assignmentId;

                return (
                  <Pressable
                    key={
                      item.id
                    }

                    onPress={
                      () =>
                        setAssignmentId(
                          item.id
                        )
                    }

                    style={[
                      s.chip,
                      active &&
                        s.chipOn,
                    ]}
                  >

                    <Text
                      style={[
                        s.chipDate,
                        active &&
                          s.chipTextOn,
                      ]}
                    >
                      {item.reading_date}
                    </Text>


                    <Text
                      numberOfLines={
                        1
                      }

                      style={[
                        s.chipRef,
                        active &&
                          s.chipTextOn,
                      ]}
                    >
                      {item.bible_reference}
                    </Text>

                  </Pressable>
                );
              }
            )}

          </ScrollView>
        )}


      <TextInput
        style={
          s.search
        }

        placeholder=
          "Search member, Local, reference, or status..."

        value={
          search
        }

        onChangeText={
          setSearch
        }
      />


      <SectionTitle>
        MEMBER VALIDATION
      </SectionTitle>


      {loadingRows && (
        <ActivityIndicator
          color={
            colors.green
          }
        />
      )}


      {!loadingRows &&
       visible.length === 0 && (

        <Card>
          <Text
            style={
              shared.muted
            }
          >
            No member records for the selected reading.
          </Text>
        </Card>
      )}


      {visible.map(
        row => {

          const questionsFil =
            jsonTextArray(
              row.chapter_questions_fil
            );

          const questionsEn =
            jsonTextArray(
              row.chapter_questions_en
            );


          const questions =
            (
              row.answer_language ===
                'en'
                ? questionsEn
                : questionsFil
            ).length
              ? (
                  row.answer_language ===
                    'en'
                    ? questionsEn
                    : questionsFil
                )
              : (
                  questionsFil.length
                    ? questionsFil
                    : questionsEn
                );


          const answers =
            jsonTextArray(
              row.question_answers
            );


          const questionsOkay =
            questions.length === 4 &&
            answers.length === 4 &&
            answers.every(
              answer =>
                answer
                  .trim()
                  .length >= 10
            );


          const bibleCharacters =
            String(
              row.bible_text ??
              ''
            )
              .trim()
              .length;


          const reflectionCharacters =
            String(
              row.reflection_text ??
              ''
            )
              .trim()
              .length;



          const reflectionOkay =
            reflectionCharacters >= 20 ||
            row.has_reflection_photo;



          return (
            <Card
              key={
                `${row.assignment_id}:${row.user_id}`
              }
            >

              <View
                style={
                  s.header
                }
              >

                <View
                  style={{
                    flex: 1,
                  }}
                >

                  <Text
                    style={
                      s.name
                    }
                  >
                    {row.full_name}
                  </Text>


                  <Text
                    style={
                      s.local
                    }
                  >
                    Local: {row.church_name || 'No Local'}
                  </Text>


                  <Text
                    style={
                      s.reference
                    }
                  >
                    {row.bible_reference}
                  </Text>

                </View>


                <View
                  style={
                    s.badge
                  }
                >

                  <Text
                    style={
                      s.badgeText
                    }
                  >
                    {label(
                      row.submission_status
                    )}
                  </Text>

                </View>

              </View>


              <View
                style={
                  s.grid
                }
              >

                <View
                  style={[
                    s.check,
                    questionsOkay
                      ? s.pass
                      : s.fail,
                  ]}
                >

                  <Text
                    style={
                      s.checkLabel
                    }
                  >
                    QUESTIONS
                  </Text>

                  <Text
                    style={
                      s.checkValue
                    }
                  >
                    {questionsOkay
                      ? '4 / 4 COMPLETE'
                      : `${answers.filter(a=>a.trim().length>=10).length} / 4`
                    }
                  </Text>

                </View>


                <View
                  style={[
                    s.check,
                    reflectionOkay
                      ? s.pass
                      : s.fail,
                  ]}
                >

                  <Text
                    style={
                      s.checkLabel
                    }
                  >
                    REFLECTION
                  </Text>

                  <Text
                    style={
                      s.checkValue
                    }
                  >
                    {reflectionOkay
                      ? 'COMPLETE'
                      : 'MISSING'
                    }
                  </Text>

                </View>


                <View
                  style={
                    s.check
                  }
                >

                  <Text
                    style={
                      s.checkLabel
                    }
                  >
                    TIMING
                  </Text>

                  <Text
                    style={
                      s.checkValue
                    }
                  >
                    {row.submission_id
                      ? (
                          row.submitted_on_time
                            ? 'ON TIME'
                            : 'LATE'
                        )
                      : 'N/A'
                    }
                  </Text>

                </View>

              </View>


              {!!row.submitted_at && (

                <Text
                  style={
                    s.meta
                  }
                >
                  Submitted: {date(row.submitted_at)}
                </Text>

              )}


              {!!row.submission_id && (

                <View
                  style={
                    s.qaBox
                  }
                >

                  <Text
                    style={
                      s.eTitle
                    }
                  >
                    SCRIPTURE QUESTIONS & ANSWERS
                  </Text>


                  <Text
                    style={
                      s.eMeta
                    }
                  >
                    Response Language: {row.answer_language === 'en' ? 'English' : 'Filipino'}
                  </Text>


                  {Array.from(
                    {
                      length: 4,
                    }
                  ).map(
                    (
                      _,
                      index
                    ) => (

                      <View
                        key={
                          index
                        }

                        style={
                          s.qaItem
                        }
                      >

                        <Text
                          style={
                            s.question
                          }
                        >
                          {index + 1}. {questions[index] || 'Question unavailable'}
                        </Text>


                        <Text
                          style={
                            s.answer
                          }
                        >
                          {answers[index] || 'No answer submitted.'}
                        </Text>

                      </View>

                    )
                  )}

                </View>

              )}


              <View
                style={
                  s.evidence
                }
              >

                <Text
                  style={
                    s.eTitle
                  }
                >
                  PERSONAL REFLECTION
                </Text>


                <Text
                  style={
                    s.eMeta
                  }
                >
                  Written characters: {reflectionCharacters}
                  {' | '}
                  Photo: {row.has_reflection_photo ? 'YES' : 'NO'}
                </Text>


                {!!row.reflection_text && (

                  <Text
                    style={
                      s.eText
                    }
                  >
                    {row.reflection_text}
                  </Text>

                )}


                {!!row.reflection_photo_path && (

                  <Button
                    title=
                      "VIEW REFLECTION PHOTO"

                    outline

                    onPress={
                      () =>
                        openPhoto(
                          row.reflection_photo_path,
                          'Reflection Photo'
                        )
                    }
                  />

                )}

              </View>


              <View
                style={
                  s.evidence
                }
              >

                <Text
                  style={
                    s.eTitle
                  }
                >
                  BIBLE PASSAGE EVIDENCE
                </Text>


                <Text
                  style={
                    s.eMeta
                  }
                >
                  Typed characters: {bibleCharacters}
                  {' | '}
                  Photo: {row.has_bible_photo ? 'YES' : 'NO'}
                </Text>


                {!!row.bible_text && (

                  <Text
                    style={
                      s.eText
                    }
                  >
                    {row.bible_text}
                  </Text>

                )}


                {!!row.bible_photo_path && (

                  <Button
                    title=
                      "VIEW BIBLE PHOTO"

                    outline

                    onPress={
                      () =>
                        openPhoto(
                          row.bible_photo_path,
                          'Bible Photo'
                        )
                    }
                  />

                )}

              </View>


              {!!row.submission_id &&
               ['ai_checking','pending_admin'].includes(row.submission_status) && (
                <Text style={s.blocked}>
                  BUKLOD AI is checking this submission automatically.
                  No Pastor, Mentor, or Admin approval is needed.
                </Text>
              )}

            </Card>
          );
        }
      )}

    </ScrollView>
  );
}


export default BibleReadingMonitor;


const s =
  StyleSheet.create({

    content: {
      padding: 18,
      paddingBottom: 40,
    },

    eyebrow: {
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.8,
      color: colors.greenDark,
      marginBottom: 4,
    },

    rules: {
      marginTop: 12,
      padding: 13,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: '#F2F6F3',
    },

    rulesTitle: {
      fontSize: 10,
      fontWeight: '900',
      color: colors.greenDark,
      marginBottom: 5,
    },

    ruleLine: {
      fontSize: 12,
      lineHeight: 19,
      color: colors.text,
      marginTop: 3,
    },

    strip: {
      gap: 8,
      paddingBottom: 4,
    },

    chip: {
      width: 150,
      padding: 10,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 12,
      backgroundColor: colors.white,
    },

    chipOn: {
      borderColor: colors.green,
      backgroundColor: colors.greenSoft,
    },

    chipDate: {
      fontSize: 10,
      fontWeight: '900',
      color: colors.muted,
    },

    chipRef: {
      marginTop: 4,
      fontSize: 12,
      fontWeight: '900',
      color: colors.text,
    },

    chipTextOn: {
      color: colors.greenDark,
    },

    search: {
      marginTop: 14,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 12,
      padding: 12,
      backgroundColor: colors.white,
    },

    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },

    name: {
      fontSize: 16,
      fontWeight: '900',
      color: colors.text,
    },

    local: {
      marginTop: 3,
      fontSize: 11,
      fontWeight: '900',
      color: colors.greenDark,
    },

    reference: {
      marginTop: 3,
      fontSize: 11,
      fontWeight: '800',
      color: colors.muted,
    },

    badge: {
      maxWidth: 125,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: '#F2F2F2',
    },

    badgeText: {
      fontSize: 9,
      fontWeight: '900',
      textAlign: 'center',
      color: colors.text,
    },

    grid: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 11,
    },

    check: {
      flex: 1,
      minHeight: 58,
      padding: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: '#F7F7F7',
    },

    pass: {
      backgroundColor: '#EEF8F1',
      borderColor: '#B8DCC2',
    },

    fail: {
      backgroundColor: '#FFF1F1',
      borderColor: '#EDC1C1',
    },

    checkLabel: {
      fontSize: 8,
      fontWeight: '900',
      color: colors.muted,
    },

    checkValue: {
      marginTop: 5,
      fontSize: 10,
      fontWeight: '900',
      color: colors.text,
    },

    meta: {
      marginTop: 7,
      fontSize: 10,
      color: colors.muted,
    },

    qaBox: {
      marginTop: 12,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: '#F7FAF8',
    },

    qaItem: {
      marginTop: 11,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },

    question: {
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '900',
      color: colors.text,
    },

    answer: {
      marginTop: 6,
      fontSize: 12,
      lineHeight: 19,
      color: colors.text,
    },

    evidence: {
      marginTop: 10,
      padding: 11,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.white,
    },

    eTitle: {
      fontSize: 10,
      fontWeight: '900',
      color: colors.greenDark,
    },

    eMeta: {
      marginTop: 4,
      fontSize: 10,
      color: colors.muted,
    },

    eText: {
      marginTop: 7,
      fontSize: 12,
      lineHeight: 18,
      color: colors.text,
    },

    note: {
      marginTop: 10,
      marginBottom: 8,
      minHeight: 64,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 12,
      padding: 11,
      textAlignVertical: 'top',
      backgroundColor: colors.white,
    },

    blocked: {
      marginTop: 10,
      fontSize: 11,
      lineHeight: 17,
      color: '#8A5A12',
    },

  });
