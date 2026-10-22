import BuklodNonMediaBanner from '@/components/BuklodNonMediaBanner';
/* PATCH_185C_WEEKLY_WORD — root stack route (reachable from scoped workspace) */
import {
  useMemo,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  router,
} from 'expo-router';

import { useBuklodOfflineCache } from '@/hooks/useBuklodOfflineCache';
import { useAuth } from '@/providers/AuthProvider';
import { useNetwork } from '@/providers/NetworkProvider';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';

import {
  Card,
  SectionTitle,
  shared,
} from '@/components/UI';
import BuklodClusterMembershipGate from '@/components/BuklodClusterMembershipGate';
import {
  supabase,
} from '@/lib/supabase';
import {
  colors,
} from '@/lib/theme';

type WordItem = {
  id: string;
  title: string;
  bible_passage: string | null;
  publish_date: string | null;
};

function toLocalDateKey(
  value: Date,
) {
  const year =
    value.getFullYear();

  const month =
    String(
      value.getMonth() + 1,
    ).padStart(
      2,
      '0',
    );

  const day =
    String(
      value.getDate(),
    ).padStart(
      2,
      '0',
    );

  return `${year}-${month}-${day}`;
}

function startOfCurrentWeek() {
  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0,
  );

  const day =
    today.getDay();

  /*
   * Monday = first day of BUKLOD Word week.
   * Sunday belongs to the week that started six days earlier.
   */
  const diff =
    day === 0
      ? -6
      : 1 - day;

  const monday =
    new Date(today);

  monday.setDate(
    today.getDate() +
      diff,
  );

  return monday;
}

function humanDate(
  value:
    | string
    | null,
) {
  if (!value) {
    return 'Scheduled Word';
  }

  const date =
    new Date(
      value + 'T00:00:00',
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return date.toLocaleDateString(
    undefined,
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    },
  );
}

export default function WordScreen() {
  const { profile } = useAuth();
  const { isConnected, isInternetReachable } = useNetwork();
  const online = Boolean(isConnected && isInternetReachable !== false);
  const accountId = String(profile?.id ?? '');
  const { data, loading, error } = useBuklodOfflineCache<WordItem[]>({
    cacheKey: accountId ? `word-list:${accountId}:${toLocalDateKey(startOfCurrentWeek())}` : '',
    enabled: Boolean(accountId),
    fetcher: async () => {
      const result = await withBuklodTimeout<any>(
        supabase.from('devotionals')
          .select('id,title,bible_passage,publish_date')
          .eq('is_published', true)
          .not('publish_date', 'is', null)
          .lte('publish_date', toLocalDateKey(new Date()))
          .order('publish_date', { ascending: false })
          .limit(40),
        7000, 'Devotion list');
      if (result.error) throw result.error;
      return (result.data ?? []) as WordItem[];
    },
  });
  const items = data ?? [];
  const mondayKey =
    useMemo(
      () =>
        toLocalDateKey(
          startOfCurrentWeek(),
        ),
      [],
    );

  const weeklyWord =
    useMemo(
      () => {
        const thisWeek =
          items
            .filter(
              item =>
                !!item.publish_date &&
                item.publish_date >=
                  mondayKey,
            )
            .slice()
            .sort(
              (a, b) =>
                String(
                  a.publish_date,
                ).localeCompare(
                  String(
                    b.publish_date,
                  ),
                ),
            );

        return (
          thisWeek[0] ??
          items[0] ??
          null
        );
      },
      [
        items,
        mondayKey,
      ],
    );

  const archive =
    useMemo(
      () =>
        items
          .filter(
            item =>
              item.id !==
              weeklyWord?.id,
          )
          .slice(
            0,
            12,
          ),
      [
        items,
        weeklyWord?.id,
      ],
    );

  const openWord =
    (
      item: WordItem,
    ) => {
      if (!online) return;
      router.push(
        `/devotional/${item.id}`,
      );
    };

  return (
    <BuklodClusterMembershipGate allowPublishedCachedPreview={!online && items.length > 0} title="Join a Cluster to use Daily Devotion">
    <View
      style={
        shared.screen
      }
    >
      {!!error && <Text style={{ color: colors.green }}>
        {data ? 'Showing saved Word. Update could not load right now.' : 'Word could not load right now. Try again when connected.'}
      </Text>}
      {loading && !data ? (
        <View
          style={
            styles.loading
          }
        >
          <ActivityIndicator
            color={
              colors.green
            }
          />

          <Text
            style={
              styles.loadingText
            }
          >
            Preparing this week's Word...
          </Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={[
            shared.content,
            {
              paddingBottom:
                46,
            },
          ]}
          data={
            archive
          }
          keyExtractor={
            item =>
              item.id
          }
          ListHeaderComponent={
            <View>
              <Text
                style={
                  styles.eyebrow
                }
              >
                THE WORD · THIS WEEK
              </Text>

              <Text
                style={
                  shared.h1
                }
              >
                The Word
              </Text>

              <Text
                style={[
                  shared.muted,
                  {
                    marginTop: 5,
                    marginBottom:
                      14,
                  },
                ]}
              >
                Automatically follows the published Word schedule. A new weekly Word appears when its scheduled week begins.
              </Text>

              {weeklyWord ? (
                <Pressable
                  disabled={!online}
                  onPress={() =>
                    openWord(
                      weeklyWord,
                    )
                  }
                >
                  <Card>
                    <View
                      style={
                        styles.weeklyBadge
                      }
                    >
                      <Text
                        style={
                          styles.weeklyBadgeText
                        }
                      >
                        THIS WEEK'S WORD
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.passage
                      }
                    >
                      {
                        weeklyWord.bible_passage ||
                        'Scripture'
                      }
                    </Text>

                    <Text
                      style={[
                        shared.h1,
                        {
                          marginTop:
                            6,
                        },
                      ]}
                    >
                      {
                        weeklyWord.title
                      }
                    </Text>

                    <Text
                      style={[
                        shared.muted,
                        {
                          marginTop:
                            7,
                        },
                      ]}
                    >
                      Scheduled {
                        humanDate(
                          weeklyWord.publish_date,
                        )
                      }
                    </Text>

                    <View
                      style={
                        styles.openRow
                      }
                    >
                      <Text
                        style={
                          styles.openText
                        }
                      >
                        OPEN THIS WEEK'S WORD
                      </Text>

                      <Text
                        style={
                          styles.chevron
                        }
                      >
                        ›
                      </Text>
                    </View>
                  </Card>
                </Pressable>
              ) : (
                <Card>
                  <Text
                    style={
                      shared.h2
                    }
                  >
                    No published Word yet
                  </Text>

                  <Text
                    style={[
                      shared.muted,
                      {
                        marginTop:
                          6,
                      },
                    ]}
                  >
                    The next Word will appear automatically after an admin publishes and schedules it.
                  </Text>
                </Card>
              )}

              {archive.length >
                0 && (
                <SectionTitle>
                  PREVIOUS WORD
                </SectionTitle>
              )}
            </View>
          }
          renderItem={({
            item, index,
          }) => (
            <>
            <Pressable
              disabled={!online}
              onPress={() =>
                openWord(
                  item,
                )
              }
            >
              <Card>
                <Text
                  style={
                    shared.h2
                  }
                >
                  {
                    item.title
                  }
                </Text>

                <Text
                  style={[
                    shared.muted,
                    {
                      marginTop:
                        5,
                    },
                  ]}
                >
                  {
                    item.bible_passage ||
                    'Scripture'
                  } · {
                    humanDate(
                      item.publish_date,
                    )
                  }
                </Text>
              </Card>
            </Pressable>
            {index === 3 && archive.length > 4 ? <BuklodNonMediaBanner placementId="devotion_list_inline" /> : null}
            </>
          )}
        />
      )}
    </View>
    </BuklodClusterMembershipGate>
  );
}

const styles =
  StyleSheet.create({
    loading: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      padding: 24,
    },
    loadingText: {
      marginTop: 10,
      color: colors.muted,
      fontSize: 12,
      fontWeight: '700',
    },
    eyebrow: {
      color:
        colors.greenDark,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1,
      marginBottom: 5,
    },
    weeklyBadge: {
      alignSelf:
        'flex-start',
      borderRadius: 999,
      paddingHorizontal:
        10,
      paddingVertical:
        6,
      backgroundColor:
        'rgba(39,93,69,0.10)',
      marginBottom: 12,
    },
    weeklyBadgeText: {
      color:
        colors.greenDark,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing:
        0.7,
    },
    passage: {
      color:
        colors.green,
      fontSize: 12,
      fontWeight: '900',
    },
    openRow: {
      marginTop: 15,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor:
        colors.line,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
    },
    openText: {
      color:
        colors.greenDark,
      fontSize: 10,
      fontWeight: '900',
    },
    chevron: {
      color:
        colors.greenDark,
      fontSize: 24,
      fontWeight: '700',
      lineHeight: 24,
    },
  });
