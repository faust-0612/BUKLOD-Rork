import React, {
  useEffect,
  useState,
} from 'react';

import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  router,
} from 'expo-router';


import {
  supabase,
} from '@/lib/supabase';

import {
  colors,
} from '@/lib/theme';

import MzbRandomWallPhoto
  from '@/components/MzbRandomWallPhoto';

/* PATCH_173B_MZB_HOME_REDESIGN */

function money(
  value: number,
) {
  return Number(value || 0)
    .toLocaleString(
      'en-PH',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    );
}

/* PATCH_184D_MZB_HOME_CLEANUP */
export default function
MzbHomeScreen() {
  const [
    bayanihanBalance,
    setBayanihanBalance,
  ] =
    useState<number | null>(
      null,
    );

  const [
    balanceLoading,
    setBalanceLoading,
  ] =
    useState(true);

  const [
    reading,
    setReading,
  ] =
    useState<{
      reading_date?: string;
      bible_reference: string;
      chapters_today: number;
    } | null>(
      null,
    );

  const [
    readingLoading,
    setReadingLoading,
  ] =
    useState(true);

  /* PATCH_173C_R2_RANDOM_ASD_VERSE */
  const [
    randomVerse,
    setRandomVerse,
  ] =
    useState<{
      book_no: number;
      book_name: string;
      chapter_no: number;
      verse_no: number;
      verse_text: string;
    } | null>(null);

  const [
    randomVerseLoading,
    setRandomVerseLoading,
  ] =
    useState(true);

  useEffect(() => {
    let active = true;

    const load =
      async () => {
        try {
          const [
            bibleResult,
            balanceResult,
          ] =
            await Promise.all([
              (
                supabase as any
              ).rpc(
                'get_automatic_bible_today',
              ),
              (
                supabase as any
              ).rpc(
                'get_my_bayanihan_current_balance_v1',
              ),
            ]);

          if (!active) {
            return;
          }

          const bibleRaw =
            Array.isArray(
              bibleResult.data,
            )
              ? bibleResult
                  .data[0] ??
                null
              : bibleResult
                  .data ??
                null;

          if (bibleRaw) {
            setReading({
              reading_date:
                bibleRaw
                  .reading_date
                  ? String(
                      bibleRaw
                        .reading_date,
                    )
                  : undefined,
              bible_reference:
                String(
                  bibleRaw
                    .bible_reference ??
                    'Daily Bible Reading',
                ),
              chapters_today:
                Number(
                  bibleRaw
                    .chapters_today ??
                    1,
                ),
            });
          }
          else {
            setReading(null);
          }

          const balanceRaw =
            Array.isArray(
              balanceResult.data,
            )
              ? balanceResult
                  .data[0] ??
                null
              : balanceResult
                  .data;

          if (
            balanceResult.error
          ) {
            console.warn(
              'MZB Home Bayanihan:',
              balanceResult
                .error
                .message,
            );

            setBayanihanBalance(
              null,
            );
          }
          else {
            const value =
              balanceRaw &&
              typeof balanceRaw ===
                'object'
                ? (
                    balanceRaw
                      .current_balance ??
                    balanceRaw
                      .balance ??
                    0
                  )
                : (
                    balanceRaw ??
                    0
                  );

            const numeric =
              Number(value);

            setBayanihanBalance(
              Number.isFinite(
                numeric,
              )
                ? numeric
                : 0,
            );
          }
        }
        catch (error: any) {
          if (!active) {
            return;
          }

          console.warn(
            'MZB Home load:',
            error?.message ??
              error,
          );

          setReading(null);
          setBayanihanBalance(
            null,
          );
        }
        finally {
          if (active) {
            setReadingLoading(
              false,
            );
            setBalanceLoading(
              false,
            );
          }
        }
      };

    const loadRandomVerse =
      async () => {
        try {
          setRandomVerseLoading(true);

          const countResult =
            await (
              supabase as any
            )
              .from(
                'bible_verses',
              )
              .select(
                'verse_no',
                {
                  count: 'exact',
                  head: true,
                },
              )
              .eq(
                'translation_code',
                'ASD',
              );

          if (
            countResult.error
          ) {
            throw countResult.error;
          }

          const total =
            Number(
              countResult.count ??
                0,
            );

          if (
            !Number.isFinite(total) ||
            total <= 0
          ) {
            throw new Error(
              'No ASD verses available.',
            );
          }

          const offset =
            Math.floor(
              Math.random() *
                total,
            );

          const verseResult =
            await (
              supabase as any
            )
              .from(
                'bible_verses',
              )
              .select(
                'book_no,chapter_no,verse_no,verse_text',
              )
              .eq(
                'translation_code',
                'ASD',
              )
              .order(
                'book_no',
                {
                  ascending: true,
                },
              )
              .order(
                'chapter_no',
                {
                  ascending: true,
                },
              )
              .order(
                'verse_no',
                {
                  ascending: true,
                },
              )
              .range(
                offset,
                offset,
              )
              .maybeSingle();

          if (
            verseResult.error
          ) {
            throw verseResult.error;
          }

          const verseRaw =
            verseResult.data;

          if (!verseRaw) {
            throw new Error(
              'Random ASD verse was empty.',
            );
          }

          const bookNo =
            Number(
              verseRaw.book_no,
            );

          const bookResult =
            await (
              supabase as any
            )
              .from(
                'bible_canon_books',
              )
              .select(
                'book_name',
              )
              .eq(
                'book_no',
                bookNo,
              )
              .maybeSingle();

          if (
            bookResult.error
          ) {
            throw bookResult.error;
          }

          if (!active) {
            return;
          }

          const cleanText =
            String(
              verseRaw
                .verse_text ??
                '',
            )
              .replace(
                /^\u00B6\s*/,
                '',
              )
              .replace(
                /\/\/\s*/g,
                '',
              )
              .replace(
                /\s+/g,
                ' ',
              )
              .trim();

          setRandomVerse({
            book_no:
              bookNo,
            book_name:
              String(
                bookResult
                  .data
                  ?.book_name ??
                  `Book ${bookNo}`,
              ),
            chapter_no:
              Number(
                verseRaw
                  .chapter_no,
              ),
            verse_no:
              Number(
                verseRaw
                  .verse_no,
              ),
            verse_text:
              cleanText,
          });
        }
        catch (error: any) {
          if (!active) {
            return;
          }

          console.warn(
            'MZB Home random ASD verse:',
            error?.message ??
              error,
          );

          setRandomVerse(
            null,
          );
        }
        finally {
          if (active) {
            setRandomVerseLoading(
              false,
            );
          }
        }
      };

    void load();
    void loadRandomVerse();

    return () => {
      active = false;
    };
  }, []);

  const openDailyBible =
    () => {
      const assignedDate =
        reading?.reading_date ??
        new Date(
          Date.now() +
            8 * 60 * 60 * 1000,
        )
          .toISOString()
          .slice(0, 10);

      router.push({
        pathname:
          '/bible/read',
        params: {
          source:
            'daily_plan',
          assignedDate,
        },
      } as any);
    };

  return (
    
      <ScrollView
        style={styles.screen}
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <View style={styles.hero}>
          <View
            style={
              styles.heroTop
            }
          >
            <View>
              <Text
                style={
                  styles.eyebrow
                }
              >
                MZB MINISTRY
              </Text>

              <Text
                style={
                  styles.heroTitle
                }
              >
                Ministry Home
              </Text>
            </View>

            <View
              style={
                styles.heroBadge
              }
            >
              <MaterialCommunityIcons
                name="church"
                size={18}
                color="#FFFFFF"
              />
            </View>
          </View>

          <Text
            style={
              styles.heroSubtitle
            }
          >
            Faith, fellowship, formation and ministry tools in one MZB workspace.
          </Text>

          <View
            style={
              styles.heroSignal
            }
          >
            <View
              style={
                styles.heroSignalDot
              }
            />
            <Text
              style={
                styles.heroSignalText
              }
            >
              MZB ORGANIZATION ENVIRONMENT
            </Text>
          </View>
        </View>

        <View
          style={
            styles.sectionTop
          }
        >
          <Text style={styles.section}>
            TODAY
          </Text>

          <Text
            style={
              styles.sectionHint
            }
          >
            Start here
          </Text>
        </View>

        <View style={styles.todayRow}>
          <Pressable
            onPress={
              openDailyBible
            }
            style={({ pressed }) => [
              styles.todayCard,
              pressed && {
                opacity: 0.74,
              },
            ]}
          >
            <View
              style={
                styles.todayIcon
              }
            >
              <MaterialCommunityIcons
                name="book-open-variant"
                size={22}
                color={colors.greenDark}
              />
            </View>

            <Text
              style={
                styles.todayLabel
              }
            >
              DAILY BIBLE
            </Text>

            <Text
              numberOfLines={2}
              style={
                styles.todayTitle
              }
            >
              {readingLoading
                ? "Loading today's reading..."
                : reading
                    ?.bible_reference ??
                  'Open Daily Bible Reading'}
            </Text>

            <Text
              style={
                styles.todayMeta
              }
            >
              {readingLoading
                ? ' '
                : reading
                    ? `${reading.chapters_today} chapter${
                        reading.chapters_today ===
                        1
                          ? ''
                          : 's'
                      } today`
                    : 'Reading and reflection'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() =>
              router.push({
                pathname:
                  '/bible/read',
                params: {
                  source:
                    'my_bible',
                },
              } as any)
            }
            style={({ pressed }) => [
              styles.todayCard,
              pressed && {
                opacity: 0.74,
              },
            ]}
          >
            <View
              style={
                styles.todayIcon
              }
            >
              <MaterialCommunityIcons
                name="book-heart-outline"
                size={22}
                color={colors.greenDark}
              />
            </View>

            <Text
              style={
                styles.todayLabel
              }
            >
              MY BIBLE
            </Text>

            <Text
              style={
                styles.todayTitle
              }
            >
              Read - Highlight - Notes
            </Text>

            <Text
              style={
                styles.todayMeta
              }
            >
              Continue your personal Bible
            </Text>
          </Pressable>
        </View>

        <Pressable
          disabled={
            randomVerseLoading ||
            !randomVerse
          }
          onPress={() => {
            if (!randomVerse) {
              return;
            }

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
                    randomVerse
                      .book_no,
                  ),
                chapter:
                  String(
                    randomVerse
                      .chapter_no,
                  ),
                verse:
                  String(
                    randomVerse
                      .verse_no,
                  ),
              },
            } as any);
          }}
          style={({ pressed }) => [
            styles.randomVerseCard,
            pressed &&
              randomVerse && {
                opacity: 0.84,
                transform: [
                  {
                    scale: 0.995,
                  },
                ],
              },
            {
              /* UI_002_R8_R4_LIVE_VERSE_LEFT */
              marginLeft: 6,
            }
          ]}
        >
          <View
            style={
              styles.randomVerseTop
            }
          >
            <View
              style={
                styles.randomVerseIcon
              }
            >
              <MaterialCommunityIcons
                name="format-quote-open"
                size={20}
                color="#173A1F"
              />
            </View>

            <Text
              style={
                styles.randomVerseEyebrow
              }
            >
              RANDOM VERSE - ASD
            </Text>
          </View>

          <Text
            style={
              styles.randomVerseText
            }
          >
            {randomVerseLoading
              ? 'Getting a verse for you...'
              : randomVerse
                  ?.verse_text ??
                'Unable to load a random verse.'}
          </Text>

          <Text
            style={
              styles.randomVerseReference
            }
          >
            {randomVerseLoading
              ? ' '
              : randomVerse
                  ? `${randomVerse.book_name} ${randomVerse.chapter_no}:${randomVerse.verse_no}`
                  : 'ASD'}
          </Text>
        </Pressable>

        <Text style={styles.section}>
          BUKLOD BAYANIHAN
        </Text>

        <Pressable
          onPress={() =>
            router.push(
              '/bayanihan' as any,
            )
          }
          accessibilityRole="button"
          accessibilityLabel="Open BUKLOD Bayanihan"
          style={({ pressed }) => [
            styles.bayanihan,
            pressed && {
              opacity: 0.78,
              transform: [
                {
                  scale: 0.992,
                },
              ],
            },
          ]}
        >
          <View
            style={
              styles.bayanihanTop
            }
          >
            <View
              style={
                styles.bayanihanIcon
              }
            >
              <MaterialCommunityIcons
                name="hand-heart-outline"
                size={24}
                color="#FFFFFF"
              />
            </View>

            <View
              style={{ flex: 1 }}
            >
              <Text
                style={
                  styles.bayanihanEyebrow
                }
              >
                BUKLOD BAYANIHAN
              </Text>

              <Text
                style={
                  styles.bayanihanTitle
                }
              >
                Rewards, help and shared support
              </Text>
            </View>

            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color="#FFFFFF"
            />
          </View>

          <View
            style={
              styles.bayanihanBottom
            }
          >
            <View>
              <Text
                style={
                  styles.balanceLabel
                }
              >
                CURRENT BALANCE
              </Text>

              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={
                  0.72
                }
                style={
                  styles.balance
                }
              >
                {balanceLoading
                  ? '...'
                  : bayanihanBalance ===
                      null
                    ? 'Unavailable'
                    : `\u20B1${money(
                        bayanihanBalance,
                      )}`}
              </Text>
            </View>

            <View
              style={
                styles.bayanihanMeta
              }
            >
              <Text
                style={
                  styles.bayanihanMetaText
                }
              >
                Rewards
              </Text>
              <Text
                style={
                  styles.bayanihanMetaText
                }
              >
                Transactions
              </Text>
              <Text
                style={
                  styles.bayanihanMetaText
                }
              >
                Assistance
              </Text>
            </View>
          </View>

          <Text
            style={
              styles.reference
            }
          >
            Reference only - Not personal cash.
          </Text>
        </Pressable>

        <MzbRandomWallPhoto />
        <Text style={styles.section}>
          STAY CONNECTED
        </Text>

        
        {/* PATCH_184D_REMOVED_MZB_MESSAGES */}


        
        {/* PATCH_184D_REMOVED_MZB_ORGANIZATION_MANAGEMENT_CONTROL */}

              {/* PATCH_177B_R2_MZB_ATTENDANCE */}
        <Pressable
          onPress={() =>
            router.push(
              '/scope/attendance' as any,
            )
          }
          accessibilityRole="button"
          accessibilityLabel="Open Events and Attendance"
          style={({ pressed }) => ({
            marginTop: 10,
            marginBottom: 10,
            padding: 14,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#C7D8CE',
            backgroundColor: pressed
              ? '#E8F2EC'
              : '#FFFFFF',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          })}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: '#E3F0E8',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MaterialCommunityIcons
              name="clipboard-check-outline"
              size={23}
              color="#176B4C"
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 10,
                fontWeight: '900',
                color: '#176B4C',
              }}
            >
              MZB ATTENDANCE
            </Text>
            <Text
              style={{
                marginTop: 2,
                fontSize: 16,
                fontWeight: '900',
                color: '#263D33',
              }}
            >
              Events & Attendance
            </Text>
            <Text
              style={{
                marginTop: 3,
                fontSize: 12,
                lineHeight: 17,
                color: '#66786F',
              }}
            >
              Create events, open check-in and review attendance reports.
            </Text>
          </View>

          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color="#66786F"
          />
        </Pressable>

        {/* PATCH_184F_R3_MZB_BAYANIHAN_HOME */}
        <Pressable
          onPress={() =>
            router.push('/bayanihan' as any)
          }
          style={{
            minHeight: 68,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.white,
            paddingHorizontal: 14,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginTop: 10,
          }}
        >
          <MaterialCommunityIcons
            name="hand-heart-outline"
            size={22}
            color={colors.greenDark}
          />

          <View
            style={{
              flex: 1,
            }}
          >
            <Text
              style={{
                color: colors.text,
                fontSize: 15,
                fontWeight: '800',
              }}
            >
              BUKLOD Bayanihan
            </Text>

            <Text
              style={{
                marginTop: 3,
                fontSize: 12,
                lineHeight: 17,
                color: colors.muted,
              }}
            >
              Rewards, balance, transactions,
              and assistance requests
            </Text>
          </View>

          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={colors.muted}
          />
        </Pressable>
</ScrollView>
    
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
    },

    content: {
      padding: 13,
      paddingBottom: 28,
    },

    hero: {
      borderRadius: 22,
      padding: 17,
      backgroundColor:
        colors.greenDark,
      marginBottom: 18,
    },

    heroTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      gap: 12,
    },

    eyebrow: {
      fontSize: 8.5,
      fontWeight: '900',
      letterSpacing: 1,
      color:
        'rgba(255,255,255,0.72)',
    },

    heroTitle: {
      marginTop: 4,
      fontSize: 24,
      fontWeight: '900',
      color: '#FFFFFF',
    },

    heroBadge: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        'rgba(255,255,255,0.14)',
    },

    heroSubtitle: {
      marginTop: 8,
      maxWidth: 320,
      fontSize: 10.5,
      lineHeight: 15.5,
      color:
        'rgba(255,255,255,0.84)',
    },

    heroSignal: {
      alignSelf: 'flex-start',
      marginTop: 12,
      minHeight: 26,
      paddingHorizontal: 9,
      borderRadius: 999,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor:
        'rgba(255,255,255,0.11)',
    },

    heroSignalDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor:
        '#FFFFFF',
    },

    heroSignalText: {
      fontSize: 7.2,
      fontWeight: '900',
      letterSpacing: 0.65,
      color:
        'rgba(255,255,255,0.86)',
    },

    sectionTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      marginBottom: 7,
    },

    section: {
      marginBottom: 7,
      fontSize: 8.7,
      fontWeight: '900',
      letterSpacing: 0.82,
      color:
        colors.greenDark,
    },

    sectionHint: {
      marginBottom: 7,
      fontSize: 8,
      fontWeight: '800',
      color:
        colors.muted,
    },

    todayRow: {
      flexDirection: 'row',
      gap: 7,
      marginBottom: 9,
    },

    todayCard: {
      flex: 1,
      minHeight: 94,
      borderRadius: 15,
      paddingHorizontal: 9,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor:
        colors.line,
      backgroundColor:
        colors.white,
    },

    todayIcon: {
      width: 30,
      height: 30,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        colors.greenSoft,
    },

    todayLabel: {
      marginTop: 5,
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 0.55,
      color:
        colors.greenDark,
    },

    todayTitle: {
      marginTop: 2,
      fontSize: 10.2,
      lineHeight: 13,
      fontWeight: '900',
      color:
        colors.text,
    },

    todayMeta: {
      marginTop: 2,
      fontSize: 7.7,
      lineHeight: 10,
      color:
        colors.muted,
    },

    randomVerseCard: {
      minHeight: 142,
      borderRadius: 19,
      paddingHorizontal: 15,
      paddingVertical: 14,
      marginBottom: 18,
      backgroundColor:
        '#8DB600',
      borderWidth: 1,
      borderColor:
        'rgba(23,58,31,0.20)',
    },

    randomVerseTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      marginBottom: 9,
    },

    randomVerseIcon: {
      width: 30,
      height: 30,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        'rgba(255,255,255,0.32)',
    },

    randomVerseEyebrow: {
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.8,
      color:
        '#173A1F',
    },

    randomVerseText: {
      fontSize: 16.5,
      lineHeight: 22.5,
      fontWeight: '700',
      color:
        '#102D18',
    },

    randomVerseReference: {
      marginTop: 11,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '900',
      color:
        '#102D18',
    },

    bayanihan: {
      borderRadius: 21,
      overflow: 'hidden',
      marginBottom: 19,
      backgroundColor:
        colors.greenDark,
    },

    bayanihanTop: {
      minHeight: 68,
      padding: 13,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },

    bayanihanIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        'rgba(255,255,255,0.13)',
    },

    bayanihanEyebrow: {
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.8,
      color:
        'rgba(255,255,255,0.72)',
    },

    bayanihanTitle: {
      marginTop: 3,
      fontSize: 12,
      fontWeight: '900',
      color: '#FFFFFF',
    },

    bayanihanBottom: {
      paddingHorizontal: 13,
      paddingVertical: 11,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent:
        'space-between',
      gap: 12,
      backgroundColor:
        'rgba(0,0,0,0.08)',
    },

    balanceLabel: {
      fontSize: 7.4,
      fontWeight: '900',
      letterSpacing: 0.6,
      color:
        'rgba(255,255,255,0.66)',
    },

    balance: {
      marginTop: 3,
      maxWidth: 170,
      fontSize: 21,
      lineHeight: 25,
      fontWeight: '900',
      color: '#FFFFFF',
    },

    bayanihanMeta: {
      alignItems: 'flex-end',
      gap: 2,
    },

    bayanihanMetaText: {
      fontSize: 8,
      fontWeight: '800',
      color:
        'rgba(255,255,255,0.74)',
    },

    reference: {
      paddingHorizontal: 13,
      paddingBottom: 11,
      fontSize: 7.6,
      color:
        'rgba(255,255,255,0.60)',
    },

    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 19,
    },

    smallCard: {
      width: '48.6%',
      minHeight: 119,
      borderRadius: 17,
      padding: 12,
      borderWidth: 1,
      borderColor:
        colors.line,
      backgroundColor:
        colors.white,
    },

    smallIcon: {
      width: 38,
      height: 38,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        colors.greenSoft,
    },

    smallTitle: {
      marginTop: 8,
      fontSize: 11.3,
      fontWeight: '900',
      color:
        colors.text,
    },

    smallSub: {
      marginTop: 3,
      fontSize: 8.7,
      lineHeight: 12,
      color:
        colors.muted,
    },

    connectCard: {
      minHeight: 79,
      borderRadius: 18,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor:
        colors.line,
      backgroundColor:
        colors.white,
      marginBottom: 10,
    },

    connectIcon: {
      width: 43,
      height: 43,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        colors.greenSoft,
    },

    connectTitle: {
      fontSize: 11.5,
      fontWeight: '900',
      color:
        colors.text,
    },

    connectSub: {
      marginTop: 3,
      fontSize: 8.6,
      lineHeight: 12,
      color:
        colors.muted,
    },

    adminCard: {
      minHeight: 62,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      borderWidth: 1,
      borderColor:
        colors.line,
      backgroundColor:
        colors.greenSoft,
    },

    adminTitle: {
      fontSize: 9.5,
      fontWeight: '900',
      color:
        colors.greenDark,
    },

    adminSub: {
      marginTop: 2,
      fontSize: 8,
      color:
        colors.muted,
    },
  });