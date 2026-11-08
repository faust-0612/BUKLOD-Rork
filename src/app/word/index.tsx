/* PATCH_185C_WEEKLY_WORD — root stack route (reachable from scoped workspace) */
import {
  useCallback,
  useMemo,
  useState,
  useRef,
} from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  router,
  useFocusEffect,
} from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { useAuth } from '@/providers/AuthProvider';
import { useNetwork } from '@/providers/NetworkProvider';
import { getOfflineCache, setOfflineCache } from '@/lib/offlineCache';
import {
  selectCurrentWeekWord,
  selectPreviousWords,
} from '@/lib/buklodWordSchedule';

type WordItem = {
  id: string;
  title: string;
  bible_passage: string | null;
  publish_date: string | null;
  sort_order?: number | null;
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
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const accountId = user?.id ?? '';
  const { online } = useNetwork();
  const request = useRef(0);
  const [items, setItems] = useState<WordItem[]>([]);
  const [itemsOwner, setItemsOwner] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const visibleItems = itemsOwner === accountId ? items : [];

  const load = useCallback(async () => {
    const token = ++request.current;
    const current = () => token === request.current;
    if (!accountId) {
      setItems([]);
      setItemsOwner('');
      setLoadError('Sign in to read saved Word content.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError('');
    const cached = await getOfflineCache<WordItem[]>('word-published-v1', {
      userId: accountId, allowStale: true,
    });
    if (!current()) return;
    const saved = Array.isArray(cached?.data) ? cached.data : [];
    if (saved.length) {
      setItems(saved);
      setItemsOwner(accountId);
      setLoading(false);
    }
    if (!online) {
      if (!saved.length) setLoadError('No saved Word on this device yet. Connect once to download it.');
      setLoading(false);
      return;
    }
    try {
      const todayKey = toLocalDateKey(new Date());
      const { data, error } = await supabase.from('devotionals')
        .select('id,title,bible_passage,publish_date,sort_order')
        .eq('is_published', true).not('publish_date', 'is', null)
        .lte('publish_date', todayKey)
        .order('publish_date', { ascending: false })
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true }).limit(40);
      if (error) throw error;
      if (!current()) return;
      const next = (data ?? []) as WordItem[];
      setItems(next);
      setItemsOwner(accountId);
      void setOfflineCache('word-published-v1', next, {
        userId: accountId, ttlMs: 14 * 24 * 60 * 60 * 1000,
      }).catch(() => undefined);
      // Warm only the latest published daily Word in the current week.
      const weekKey = toLocalDateKey(startOfCurrentWeek());
      const weekly = selectCurrentWeekWord(next, weekKey, todayKey);
      if (weekly) {
        void Promise.resolve(supabase.from('devotionals').select('*')
          .eq('id', weekly.id).eq('is_published', true).single())
          .then(({data: detail, error: detailError}) => {
            if (!detailError && detail && current()) {
              void setOfflineCache('word-full:' + weekly.id, detail, {
                userId: accountId, ttlMs: 30 * 24 * 60 * 60 * 1000,
              }).catch(() => undefined);
            }
          }).catch(() => undefined);
      }
    } catch {
      if (current()) setLoadError(saved.length
        ? 'Connection unavailable. Showing your last saved Word.'
        : 'Word is unavailable until a published reading can be downloaded.');
    } finally {
      if (current()) setLoading(false);
    }
  }, [accountId, online]);

  // Refresh on revisit, app foreground return, and the local day boundary.
  // This is one scheduled refresh per day, not a background polling loop.
  useFocusEffect(useCallback(() => {
    let active = true;
    let dailyRefreshTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextDayRefresh = () => {
      const now = new Date();
      const nextDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        2,
      );
      dailyRefreshTimer = setTimeout(() => {
        if (!active) return;
        void load();
        scheduleNextDayRefresh();
      }, Math.max(1000, nextDay.getTime() - now.getTime()));
    };

    void load();
    scheduleNextDayRefresh();

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void load();
    });

    return () => {
      active = false;
      if (dailyRefreshTimer) clearTimeout(dailyRefreshTimer);
      subscription.remove();
      request.current += 1;
    };
  }, [load]));

  const todayKey = toLocalDateKey(new Date());
  const mondayKey = toLocalDateKey(startOfCurrentWeek());

  const weeklyWord = useMemo(
    () => selectCurrentWeekWord(visibleItems, mondayKey, todayKey),
    [visibleItems, mondayKey, todayKey],
  );

  const archive = useMemo(
    () => selectPreviousWords(visibleItems, weeklyWord, todayKey, 12),
    [visibleItems, weeklyWord, todayKey],
  );

  const openWord =
    (
      item: WordItem,
    ) => {
      router.push(
        `/devotional/${item.id}`,
      );
    };

  return (
    <BuklodClusterMembershipGate title="Join a Cluster to use Daily Devotion">
    <View
      style={[
        shared.screen,
        { paddingTop: insets.top },
      ]}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="My devotional submissions and revisions"
          onPress={() => router.push('/devotional/submissions' as any)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13,
            backgroundColor: '#EAF6EE', borderWidth: 1, borderColor: '#C9E2D1', borderRadius: 12 }}
        >
          <Text style={{ flex: 1, color: '#186342', fontWeight: '900', fontSize: 13 }}>
            My Devotional Submissions · Check Revisions
          </Text>
          <Text style={{ color: '#186342', fontWeight: '900' }}>›</Text>
        </Pressable>
      </View>
      {!!loadError && <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <Text style={shared.muted}>{loadError}</Text>
        {online && <Pressable accessibilityRole="button" onPress={() => void load()}>
          <Text style={{ color: colors.green, fontWeight: '800', marginTop: 8 }}>RETRY</Text>
        </Pressable>}
      </View>}
      {loading && !visibleItems.length ? (
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
                Publishes a new Word each day according to the published schedule. The latest Word for the current week appears first; earlier days remain in Previous Words.
              </Text>

              {weeklyWord ? (
                <Pressable
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
                    No Word published this week yet
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
                    Previous published Words remain below. This section updates automatically when an admin publishes a Word scheduled for this week.
                  </Text>
                </Card>
              )}

              {archive.length >
                0 && (
                <SectionTitle>
                  PREVIOUS WORDS
                </SectionTitle>
              )}
            </View>
          }
          renderItem={({
            item,
          }) => (
            <Pressable
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
