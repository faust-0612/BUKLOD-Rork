/* PATCH_192A_R2_SHOW_FAITH_ABC_HYMNS_POINTS_ALL_ACCESS */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  supabase,
} from '@/lib/supabase';
import { getOfflineCache, setOfflineCache } from '@/lib/offlineCache';
import { useAuth } from '@/providers/AuthProvider';
import { useNetwork } from '@/providers/NetworkProvider';

import {
  router,
  useFocusEffect,
} from 'expo-router';

import {
  ABC_LESSONS,
  ABC_SOURCE,
  type AbcLesson,
} from '@/data/faith/abcLessons';

const COMPLETION_KEY =
  'buklod.faith.abc.completed.v1';

type AbcPointProgress = {
  lesson_id: string;
  completed_at: string | null;
  points: number;
  claim_state: string | null;
  point_ledger_id: string | null;
};

const ABC_POINTS_PER_LESSON =
  5;


export default function
BuklodAbcLessonsScreen() {
  const { user } = useAuth();
  const { online } = useNetwork();
  const accountId = user?.id ?? '';
  const accountCompletionKey = accountId ? `${COMPLETION_KEY}.${accountId}` : null;
  const [
    query,
    setQuery,
  ] =
    useState('');

  const [
    completed,
    setCompleted,
  ] =
    useState<Record<string, boolean>>(
      {}
    );

  const [
    pointProgress,
    setPointProgress,
  ] =
    useState<
      Record<
        string,
        AbcPointProgress
      >
    >({});

  useEffect(() => {
    // Completion snapshots belong to the signed-in account, never the device.
    setCompleted({});
    setPointProgress({});
  }, [accountId]);

  const loadProgress = useCallback(() => {
    let alive = true;
    let freshApplied = false;
    if (!accountId || !accountCompletionKey) {
      return () => { alive = false; };
    }

    const applyRows = (rows: any[]) => {
      if (!alive) return;
      const next: Record<string, AbcPointProgress> = {};
      const completedPatch: Record<string, boolean> = {};
      for (const row of rows) {
        const id = String(row?.lesson_id ?? '');
        if (!id) continue;
        next[id] = {
          lesson_id: id,
          completed_at: row?.completed_at ?? null,
          points: Number(row?.points ?? ABC_POINTS_PER_LESSON),
          claim_state: row?.claim_state ?? null,
          point_ledger_id: row?.point_ledger_id ?? null,
        };
        completedPatch[id] = true;
      }
      setPointProgress(next);
      setCompleted(current => ({ ...current, ...completedPatch }));
    };

    // Bundled lessons work offline; hydrate completed states first, then sync.
    void Promise.all([
      AsyncStorage.getItem(accountCompletionKey),
      getOfflineCache<AbcPointProgress[]>('faith-abc-progress:v1', {
        userId: accountId,
        allowStale: true,
      }),
    ]).then(([raw, cached]) => {
      if (!alive || freshApplied) return;
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            setCompleted(current => ({ ...current, ...parsed }));
          }
        } catch {
          // Damaged device cache is not a server failure.
        }
      }
      if (Array.isArray(cached?.data)) applyRows(cached.data);
    }).catch(() => undefined);

    if (online) {
      void (async () => {
        try {
          const { data, error } = await (supabase as any).rpc(
            'get_my_abc_growth_progress_v1'
          );
          if (!alive || error || !Array.isArray(data)) return;
          freshApplied = true;
          applyRows(data);
          await setOfflineCache('faith-abc-progress:v1', data, {
            userId: accountId,
            ttlMs: 30 * 60 * 1000,
          });
        } catch {
          // Previously downloaded progress stays visible while offline.
        }
      })();
    }

    return () => { alive = false; };
  }, [accountId, accountCompletionKey, online]);

  useFocusEffect(
    loadProgress
  );

  const filtered =
    useMemo(
      () => {
        const needle =
          query
            .trim()
            .toLocaleLowerCase();

        if (!needle) {
          return ABC_LESSONS;
        }

        return ABC_LESSONS
          .filter(
            lesson =>
              `${lesson.code} ${lesson.title}`
                .toLocaleLowerCase()
                .includes(
                  needle
                )
          );
      },
      [query]
    );

  const studyLessons =
    ABC_LESSONS.filter(
      item =>
        item.id !==
        'intro'
    );

  const completedCount =
    studyLessons
      .filter(
        item =>
          Boolean(
            pointProgress[
              item.id
            ]
          )
      )
      .length;

  const pendingPoints =
    Object.values(
      pointProgress
    )
      .filter(
        item =>
          item.claim_state ===
          'pending'
      )
      .reduce(
        (sum, item) =>
          sum + item.points,
        0
      );

  const claimedPoints =
    Object.values(
      pointProgress
    )
      .filter(
        item =>
          item.claim_state ===
            'claimed' ||
          item.claim_state ===
            'legacy'
      )
      .reduce(
        (sum, item) =>
          sum + item.points,
        0
      );

  const openLesson =
    (
      lesson:
        AbcLesson
    ) => {
      router.push({
        pathname:
          '/faith/abc/[lessonId]',
        params: {
          lessonId:
            lesson.id,
        },
      } as any);
    };

  return (
    <SafeAreaView
      style={
        styles.screen
      }
    >
      <FlatList
        ListHeaderComponent={
          <>
            <View
              style={
                styles.header
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
                  styles.backButton
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
                  styles.headerCopy
                }
              >
                <Text
                  style={
                    styles.eyebrow
                  }
                >
                  SHOW FAITH · ALL USERS
                </Text>

                <Text
                  style={
                    styles.title
                  }
                >
                  {ABC_SOURCE.title}
                </Text>

                <Text
                  style={
                    styles.subtitle
                  }
                >
                  Sunday school mula A hanggang Z. Bawat tanong ay may talata. Si Hesus ang sentro.
                </Text>
              </View>
            </View>

            <View
              style={
                styles.sourceCard
              }
            >
              <Text
                style={
                  styles.sourceTitle
                }
              >
                {ABC_SOURCE.title}
              </Text>

              <Text
                style={
                  styles.sourceBody
                }
              >
                {ABC_SOURCE.englishTitle}
              </Text>

              <Text
                style={
                  styles.sourceNote
                }
              >
                {ABC_SOURCE.copyright} Sagutin ang bawat tanong mula sa talatang nakakabit. Ang huling sagot ay sarili mong hakbang.
              </Text>
            </View>

            <View
              style={
                styles.progressCard
              }
            >
              <View>
                <Text
                  style={
                    styles.progressLabel
                  }
                >
                  STUDY PROGRESS
                </Text>

                <Text
                  style={
                    styles.progressValue
                  }
                >
                  {completedCount} / {studyLessons.length} completed · {claimedPoints} claimed · {pendingPoints} ready
                </Text>
              </View>

              <MaterialCommunityIcons
                name="book-check-outline"
                size={28}
                color="#2F7A4F"
              />
            </View>

            <View
              style={
                styles.pointsInfoCard
              }
            >
              <MaterialCommunityIcons
                name="star-circle"
                size={24}
                color="#8B6C20"
              />

              <View
                style={
                  styles.pointsInfoCopy
                }
              >
                <Text
                  style={
                    styles.pointsInfoTitle
                  }
                >
                  +5 BUKLOD Points bawat lesson
                </Text>

                <Text
                  style={
                    styles.pointsInfoBody
                  }
                >
                  28 rewardable lessons · one reward per lesson · hanggang 140 points. Pag na-complete, lalabas muna bilang Ready to Claim sa BUKLOD Points.
                </Text>
              </View>
            </View>

            <View
              style={
                styles.searchBox
              }
            >
              <MaterialCommunityIcons
                name="magnify"
                size={21}
                color="#607268"
              />

              <TextInput
                accessibilityLabel="Search ABAKA lessons"
                value={query}
                onChangeText={
                  setQuery
                }
                placeholder="Search lesson title..."
                placeholderTextColor="#839187"
                autoCorrect={false}
                style={
                  styles.searchInput
                }
              />

              {query ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear lesson search"
                  hitSlop={10}
                  onPress={() =>
                    setQuery('')
                  }
                >
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={20}
                    color="#7C8C83"
                  />
                </Pressable>
              ) : null}
            </View>
          </>
        }
        ListHeaderComponentStyle={{ paddingBottom: 10 }}
        data={
          filtered
        }
        keyExtractor={
          item =>
            item.id
        }
        contentContainerStyle={
          styles.listContent
        }
        keyboardShouldPersistTaps="handled"
        renderItem={({
          item,
        }) => {
          const reward =
            pointProgress[
              item.id
            ];

          const isDone =
            item.id ===
              'intro'
              ? Boolean(
                  completed[
                    item.id
                  ]
                )
              : Boolean(
                  reward
                );

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.code}: ${item.title}`}
              onPress={() =>
                openLesson(
                  item
                )
              }
              style={({
                pressed,
              }) => [
                styles.lessonCard,
                pressed &&
                  styles.pressed,
              ]}
            >
              <View
                style={
                  styles.lessonBadge
                }
              >
                <MaterialCommunityIcons
                  name={
                    item.id ===
                    'intro'
                      ? 'information-outline'
                      : isDone
                        ? 'check-circle'
                        : 'book-open-page-variant-outline'
                  }
                  size={22}
                  color={
                    isDone
                      ? '#2F7A4F'
                      : '#536E5D'
                  }
                />
              </View>

              <View
                style={
                  styles.lessonCopy
                }
              >
                <View
                  style={
                    styles.lessonTop
                  }
                >
                  <Text
                    style={
                      styles.lessonCode
                    }
                  >
                    {item.code}
                  </Text>

                  <Text
                    style={
                      styles.pageLabel
                    }
                  >
                    pp. {item.sourcePages[0]}
                    {item.sourcePages[1] !==
                    item.sourcePages[0]
                      ? `–${item.sourcePages[1]}`
                      : ''}
                  </Text>

                  {item.id !==
                  'intro' ? (
                    <View
                      style={[
                        styles.pointsPill,
                        reward &&
                          styles.pointsPillEarned,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pointsPillText,
                          reward &&
                            styles.pointsPillTextEarned,
                        ]}
                      >
                        {reward
                          ? reward.claim_state ===
                            'pending'
                            ? '5 PTS READY'
                            : '5 PTS ✓'
                          : '+5 PTS'}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Text
                  style={
                    styles.lessonTitle
                  }
                >
                  {item.title}
                </Text>

                <Text
                  style={
                    styles.lessonMeta
                  }
                >
                  {item.blocks.length} study blocks · {item.references.length} linked Bible references
                </Text>
              </View>

              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color="#87958D"
              />
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View
            style={
              styles.emptyCard
            }
          >
            <Text
              style={
                styles.emptyTitle
              }
            >
              No lesson found
            </Text>

            <Text
              style={
                styles.emptyBody
              }
            >
              Try another word from the lesson title.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor:
        '#F6F8F5',
    },

    header: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      paddingHorizontal:
        16,
      paddingTop:
        10,
      paddingBottom:
        10,
    },

    backButton: {
      width: 44,
      height: 44,
      borderRadius: 15,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 10,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E0E7E2',
    },

    headerCopy: {
      flex: 1,
      paddingTop: 2,
    },

    eyebrow: {
      color:
        '#2F7A4F',
      fontSize: 10,
      fontWeight:
        '900',
      letterSpacing:
        0.8,
    },

    title: {
      marginTop: 4,
      color:
        '#173A2B',
      fontSize: 23,
      lineHeight: 28,
      fontWeight:
        '900',
    },

    subtitle: {
      marginTop: 4,
      color:
        '#69796F',
      fontSize: 12,
      lineHeight: 18,
    },

    sourceCard: {
      marginHorizontal:
        16,
      padding: 14,
      borderRadius: 18,
      backgroundColor:
        '#EDF7F0',
      borderWidth: 1,
      borderColor:
        '#D7EBDD',
    },

    sourceTitle: {
      color:
        '#244D36',
      fontSize: 14,
      fontWeight:
        '900',
    },

    sourceBody: {
      marginTop: 4,
      color:
        '#496052',
      fontSize: 11,
      lineHeight: 17,
      fontWeight:
        '700',
    },

    sourceNote: {
      marginTop: 8,
      color:
        '#66786B',
      fontSize: 10,
      lineHeight: 15,
    },

    progressCard: {
      marginTop: 10,
      marginHorizontal:
        16,
      minHeight: 66,
      paddingHorizontal:
        15,
      paddingVertical:
        12,
      borderRadius: 18,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E2E8E3',
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
    },

    progressLabel: {
      color:
        '#688075',
      fontSize: 9,
      fontWeight:
        '900',
      letterSpacing:
        0.8,
    },

    progressValue: {
      marginTop: 3,
      color:
        '#203D2F',
      fontSize: 15,
      fontWeight:
        '900',
    },

    pointsInfoCard: {
      marginTop: 9,
      marginHorizontal:
        16,
      padding: 12,
      borderRadius: 17,
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

    pointsInfoCopy: {
      flex: 1,
    },

    pointsInfoTitle: {
      color:
        '#6E5518',
      fontSize: 12,
      fontWeight:
        '900',
    },

    pointsInfoBody: {
      marginTop: 3,
      color:
        '#796B45',
      fontSize: 10,
      lineHeight: 15,
    },

    pointsPill: {
      marginLeft: 5,
      paddingHorizontal:
        7,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor:
        '#FFF7DD',
      borderWidth: 1,
      borderColor:
        '#EEDFAF',
    },

    pointsPillEarned: {
      backgroundColor:
        '#EAF6EE',
      borderColor:
        '#CEE6D5',
    },

    pointsPillText: {
      color:
        '#81641C',
      fontSize: 8,
      fontWeight:
        '900',
      letterSpacing: 0.3,
    },

    pointsPillTextEarned: {
      color:
        '#2F7048',
    },

    searchBox: {
      marginTop: 10,
      marginHorizontal:
        16,
      minHeight: 48,
      paddingHorizontal:
        13,
      borderRadius: 16,
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#DFE7E1',
    },

    searchInput: {
      flex: 1,
      minHeight: 46,
      paddingHorizontal:
        10,
      color:
        '#263D31',
      fontSize: 14,
    },

    listContent: {
      paddingBottom: 36,
    },

    lessonCard: {
      minHeight: 94,
      marginHorizontal: 16,
      marginBottom: 10,
      padding: 13,
      borderRadius: 19,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E2E8E3',
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    pressed: {
      opacity: 0.78,
      transform: [
        {
          scale: 0.995,
        },
      ],
    },

    lessonBadge: {
      width: 44,
      height: 44,
      borderRadius: 15,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#EFF5F0',
      marginRight: 12,
    },

    lessonCopy: {
      flex: 1,
      minWidth: 0,
    },

    lessonTop: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
    },

    lessonCode: {
      color:
        '#2F7A4F',
      fontSize: 10,
      fontWeight:
        '900',
      textTransform:
        'uppercase',
      letterSpacing:
        0.5,
    },

    pageLabel: {
      color:
        '#8A968F',
      fontSize: 9,
      fontWeight:
        '700',
    },

    lessonTitle: {
      marginTop: 4,
      color:
        '#24392E',
      fontSize: 15,
      lineHeight: 20,
      fontWeight:
        '900',
    },

    lessonMeta: {
      marginTop: 5,
      color:
        '#75847B',
      fontSize: 10,
      lineHeight: 15,
    },

    emptyCard: {
      marginHorizontal: 16,
      padding: 24,
      borderRadius: 18,
      alignItems:
        'center',
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E3E9E5',
    },

    emptyTitle: {
      color:
        '#304438',
      fontSize: 15,
      fontWeight:
        '900',
    },

    emptyBody: {
      marginTop: 5,
      color:
        '#78867E',
      fontSize: 11,
    },
  });
