/**
 * PATCH 153H-3C
 * MY BIBLE READING REPORT
 *
 * Personal engagement report only.
 * This is NOT a spirituality score.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';

import {
  Card,
  SectionTitle,
  shared,
} from '@/components/UI';


type Period =
  | 'today'
  | 'week'
  | 'month'
  | 'all';


type ReadingReport = {
  period: string;

  sessions_started: number | string;
  chapters_completed: number | string;

  books_explored: number | string;

  daily_plan_completed: number | string;
  free_reading_completed: number | string;
  search_reading_completed: number | string;

  current_streak_days: number | string;

  last_read_at: string | null;
  last_reference: string | null;
};


type RecentReading = {
  session_id: string;

  translation_code: string;
  translation_title: string;

  book_no: number;
  book_name: string;
  chapter_no: number;

  bible_reference: string;

  source: string;

  started_at: string;
  completed_at: string | null;

  is_completed: boolean;
};


type DailyActivity = {
  reading_date: string;

  sessions_started: number | string;
  chapters_completed: number | string;

  daily_plan_completed: number | string;
  free_reading_completed: number | string;
};


const periods: {
  key: Period;
  label: string;
}[] = [
  {
    key: 'today',
    label: 'TODAY',
  },
  {
    key: 'week',
    label: 'WEEK',
  },
  {
    key: 'month',
    label: 'MONTH',
  },
  {
    key: 'all',
    label: 'ALL',
  },
];


const n = (
  value:
    | number
    | string
    | null
    | undefined
) => Number(value ?? 0);


const dateLabel = (
  iso: string | null | undefined
) => {
  if (!iso) return '—';

  const d = new Date(iso);

  return d.toLocaleDateString(
    undefined,
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }
  );
};


const sourceLabel = (
  source: string
) => {
  if (source === 'daily_plan') {
    return 'DAILY PLAN';
  }

  if (source === 'search') {
    return 'SEARCH';
  }

  return 'FREE READING';
};


export default function BibleReadingReportScreen() {
  const [period, setPeriod] =
    useState<Period>('week');

  const [report, setReport] =
    useState<ReadingReport | null>(
      null
    );

  const [recent, setRecent] =
    useState<RecentReading[]>([]);

  const [activity, setActivity] =
    useState<DailyActivity[]>([]);

  const [loading, setLoading] =
    useState(true);


  const load = useCallback(
    async () => {

      setLoading(true);

      try {
        const [
          reportResult,
          recentResult,
          activityResult,
        ] = await Promise.all([
          (supabase as any).rpc(
            'get_my_bible_reading_report',
            {
              p_period:
                period,
            }
          ),

          (supabase as any).rpc(
            'get_my_recent_bible_reading',
            {
              p_limit: 20,
            }
          ),

          (supabase as any).rpc(
            'get_my_bible_reading_daily_activity',
            {
              p_days: 30,
            }
          ),
        ]);


        if (reportResult.error) {
          throw reportResult.error;
        }

        if (recentResult.error) {
          throw recentResult.error;
        }

        if (activityResult.error) {
          throw activityResult.error;
        }


        const reportRow =
          Array.isArray(
            reportResult.data
          )
            ? reportResult.data[0]
            : reportResult.data;


        setReport(
          (
            reportRow ??
            null
          ) as ReadingReport | null
        );


        setRecent(
          (
            recentResult.data ??
            []
          ) as RecentReading[]
        );


        setActivity(
          (
            activityResult.data ??
            []
          ) as DailyActivity[]
        );

      } catch (e: any) {
        Alert.alert(
          'Bible Reading Report',
          e?.message ??
            'Unable to load your Bible Reading Report.'
        );

      } finally {
        setLoading(false);
      }

    },
    [period]
  );


  useEffect(() => {
    load();
  }, [load]);


  const recentIncomplete =
    useMemo(
      () =>
        recent.find(
          item =>
            !item.is_completed
        ),
      [recent]
    );


  const mostRecent =
    recent[0];


  const openReading =
    (
      item: RecentReading
    ) => {

      router.push({
        pathname:
          '/bible/read',

        params: {
          translation:
            item.translation_code,

          book:
            String(
              item.book_no
            ),

          chapter:
            String(
              item.chapter_no
            ),

          source:
            item.source ===
            'daily_plan'
              ? 'daily_plan'
              : 'free_reading',
        },
      });
    };


  const activityByDate =
    useMemo(() => {

      const map =
        new Map<
          string,
          DailyActivity
        >();


      for (
        const item
        of activity
      ) {
        map.set(
          item.reading_date,
          item
        );
      }


      return map;

    }, [activity]);


  const last30Days =
    useMemo(() => {

      const items: string[] =
        [];

      const today =
        new Date();

      today.setHours(
        12,
        0,
        0,
        0
      );


      for (
        let offset = 29;
        offset >= 0;
        offset--
      ) {
        const d =
          new Date(today);

        d.setDate(
          d.getDate() -
            offset
        );

        const key =
          `${d.getFullYear()}-${String(
            d.getMonth() + 1
          ).padStart(
            2,
            '0'
          )}-${String(
            d.getDate()
          ).padStart(
            2,
            '0'
          )}`;

        items.push(key);
      }


      return items;

    }, []);


  return (
    <ScrollView
      style={shared.screen}
      contentContainerStyle={[
        shared.content,
        styles.content,
      ]}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={shared.h1}>
            My Bible Report
          </Text>

          <Text style={shared.muted}>
            Your personal Bible reading activity and progress.
          </Text>
        </View>

        <Pressable
          onPress={() =>
            router.back()
          }
          style={styles.outline}
        >
          <Text
            style={
              styles.outlineText
            }
          >
            BACK
          </Text>
        </Pressable>
      </View>


      {/* =====================================================
          PERIOD
      ====================================================== */}

      <View style={styles.periodRow}>
        {periods.map(
          item => {

            const active =
              item.key === period;

            return (
              <Pressable
                key={item.key}
                onPress={() =>
                  setPeriod(
                    item.key
                  )
                }
                style={[
                  styles.period,
                  active &&
                    styles.periodActive,
                ]}
              >
                <Text
                  style={[
                    styles.periodText,
                    active &&
                      styles.periodTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          }
        )}
      </View>


      {loading ? (
        <Card>
          <View style={styles.loading}>
            <ActivityIndicator />

            <Text
              style={[
                shared.muted,
                {
                  marginTop: 8,
                },
              ]}
            >
              Loading report...
            </Text>
          </View>
        </Card>

      ) : (
        <>
          {/* =================================================
              SUMMARY
          ================================================== */}

          <View style={styles.statsGrid}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {n(
                  report?.current_streak_days
                )}
              </Text>

              <Text style={styles.statLabel}>
                DAY STREAK
              </Text>
            </View>


            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {n(
                  report?.chapters_completed
                )}
              </Text>

              <Text style={styles.statLabel}>
                CHAPTERS READ
              </Text>
            </View>


            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {n(
                  report?.books_explored
                )}
              </Text>

              <Text style={styles.statLabel}>
                BOOKS EXPLORED
              </Text>
            </View>


            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {n(
                  report?.sessions_started
                )}
              </Text>

              <Text style={styles.statLabel}>
                READING SESSIONS
              </Text>
            </View>
          </View>


          {/* =================================================
              CONTINUE READING
          ================================================== */}

          <SectionTitle>
            CONTINUE READING
          </SectionTitle>


          <Card>
            {recentIncomplete ? (
              <>
                <Text style={styles.eyebrow}>
                  PICK UP WHERE YOU LEFT OFF
                </Text>

                <Text style={styles.continueTitle}>
                  {
                    recentIncomplete.bible_reference
                  }
                </Text>

                <Text style={styles.continueMeta}>
                  {
                    recentIncomplete.translation_title
                  }
                  {' · '}
                  {
                    sourceLabel(
                      recentIncomplete.source
                    )
                  }
                </Text>

                <Pressable
                  onPress={() =>
                    openReading(
                      recentIncomplete
                    )
                  }
                  style={styles.primaryButton}
                >
                  <Text
                    style={
                      styles.primaryButtonText
                    }
                  >
                    CONTINUE READING ›
                  </Text>
                </Pressable>
              </>

            ) : mostRecent ? (
              <>
                <Text style={styles.eyebrow}>
                  READ AGAIN OR CONTINUE
                </Text>

                <Text style={styles.continueTitle}>
                  {
                    mostRecent.bible_reference
                  }
                </Text>

                <Text style={styles.continueMeta}>
                  {
                    mostRecent.translation_title
                  }
                </Text>

                <Pressable
                  onPress={() =>
                    openReading(
                      mostRecent
                    )
                  }
                  style={styles.primaryButton}
                >
                  <Text
                    style={
                      styles.primaryButtonText
                    }
                  >
                    OPEN BIBLE ›
                  </Text>
                </Pressable>
              </>

            ) : (
              <>
                <Text style={shared.h2}>
                  Start Reading
                </Text>

                <Text
                  style={[
                    shared.muted,
                    {
                      marginTop: 7,
                    },
                  ]}
                >
                  Your recent Bible reading will appear here.
                </Text>

                <Pressable
                  onPress={() =>
                    router.push(
                      '/bible/read'
                    )
                  }
                  style={styles.primaryButton}
                >
                  <Text
                    style={
                      styles.primaryButtonText
                    }
                  >
                    OPEN BIBLE ›
                  </Text>
                </Pressable>
              </>
            )}
          </Card>


          {/* =================================================
              READING BREAKDOWN
          ================================================== */}

          <SectionTitle>
            READING BREAKDOWN
          </SectionTitle>


          <Card>
            <BreakdownRow
              label="Daily Plan"
              value={n(
                report?.daily_plan_completed
              )}
            />

            <BreakdownRow
              label="Free Reading"
              value={n(
                report?.free_reading_completed
              )}
            />

            <BreakdownRow
              label="Opened from Search"
              value={n(
                report?.search_reading_completed
              )}
              last
            />
          </Card>


          {/* =================================================
              30-DAY ACTIVITY
          ================================================== */}

          <SectionTitle>
            LAST 30 DAYS
          </SectionTitle>


          <Card>
            <View
              style={
                styles.activityGrid
              }
            >
              {last30Days.map(
                date => {

                  const item =
                    activityByDate.get(
                      date
                    );

                  const completed =
                    n(
                      item?.chapters_completed
                    );


                  return (
                    <View
                      key={date}
                      style={[
                        styles.activityDay,

                        completed > 0 &&
                          styles.activityDayRead,

                        completed > 1 &&
                          styles.activityDayStrong,
                      ]}
                    />
                  );
                }
              )}
            </View>


            <View
              style={
                styles.activityLegend
              }
            >
              <Text
                style={
                  styles.legendText
                }
              >
                No completed chapter
              </Text>

              <View
                style={
                  styles.legendRight
                }
              >
                <View
                  style={[
                    styles.legendBox,
                    styles.activityDayRead,
                  ]}
                />

                <Text
                  style={
                    styles.legendText
                  }
                >
                  Read
                </Text>
              </View>
            </View>
          </Card>


          {/* =================================================
              LAST READING
          ================================================== */}

          <SectionTitle>
            LAST READING
          </SectionTitle>


          <Card>
            <Text style={styles.lastReference}>
              {
                report?.last_reference ??
                'No reading yet'
              }
            </Text>

            <Text style={styles.lastDate}>
              {
                report?.last_read_at
                  ? dateLabel(
                      report.last_read_at
                    )
                  : 'Your reading activity will appear here.'
              }
            </Text>
          </Card>


          {/* =================================================
              RECENT HISTORY
          ================================================== */}

          <SectionTitle>
            RECENT READING HISTORY
          </SectionTitle>


          {!recent.length ? (
            <Card>
              <Text style={shared.h2}>
                No recent reading
              </Text>

              <Text
                style={[
                  shared.muted,
                  {
                    marginTop: 7,
                  },
                ]}
              >
                Open the Bible and start reading any chapter.
              </Text>
            </Card>

          ) : (
            recent.map(
              item => (
                <Pressable
                  key={
                    item.session_id
                  }
                  onPress={() =>
                    openReading(
                      item
                    )
                  }
                >
                  <Card>
                    <View
                      style={
                        styles.historyHeader
                      }
                    >
                      <View
                        style={{
                          flex: 1,
                        }}
                      >
                        <Text
                          style={
                            styles.historyReference
                          }
                        >
                          {
                            item.bible_reference
                          }
                        </Text>

                        <Text
                          style={
                            styles.historyMeta
                          }
                        >
                          {
                            item.translation_title
                          }
                          {' · '}
                          {
                            sourceLabel(
                              item.source
                            )
                          }
                        </Text>
                      </View>


                      <View
                        style={[
                          styles.statusBadge,

                          item.is_completed
                            ? styles.statusDone
                            : styles.statusOpen,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,

                            item.is_completed
                              ? styles.statusDoneText
                              : styles.statusOpenText,
                          ]}
                        >
                          {
                            item.is_completed
                              ? 'READ'
                              : 'CONTINUE'
                          }
                        </Text>
                      </View>
                    </View>


                    <Text
                      style={
                        styles.historyDate
                      }
                    >
                      {
                        dateLabel(
                          item.started_at
                        )
                      }
                    </Text>
                  </Card>
                </Pressable>
              )
            )
          )}


          <Card>
            <Text
              style={
                styles.disclaimer
              }
            >
              Your Bible Reading Report is designed to help you build a consistent habit of reading Scripture. It is an activity record, not a measure of spirituality, faith, maturity, or church authority.
            </Text>
          </Card>
        </>
      )}
    </ScrollView>
  );
}


function BreakdownRow(
  props: {
    label: string;
    value: number;
    last?: boolean;
  }
) {
  return (
    <View
      style={[
        styles.breakdownRow,

        props.last &&
          styles.breakdownRowLast,
      ]}
    >
      <Text
        style={
          styles.breakdownLabel
        }
      >
        {props.label}
      </Text>

      <Text
        style={
          styles.breakdownValue
        }
      >
        {props.value}
      </Text>
    </View>
  );
}


const styles =
  StyleSheet.create({

    content: {
      paddingBottom: 50,
      gap: 14,
    },


    header: {
      flexDirection: 'row',
      gap: 12,
      alignItems:
        'flex-start',
    },


    outline: {
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderWidth: 1,
      borderColor:
        '#D7DFDA',
      borderRadius: 12,
    },


    outlineText: {
      fontSize: 11,
      fontWeight: '900',
      color: '#275D45',
    },


    periodRow: {
      flexDirection: 'row',
      gap: 6,
    },


    period: {
      flex: 1,
      minHeight: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor:
        '#D9E1DC',
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        '#FFF',
    },


    periodActive: {
      borderColor:
        '#275D45',
      backgroundColor:
        '#275D45',
    },


    periodText: {
      fontSize: 8.5,
      fontWeight: '900',
      color: '#65746C',
    },


    periodTextActive: {
      color: '#FFF',
    },


    loading: {
      minHeight: 120,
      alignItems: 'center',
      justifyContent:
        'center',
    },


    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },


    stat: {
      width: '48.7%',
      minHeight: 95,
      borderRadius: 17,
      borderWidth: 1,
      borderColor:
        '#DCE5E0',
      backgroundColor:
        '#FFF',
      alignItems: 'center',
      justifyContent:
        'center',
      padding: 12,
    },


    statValue: {
      fontSize: 27,
      fontWeight: '900',
      color: '#275D45',
    },


    statLabel: {
      marginTop: 3,
      fontSize: 8.5,
      fontWeight: '900',
      color: '#79867F',
      textAlign: 'center',
    },


    eyebrow: {
      fontSize: 8.5,
      fontWeight: '900',
      color: '#748279',
      letterSpacing: 0.7,
    },


    continueTitle: {
      marginTop: 5,
      fontSize: 23,
      fontWeight: '900',
      color: '#233B2F',
    },


    continueMeta: {
      marginTop: 3,
      fontSize: 10,
      color: '#7A867F',
    },


    primaryButton: {
      marginTop: 15,
      minHeight: 48,
      borderRadius: 14,
      backgroundColor:
        '#275D45',
      alignItems: 'center',
      justifyContent:
        'center',
    },


    primaryButtonText: {
      fontSize: 10,
      fontWeight: '900',
      color: '#FFF',
    },


    breakdownRow: {
      minHeight: 49,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor:
        '#EDF1EE',
    },


    breakdownRowLast: {
      borderBottomWidth: 0,
    },


    breakdownLabel: {
      flex: 1,
      fontSize: 12,
      fontWeight: '700',
      color: '#45594E',
    },


    breakdownValue: {
      fontSize: 18,
      fontWeight: '900',
      color: '#275D45',
    },


    activityGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },


    activityDay: {
      width: 21,
      height: 21,
      borderRadius: 6,
      backgroundColor:
        '#E9EEEB',
      borderWidth: 1,
      borderColor:
        '#E0E6E2',
    },


    activityDayRead: {
      backgroundColor:
        '#A9C7B7',
      borderColor:
        '#94B7A4',
    },


    activityDayStrong: {
      backgroundColor:
        '#4F8068',
      borderColor:
        '#4F8068',
    },


    activityLegend: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },


    legendRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },


    legendBox: {
      width: 13,
      height: 13,
      borderRadius: 4,
    },


    legendText: {
      fontSize: 8.5,
      color: '#7A867F',
    },


    lastReference: {
      fontSize: 21,
      fontWeight: '900',
      color: '#274334',
    },


    lastDate: {
      marginTop: 4,
      fontSize: 10,
      color: '#7C8881',
    },


    historyHeader: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
    },


    historyReference: {
      fontSize: 16,
      fontWeight: '900',
      color: '#294535',
    },


    historyMeta: {
      marginTop: 3,
      fontSize: 9,
      color: '#7B8880',
    },


    historyDate: {
      marginTop: 10,
      fontSize: 9,
      color: '#89948E',
    },


    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 9,
    },


    statusDone: {
      backgroundColor:
        '#E8F3EC',
    },


    statusOpen: {
      backgroundColor:
        '#F6F1E4',
    },


    statusText: {
      fontSize: 7.5,
      fontWeight: '900',
    },


    statusDoneText: {
      color: '#33704F',
    },


    statusOpenText: {
      color: '#876C29',
    },


    disclaimer: {
      fontSize: 10,
      lineHeight: 16,
      textAlign: 'center',
      color: '#748078',
    },
  });