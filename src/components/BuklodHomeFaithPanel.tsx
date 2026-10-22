/*
 * PATCH_178H_R2_PREMIUM_SHOW_FAITH_HUB
 *
 * Premium SHOW FAITH Home hub.
 * Existing BUKLOD Bible DB / routes only.
 * No autoplay. No native dependency.
 */

import React, {
  useCallback,
  useRef,
  useState,
} from 'react';

import { useFocusEffect } from 'expo-router';

import {
  ActivityIndicator,
  Animated as RNAnimated,
  Easing,
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
  useBuklodPresentation,
} from '@/hooks/useBuklodPresentation';

import {
  useBuklodReduceMotion,
} from '@/components/HomeMotion';

import {
  buildDefaultScopeFaithAccessStatus,
  fetchScopeFaithAccessStatusResilient,
  type ScopeFaithAccessStatus,
} from '@/lib/buklodScopeFaithAccess';

import { useBuklodOfflineCache } from '@/hooks/useBuklodOfflineCache';
import { useAuth } from '@/providers/AuthProvider';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';

const FOCUS_EASING = Easing.out(Easing.cubic);

type TodayReading = {
  bible_reference: string;
  chapters_today: number;
};

type FaithTone =
  | 'reading'
  | 'bible'
  | 'word'
  | 'prayer'
  | 'abc'
  | 'hymns';

type FaithActionProps = {
  label: string;
  title: string;
  meta: string;
  icon: any;
  tone: FaithTone;
  onPress: () => void;
  loading?: boolean;
  locked?: boolean;
};

const FAITH_TONES = {
  reading: {
    surface: '#E7F8EE',
    iconSurface: '#FFFFFF',
    accent: '#1F8A4C',
  },
  bible: {
    surface: '#E7F2FC',
    iconSurface: '#FFFFFF',
    accent: '#2F6FED',
  },
  word: {
    surface: '#FBF4E8',
    iconSurface: '#FFFFFF',
    accent: '#C47A2C',
  },
  prayer: {
    surface: '#F8EEF6',
    iconSurface: '#FFFFFF',
    accent: '#8B5CF6',
  },
  abc: {
    surface: '#F3EEFB',
    iconSurface: '#FFFFFF',
    accent: '#7C5CBF',
  },
  hymns: {
    surface: '#E7F6FB',
    iconSurface: '#FFFFFF',
    accent: '#1D8FB5',
  },
} as const;

function FaithAction({
  label,
  title,
  meta,
  icon,
  tone,
  onPress,
  loading = false,
  locked = false,
}: FaithActionProps) {
  const { colors } = useBuklodPresentation();
  const reduceMotion = useBuklodReduceMotion();
  const scale =
    useRef(
      new RNAnimated.Value(1)
    ).current;

  const styleTone =
    FAITH_TONES[tone];

  const pressTo = (
    value: number,
    duration: number
  ) => {
    if (reduceMotion) {
      return;
    }

    RNAnimated.timing(scale, {
      toValue: value,
      duration,
      easing: FOCUS_EASING,
      useNativeDriver: true,
    }).start();
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
          pressTo(0.97, 70)
        }
        onPressOut={() =>
          pressTo(1, 145)
        }
        style={({pressed}) => [
          styles.card,
          {
            backgroundColor:
              styleTone.surface,
            minHeight: 112,
          },
          pressed && {
            opacity: 0.90,
          },
        ]}
      >
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
              size={22}
              color={
                styleTone.accent
              }
            />
          </View>

          <MaterialCommunityIcons
            name={locked ? 'lock-outline' : 'chevron-right'}
            size={18}
            color={styleTone.accent}
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
              style={[
                styles.cardTitle,
                { color: colors.text },
              ]}
            >
              {title}
            </Text>

            <Text
              numberOfLines={2}
              style={[
                styles.meta,
                { color: colors.muted },
              ]}
            >
              {meta}
            </Text>
          </>
        )}
      </Pressable>
    </RNAnimated.View>
  );
}

export default function BuklodHomeFaithPanel({
  scopeId,
}: {
  scopeId?: string;
} = {}) {
  const { colors } = useBuklodPresentation();
  const reduceMotion = useBuklodReduceMotion();
  const { profile } = useAuth();
  const accountId = String(profile?.id ?? '');
  const { data: reading, loading } = useBuklodOfflineCache<TodayReading>({
    cacheKey: accountId ? `faith-reading:${accountId}:${scopeId ?? 'public'}:${new Date().toLocaleDateString('en-CA')}` : '',
    enabled: Boolean(accountId),
    fetcher: async () => {
      const { data, error } = await withBuklodTimeout<any>(
        (supabase as any).rpc('get_automatic_bible_today'), 7000, 'Daily Reading');
      if (error) throw error;
      const raw = Array.isArray(data) ? data[0] : data;
      if (!raw) throw new Error('Daily Reading unavailable');
      return { bible_reference: String(raw.bible_reference ?? ''), chapters_today: Number(raw.chapters_today ?? 1) };
    },
  });
  const [access, setAccess] =
    useState<ScopeFaithAccessStatus | null>(null);
  const [accessLoading, setAccessLoading] =
    useState(Boolean(scopeId));

  const opacity = useRef(
    new RNAnimated.Value(1)
  ).current;
  const translateY = useRef(
    new RNAnimated.Value(0)
  ).current;

  useFocusEffect(
    useCallback(() => {
      if (reduceMotion) {
        opacity.setValue(1);
        translateY.setValue(0);
        return;
      }

      opacity.setValue(0.7);
      translateY.setValue(10);

      const motion = RNAnimated.parallel([
        RNAnimated.timing(opacity, {
          toValue: 1,
          duration: 260,
          easing: FOCUS_EASING,
          useNativeDriver: true,
        }),
        RNAnimated.timing(translateY, {
          toValue: 0,
          duration: 260,
          easing: FOCUS_EASING,
          useNativeDriver: true,
        }),
      ]);

      const frame = requestAnimationFrame(() => {
        motion.start();
      });

      return () => {
        cancelAnimationFrame(frame);
        motion.stop();
        opacity.setValue(1);
        translateY.setValue(0);
      };
    }, [opacity, reduceMotion, translateY])
  );

  const faithIdentity = accountId+':'+String(scopeId??'');
  const faithIdentityRef=useRef(faithIdentity);faithIdentityRef.current=faithIdentity;
  const faithPendingRef=useRef<{key:string;task:Promise<void>}|null>(null);
  const loadFaithAccess = useCallback(async () => {
    if(!scopeId){setAccess(null);setAccessLoading(false);return;}
    if(faithPendingRef.current?.key===faithIdentity)return faithPendingRef.current.task;
    setAccessLoading(true);
    const owner=faithIdentity;
    const task=(async()=>{
      try {
        const next=await withBuklodTimeout(fetchScopeFaithAccessStatusResilient(scopeId),10000,'Faith access');
        if(faithIdentityRef.current===owner)setAccess(next);
      } catch {if(faithIdentityRef.current===owner)setAccess(buildDefaultScopeFaithAccessStatus(scopeId));}
      finally {if(faithIdentityRef.current===owner)setAccessLoading(false);}
    })();
    faithPendingRef.current={key:owner,task};
    try{await task;}finally{if(faithPendingRef.current?.task===task)faithPendingRef.current=null;}
  },[scopeId,faithIdentity]);

  useFocusEffect(
    useCallback(() => {
      void loadFaithAccess();
    }, [loadFaithAccess])
  );

  const dailyReadingLocked =
    Boolean(scopeId) &&
    access != null &&
    !access.daily_reading.unlocked;

  const devotionLocked =
    Boolean(scopeId) &&
    access != null &&
    !access.devotion_word.unlocked;

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
          backgroundColor: colors.white,
          borderColor: colors.line,
          shadowColor: colors.text,
          opacity,
          transform: [
            {
              translateY,
            },
          ],
        },
      ]}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.headerIcon,
            { backgroundColor: '#E7F8EE' },
          ]}
        >
          <MaterialCommunityIcons
            name="heart"
            size={18}
            color="#1F8A4C"
          />
        </View>

        <View style={styles.headerCopy}>
          <Text style={[styles.sectionTitle, { color: '#17324A' }]}>
            SHOW FAITH
          </Text>

          <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
            Scripture, devotion, prayer, Christian growth and hymns.
          </Text>
        </View>

        <View
          style={[
            styles.todayPill,
          ]}
        >
          <MaterialCommunityIcons
            name="calendar-month-outline"
            size={12}
            color="#1F8A4C"
          />
          <Text style={[styles.todayText, { color: '#1F8A4C' }]}>
            {todayLabel}
          </Text>
        </View>
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="Open Show Faith Reading Library"
        onPress={() => router.push('/faith/library' as any)} style={{ paddingVertical: 12 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>Open Reading Library ›</Text>
      </Pressable>
      <View style={styles.grid}>
        <FaithAction
          label="Daily Reading"
          title={
            reading
              ?.bible_reference ||
            "Today's reading"
          }
          meta={
            Boolean(scopeId) && (accessLoading || !access)
              ? 'Checking Cluster access…'
              : Boolean(scopeId) && !access?.has_active_cluster
              ? 'Join a Cluster first'
              : dailyReadingLocked
              ? access?.daily_reading.pending_request_id
                ? 'Payment pending verification'
                : 'This feature is available through your Cluster Premium.'
              : reading
              ? `${reading.chapters_today} ${
                  reading.chapters_today ===
                  1
                    ? 'chapter'
                    : 'chapters'
                } today`
              : 'Open your guided reading'
          }
          icon="book-open-variant"
          tone="reading"
          loading={loading && !reading}
          locked={dailyReadingLocked}
          onPress={() => {
            if (scopeId && (accessLoading || !access)) {
              return;
            }
            if (scopeId && !access?.has_active_cluster) {
              router.push('/clusters' as any);
              return;
            }
            if (dailyReadingLocked) {
              return;
            }

            router.push({
  pathname: '/bible/read',
  params: {
    source: 'daily_plan',
    assignedDate: new Date(
      Date.now() + 8 * 60 * 60 * 1000
    ).toISOString().slice(0, 10),
  },
} as any);
          }}
        />

        <FaithAction
          label="My Bible"
          title="Read the Bible"
          meta="Read • Highlight • Notes"
          icon="book-cross"
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
          meta={
            Boolean(scopeId) && (accessLoading || !access)
              ? 'Checking Cluster access…'
              : Boolean(scopeId) && !access?.has_active_cluster
              ? 'Join a Cluster first'
              : devotionLocked
              ? access?.devotion_word.pending_request_id
                ? 'Payment pending verification'
                : 'This feature is available through your Cluster Premium.'
              : 'Read • Reflect • Apply'
          }
          icon="file-document-outline"
          tone="word"
          loading={Boolean(scopeId) && accessLoading && !access}
          locked={devotionLocked}
          onPress={() => {
            if (scopeId && (accessLoading || !access)) {
              return;
            }
            if (scopeId && !access?.has_active_cluster) {
              router.push('/clusters' as any);
              return;
            }
            if (devotionLocked) {
              return;
            }

            router.push('/word' as any);
          }}
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
      
        {/* PATCH_192A_R2_SHOW_FAITH_ABC_HYMNS_POINTS_ALL_ACCESS
            Public/personal Show Faith resources.
            ABC + Hymns have NO Organization / Cluster / Premium / purchase gate.
            ABC lesson completion uses the existing BUKLOD Points claim flow.
        */}
        <FaithAction
          label="ABC Study"
          title="ABC’s ng Paglagong Kristyano"
          meta="Lessons • Bible links • +5 points"
          icon="school-outline"
          tone="abc"
          onPress={() =>
            router.push(
              '/faith/abc' as any
            )
          }
        />

        <FaithAction
          label="Hymns"
          title="Samahang Binuklod ng Pag-ibig"
          meta="Search • Select • Font • Zoom"
          icon="music-note"
          tone="hymns"
          onPress={() =>
            router.push(
              '/faith/hymns' as any
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
      marginTop: 0,
      marginHorizontal: 0,
      marginBottom: 0,
      padding: 14,
      borderWidth: 0,
      borderRadius: 28,
      shadowOffset: {
        width: 0,
        height: 8,
      },
      shadowOpacity: 0.08,
      shadowRadius: 16,
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
    },

    headerCopy: {
      flex: 1,
      minWidth: 0,
    },

    sectionTitle: {
      fontSize: 18,
      fontWeight: '900',
      letterSpacing: 0.4,
    },

    sectionSubtitle: {
      marginTop: 2,
      fontSize: 12,
      lineHeight: 16,
    },

    todayPill: {
      marginLeft: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: '#E7F8EE',
    },

    todayText: {
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.4,
    },

    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 12,
    },

    cardShell: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: '46%' as any,
      minWidth: 0,
    },

    card: {
      minHeight: 112,
      overflow: 'hidden',
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: 12,
      borderWidth: 0,
      borderRadius: 20,
    },

    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      marginBottom: 6,
    },

    iconBubble: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },

    eyebrow: {
      marginBottom: 4,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.4,
    },

    cardTitle: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '900',
    },

    meta: {
      marginTop: 4,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '600',
    },

    loadingBox: {
      minHeight: 35,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
  });
