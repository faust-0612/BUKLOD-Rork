import React, {
  useEffect,
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
} from '@/components/UI';

import {
  supabase,
} from '@/lib/supabase';

import {
  colors,
} from '@/lib/theme';


type Props = {
  lesson: any;
  onSaved?: () => void | Promise<void>;
};


function normalizeQuestions(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return ['', '', '', ''];
  }

  const next = value
    .slice(0,4)
    .map(
      (x) =>
        String(x ?? '')
    );

  while (next.length < 4) {
    next.push('');
  }

  return next;
}


function AdminAudioButton({
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
            'Audio',
            'Could not play audio.'
          );
        }
      }}
      style={styles.audioPreview}
    >
      <Text style={styles.audioPreviewText}>
        ▶ PREVIEW AUDIO
      </Text>
    </Pressable>
  );
}


export function LessonAdminEditor({
  lesson,
  onSaved,
}: Props) {
  const [
    open,
    setOpen,
  ] = useState(false);

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    title,
    setTitle,
  ] = useState('');

  const [
    scripture,
    setScripture,
  ] = useState('');

  const [
    content,
    setContent,
  ] = useState('');

  const [
    reflection,
    setReflection,
  ] = useState('');

  const [
    assignment,
    setAssignment,
  ] = useState('');

  const [
    audioUrl,
    setAudioUrl,
  ] = useState('');

  const [
    questions,
    setQuestions,
  ] = useState<string[]>(
    ['', '', '', '']
  );


  useEffect(() => {
    setTitle(
      String(
        lesson?.title ??
        ''
      )
    );

    setScripture(
      String(
        lesson?.scripture_reference ??
        ''
      )
    );

    setContent(
      String(
        lesson?.content ??
        ''
      )
    );

    setReflection(
      String(
        lesson?.reflection_question ??
        ''
      )
    );

    setAssignment(
      String(
        lesson?.assignment_prompt ??
        ''
      )
    );

    setAudioUrl(
      String(
        lesson?.audio_url ??
        ''
      )
    );

    setQuestions(
      normalizeQuestions(
        lesson?.generated_questions_fil
      )
    );
  }, [
    lesson?.id,
    lesson?.updated_at,
  ]);


  const updateQuestion = (
    index: number,
    value: string
  ) => {
    setQuestions(
      (current) => {
        const next = [
          ...current,
        ];

        while (next.length < 4) {
          next.push('');
        }

        next[index] = value;

        return next;
      }
    );
  };


  const save = async () => {
    if (
      !title.trim() ||
      !content.trim()
    ) {
      return Alert.alert(
        'Lesson',
        'Lesson title and content are required.'
      );
    }

    const finalQuestions =
      questions.map(
        (x) =>
          x.trim()
      );

    if (
      finalQuestions.length !== 4 ||
      finalQuestions.some(
        (x) =>
          x.length < 5
      )
    ) {
      return Alert.alert(
        'Four Questions Required',
        'Complete all four review questions before saving.'
      );
    }

    setBusy(true);

    const {
      error,
    } = await supabase
      .from('learning_lessons')
      .update({
        title:
          title.trim(),

        scripture_reference:
          scripture.trim() ||
          null,

        content:
          content.trim(),

        reflection_question:
          reflection.trim() ||
          null,

        assignment_prompt:
          assignment.trim() ||
          null,

        audio_url:
          audioUrl.trim() ||
          null,

        generated_questions_fil:
          finalQuestions,

        questions_locked:
          true,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        'id',
        lesson.id
      );

    setBusy(false);

    if (error) {
      return Alert.alert(
        'Could Not Update Lesson',
        error.message
      );
    }

    Alert.alert(
      'Lesson Updated',
      'Lesson content and review questions were saved.'
    );

    setOpen(false);

    await onSaved?.();
  };


  const regenerate = async () => {
    Alert.alert(
      'Regenerate Questions?',
      'The four Filipino questions will be regenerated automatically from the lesson title and Scripture reference.',
      [
        {
          text: 'CANCEL',
          style: 'cancel',
        },
        {
          text: 'REGENERATE',
          onPress: async () => {
            setBusy(true);

            const {
              error,
            } = await supabase
              .from('learning_lessons')
              .update({
                title:
                  title.trim() ||
                  lesson.title,

                scripture_reference:
                  scripture.trim() ||
                  null,

                questions_locked:
                  false,

                updated_at:
                  new Date().toISOString(),
              })
              .eq(
                'id',
                lesson.id
              );

            setBusy(false);

            if (error) {
              return Alert.alert(
                'Questions',
                error.message
              );
            }

            await onSaved?.();

            Alert.alert(
              'Questions Regenerated',
              'The automatic four-question set has been restored.'
            );
          },
        },
      ]
    );
  };


  if (!open) {
    return (
      <Pressable
        onPress={() =>
          setOpen(true)
        }
        style={styles.editButton}
      >
        <Text style={styles.editText}>
          ✎ EDIT LESSON
        </Text>

        <Text style={styles.editSub}>
          Content • Questions • Audio
        </Text>
      </Pressable>
    );
  }


  return (
    <View style={styles.editor}>
      <View style={styles.editorHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.editorTitle}>
            EDIT LESSON
          </Text>

          <Text style={styles.editorSub}>
            Changes apply immediately.
          </Text>
        </View>

        <Pressable
          onPress={() =>
            setOpen(false)
          }
        >
          <Text style={styles.close}>
            ✕
          </Text>
        </Pressable>
      </View>


      <Text style={styles.label}>
        LESSON TITLE
      </Text>

      <TextInput
        value={title}
        onChangeText={setTitle}
        style={styles.input}
      />


      <Text style={styles.label}>
        SCRIPTURE REFERENCE
      </Text>

      <TextInput
        value={scripture}
        onChangeText={setScripture}
        style={styles.input}
        placeholder="Example: John 3:16"
      />


      <Text style={styles.label}>
        LESSON CONTENT
      </Text>

      <TextInput
        multiline
        value={content}
        onChangeText={setContent}
        style={styles.area}
      />


      <Text style={styles.label}>
        REFLECTION PROMPT
      </Text>

      <TextInput
        multiline
        value={reflection}
        onChangeText={setReflection}
        style={styles.smallArea}
        placeholder="Optional additional Personal Reflection prompt"
      />


      <Text style={styles.label}>
        AUDIO URL
      </Text>

      <TextInput
        value={audioUrl}
        onChangeText={setAudioUrl}
        style={styles.input}
        autoCapitalize="none"
        placeholder="https://..."
      />

      {!!audioUrl.trim() && (
        <AdminAudioButton
          url={audioUrl.trim()}
        />
      )}


      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>
        FOUR REVIEW QUESTIONS
      </Text>

      <Text style={styles.helper}>
        These questions are automatically
        generated when a lesson is created.
        You may edit and lock them here.
      </Text>

      {questions.map(
        (
          question,
          index
        ) => (
          <View
            key={index}
            style={styles.questionWrap}
          >
            <Text style={styles.questionLabel}>
              QUESTION {index + 1}
            </Text>

            <TextInput
              multiline
              value={question}
              onChangeText={(
                value
              ) =>
                updateQuestion(
                  index,
                  value
                )
              }
              style={styles.questionInput}
            />
          </View>
        )
      )}


      <View style={styles.actions}>
        <View style={{ flex: 1 }}>
          <Button
            title={
              busy
                ? 'SAVING...'
                : 'SAVE CHANGES'
            }
            onPress={save}
          />
        </View>
      </View>


      <Pressable
        onPress={regenerate}
        disabled={busy}
        style={styles.regenerate}
      >
        <Text style={styles.regenerateText}>
          ↻ REGENERATE AUTOMATIC QUESTIONS
        </Text>
      </Pressable>


      {lesson?.lesson_type ===
        'assignment' && (
        <>
          <Text style={styles.label}>
            ASSIGNMENT PROMPT
          </Text>

          <TextInput
            multiline
            value={assignment}
            onChangeText={setAssignment}
            style={styles.smallArea}
          />
        </>
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  editButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#F6F8F6',
  },

  editText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.greenDark,
  },

  editSub: {
    marginTop: 3,
    fontSize: 9.5,
    color: colors.muted,
  },

  editor: {
    marginTop: 14,
    padding: 13,
    borderRadius: 14,
    backgroundColor: '#F6F8F6',
    borderWidth: 1,
    borderColor: colors.line,
  },

  editorHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },

  editorTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.greenDark,
  },

  editorSub: {
    marginTop: 3,
    fontSize: 9.5,
    color: colors.muted,
  },

  close: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.muted,
    paddingHorizontal: 6,
  },

  label: {
    marginTop: 12,
    marginBottom: 5,
    fontSize: 9.5,
    letterSpacing: 0.6,
    fontWeight: '900',
    color: colors.greenDark,
  },

  input: {
    minHeight: 44,
    paddingHorizontal: 11,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    color: colors.text,
  },

  area: {
    minHeight: 180,
    padding: 11,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    textAlignVertical: 'top',
    color: colors.text,
  },

  smallArea: {
    minHeight: 90,
    padding: 11,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    textAlignVertical: 'top',
    color: colors.text,
  },

  audioPreview: {
    marginTop: 8,
    padding: 10,
    borderRadius: 11,
    backgroundColor: '#EEF7F0',
  },

  audioPreviewText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.greenDark,
  },

  divider: {
    height: 1,
    marginVertical: 16,
    backgroundColor: colors.line,
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
  },

  helper: {
    marginTop: 5,
    fontSize: 10,
    lineHeight: 15,
    color: colors.muted,
  },

  questionWrap: {
    marginTop: 12,
  },

  questionLabel: {
    marginBottom: 5,
    fontSize: 9,
    fontWeight: '900',
    color: colors.greenDark,
  },

  questionInput: {
    minHeight: 72,
    padding: 10,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    textAlignVertical: 'top',
    color: colors.text,
  },

  actions: {
    marginTop: 15,
    flexDirection: 'row',
  },

  regenerate: {
    marginTop: 9,
    padding: 11,
    alignItems: 'center',
  },

  regenerateText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: colors.greenDark,
  },
});