/* PATCH_185B_EDITABLE_LESSON_EDITOR */
import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  useLocalSearchParams,
} from 'expo-router';

import {
  AdminGate,
} from '@/components/AdminGate';
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

type LessonForm = {
  title: string;
  scripture: string;
  lessonType: string;
  content: string;
  reflection: string;
  assignment: string;
};

const EMPTY_FORM: LessonForm = {
  title: '',
  scripture: '',
  lessonType: 'reading',
  content: '',
  reflection: '',
  assignment: '',
};

function lessonToForm(
  lesson: any,
): LessonForm {
  return {
    title: String(
      lesson?.title ?? '',
    ),
    scripture: String(
      lesson?.scripture_reference ?? '',
    ),
    lessonType: String(
      lesson?.lesson_type ?? 'reading',
    ),
    content: String(
      lesson?.content ?? '',
    ),
    reflection: String(
      lesson?.reflection_question ?? '',
    ),
    assignment: String(
      lesson?.assignment_prompt ?? '',
    ),
  };
}

export default function TrackEditor() {
  const params =
    useLocalSearchParams<{
      id?: string | string[];
    }>();

  const trackId =
    Array.isArray(params.id)
      ? params.id[0]
      : params.id;

  const [
    track,
    setTrack,
  ] =
    useState<any>(null);

  const [
    lessons,
    setLessons,
  ] =
    useState<any[]>([]);

  const [
    form,
    setForm,
  ] =
    useState<LessonForm>(
      EMPTY_FORM,
    );

  const [
    editingId,
    setEditingId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const load =
    useCallback(
      async () => {
        if (!trackId) {
          setTrack(null);
          setLessons([]);
          setLoading(false);
          return;
        }

        setLoading(true);

        const [
          trackResult,
          lessonResult,
        ] =
          await Promise.all([
            supabase
              .from('learning_tracks')
              .select('*')
              .eq('id', trackId)
              .single(),

            supabase
              .from('learning_lessons')
              .select('*')
              .eq(
                'track_id',
                trackId,
              )
              .order(
                'lesson_number',
              ),
          ]);

        if (
          trackResult.error
        ) {
          Alert.alert(
            'Learning Track',
            trackResult.error.message,
          );
        }

        if (
          lessonResult.error
        ) {
          Alert.alert(
            'Lessons',
            lessonResult.error.message,
          );
        }

        setTrack(
          trackResult.data ?? null,
        );

        setLessons(
          lessonResult.data ?? [],
        );

        setLoading(false);
      },
      [trackId],
    );

  useEffect(
    () => {
      void load();
    },
    [load],
  );

  const updateForm =
    (
      patch:
        Partial<LessonForm>,
    ) => {
      setForm(
        current => ({
          ...current,
          ...patch,
        }),
      );
    };

  const resetEditor =
    () => {
      setEditingId(null);
      setForm(EMPTY_FORM);
    };

  const validateForm =
    () => {
      if (
        !form.title.trim() ||
        !form.content.trim()
      ) {
        Alert.alert(
          'Lesson',
          'Title and content are required.',
        );

        return false;
      }

      return true;
    };

  const addLesson =
    async () => {
      if (
        !trackId ||
        !validateForm()
      ) {
        return;
      }

      const next =
        (
          lessons.at(-1)
            ?.lesson_number ??
          0
        ) + 1;

      setBusy(true);

      const {
        error,
      } =
        await supabase
          .from(
            'learning_lessons',
          )
          .insert({
            track_id:
              trackId,
            lesson_number:
              next,
            title:
              form.title.trim(),
            lesson_type:
              form.lessonType,
            scripture_reference:
              form.scripture.trim() ||
              null,
            content:
              form.content.trim(),
            reflection_question:
              form.reflection.trim() ||
              null,
            assignment_prompt:
              form.assignment.trim() ||
              null,
          });

      setBusy(false);

      if (error) {
        Alert.alert(
          'Could not add lesson',
          error.message,
        );

        return;
      }

      resetEditor();
      await load();
    };

  const beginEdit =
    (lesson: any) => {
      setEditingId(
        String(lesson.id),
      );

      setForm(
        lessonToForm(lesson),
      );
    };

  const saveEdit =
    async () => {
      if (
        !trackId ||
        !editingId ||
        !validateForm()
      ) {
        return;
      }

      setBusy(true);

      const {
        error,
      } =
        await supabase
          .from(
            'learning_lessons',
          )
          .update({
            title:
              form.title.trim(),
            lesson_type:
              form.lessonType,
            scripture_reference:
              form.scripture.trim() ||
              null,
            content:
              form.content.trim(),
            reflection_question:
              form.reflection.trim() ||
              null,
            assignment_prompt:
              form.assignment.trim() ||
              null,
          })
          .eq(
            'id',
            editingId,
          )
          .eq(
            'track_id',
            trackId,
          );

      setBusy(false);

      if (error) {
        Alert.alert(
          'Could not update lesson',
          error.message,
        );

        return;
      }

      resetEditor();
      await load();

      Alert.alert(
        'Lesson updated',
        'The lesson changes were saved.',
      );
    };

  const publish =
    async (
      value: boolean,
    ) => {
      if (!trackId) {
        return;
      }

      setBusy(true);

      const {
        error,
      } =
        await supabase
          .from(
            'learning_tracks',
          )
          .update({
            status:
              value
                ? 'published'
                : 'draft',
          })
          .eq(
            'id',
            trackId,
          );

      setBusy(false);

      if (error) {
        Alert.alert(
          'Track',
          error.message,
        );

        return;
      }

      await load();
    };

  const saveCurrent =
    () => {
      /*
       * PATCH_185B_R2_BUSY_GUARD
       * The shared BUKLOD Button does not expose a disabled prop,
       * so prevent duplicate saves in the handler instead.
       */
      if (busy) {
        return;
      }

      if (editingId) {
        void saveEdit();
        return;
      }

      void addLesson();
    };

  return (
    <AdminGate>
      <ScrollView
        style={
          shared.screen
        }
        contentContainerStyle={[
          shared.content,
          {
            paddingBottom:
              56,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          style={
            shared.h1
          }
        >
          Learning Track
        </Text>

        {loading ? (
          <Card>
            <Text
              style={
                shared.muted
              }
            >
              Loading track...
            </Text>
          </Card>
        ) : !track ? (
          <Card>
            <Text
              style={
                shared.muted
              }
            >
              Track not found.
            </Text>
          </Card>
        ) : (
          <>
            <Card>
              <Text
                style={
                  shared.h2
                }
              >
                {track.title}
              </Text>

              {!!track.description && (
                <Text
                  style={[
                    shared.muted,
                    {
                      marginTop:
                        6,
                    },
                  ]}
                >
                  {
                    track.description
                  }
                </Text>
              )}

              <View
                style={
                  styles.statusRow
                }
              >
                <Text
                  style={
                    styles.status
                  }
                >
                  {String(
                    track.status ??
                    'draft',
                  ).toUpperCase()}
                </Text>

                <Pressable
                  onPress={() =>
                    void publish(
                      track.status !==
                        'published',
                    )
                  }
                  disabled={busy}
                  style={
                    styles.publishButton
                  }
                >
                  <Text
                    style={
                      styles.publishText
                    }
                  >
                    {
                      track.status ===
                      'published'
                        ? 'MOVE TO DRAFT'
                        : 'PUBLISH TRACK'
                    }
                  </Text>
                </Pressable>
              </View>
            </Card>

            <SectionTitle>
              {
                editingId
                  ? 'EDIT LESSON'
                  : 'ADD LESSON'
              }
            </SectionTitle>

            <Card>
              {editingId && (
                <View
                  style={
                    styles.editBanner
                  }
                >
                  <Text
                    style={
                      styles.editBannerTitle
                    }
                  >
                    Editing existing lesson
                  </Text>

                  <Text
                    style={
                      styles.editBannerText
                    }
                  >
                    Save changes below or cancel to return to Add Lesson.
                  </Text>
                </View>
              )}

              <TextInput
                style={
                  styles.input
                }
                placeholder="Lesson title"
                value={
                  form.title
                }
                onChangeText={
                  value =>
                    updateForm({
                      title:
                        value,
                    })
                }
              />

              <TextInput
                style={
                  styles.input
                }
                placeholder="Scripture reference"
                value={
                  form.scripture
                }
                onChangeText={
                  value =>
                    updateForm({
                      scripture:
                        value,
                    })
                }
              />

              <Text
                style={
                  styles.fieldLabel
                }
              >
                Lesson type
              </Text>

              <View
                style={
                  styles.wrap
                }
              >
                {[
                  'reading',
                  'reflection',
                  'quiz',
                  'assignment',
                ].map(
                  type => (
                    <Pressable
                      key={
                        type
                      }
                      onPress={() =>
                        updateForm({
                          lessonType:
                            type,
                        })
                      }
                      style={[
                        styles.chip,
                        form.lessonType ===
                          type &&
                          styles.chipOn,
                      ]}
                    >
                      <Text
                        style={
                          styles.chipText
                        }
                      >
                        {type}
                      </Text>
                    </Pressable>
                  ),
                )}
              </View>

              <TextInput
                multiline
                style={
                  styles.area
                }
                placeholder="Lesson content"
                value={
                  form.content
                }
                onChangeText={
                  value =>
                    updateForm({
                      content:
                        value,
                    })
                }
              />

              <TextInput
                multiline
                style={
                  styles.area
                }
                placeholder="Reflection question (optional)"
                value={
                  form.reflection
                }
                onChangeText={
                  value =>
                    updateForm({
                      reflection:
                        value,
                    })
                }
              />

              <TextInput
                multiline
                style={
                  styles.area
                }
                placeholder="Assignment prompt (optional)"
                value={
                  form.assignment
                }
                onChangeText={
                  value =>
                    updateForm({
                      assignment:
                        value,
                    })
                }
              />

              <Button
                title={
                  busy
                    ? 'SAVING...'
                    : editingId
                      ? 'SAVE LESSON CHANGES'
                      : 'ADD LESSON'
                }
                onPress={
                  saveCurrent
                }
              />

              {editingId && (
                <Pressable
                  onPress={
                    resetEditor
                  }
                  disabled={
                    busy
                  }
                  style={
                    styles.cancelButton
                  }
                >
                  <Text
                    style={
                      styles.cancelText
                    }
                  >
                    CANCEL EDITING
                  </Text>
                </Pressable>
              )}
            </Card>

            <SectionTitle>
              LESSONS
            </SectionTitle>

            {lessons.length ===
            0 ? (
              <Card>
                <Text
                  style={
                    shared.muted
                  }
                >
                  No lessons yet.
                </Text>
              </Card>
            ) : (
              lessons.map(
                lesson => (
                  <Card
                    key={
                      lesson.id
                    }
                  >
                    <View
                      style={
                        styles.lessonTop
                      }
                    >
                      <View
                        style={{
                          flex: 1,
                        }}
                      >
                        <Text
                          style={
                            shared.h2
                          }
                        >
                          Lesson {
                            lesson.lesson_number
                          }: {
                            lesson.title
                          }
                        </Text>

                        <Text
                          style={[
                            shared.muted,
                            {
                              marginTop:
                                4,
                            },
                          ]}
                        >
                          {
                            lesson.lesson_type
                          } · {
                            lesson.scripture_reference ||
                            'No scripture reference'
                          }
                        </Text>
                      </View>

                      <Pressable
                        onPress={() =>
                          beginEdit(
                            lesson,
                          )
                        }
                        style={
                          styles.editButton
                        }
                      >
                        <Text
                          style={
                            styles.editText
                          }
                        >
                          EDIT
                        </Text>
                      </Pressable>
                    </View>

                    {!!lesson.content && (
                      <Text
                        numberOfLines={
                          3
                        }
                        style={
                          styles.preview
                        }
                      >
                        {
                          lesson.content
                        }
                      </Text>
                    )}

                    {!!lesson.reflection_question && (
                      <Text
                        numberOfLines={
                          2
                        }
                        style={
                          styles.secondary
                        }
                      >
                        Reflection: {
                          lesson.reflection_question
                        }
                      </Text>
                    )}

                    {!!lesson.assignment_prompt && (
                      <Text
                        numberOfLines={
                          2
                        }
                        style={
                          styles.secondary
                        }
                      >
                        Assignment: {
                          lesson.assignment_prompt
                        }
                      </Text>
                    )}
                  </Card>
                ),
              )
            )}
          </>
        )}
      </ScrollView>
    </AdminGate>
  );
}

const styles =
  StyleSheet.create({
    statusRow: {
      marginTop: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      gap: 10,
    },
    status: {
      color:
        colors.greenDark,
      fontSize: 11,
      fontWeight: '900',
    },
    publishButton: {
      borderWidth: 1,
      borderColor:
        colors.green,
      borderRadius: 999,
      paddingHorizontal:
        12,
      paddingVertical:
        8,
    },
    publishText: {
      color:
        colors.greenDark,
      fontSize: 10,
      fontWeight: '900',
    },
    fieldLabel: {
      marginTop: 2,
      marginBottom: 8,
      fontWeight: '900',
      color: colors.text,
    },
    input: {
      borderWidth: 1,
      borderColor:
        colors.line,
      borderRadius: 12,
      backgroundColor:
        colors.white,
      paddingHorizontal:
        12,
      paddingVertical:
        11,
      marginBottom: 10,
      color: colors.text,
    },
    area: {
      minHeight: 100,
      borderWidth: 1,
      borderColor:
        colors.line,
      borderRadius: 12,
      backgroundColor:
        colors.white,
      paddingHorizontal:
        12,
      paddingVertical:
        11,
      marginTop: 10,
      marginBottom: 10,
      color: colors.text,
      textAlignVertical:
        'top',
    },
    wrap: {
      flexDirection:
        'row',
      flexWrap: 'wrap',
      gap: 7,
    },
    chip: {
      borderWidth: 1,
      borderColor:
        colors.line,
      borderRadius: 999,
      paddingHorizontal:
        11,
      paddingVertical:
        8,
      backgroundColor:
        colors.white,
    },
    chipOn: {
      borderColor:
        colors.green,
      backgroundColor:
        'rgba(39,93,69,0.10)',
    },
    chipText: {
      color: colors.text,
      fontSize: 11,
      fontWeight: '800',
      textTransform:
        'capitalize',
    },
    editBanner: {
      marginBottom: 12,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor:
        colors.line,
      backgroundColor:
        'rgba(39,93,69,0.08)',
    },
    editBannerTitle: {
      color:
        colors.greenDark,
      fontSize: 12,
      fontWeight: '900',
    },
    editBannerText: {
      marginTop: 4,
      color: colors.muted,
      fontSize: 11,
      lineHeight: 16,
    },
    cancelButton: {
      alignItems:
        'center',
      paddingVertical:
        11,
      marginTop: 5,
    },
    cancelText: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '900',
    },
    lessonTop: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      gap: 10,
    },
    editButton: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor:
        colors.green,
      paddingHorizontal:
        12,
      paddingVertical:
        7,
    },
    editText: {
      color:
        colors.greenDark,
      fontSize: 10,
      fontWeight: '900',
    },
    preview: {
      marginTop: 10,
      color: colors.text,
      fontSize: 12,
      lineHeight: 18,
    },
    secondary: {
      marginTop: 7,
      color: colors.muted,
      fontSize: 11,
      lineHeight: 17,
    },
  });
