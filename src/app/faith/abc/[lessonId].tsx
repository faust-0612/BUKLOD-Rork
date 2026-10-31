/* PATCH_192A_R2_SHOW_FAITH_ABC_HYMNS_POINTS_ALL_ACCESS */
import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/providers/AuthProvider';
import { useNetwork } from '@/providers/NetworkProvider';
import { warmBuklodAdOpportunity, showBuklodAdOpportunity } from '@/lib/buklodAdOpportunities';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import {
  enqueueOfflineAction,
  subscribeOfflineQueue,
  type OfflineQueueSnapshot,
} from '@/lib/offlineSyncQueue';

import {
  supabase,
} from '@/lib/supabase';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import {
  ABC_LESSONS,
  ABC_SOURCE,
  type AbcBlock,
  type FaithBibleReference,
} from '@/data/faith/abcLessons';

const COMPLETION_KEY =
  'buklod.faith.abc.completed.v1';

const FONT_KEY =
  'buklod.faith.abc.font.v1';

const ABC_POINTS_PER_LESSON =
  5;

type AbcRewardState =
  | 'pending'
  | 'claimed'
  | 'legacy'
  | null;

function answerKey(
  lessonId: string
) {
  return `buklod.faith.abc.answers.v1.${lessonId}`;
}

function displayPrompt(
  value: string
) {
  return value
    .replace(
      /(?:__\s*){3,}/g,
      '________'
    )
    .replace(
      /\s+/g,
      ' '
    )
    .trim();
}

export default function
BuklodAbcLessonDetailScreen() {
  const { user } = useAuth();
  const { online } = useNetwork();
  const accountId = user?.id;
  const accountCompletionKey = accountId ? `${COMPLETION_KEY}.${accountId}` : null;
  const params =
    useLocalSearchParams<{
      lessonId?:
        | string
        | string[];
    }>();

  const lessonId =
    Array.isArray(
      params.lessonId
    )
      ? params.lessonId[0]
      : params.lessonId;

  const accountAnswerKey = accountId && lessonId ? `${answerKey(lessonId)}.${accountId}` : null;
  const lesson =
    useMemo(
      () =>
        ABC_LESSONS.find(
          item =>
            item.id ===
            lessonId
        ) ?? null,
      [lessonId]
    );

  const [
    answers,
    setAnswers,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    loaded,
    setLoaded,
  ] =
    useState(false);

  const [
    completed,
    setCompleted,
  ] =
    useState(false);

  const [
    rewardState,
    setRewardState,
  ] =
    useState<
      AbcRewardState
    >(null);

  const [
    rewardBusy,
    setRewardBusy,
  ] =
    useState(false);
  const [pendingSync, setPendingSync] = useState(false);

  useEffect(() => {
    if (online && lesson && lesson.id !== 'intro' && !completed && !pendingSync) {
      warmBuklodAdOpportunity('abc_lesson_success');
    }
  }, [online, lesson?.id, completed, pendingSync]);

  const [
    fontSize,
    setFontSize,
  ] =
    useState(16);

  useEffect(() => {
    if (!accountId || !lessonId) {
      setPendingSync(false);
      return;
    }
    let active = true;
    let hadPending = false;
    const update = (snapshot: OfflineQueueSnapshot) => {
      if (!active) return;
      const isPending = snapshot.items.some(item =>
        item.kind === 'faith_abc_completion_v1' &&
        item.userId === accountId &&
        (item.payload as { lessonId?: unknown } | null)?.lessonId === lessonId
      );
      setPendingSync(isPending);
      if (hadPending && !isPending) {
        // Queue removal follows the server-confirmed idempotent RPC.
        void AsyncStorage.getItem(`${COMPLETION_KEY}.${accountId}`)
          .then(raw => {
            if (!active || !raw) return;
            const saved = JSON.parse(raw);
            if (saved?.[lessonId]) {
              setCompleted(true);
              setRewardState('legacy');
            }
          }).catch(() => undefined);
      }
      hadPending = isPending;
    };
    const unsubscribe = subscribeOfflineQueue(update);
    return () => { active = false; unsubscribe(); };
  }, [accountId, lessonId]);

  useEffect(
    () => {
      let active =
        true;

      setLoaded(false);
      setAnswers({});
      setCompleted(false);
      setRewardState(null);
      if (!lesson || !accountId || !accountCompletionKey || !accountAnswerKey) {
        setLoaded(true);
        return;
      }

      if (
        lesson.id !==
        'intro'
      ) {
        void (async () => {
          const {
            data,
            error,
          } =
            await (
              supabase as any
            ).rpc(
              'get_my_abc_growth_progress_v1'
            );

          if (
            !active ||
            error ||
            !Array.isArray(data)
          ) {
            return;
          }

          const row =
            data.find(
              item =>
                String(
                  item?.lesson_id ??
                    ''
                ) ===
                lesson.id
            );

          if (!row) {
            return;
          }

          setCompleted(true);
          setRewardState(
            (row.claim_state ??
              'legacy') as
              AbcRewardState
          );
        })();
      }

      void Promise.all([
        AsyncStorage.getItem(accountAnswerKey),
        AsyncStorage.getItem(accountCompletionKey),
        AsyncStorage.getItem(
          FONT_KEY
        ),
      ])
        .then(
          ([
            answerRaw,
            completeRaw,
            fontRaw,
          ]) => {
            if (!active) {
              return;
            }

            if (answerRaw) {
              try {
                const parsed =
                  JSON.parse(
                    answerRaw
                  );

                if (
                  parsed &&
                  typeof parsed ===
                    'object'
                ) {
                  setAnswers(
                    parsed
                  );
                }
              }
              catch {
                // Ignore malformed local notes.
              }
            }

            if (
              completeRaw &&
              lesson.id ===
                'intro'
            ) {
              try {
                const parsed =
                  JSON.parse(
                    completeRaw
                  );

                setCompleted(
                  Boolean(
                    parsed?.[
                      lesson.id
                    ]
                  )
                );
              }
              catch {
                // Ignore malformed completion map.
              }
            }

            const parsedFont =
              Number(
                fontRaw
              );

            if (
              Number.isFinite(
                parsedFont
              ) &&
              parsedFont >= 13 &&
              parsedFont <= 25
            ) {
              setFontSize(
                parsedFont
              );
            }

            setLoaded(true);
          }
        )
        .catch(
          () => {
            if (active) {
              setLoaded(true);
            }
          }
        );

      return () => {
        active =
          false;
      };
    },
    [lesson, accountId, accountCompletionKey, accountAnswerKey]
  );

  useEffect(
    () => {
      if (
        !loaded ||
        !lesson ||
        !accountAnswerKey
      ) {
        return;
      }

      const timer =
        setTimeout(
          () => {
            void AsyncStorage
              .setItem(
                accountAnswerKey,
                JSON.stringify(
                  answers
                )
              );
          },
          250
        );

      return () =>
        clearTimeout(
          timer
        );
    },
    [
      answers,
      lesson,
      loaded,
      accountAnswerKey,
    ]
  );

  useEffect(
    () => {
      void AsyncStorage
        .setItem(
          FONT_KEY,
          String(
            fontSize
          )
        );
    },
    [fontSize]
  );

  const setAnswer =
    (
      key: string,
      value: string
    ) => {
      setAnswers(
        current => ({
          ...current,
          [key]:
            value,
        })
      );
    };

  const persistCompletion =
    async (
      value: boolean
    ) => {
      if (!lesson || !accountCompletionKey) {
        return;
      }

      let map:
        Record<
          string,
          boolean
        > = {};

      try {
        const raw =
          await AsyncStorage
            .getItem(
              accountCompletionKey
            );

        if (raw) {
          const parsed =
            JSON.parse(raw);

          if (
            parsed &&
            typeof parsed ===
              'object'
          ) {
            map = parsed;
          }
        }
      }
      catch {
        map = {};
      }

      map[
        lesson.id
      ] = value;

      await AsyncStorage
        .setItem(
          accountCompletionKey,
          JSON.stringify(
            map
          )
        );
    };

  const toggleIntroComplete =
    async () => {
      if (
        !lesson ||
        lesson.id !==
          'intro'
      ) {
        return;
      }

      const next =
        !completed;

      setCompleted(next);
      await persistCompletion(
        next
      );
    };

  const queueLessonCompletion = async () => {
    if (!accountId || !lesson) {
      throw new Error('Sign in before saving a completion.');
    }
    await enqueueOfflineAction({
      kind: 'faith_abc_completion_v1',
      userId: accountId,
      dedupeKey: lesson.id,
      payload: { lessonId: lesson.id },
      maxAttempts: 100,
    });
    setPendingSync(true);
    Alert.alert(
      'Saved Offline · Pending Sync',
      'Naka-save sa device ang completion. Ise-send ito kapag may internet. Ang +5 points ay magiging available lamang pagkatapos makumpirma ng server.'
    );
  };

  const completeRewardableLesson =
    async () => {
      if (
        !lesson ||
        lesson.id ===
          'intro' ||
        completed ||
        pendingSync ||
        rewardBusy
      ) {
        return;
      }

      const unanswered =
        lesson.blocks
          .filter(
            block =>
              block.answerable
          )
          .filter(
            block =>
              !String(
                answers[
                  block.id
                ] ?? ''
              ).trim()
          )
          .length;

      if (unanswered > 0) {
        Alert.alert(
          'May kulang pang sagot',
          `May ${unanswered} tanong pang walang sagot. Sagutin muna ang bawat tanong bago tapusin ang aralin.`
        );
        return;
      }

      setRewardBusy(true);

      try {
        if (!online) {
          await queueLessonCompletion();
          return;
        }
        const {
          data,
          error,
        } = await withBuklodTimeout<any>(
          (supabase as any).rpc('complete_my_abc_growth_lesson_v1', {
            p_lesson_id: lesson.id,
          }),
          8500,
          'ABC lesson completion'
        );

        if (error) {
          throw error;
        }

        const points =
          Number(
            data?.points ??
              ABC_POINTS_PER_LESSON
          );

        const nextState =
          (data?.claim_state ??
            'pending') as
            AbcRewardState;

        setCompleted(true);
        setRewardState(
          nextState
        );

        await persistCompletion(
          true
        );

        // Never show an ad for an offline queue or a previously completed lesson.
        if (data?.already_completed === false) {
          await showBuklodAdOpportunity('abc_lesson_success');
        }

        if (
          nextState ===
          'pending'
        ) {
          Alert.alert(
            'Lesson completed!',
            `+${points} BUKLOD Points are Ready to Claim.`,
            [
              {
                text: 'Mamaya',
              },
              {
                text: 'Open BUKLOD Points',
                onPress: () =>
                  router.push(
                    '/points' as any
                  ),
              },
            ]
          );
        }
        else {
          Alert.alert(
            'Lesson completed!',
            `+${points} BUKLOD Points recorded.`
          );
        }
      }
      catch (
        error: any
      ) {
        const message = String(error?.message ?? error ?? '');
        if (!pendingSync && /network|fetch|offline|timed?\s*out|timeout|connection/i.test(message)) {
          try {
            await queueLessonCompletion();
            return;
          } catch (queueError) {
            Alert.alert('Hindi na-save sa device', String(queueError));
            return;
          }
        }
        Alert.alert(
          'Hindi ma-complete ang lesson',
          message || 'Please check your internet connection and try again.'
        );
      }
      finally {
        setRewardBusy(false);
      }
    };

  const openReference =
    (
      ref:
        FaithBibleReference
    ) => {
      router.push({
        pathname:
          '/bible/read',
        params: {
          source:
            'my_bible',
          translation:
            'ASD',
          book:
            String(
              ref.bookNo
            ),
          chapter:
            String(
              ref.chapter
            ),
          verse:
            String(
              ref.verse
            ),
        },
      } as any);
    };

  const renderBlock =
    (
      block:
        AbcBlock
    ) => {
      const baseText = {
        fontSize,
        lineHeight:
          Math.round(
            fontSize * 1.55
          ),
      };

      if (
        block.kind ===
        'heading'
      ) {
        return (
          <View
            key={
              block.id
            }
            style={
              styles.headingBlock
            }
          >
            <Text
              style={[
                styles.headingText,
                {
                  fontSize:
                    Math.min(
                      fontSize + 1,
                      24
                    ),
                  lineHeight:
                    Math.round(
                      (fontSize + 1) *
                        1.35
                    ),
                },
              ]}
            >
              {block.text}
            </Text>

            <ReferenceChips
              refs={
                block.refs
              }
              onPress={
                openReference
              }
            />
          </View>
        );
      }

      const special =
        block.kind ===
          'homework' ||
        block.kind ===
          'memory' ||
        block.kind ===
          'notes';

      return (
        <View
          key={
            block.id
          }
          style={[
            styles.block,
            block.kind ===
              'question' &&
              styles.questionBlock,
            block.kind ===
              'homework' &&
              styles.homeworkBlock,
            block.kind ===
              'memory' &&
              styles.memoryBlock,
            block.kind ===
              'notes' &&
              styles.notesBlock,
          ]}
        >
          {special ? (
            <Text
              style={
                styles.blockLabel
              }
            >
              {block.kind ===
              'homework'
                ? 'TAKDANG ARALIN'
                : block.kind ===
                    'memory'
                  ? 'PAGMEMEMORYA'
                  : 'MGA TALA / TANONG'}
            </Text>
          ) : null}

          <Text
            selectable
            style={[
              styles.bodyText,
              baseText,
              block.kind ===
                'question' &&
                styles.questionText,
            ]}
          >
            {displayPrompt(
              block.text
            )}
          </Text>

          <ReferenceChips
            refs={
              block.refs
            }
            onPress={
              openReference
            }
          />

          {block.answerable ? (
            <TextInput
              accessibilityLabel={`Answer for ${block.text.slice(0, 80)}`}
              multiline
              value={
                answers[
                  block.id
                ] ?? ''
              }
              onChangeText={
                value =>
                  setAnswer(
                    block.id,
                    value
                  )
              }
              placeholder="Isulat ang iyong sagot..."
              placeholderTextColor="#8C9891"
              textAlignVertical="top"
              style={[
                styles.answerInput,
                {
                  fontSize:
                    Math.max(
                      14,
                      fontSize - 1
                    ),
                  lineHeight:
                    Math.round(
                      fontSize *
                        1.4
                    ),
                },
              ]}
            />
          ) : null}
        </View>
      );
    };

  if (!lesson) {
    return (
      <SafeAreaView
        style={
          styles.screen
        }
      >
        <View
          style={
            styles.missingCard
          }
        >
          <MaterialCommunityIcons
            name="book-alert-outline"
            size={42}
            color="#8A6656"
          />

          <Text
            style={
              styles.missingTitle
            }
          >
            Lesson not found
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.replace(
                '/faith/abc' as any
              )
            }
            style={
              styles.primaryButton
            }
          >
            <Text
              style={
                styles.primaryButtonText
              }
            >
              Back to ABAKA
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={
        styles.screen
      }
    >
      <KeyboardAvoidingView
        style={
          styles.flex
        }
        behavior={
          Platform.OS ===
          'ios'
            ? 'padding'
            : undefined
        }
      >
        <View
          style={
            styles.topBar
          }
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={10}
            onPress={() =>
              router.back()
            }
            style={
              styles.iconButton
            }
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color="#173A2B"
            />
          </Pressable>

          <View
            style={
              styles.topBarCopy
            }
          >
            <Text
              style={
                styles.topCode
              }
            >
              {lesson.code}
            </Text>

            <Text
              numberOfLines={1}
              style={
                styles.topTitle
              }
            >
              {lesson.title}
            </Text>
          </View>

          <View
            style={
              styles.fontControls
            }
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Decrease lesson text size"
              onPress={() =>
                setFontSize(
                  value =>
                    Math.max(
                      13,
                      value - 1
                    )
                )
              }
              style={
                styles.smallControl
              }
            >
              <Text
                style={
                  styles.smallControlText
                }
              >
                A−
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Increase lesson text size"
              onPress={() =>
                setFontSize(
                  value =>
                    Math.min(
                      25,
                      value + 1
                    )
                )
              }
              style={
                styles.smallControl
              }
            >
              <Text
                style={
                  styles.smallControlText
                }
              >
                A+
              </Text>
            </Pressable>
          </View>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={
            styles.content
          }
        >
          <View
            style={
              styles.hero
            }
          >
            <Text
              style={
                styles.heroEyebrow
              }
            >
              {lesson.code.toUpperCase()}
            </Text>

            <Text
              style={
                styles.heroTitle
              }
            >
              {lesson.title}
            </Text>

            <Text
              style={
                styles.heroMeta
              }
            >
              Source pages {lesson.sourcePages[0]}
              {lesson.sourcePages[1] !==
              lesson.sourcePages[0]
                ? `–${lesson.sourcePages[1]}`
                : ''} · {lesson.references.length} Bible references
            </Text>
          </View>

          <View
            style={
              styles.studyMeta
            }
          >
            <View
              style={
                styles.studyField
              }
            >
              <Text
                style={
                  styles.studyFieldLabel
                }
              >
                SINIMULAN ANG ARALIN
              </Text>

              <TextInput
                accessibilityLabel="Date lesson started"
                value={
                  answers[
                    '__started'
                  ] ?? ''
                }
                onChangeText={
                  value =>
                    setAnswer(
                      '__started',
                      value
                    )
                }
                placeholder="Petsa"
                placeholderTextColor="#929D96"
                style={
                  styles.studyFieldInput
                }
              />
            </View>

            <View
              style={
                styles.studyField
              }
            >
              <Text
                style={
                  styles.studyFieldLabel
                }
              >
                IWINASTO ANG ARALIN
              </Text>

              <TextInput
                accessibilityLabel="Date lesson reviewed"
                value={
                  answers[
                    '__reviewed'
                  ] ?? ''
                }
                onChangeText={
                  value =>
                    setAnswer(
                      '__reviewed',
                      value
                    )
                }
                placeholder="Petsa"
                placeholderTextColor="#929D96"
                style={
                  styles.studyFieldInput
                }
              />
            </View>
          </View>

          <View
            style={
              styles.referenceIntro
            }
          >
            <MaterialCommunityIcons
              name="link-variant"
              size={20}
              color="#2F7A4F"
            />

            <Text
              style={
                styles.referenceIntroText
              }
            >
              Tap any Bible reference to open the exact passage in the existing BUKLOD Bible reader (ASD).
            </Text>
          </View>

          {lesson.id !==
          'intro' ? (
            <View
              style={
                styles.rewardCard
              }
            >
              <View
                style={
                  styles.rewardIcon
                }
              >
                <MaterialCommunityIcons
                  name="star-circle"
                  size={24}
                  color="#8B6C20"
                />
              </View>

              <View
                style={
                  styles.rewardCopy
                }
              >
                <Text
                  style={
                    styles.rewardTitle
                  }
                >
                  +5 BUKLOD Points
                </Text>

                <Text
                  style={
                    styles.rewardBody
                  }
                >
                  Sagutan ang lahat ng answer fields, tapos i-complete ang lesson. Isang beses lang ang reward sa bawat lesson.
                </Text>

                {completed ? (
                  <Text
                    style={
                      styles.rewardStatus
                    }
                  >
                    {rewardState ===
                    'pending'
                      ? '✓ Completed · 5 points Ready to Claim'
                      : '✓ Completed · 5 points recorded'}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {lesson.blocks.map(
            renderBlock
          )}

          <View
            style={
              styles.personalNotes
            }
          >
            <View
              style={
                styles.personalNotesHeader
              }
            >
              <MaterialCommunityIcons
                name="note-edit-outline"
                size={22}
                color="#5D7041"
              />

              <Text
                style={
                  styles.personalNotesTitle
                }
              >
                Personal na mga tala at tanong
              </Text>
            </View>

            <TextInput
              accessibilityLabel="Personal notes and questions"
              multiline
              value={
                answers[
                  '__notes'
                ] ?? ''
              }
              onChangeText={
                value =>
                  setAnswer(
                    '__notes',
                    value
                  )
              }
              placeholder="Isulat dito ang iyong reflection, tanong, o bagay na nais itanong sa pastor / nakatatandang kapatid..."
              placeholderTextColor="#8E9992"
              textAlignVertical="top"
              style={[
                styles.notesInput,
                {
                  fontSize:
                    Math.max(
                      14,
                      fontSize - 1
                    ),
                },
              ]}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              selected:
                completed,
              disabled:
                rewardBusy ||
                (lesson.id !==
                  'intro' &&
                  completed),
            }}
            accessibilityLabel={
              lesson.id ===
              'intro'
                ? completed
                  ? 'Mark introduction unread'
                  : 'Mark introduction read'
                : completed
                  ? 'ABAKA lesson completed'
                  : pendingSync
                    ? 'Saved offline; awaiting server confirmation'
                    : 'Complete this ABAKA lesson and earn five BUKLOD Points'
            }
            disabled={
              rewardBusy ||
              pendingSync ||
              (lesson.id !==
                'intro' &&
                completed)
            }
            onPress={
              lesson.id ===
              'intro'
                ? toggleIntroComplete
                : completeRewardableLesson
            }
            style={[
              styles.completeButton,
              completed &&
                styles.completeButtonOn,
              rewardBusy &&
                styles.completeButtonBusy,
            ]}
          >
            {rewardBusy ? (
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
              />
            ) : (
              <MaterialCommunityIcons
                name={
                  completed
                    ? 'check-circle'
                    : lesson.id ===
                        'intro'
                      ? 'circle-outline'
                      : 'star-circle-outline'
                }
                size={22}
                color={
                  completed
                    ? '#FFFFFF'
                    : '#2F7A4F'
                }
              />
            )}

            <Text
              style={[
                styles.completeButtonText,
                completed &&
                  styles.completeButtonTextOn,
              ]}
            >
              {rewardBusy
                ? 'Recording completion...'
                : pendingSync
                  ? 'Saved Offline · Pending Sync'
                : lesson.id ===
                    'intro'
                  ? completed
                    ? 'Panimula read'
                    : 'Mark Panimula read'
                  : completed
                    ? rewardState ===
                      'pending'
                      ? 'Completed · +5 points ready to claim'
                      : 'Completed · +5 BUKLOD Points'
                    : 'Complete lesson · earn +5 points'}
            </Text>
          </Pressable>

          {lesson.id !==
            'intro' &&
          completed &&
          rewardState ===
            'pending' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push(
                  '/points' as any
                )
              }
              style={
                styles.claimButton
              }
            >
              <MaterialCommunityIcons
                name="gift-outline"
                size={19}
                color="#6E5518"
              />

              <Text
                style={
                  styles.claimButtonText
                }
              >
                Open BUKLOD Points · Claim 5 Points
              </Text>
            </Pressable>
          ) : null}

          <View
            style={
              styles.citationCard
            }
          >
            <Text
              style={
                styles.citationLabel
              }
            >
              SOURCE / CITATION
            </Text>

            <Text
              selectable
              style={
                styles.citationText
              }
            >
              {ABC_SOURCE.title}. {ABC_SOURCE.copyright} Sanggunian ng balangkas: {ABC_SOURCE.author}.
            </Text>

            <Text
              style={
                styles.citationNote
              }
            >
              Ang mga talata ay naka-ugnay sa mambabasa ng Biblia ng BUKLOD. Sagutin mula sa talata.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ReferenceChips({
  refs,
  onPress,
}: {
  refs:
    FaithBibleReference[];
  onPress:
    (
      ref:
        FaithBibleReference
    ) => void;
}) {
  if (!refs.length) {
    return null;
  }

  return (
    <View
      style={
        styles.referenceWrap
      }
    >
      {refs.map(
        (
          ref,
          index
        ) => (
          <Pressable
            key={`${ref.bookNo}-${ref.chapter}-${ref.verse}-${index}`}
            accessibilityRole="link"
            accessibilityLabel={`Open Bible reference ${ref.label}`}
            onPress={() =>
              onPress(ref)
            }
            style={({
              pressed,
            }) => [
              styles.referenceChip,
              pressed &&
                styles.referenceChipPressed,
            ]}
          >
            <MaterialCommunityIcons
              name="book-open-variant"
              size={15}
              color="#2F7A4F"
            />

            <Text
              style={
                styles.referenceChipText
              }
            >
              {ref.label}
            </Text>
          </Pressable>
        )
      )}
    </View>
  );
}

const styles =
  StyleSheet.create({
    flex: {
      flex: 1,
    },

    screen: {
      flex: 1,
      backgroundColor:
        '#F6F8F5',
    },

    topBar: {
      minHeight: 62,
      paddingHorizontal:
        12,
      flexDirection:
        'row',
      alignItems:
        'center',
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        '#DDE5DF',
      backgroundColor:
        '#FFFFFF',
    },

    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    topBarCopy: {
      flex: 1,
      minWidth: 0,
      paddingHorizontal:
        5,
    },

    topCode: {
      color:
        '#2F7A4F',
      fontSize: 9,
      fontWeight:
        '900',
      letterSpacing:
        0.6,
      textTransform:
        'uppercase',
    },

    topTitle: {
      marginTop: 2,
      color:
        '#243A2E',
      fontSize: 13,
      fontWeight:
        '900',
    },

    fontControls: {
      flexDirection:
        'row',
      gap: 5,
    },

    smallControl: {
      minWidth: 42,
      height: 42,
      paddingHorizontal:
        8,
      borderRadius: 13,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#EFF5F0',
      borderWidth: 1,
      borderColor:
        '#DEE9E1',
    },

    smallControlText: {
      color:
        '#315D43',
      fontSize: 13,
      fontWeight:
        '900',
    },

    content: {
      padding: 16,
      paddingBottom: 44,
    },

    hero: {
      padding: 18,
      borderRadius: 22,
      backgroundColor:
        '#244C36',
    },

    heroEyebrow: {
      color:
        '#BFE0C9',
      fontSize: 10,
      fontWeight:
        '900',
      letterSpacing:
        0.8,
    },

    heroTitle: {
      marginTop: 7,
      color:
        '#FFFFFF',
      fontSize: 24,
      lineHeight: 30,
      fontWeight:
        '900',
    },

    heroMeta: {
      marginTop: 8,
      color:
        '#D8E9DD',
      fontSize: 11,
      lineHeight: 16,
    },

    studyMeta: {
      marginTop: 10,
      flexDirection:
        'row',
      gap: 8,
    },

    studyField: {
      flex: 1,
      padding: 11,
      borderRadius: 16,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E1E8E3',
    },

    studyFieldLabel: {
      color:
        '#6F8076',
      fontSize: 8,
      fontWeight:
        '900',
      letterSpacing:
        0.5,
    },

    studyFieldInput: {
      minHeight: 36,
      marginTop: 2,
      paddingVertical: 5,
      color:
        '#263C31',
      fontSize: 13,
      fontWeight:
        '700',
    },

    referenceIntro: {
      marginTop: 10,
      padding: 12,
      borderRadius: 16,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 9,
      backgroundColor:
        '#EDF7F0',
      borderWidth: 1,
      borderColor:
        '#DAECDD',
    },

    referenceIntroText: {
      flex: 1,
      color:
        '#4E6657',
      fontSize: 10,
      lineHeight: 15,
      fontWeight:
        '700',
    },

    headingBlock: {
      marginTop: 20,
      marginBottom: 7,
    },

    headingText: {
      color:
        '#1F4430',
      fontWeight:
        '900',
      letterSpacing:
        0.15,
    },

    block: {
      marginTop: 8,
      padding: 14,
      borderRadius: 17,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E4E9E5',
    },

    questionBlock: {
      borderColor:
        '#D7E9DA',
      backgroundColor:
        '#FBFEFB',
    },

    homeworkBlock: {
      borderColor:
        '#E9DFC4',
      backgroundColor:
        '#FFF9EB',
    },

    memoryBlock: {
      borderColor:
        '#D9DDED',
      backgroundColor:
        '#F7F8FE',
    },

    notesBlock: {
      borderColor:
        '#E5DFEA',
      backgroundColor:
        '#FBF8FC',
    },

    blockLabel: {
      marginBottom: 6,
      color:
        '#6C775F',
      fontSize: 9,
      fontWeight:
        '900',
      letterSpacing:
        0.7,
    },

    bodyText: {
      color:
        '#35483E',
    },

    questionText: {
      color:
        '#243D30',
      fontWeight:
        '700',
    },

    answerInput: {
      minHeight: 76,
      marginTop: 11,
      paddingHorizontal:
        12,
      paddingVertical:
        10,
      borderRadius: 13,
      color:
        '#253B30',
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#D6E2D9',
    },

    referenceWrap: {
      marginTop: 9,
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      gap: 6,
    },

    referenceChip: {
      minHeight: 36,
      paddingHorizontal:
        10,
      paddingVertical:
        7,
      borderRadius: 999,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 6,
      backgroundColor:
        '#E9F4EC',
      borderWidth: 1,
      borderColor:
        '#D3E7D8',
    },

    referenceChipPressed: {
      opacity: 0.72,
    },

    referenceChipText: {
      color:
        '#2F6B47',
      fontSize: 11,
      fontWeight:
        '900',
    },

    personalNotes: {
      marginTop: 20,
      padding: 15,
      borderRadius: 19,
      backgroundColor:
        '#F3F6EE',
      borderWidth: 1,
      borderColor:
        '#DDE5D4',
    },

    personalNotesHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 8,
    },

    personalNotesTitle: {
      color:
        '#455736',
      fontSize: 13,
      fontWeight:
        '900',
    },

    notesInput: {
      minHeight: 120,
      marginTop: 10,
      padding: 12,
      borderRadius: 14,
      color:
        '#34422E',
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#DCE4D4',
      lineHeight: 21,
    },

    completeButton: {
      minHeight: 52,
      marginTop: 14,
      borderRadius: 17,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 9,
      backgroundColor:
        '#EDF7F0',
      borderWidth: 1,
      borderColor:
        '#CAE2D1',
    },

    completeButtonOn: {
      backgroundColor:
        '#2F7A4F',
      borderColor:
        '#2F7A4F',
    },

    completeButtonText: {
      color:
        '#2F704A',
      fontSize: 13,
      fontWeight:
        '900',
    },

    completeButtonTextOn: {
      color:
        '#FFFFFF',
    },

    rewardCard: {
      marginTop: 10,
      padding: 13,
      borderRadius: 18,
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      gap: 10,
      backgroundColor:
        '#FFF8E4',
      borderWidth: 1,
      borderColor:
        '#EFE1B7',
    },

    rewardIcon: {
      width: 38,
      height: 38,
      borderRadius: 13,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#FFF0BE',
    },

    rewardCopy: {
      flex: 1,
    },

    rewardTitle: {
      color:
        '#6E5518',
      fontSize: 13,
      fontWeight:
        '900',
    },

    rewardBody: {
      marginTop: 3,
      color:
        '#796B45',
      fontSize: 10,
      lineHeight: 15,
    },

    rewardStatus: {
      marginTop: 7,
      color:
        '#2F7048',
      fontSize: 10,
      lineHeight: 14,
      fontWeight:
        '900',
    },

    completeButtonBusy: {
      opacity: 0.72,
    },

    claimButton: {
      marginTop: 8,
      minHeight: 48,
      paddingHorizontal:
        14,
      borderRadius: 16,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 8,
      backgroundColor:
        '#FFF8E4',
      borderWidth: 1,
      borderColor:
        '#E8D597',
    },

    claimButtonText: {
      color:
        '#6E5518',
      fontSize: 11,
      fontWeight:
        '900',
    },

    citationCard: {
      marginTop: 14,
      padding: 14,
      borderRadius: 17,
      backgroundColor:
        '#F5F3ED',
      borderWidth: 1,
      borderColor:
        '#E7E1D5',
    },

    citationLabel: {
      color:
        '#7E6D4E',
      fontSize: 9,
      fontWeight:
        '900',
      letterSpacing:
        0.7,
    },

    citationText: {
      marginTop: 6,
      color:
        '#5F584B',
      fontSize: 11,
      lineHeight: 17,
      fontWeight:
        '700',
    },

    citationNote: {
      marginTop: 6,
      color:
        '#80796E',
      fontSize: 9,
      lineHeight: 14,
    },

    missingCard: {
      margin: 20,
      padding: 28,
      borderRadius: 22,
      alignItems:
        'center',
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E4E6E2',
    },

    missingTitle: {
      marginTop: 10,
      color:
        '#433A35',
      fontSize: 18,
      fontWeight:
        '900',
    },

    primaryButton: {
      minHeight: 48,
      marginTop: 16,
      paddingHorizontal:
        18,
      borderRadius: 15,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#2F7A4F',
    },

    primaryButtonText: {
      color:
        '#FFFFFF',
      fontWeight:
        '900',
    },
  });
