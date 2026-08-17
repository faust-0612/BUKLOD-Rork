/*
 * PATCH_178H_R2_PREMIUM_SHOW_FAITH_HUB
 *
 * Premium SHOW FAITH Home hub.
 * Existing BUKLOD Bible DB / routes only.
 * No autoplay. No native dependency.
 */

import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Animated as RNAnimated,
  Pressable,
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

type TodayReading = {
  bible_reference: string;
  chapters_today: number;
};

type FaithTone =
  | 'reading'
  | 'bible'
  | 'word'
  | 'prayer';

type FaithActionProps = {
  label: string;
  title: string;
  meta: string;
  icon: any;
  tone: FaithTone;
  onPress: () => void;
  loading?: boolean;
};

const TONES: Record<
  FaithTone,
  {
    surface: string;
    iconSurface: string;
    accent: string;
  }
> = {
  reading: {
    surface: '#F4FAF6',
    iconSurface: '#DDEFE3',
    accent: '#2F7650',
  },

  bible: {
    surface: '#F7F9F4',
    iconSurface: '#E8EDDC',
    accent: '#5D7041',
  },

  word: {
    surface: '#FAF8F2',
    iconSurface: '#F1E9D5',
    accent: '#806A37',
  },

  prayer: {
    surface: '#F7F5FA',
    iconSurface: '#EAE3F1',
    accent: '#6B5680',
  },
};

function FaithAction({
  label,
  title,
  meta,
  icon,
  tone,
  onPress,
  loading = false,
}: FaithActionProps) {
  const scale =
    useRef(
      new RNAnimated.Value(1)
    ).current;

  const styleTone =
    TONES[tone];

  const pressTo =
    (value: number) => {
      RNAnimated.spring(
        scale,
        {
          toValue: value,
          useNativeDriver: true,
          speed: 28,
          bounciness: 4,
        }
      ).start();
    };

  return (
    <RNAnimated.View
      style={[
        styles.cardShell,
        {
          transform: [
            {
              scale,
            },
          ],
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        onPressIn={() =>
          pressTo(0.975)
        }
        onPressOut={() =>
          pressTo(1)
        }
        style={({pressed}) => [
          styles.card,
          {
            backgroundColor:
              styleTone.surface,

            borderColor:
              `${styleTone.accent}22`,
          },
          pressed && {
            opacity: 0.90,
          },
        ]}
      >
        <View
          style={[
            styles.accentRail,
            {
              backgroundColor:
                styleTone.accent,
            },
          ]}
        />

        <View style={styles.cardTop}>
          <View
            style={[
              styles.iconBubble,
              {
                backgroundColor:
                  styleTone.iconSurface,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={icon}
              size={19}
              color={
                styleTone.accent
              }
            />
          </View>

          <MaterialCommunityIcons
            name="arrow-top-right"
            size={16}
            color={`${styleTone.accent}99`}
          />
        </View>

        <Text
          numberOfLines={1}
          style={[
            styles.eyebrow,
            {
              color:
                styleTone.accent,
            },
          ]}
        >
          {label.toUpperCase()}
        </Text>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator
              size="small"
              color={
                styleTone.accent
              }
            />
          </View>
        ) : (
          <>
            <Text
              numberOfLines={2}
              style={styles.cardTitle}
            >
              {title}
            </Text>

            <Text
              numberOfLines={2}
              style={styles.meta}
            >
              {meta}
            </Text>
          </>
        )}
      </Pressable>
    </RNAnimated.View>
  );
}

export default function
BuklodHomeFaithPanel() {
  const [reading,setReading] =
    useState<TodayReading | null>(
      null
    );

  const [loading,setLoading] =
    useState(true);

  const reveal =
    useRef(
      new RNAnimated.Value(0)
    ).current;

  useEffect(
    () => {
      RNAnimated.timing(
        reveal,
        {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
        }
      ).start();
    },
    [
      reveal,
    ]
  );

  useEffect(
    () => {
      let active =
        true;

      const load =
        async () => {
          try {
            const {
              data,
            } =
              await (supabase as any)
                .rpc(
                  'get_automatic_bible_today'
                );

            if (!active) {
              return;
            }

            const raw =
              Array.isArray(data)
                ? data[0] ?? null
                : data ?? null;

            if (raw) {
              setReading({
                bible_reference:
                  String(
                    raw.bible_reference ??
                    ''
                  ),

                chapters_today:
                  Number(
                    raw.chapters_today ??
                    1
                  ),
              });
            }
          }
          catch (error: any) {
            console.warn(
              'SHOW FAITH daily reading:',
              error?.message ??
              error
            );
          }
          finally {
            if (active) {
              setLoading(false);
            }
          }
        };

      void load();

      return () => {
        active =
          false;
      };
    },
    []
  );

  const todayLabel =
    new Date()
      .toLocaleDateString(
        undefined,
        {
          month: 'short',
          day: 'numeric',
        }
      )
      .toUpperCase();

  return (
    <RNAnimated.View
      style={[
        styles.section,
        {
          opacity:
            reveal,

          transform: [
            {
              translateY:
                reveal.interpolate({
                  inputRange: [0,1],
                  outputRange: [12,0],
                }),
            },
          ],
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <MaterialCommunityIcons
            name="heart-outline"
            size={20}
            color={colors.greenDark}
          />
        </View>

        <View style={styles.headerCopy}>
          <Text style={styles.sectionTitle}>
            SHOW FAITH
          </Text>

          <Text style={styles.sectionSubtitle}>
            Your daily space for Scripture, devotion and prayer.
          </Text>
        </View>

        <View style={styles.todayPill}>
          <Text style={styles.todayText}>
            {todayLabel}
          </Text>
        </View>
      </View>

      <View style={styles.grid}>
        <FaithAction
          label="Daily Reading"
          title={
            reading
              ?.bible_reference ||
            "Today's reading"
          }
          meta={
            reading
              ? `${reading.chapters_today} ${
                  reading.chapters_today ===
                  1
                    ? 'chapter'
                    : 'chapters'
                } today`
              : 'Open your guided reading'
          }
          icon="calendar-text-outline"
          tone="reading"
          loading={loading}
          onPress={() =>
            router.push(
              '/bible' as any
            )
          }
        />

        <FaithAction
          label="My Bible"
          title="Read the Bible"
          meta="Read • Highlight • Notes"
          icon="book-heart-outline"
          tone="bible"
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
        />

        <FaithAction
          label="Word"
          title="Daily devotional"
          meta="Read • Reflect • Apply"
          icon="book-open-page-variant-outline"
          tone="word"
          onPress={() =>
            router.push(
              '/word' as any
            )
          }
        />

        <FaithAction
          label="Prayer"
          title="Prayer"
          meta="Pray • Share • Encourage"
          icon="hands-pray"
          tone="prayer"
          onPress={() =>
            router.push(
              '/prayer' as any
            )
          }
        />
      </View>
    </RNAnimated.View>
  );
}

const styles =
  StyleSheet.create({
    section: {
      marginTop: 6,
      marginHorizontal: 12,
      marginBottom: 6,
      padding: 13,
      borderWidth: 1,
      borderColor:
        'rgba(39,93,69,0.12)',
      borderRadius: 24,
      backgroundColor:
        '#FCFEFC',

      shadowColor:
        '#000000',

      shadowOffset: {
        width: 0,
        height: 5,
      },

      shadowOpacity: 0.055,
      shadowRadius: 14,
      elevation: 3,
    },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },

    headerIcon: {
      width: 38,
      height: 38,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
      backgroundColor:
        '#E7F4EB',
    },

    headerCopy: {
      flex: 1,
      minWidth: 0,
    },

    sectionTitle: {
      color: colors.greenDark,
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 0.8,
    },

    sectionSubtitle: {
      marginTop: 2,
      color: colors.muted,
      fontSize: 9,
      lineHeight: 13,
    },

    todayPill: {
      marginLeft: 8,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor:
        '#F0F6F2',
    },

    todayText: {
      color: colors.greenDark,
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.45,
    },

    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },

    cardShell: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: '47%' as any,
      minWidth: 0,
    },

    card: {
      minHeight: 120,
      overflow: 'hidden',
      paddingHorizontal: 11,
      paddingTop: 10,
      paddingBottom: 11,
      borderWidth: 1,
      borderRadius: 0,
    },

    accentRail: {
      position: 'absolute',
      left: 0,
      top: 18,
      bottom: 18,
      width: 3,
      borderTopRightRadius: 99,
      borderBottomRightRadius: 99,
      opacity: 0.78,
    },

    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      marginBottom: 6,
    },

    iconBubble: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },

    eyebrow: {
      marginBottom: 4,
      fontSize: 7.5,
      fontWeight: '900',
      letterSpacing: 0.55,
    },

    cardTitle: {
      color: colors.text,
      fontSize: 11.5,
      lineHeight: 15,
      fontWeight: '900',
    },

    meta: {
      marginTop: 4,
      color: colors.muted,
      fontSize: 8.5,
      lineHeight: 12,
      fontWeight: '600',
    },

    loadingBox: {
      minHeight: 35,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
  });