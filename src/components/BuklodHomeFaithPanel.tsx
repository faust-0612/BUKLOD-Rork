/*
 * PATCH_178H_R2_PREMIUM_SHOW_FAITH_HUB
 *
 * SHOW FAITH Home hub; paid access gates retired.
 * Existing BUKLOD Bible DB / routes only.
 * No autoplay. No native dependency.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { useNetwork } from '@/providers/NetworkProvider';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import { getOfflineCache, setOfflineCache } from '@/lib/offlineCache';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';

import {
  ActivityIndicator,
  AppState,
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

import BuklodFindAChurchDoorway from '@/components/BuklodFindAChurchDoorway';
import BuklodHomeCheckinToday from '@/components/BuklodHomeCheckinToday';
import {
  fetchScopeFaithAccessStatus,
  type ScopeFaithAccessStatus,
} from '@/lib/buklodScopeFaithAccess';

const FOCUS_EASING = Easing.out(Easing.cubic);

type TodayReading = {
  reading_date: string;
  bible_reference: string;
  chapters_today: number;
};

// The automatic plan and assignments use the Philippine calendar day.
function getManilaReadingDate(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

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
  locked?: boolean;
  compact?: boolean;
};

function useFaithTones() {
  const { theme } = useBuklodPresentation();

  return {
    reading: {
      surface: theme.accentSoft,
      iconSurface: theme.accentSoft,
      accent: theme.accent,
    },
    bible: {
      surface: theme.surfaceMuted,
      iconSurface: theme.accentSoft,
      accent: theme.accent,
    },
    word: {
      surface: theme.surfaceElevated,
      iconSurface: theme.accentSoft,
      accent: theme.accent,
    },
    prayer: {
      surface: theme.cardSurface,
      iconSurface: theme.accentSoft,
      accent: theme.accent,
    },
  } as const;
}

function FaithAction({
  label,
  title,
  meta,
  icon,
  tone,
  onPress,
  loading = false,
  locked = false,
  compact = false,
}: FaithActionProps) {
  const { colors } = useBuklodPresentation();
  const reduceMotion = useBuklodReduceMotion();
  const scale =
    useRef(
      new RNAnimated.Value(1)
    ).current;

  const styleTone =
    useFaithTones()[tone];
  // BUKLOD_V28_FAITH_SIX_TILE_R1
  const tileColor: Record<string, string> = {
    'Daily Reading': '#319AED', 'My Bible': '#2DB753', Word: '#F5A31E',
    Prayer: '#E74F82', ABAKA: '#8B50E9', Hymns: '#09B8C6',
  };
  const compactColor = tileColor[label] ?? styleTone.accent;

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
        compact && styles.compactShell,
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
        accessibilityLabel={`${label}. ${title}`}
        onPress={onPress}
        onPressIn={() =>
          pressTo(0.97, 70)
        }
        onPressOut={() =>
          pressTo(1, 145)
        }
        style={({pressed}) => [
          styles.card,
          compact && styles.compactCard,
          {
            backgroundColor: compact ? compactColor : styleTone.surface,
            borderColor: compact ? compactColor : `${styleTone.accent}22`,
            minHeight: compact ? 96 : 72,
          },
          pressed && {
            opacity: 0.90,
          },
        ]}
      >
        {!compact && <View
          style={[
            styles.accentRail,
            {
              backgroundColor:
                styleTone.accent,
            },
          ]}
        />}

        <View style={[styles.cardTop, compact && styles.compactCardTop]}>
          <View
            style={[
              styles.iconBubble,
              {
                backgroundColor: compact ? 'transparent' : styleTone.iconSurface,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={icon}
              size={compact ? 26 : 19}
              color={compact ? '#FFFFFF' : styleTone.accent}
            />
          </View>

          {!compact && <MaterialCommunityIcons
            name={locked ? 'lock-outline' : 'arrow-top-right'}
            size={16}
            color={`${styleTone.accent}99`}
          />}
          {compact && locked ? <MaterialCommunityIcons name="lock-outline" size={12} color="#FFFFFF" /> : null}
        </View>

        <Text
          numberOfLines={compact ? 2 : 1}
          style={[
            styles.eyebrow,
            {
              color: compact ? '#FFFFFF' : styleTone.accent,
            },
            compact && styles.compactEyebrow,
          ]}
        >
          {label.toUpperCase()}
        </Text>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator
              size="small"
              color={compact ? '#FFFFFF' : styleTone.accent}
            />
          </View>
        ) : (
          <>
            <Text
              numberOfLines={2}
              style={[
                styles.cardTitle,
                compact && { display: 'none' },
                { color: colors.text },
              ]}
            >
              {title}
            </Text>

            <Text
              numberOfLines={2}
              style={[
                styles.meta,
                compact && { display: 'none' },
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
  compact = false,
}: {
  scopeId?: string;
  compact?: boolean;
} = {}) {
  const { colors } = useBuklodPresentation();
  const reduceMotion = useBuklodReduceMotion();
  const { user } = useAuth();
  const { online } = useNetwork();
  const { scopes } = useBuklodScope();
  const savedActiveCluster = !online && scopes.some(scope => scope.scope_type === 'CLUSTER' && scope.membership_status === 'ACTIVE');
  const readingCacheUser = user?.id ?? 'guest';
  const readingAccountRef = useRef(readingCacheUser);
  const [readingDate, setReadingDate] = useState(getManilaReadingDate);
  const [readingOwner, setReadingOwner] = useState<string | null>(null);
  const [readingFromCache, setReadingFromCache] = useState(false);
  const [reading,setReading] =
    useState<TodayReading | null>(
      null
    );

  const displayedReading =
    readingOwner === readingCacheUser && reading?.reading_date === readingDate
      ? reading
      : null;

  // Refresh the day without background polling; revisit/resume is enough.
  useFocusEffect(useCallback(() => {
    setReadingDate(getManilaReadingDate());
  }, []));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') setReadingDate(getManilaReadingDate());
    });
    return () => subscription.remove();
  }, []);

  const [loading,setLoading] =
    useState(true);
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

  const accessContext = `${user?.id ?? ''}:${scopeId ?? ''}`;
  const accessContextRef = useRef(accessContext);
  accessContextRef.current = accessContext;
  const loadedAccessContext = useRef<string | null>(null);

  // One access refresh per focus. Keep already displayed content during revalidation.
  useFocusEffect(useCallback(() => {
    let active = true;
    const context = accessContext;
    const current = () => active && accessContextRef.current === context;
    if (!scopeId) {
      setAccess(null);
      setAccessLoading(false);
      return;
    }
    if (loadedAccessContext.current !== context) {
      setAccess(null);
      setAccessLoading(true);
    }
    if (!online) {
      setAccessLoading(false);
      return;
    }
    void withBuklodTimeout(fetchScopeFaithAccessStatus(scopeId), 10000, 'Faith access')
      .then(next => {
        if (!current()) return;
        if (!next) throw new Error('Faith access status unavailable');
        loadedAccessContext.current = context;
        setAccess(next);
      })
      .catch(error => {
        if (!current()) return;
        console.warn('SHOW FAITH access:', error);
        // Do not turn a failed access lookup into a false locked state.
        if (loadedAccessContext.current !== context) setAccess(null);
      })
      .finally(() => { if (current()) setAccessLoading(false); });
    return () => { active = false; };
  }, [accessContext, scopeId, online]));

  useEffect(() => {
    let active = true;
    let fetched = false;
    // A cached reference from yesterday must never appear under today's date,
    // including after an account switch or a foreground day rollover.
    setReading(null);
    setReadingOwner(null);
    setReadingFromCache(false);
    setLoading(true);
    readingAccountRef.current = readingCacheUser;

    const cacheKey = `show-faith-today:v2:${readingDate}`;
    // Scope entitlements are checked separately and are never cached as authority.
    void getOfflineCache<TodayReading>(cacheKey, {
      userId: readingCacheUser,
      allowStale: true,
    }).then(cached => {
      if (!active || fetched || cached?.data?.reading_date !== readingDate ||
          !cached.data.bible_reference) return;
      setReading(cached.data);
      setReadingOwner(readingCacheUser);
      setReadingFromCache(true);
      setLoading(false);
    }).catch(() => undefined);

    if (online) {
      void (async () => {
        try {
          const { data, error } = await withBuklodTimeout<{
            data: any; error?: { message?: string } | null;
          }>((supabase as any).rpc('get_automatic_bible_today'), 10000, 'Daily reading');
          if (!active) return;
          if (error) {
            console.warn('SHOW FAITH daily reading:', error.message);
            return;
          }
          const raw = Array.isArray(data) ? data[0] ?? null : data ?? null;
          if (!raw) return;
          const returnedDate = String(raw.reading_date ?? '').slice(0, 10);
          if (returnedDate !== readingDate) {
            console.warn('SHOW FAITH daily reading: response date mismatch');
            return;
          }
          const startBook = Number(raw.start_book_no ?? 0);
          const startChapter = Number(raw.start_chapter ?? 0);
          if (startBook > 0 && startChapter > 0) {
            void setOfflineCache('bible-daily-plan:' + readingDate,
              { bookNo: startBook, chapterNo: startChapter },
              { userId: readingCacheUser, ttlMs: 35 * 24 * 60 * 60 * 1000 })
              .catch(() => undefined);
          }
          const next: TodayReading = {
            reading_date: returnedDate,
            bible_reference: String(raw.bible_reference ?? ''),
            chapters_today: Number(raw.chapters_today ?? 1),
          };
          if (!next.bible_reference) return;
          fetched = true;
          setReading(next);
          setReadingOwner(readingCacheUser);
          setReadingFromCache(false);
          void setOfflineCache(cacheKey, next, {
            userId: readingCacheUser,
            ttlMs: 24 * 60 * 60 * 1000,
          }).catch(() => undefined);
        } catch (error: any) {
          console.warn('SHOW FAITH daily reading:', error?.message ?? error);
        } finally {
          if (active) setLoading(false);
        }
      })();
    } else {
      setLoading(false);
    }

    return () => { active = false; };
  }, [readingCacheUser, readingDate, online]);


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
        compact && styles.compactSection,
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
            { backgroundColor: colors.greenSoft },
          ]}
        >
          <MaterialCommunityIcons
            name="heart-outline"
            size={20}
            color={colors.greenDark}
          />
        </View>

        <View style={styles.headerCopy}>
          <Text style={[styles.sectionTitle, { color: colors.greenDark }]}>
            SHOW FAITH
          </Text>

          <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
            Scripture, devotion, prayer, ABAKA, and hymns.
          </Text>
        </View>

        <View
          style={[
            styles.todayPill,
            { backgroundColor: colors.greenSoft },
          ]}
        >
          <Text style={[styles.todayText, { color: colors.greenDark }]}>
            {todayLabel}
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Play Daily Bible Quiz"
        onPress={() => router.push('/faith/bible-quiz' as any)}
        style={{marginHorizontal:12,marginBottom:10,padding:12,borderRadius:14,
          backgroundColor:'#EAF5EA',borderWidth:1,borderColor:'#B8D8BD',
          flexDirection:'row',alignItems:'center',gap:10}}
      >
        <MaterialCommunityIcons name="help-circle-outline" size={24} color="#236842" />
        <View style={{flex:1}}>
          <Text style={{fontSize:13,fontWeight:'900',color:'#195C37'}}>Daily Bible Quiz</Text>
          <Text style={{fontSize:11,color:'#486B55'}}>Easy +3 · Medium +6 · Hard +12 BP · 5 auto questions daily</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color="#236842"/>
      </Pressable>
      <BuklodHomeCheckinToday />

      <View style={styles.grid}>
        <FaithAction
          compact={compact}
          label="Daily Reading"
          title={
            displayedReading
              ?.bible_reference ||
            "Today's reading"
          }
          meta={
            Boolean(scopeId) && !savedActiveCluster && (accessLoading || !access)
              ? 'Checking Cluster access…'
              : Boolean(scopeId) && !savedActiveCluster && !access?.has_active_cluster
              ? 'Join a Cluster first'
              : dailyReadingLocked
              ? access?.daily_reading.pending_request_id
                ? 'Check your Cluster membership'
                : 'An active Cluster membership is required.'
              : displayedReading
              ? `${displayedReading.chapters_today} ${
                  displayedReading.chapters_today ===
                  1
                    ? 'chapter'
                    : 'chapters'
                } ${readingFromCache ? '· last saved today' : 'today'}`
              : 'Open your guided reading'
          }
          icon="calendar-text-outline"
          tone="reading"
          loading={loading || (Boolean(scopeId) && accessLoading)}
          locked={dailyReadingLocked}
          onPress={() => {
            if (scopeId && !savedActiveCluster && (accessLoading || !access)) {
              return;
            }
            if (scopeId && !savedActiveCluster && !access?.has_active_cluster) {
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
    assignedDate: readingDate,
  },
} as any);
          }}
        />

        <FaithAction
          compact={compact}
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
          compact={compact}
          label="Word"
          title="Daily devotional"
          meta={
            Boolean(scopeId) && !savedActiveCluster && (accessLoading || !access)
              ? 'Checking Cluster access…'
              : Boolean(scopeId) && !savedActiveCluster && !access?.has_active_cluster
              ? 'Join a Cluster first'
              : devotionLocked
              ? access?.devotion_word.pending_request_id
                ? 'Check your Cluster membership'
                : 'An active Cluster membership is required.'
              : 'Read • Reflect • Apply'
          }
          icon="book-open-page-variant-outline"
          tone="word"
          loading={Boolean(scopeId) && accessLoading}
          locked={devotionLocked}
          onPress={() => {
            if (scopeId && !savedActiveCluster && (accessLoading || !access)) {
              return;
            }
            if (scopeId && !savedActiveCluster && !access?.has_active_cluster) {
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
          compact={compact}
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
          compact={compact}
          label="ABAKA"
          title="ABAKA ng Bagong Likha"
          meta="Sunday school • A–Z • +8 BP per verified lesson"
          icon="school-outline"
          tone="bible"
          onPress={() =>
            router.push(
              '/faith/abc' as any
            )
          }
        />

        <FaithAction
          compact={compact}
          label="Hymns"
          title="Samahang Binuklod ng Pag-ibig"
          meta="Search • Select • Font • Zoom"
          icon="music-note-outline"
          tone="prayer"
          onPress={() =>
            router.push(
              '/faith/hymns' as any
            )
          }
        />

</View>

      {!compact ? (
        <View style={{ marginTop: 6 }}>
          <BuklodFindAChurchDoorway />
        </View>
      ) : null}
    </RNAnimated.View>
  );
}

const styles =
  StyleSheet.create({
    compactSection: { marginHorizontal: 0, marginTop: 0, marginBottom: 0, padding: 10, borderRadius: 15 },
    /* Scoped Show Faith: two responsive rows of three large cards. */
    compactShell: { flexGrow: 1, flexShrink: 0, flexBasis: '30%' as any, minWidth: 0 },
    compactCard: { minHeight: 96, paddingHorizontal: 6, paddingVertical: 10,
      alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
    compactCardTop: { justifyContent: 'center', marginBottom: 1 },
    compactEyebrow: { textAlign: 'center', fontSize: 11, lineHeight: 15, letterSpacing: 0, marginBottom: 0 },
    section: {
      marginTop: 6,
      marginHorizontal: 12,
      marginBottom: 6,
      padding: 13,
      borderWidth: 1,
      borderRadius: 24,
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
    },

    headerCopy: {
      flex: 1,
      minWidth: 0,
    },

    sectionTitle: {
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 0.8,
    },

    sectionSubtitle: {
      marginTop: 2,
      fontSize: 9,
      lineHeight: 13,
    },

    todayPill: {
      marginLeft: 8,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 999,
    },

    todayText: {
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
      minHeight: 72,
      overflow: 'hidden',
      paddingHorizontal: 11,
      paddingTop: 10,
      paddingBottom: 11,
      borderWidth: 1,
      borderRadius: 12,
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
      fontSize: 11.5,
      lineHeight: 15,
      fontWeight: '900',
    },

    meta: {
      marginTop: 4,
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

