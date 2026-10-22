import {
  useEffect,
  useState,
} from 'react';

import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import { AdminGate } from '@/components/AdminGate';

import {
  Button,
  Card,
  SectionTitle,
  shared,
} from '@/components/UI';

import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type SeriesRow = {
  id: string;
  title: string;
  description: string | null;
  is_published: boolean;
};

const today = () =>
  new Date().toISOString().slice(0, 10);

export default function DevotionalEditor() {
  const { id } =
    useLocalSearchParams<{
      id?: string;
    }>();

  const db = supabase as any;

  const [series, setSeries] =
    useState<SeriesRow[]>([]);

  const [seriesId, setSeriesId] =
    useState('');

  const [lessonNumber, setLessonNumber] =
    useState('');

  const [sortOrder, setSortOrder] =
    useState('');

  const [publishDate, setPublishDate] =
    useState(today());

  const [title, setTitle] =
    useState('');

  const [passage, setPassage] =
    useState('');

  const [keyVerse, setKeyVerse] =
    useState('');

  const [scripture, setScripture] =
    useState('');

  const [reflection, setReflection] =
    useState('');

  const [question, setQuestion] =
    useState('');

  const [application, setApplication] =
    useState('');

  const [prayer, setPrayer] =
    useState('');

  const [published, setPublished] =
    useState(false);

  const [busy, setBusy] =
    useState(false);

  useEffect(() => {
    const loadSeries = async () => {
      const {
        data,
        error,
      } = await db
        .from('devotional_series')
        .select(
          'id,title,description,is_published'
        )
        .order('title');

      if (error) {
        Alert.alert(
          'Devotional Series',
          error.message
        );
        return;
      }

      setSeries(data ?? []);
    };

    loadSeries();
  }, [db]);

  useEffect(() => {
    if (!id) return;

    const loadDevotional = async () => {
      const {
        data,
        error,
      } = await db
        .from('devotionals')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        Alert.alert(
          'Devotional',
          error?.message ||
            'Lesson could not be loaded.'
        );
        return;
      }

      setSeriesId(
        data.series_id || ''
      );

      setLessonNumber(
        data.day_number
          ? String(data.day_number)
          : ''
      );

      setSortOrder(
        data.sort_order
          ? String(data.sort_order)
          : data.day_number
            ? String(data.day_number)
            : ''
      );

      setPublishDate(
        data.publish_date || today()
      );

      setTitle(
        data.title || ''
      );

      setPassage(
        data.bible_passage || ''
      );

      setKeyVerse(
        data.key_verse || ''
      );

      setScripture(
        data.scripture_text || ''
      );

      setReflection(
        data.reflection_text || ''
      );

      setQuestion(
        data.think_about_it || ''
      );

      setApplication(
        data.application_text || ''
      );

      setPrayer(
        data.prayer_text || ''
      );

      setPublished(
        !!data.is_published
      );
    };

    loadDevotional();
  }, [db, id]);

  const chooseSeries = (
    item: SeriesRow
  ) => {
    setSeriesId(item.id);
  };

  const save = async () => {
    if (busy) return;

    if (!seriesId) {
      return Alert.alert(
        'Devotional Series',
        'Select a Devotional Series.'
      );
    }

    if (!title.trim()) {
      return Alert.alert(
        'Lesson Title',
        'Lesson title is required.'
      );
    }

    if (!reflection.trim()) {
      return Alert.alert(
        'Devotional Body',
        'Devotional or reflection body is required.'
      );
    }

    const parsedLesson =
      lessonNumber.trim()
        ? Number(lessonNumber)
        : null;

    const parsedOrder =
      sortOrder.trim()
        ? Number(sortOrder)
        : parsedLesson;

    if (
      parsedLesson !== null &&
      (
        !Number.isInteger(parsedLesson) ||
        parsedLesson <= 0
      )
    ) {
      return Alert.alert(
        'Lesson Number',
        'Use a positive whole number.'
      );
    }

    if (
      parsedOrder !== null &&
      (
        !Number.isInteger(parsedOrder) ||
        parsedOrder <= 0
      )
    ) {
      return Alert.alert(
        'Lesson Order',
        'Use a positive whole number.'
      );
    }

    if (
      publishDate &&
      !/^\d{4}-\d{2}-\d{2}$/.test(
        publishDate
      )
    ) {
      return Alert.alert(
        'Publish Date',
        'Use YYYY-MM-DD format.'
      );
    }

    const selectedSeries =
      series.find(
        (item) =>
          item.id === seriesId
      );

    if (
      published &&
      selectedSeries &&
      !selectedSeries.is_published
    ) {
      const continueSave =
        await new Promise<boolean>(
          (resolve) => {
            Alert.alert(
              'Series is Unpublished',
              'This lesson can be marked published, but members will not receive it until the Devotional Series itself is published.',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                  onPress: () =>
                    resolve(false),
                },
                {
                  text: 'Save Anyway',
                  onPress: () =>
                    resolve(true),
                },
              ]
            );
          }
        );

      if (!continueSave) return;
    }

    setBusy(true);

    try {
      const payload = {
        series_id: seriesId,

        day_number:
          parsedLesson,

        sort_order:
          parsedOrder,

        publish_date:
          publishDate || null,

        title:
          title.trim(),

        bible_passage:
          passage.trim() || null,

        key_verse:
          keyVerse.trim() || null,

        scripture_text:
          scripture.trim() || null,

        reflection_text:
          reflection.trim(),

        think_about_it:
          question.trim() || null,

        application_text:
          application.trim() || null,

        prayer_text:
          prayer.trim() || null,

        is_published:
          published,
      };

      const result = id
        ? await db
            .from('devotionals')
            .update(payload)
            .eq('id', id)

        : await db
            .from('devotionals')
            .insert(payload);

      if (result.error) {
        throw result.error;
      }

      Alert.alert(
        'Saved',
        published
          ? 'Lesson is published and available to the weekly devotional engine.'
          : 'Lesson was saved as an unpublished draft.'
      );

      router.replace(
        '/admin/devotionals' as any
      );
    } catch (error: any) {
      Alert.alert(
        'Could Not Save',
        error?.message ||
          'Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminGate>
      <ScrollView
        style={shared.screen}
        contentContainerStyle={
          styles.content
        }
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>
          DEVOTIONAL CONTENT
        </Text>

        <Text style={shared.h1}>
          {id
            ? 'Edit Devotional Lesson'
            : 'New Devotional Lesson'}
        </Text>

        <Text
          style={[
            shared.muted,
            {
              marginTop: 5,
            },
          ]}
        >
          Every lesson can be edited,
          reordered, published, or kept
          as draft.
        </Text>

        <SectionTitle>
          DEVOTIONAL SERIES
        </SectionTitle>

        <Card>
          <Text style={styles.label}>
            SERIES *
          </Text>

          <View style={styles.seriesWrap}>
            {series.map(
              (item) => {
                const selected =
                  item.id === seriesId;

                return (
                  <Pressable
                    key={item.id}
                    onPress={() =>
                      chooseSeries(item)
                    }
                    style={[
                      styles.seriesChip,
                      selected &&
                        styles.seriesChipOn,
                    ]}
                  >
                    <Text
                      style={[
                        styles.seriesTitle,
                        selected &&
                          styles.seriesTitleOn,
                      ]}
                    >
                      {item.title}
                    </Text>

                    <Text
                      style={
                        styles.seriesStatus
                      }
                    >
                      {item.is_published
                        ? 'PUBLISHED'
                        : 'DRAFT SERIES'}
                    </Text>
                  </Pressable>
                );
              }
            )}
          </View>

          {series.length === 0 && (
            <Text style={shared.muted}>
              No Devotional Series found.
              Create a series first.
            </Text>
          )}
        </Card>

        <SectionTitle>
          LESSON ORGANIZATION
        </SectionTitle>

        <Card>
          <FieldLabel>
            LESSON NUMBER
          </FieldLabel>

          <TextInput
            style={styles.input}
            value={lessonNumber}
            onChangeText={(value) => {
              setLessonNumber(value);

              if (!sortOrder) {
                setSortOrder(value);
              }
            }}
            keyboardType="number-pad"
            placeholder="Example: 1"
          />

          <Text style={styles.help}>
            Week 1 normally uses Lesson 1,
            Week 2 uses Lesson 2, and so on.
          </Text>

          <FieldLabel>
            DISPLAY / WEEKLY ORDER
          </FieldLabel>

          <TextInput
            style={styles.input}
            value={sortOrder}
            onChangeText={setSortOrder}
            keyboardType="number-pad"
            placeholder="Example: 1"
          />

          <Text style={styles.help}>
            The weekly devotional engine
            follows this order first.
          </Text>

          <FieldLabel>
            PUBLISH DATE
          </FieldLabel>

          <TextInput
            style={styles.input}
            value={publishDate}
            onChangeText={setPublishDate}
            autoCapitalize="none"
            placeholder="YYYY-MM-DD"
          />
        </Card>

        <SectionTitle>
          LESSON CONTENT
        </SectionTitle>

        <Card>
          <Editor
            label="LESSON TITLE *"
            value={title}
            setValue={setTitle}
            placeholder="Lesson title"
          />

          <Editor
            label="SCRIPTURE / BIBLE PASSAGE"
            value={passage}
            setValue={setPassage}
            placeholder="Example: John 3:16-18"
          />

          <Editor
            label="KEY VERSE"
            value={keyVerse}
            setValue={setKeyVerse}
            placeholder="Key verse reference or text"
          />

          <Editor
            label="SCRIPTURE TEXT"
            value={scripture}
            setValue={setScripture}
            placeholder="Scripture text"
            tall
          />

          <Editor
            label="DEVOTIONAL / LESSON BODY *"
            value={reflection}
            setValue={setReflection}
            placeholder="Main devotional teaching or reflection"
            tall
          />

          <Editor
            label="REFLECTION QUESTION"
            value={question}
            setValue={setQuestion}
            placeholder="Question for personal reflection"
            tall
          />

          <Editor
            label="APPLICATION"
            value={application}
            setValue={setApplication}
            placeholder="Practical application or action step"
            tall
          />

          <Editor
            label="PRAYER"
            value={prayer}
            setValue={setPrayer}
            placeholder="Closing or guided prayer"
            tall
          />
        </Card>

        <SectionTitle>
          PUBLICATION
        </SectionTitle>

        <Card>
          <View style={styles.publishRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.publishTitle}>
                Publish Lesson
              </Text>

              <Text
                style={[
                  shared.muted,
                  {
                    marginTop: 3,
                  },
                ]}
              >
                Only published lessons are
                included in the automatic
                weekly devotional sequence.
              </Text>
            </View>

            <Switch
              value={published}
              onValueChange={
                setPublished
              }
            />
          </View>

          <View
            style={[
              styles.statusBox,
              published
                ? styles.statusPublished
                : styles.statusDraft,
            ]}
          >
            <Text style={styles.statusText}>
              {published
                ? 'PUBLISHED LESSON'
                : 'UNPUBLISHED DRAFT'}
            </Text>
          </View>
        </Card>

        <View style={styles.actions}>
          <Button
            title={
              busy
                ? 'SAVING...'
                : 'SAVE DEVOTIONAL LESSON'
            }
            onPress={save}
          />

          <Button
            title="CANCEL"
            outline
            onPress={() =>
              router.back()
            }
          />
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>
    </AdminGate>
  );
}

function FieldLabel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Text style={styles.label}>
      {children}
    </Text>
  );
}

function Editor({
  label,
  value,
  setValue,
  placeholder,
  tall = false,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  placeholder?: string;
  tall?: boolean;
}) {
  return (
    <View style={styles.editor}>
      <Text style={styles.label}>
        {label}
      </Text>

      <TextInput
        style={[
          styles.input,
          tall && styles.tallInput,
        ]}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        multiline={tall}
        textAlignVertical={
          tall ? 'top' : 'center'
        }
      />
    </View>
  );
}

const styles =
  StyleSheet.create({
    content: {
      padding: 18,
      paddingBottom: 50,
    },

    eyebrow: {
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1,
      color: colors.greenDark,
      marginBottom: 4,
    },

    label: {
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.7,
      color: colors.muted,
      marginBottom: 6,
      marginTop: 4,
    },

    help: {
      fontSize: 11,
      lineHeight: 16,
      color: colors.muted,
      marginTop: -3,
      marginBottom: 13,
    },

    input: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 12,
      backgroundColor: colors.white,
      paddingHorizontal: 12,
      paddingVertical: 11,
      color: colors.text,
      marginBottom: 9,
    },

    tallInput: {
      minHeight: 110,
      paddingTop: 12,
    },

    editor: {
      marginBottom: 7,
    },

    seriesWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },

    seriesChip: {
      minWidth: 120,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 12,
      paddingVertical: 9,
      paddingHorizontal: 11,
      backgroundColor: colors.white,
    },

    seriesChipOn: {
      borderColor: colors.green,
      backgroundColor:
        colors.greenSoft,
    },

    seriesTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.text,
    },

    seriesTitleOn: {
      color: colors.greenDark,
    },

    seriesStatus: {
      marginTop: 3,
      fontSize: 8,
      fontWeight: '900',
      color: colors.muted,
    },

    publishRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },

    publishTitle: {
      fontSize: 15,
      fontWeight: '900',
      color: colors.text,
    },

    statusBox: {
      marginTop: 14,
      borderRadius: 10,
      paddingVertical: 9,
      paddingHorizontal: 11,
    },

    statusPublished: {
      backgroundColor:
        colors.greenSoft,
    },

    statusDraft: {
      backgroundColor:
        '#F1F1F1',
    },

    statusText: {
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.5,
      color: colors.greenDark,
    },

    actions: {
      gap: 9,
      marginTop: 18,
    },
  });