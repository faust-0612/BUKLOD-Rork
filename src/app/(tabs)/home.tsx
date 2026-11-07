import BuklodPublicCommunityBulletin from '@/components/BuklodPublicCommunityBulletin';
import BuklodPremiumMusicDeck from '@/components/BuklodPremiumMusicDeck';
import BuklodPublicWordShortcut from '@/components/BuklodPublicWordShortcut';
import BuklodFindAChurchDoorway from '@/components/BuklodFindAChurchDoorway';
import BuklodMentionText from '@/components/BuklodMentionText';
import BuklodHomeScopeBulletins from '@/components/BuklodHomeScopeBulletins';
import BuklodScreenBottomBanner from '@/components/BuklodScreenBottomBanner';
import BuklodCommunityContributionCard from '@/components/BuklodCommunityContributionCard';
import { BuklodSystemAnnouncementBoard } from '@/components/BuklodSystemAnnouncementBoard';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import {
  BuklodFocusScaleIn,
  HomeMotionSection,
  HomePressable,
} from '@/components/HomeMotion';

import BuklodSponsorSlot from '@/components/BuklodSponsorSlot';
/* PATCH_161B_BULLETIN_SOCIAL_UI */
import {
  Alert as BulletinAlert,
  TextInput as BulletinTextInput,
} from 'react-native';

import {
  useRef as useBulletinRef,
} from 'react';

import {
  Image as BulletinImage,
} from 'expo-image';

import * as React from 'react';
import {
  useEffect,
  useState,
  } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
  Linking,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';
import { loadBuklodPointsDashboard } from '@/lib/buklodRewards';
import { Card, Button, SectionTitle } from '@/components/UI';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodAccess } from '@/hooks/useBuklodAccess';
import { useNotifications } from '@/providers/NotificationProvider';
import { EnvironmentBadge } from '@/components/EnvironmentBadge';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';

type Devotional = {
  id: string;
  title: string;
  bible_passage: string | null;
  reflection_text: string;

  week_number?: number | null;
  lesson_number?: number | null;
  series_title?: string | null;
};

type MissionBulletin = {
  id: string;
  church_id: string | null;
  title: string;
  body: string;
  priority: number;
  is_pinned: boolean;
  starts_at: string;
  expires_at: string | null;
  created_at?: string;
  media_path?: string | null;
  media_url?: string | null;
  church?:
    | { name: string }
    | { name: string }[]
    | null;
};

type HomeLeaderboardRow = {
  user_id?: string;
  full_name?: string;
  member_name?: string;
  name?: string;
  total_points?: number;
  points?: number;
  church_name?: string;
  rank?: number;
  rank_position?: number;
};
function churchName(
  church: MissionBulletin['church']
): string | null {
  if (!church) return null;
  if (Array.isArray(church)) {
    return church[0]?.name ?? null;
  }
  return church.name ?? null;
}

/* PATCH_173I_R3_REMOVE_DUPLICATE_WORD_TOP_ICON */
/* PATCH_177B_P1_R4_SAFE_HOME_INTRO */
export default function HomeScreen() {
  const { colors, shared, theme } = useBuklodPresentation();
  const { profile, hasRole } = useAuth();
  const { activeScope } = useBuklodScope();
  const showFaithContent = Boolean(activeScope?.show_faith_content);
  const { unreadCount } = useNotifications();

  // HOME_CIRCLE_RANK_IDENTITY_V2
  const profileId =
    (profile as any)?.id as string | undefined;

  const [circleRank, setCircleRank] =
    useState('Circle Starter V');

  useEffect(() => {
    let cancelled = false;

    const loadCircleRank = async () => {
      if (!profileId) {
        return;
      }

      const { data, error } =
        await (supabase as any).rpc(
          'get_member_circle_ranks_v1',
          {
            p_user_ids: [profileId],
          }
        );

      if (cancelled) return;

      if (error) {
        console.warn(
          'Home Circle Rank:',
          error.message
        );
        return;
      }

      const rows =
        Array.isArray(data)
          ? data
          : data
            ? [data]
            : [];

      const row =
        rows.find(
          (item: any) =>
            item?.user_id === profileId
        ) ?? rows[0];

      setCircleRank(
        row?.rank_name ||
        'Circle Starter V'
      );
    };

    void loadCircleRank();

    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const [devotional, setDevotional] =
    useState<Devotional | null>(null);

  const [bulletin, setBulletin] =
    useState<MissionBulletin | null>(null);

  const [count, setCount] = useState(0);

  const [homeTop, setHomeTop] =
    useState<HomeLeaderboardRow[]>([]);

  const [topLoading, setTopLoading] =
    useState(true);
  const [loading, setLoading] = useState(true);

  const canManageBulletins =
    hasRole('system_admin') ||
    hasRole('pastor') ||
    hasRole('local_admin');

  useEffect(() => {
    (async () => {
      try {
        const today =
          new Date().toISOString().slice(0, 10);

        const now =
          new Date().toISOString();

        /*
         * PATCH 153D-1C1
         *
         * Primary source:
         * get_my_daily_devotional()
         *
         * The backend chooses the lesson from the
         * Member's active assigned Devotional Series
         * using weekly progression.
         *
         * Refreshing Home therefore does not randomly
         * change the assigned lesson.
         *
         * Until PATCH 153D is deployed, the existing
         * latest-published devotional query remains
         * as a temporary fallback.
         */

        const devotionalDb =
          supabase as any;

        let weeklyDevotional:
          Devotional | null = null;

        let weeklyRpcAvailable =
          true;


        try {
          const {
            data: weeklyData,
            error: weeklyError,
          } =
            await devotionalDb.rpc(
              'get_my_daily_devotional'
            );


          if (weeklyError) {
            weeklyRpcAvailable =
              false;

          } else {
            const raw =
              Array.isArray(
                weeklyData
              )
                ? weeklyData[0] ??
                  null
                : weeklyData ??
                  null;


            if (raw) {
              const devotionalId =
                raw.devotional_id ??
                raw.id ??
                null;


              if (devotionalId) {
                const rawWeek =
                  raw.week_number ??
                  raw.week_no ??
                  raw.week ??
                  null;


                const rawLesson =
                  raw.lesson_number ??
                  raw.lesson_no ??
                  raw.lesson_order ??
                  raw.sort_order ??
                  raw.day_number ??
                  null;


                const parsedWeek =
                  rawWeek === null
                    ? null
                    : Number(
                        rawWeek
                      );


                const parsedLesson =
                  rawLesson === null
                    ? null
                    : Number(
                        rawLesson
                      );


                weeklyDevotional = {
                  id:
                    String(
                      devotionalId
                    ),

                  title:
                    String(
                      raw.lesson_title ??
                      raw.title ??
                      'Daily Devotional'
                    ),

                  bible_passage:
                    raw.bible_passage ??
                    raw.scripture_reference ??
                    raw.scripture ??
                    null,

                  reflection_text:
                    String(
                      raw.reflection_text ??
                      raw.reflection_question ??
                      raw.body ??
                      ''
                    ),

                  week_number:
                    parsedWeek !==
                      null &&
                    Number.isFinite(
                      parsedWeek
                    )
                      ? parsedWeek
                      : null,

                  lesson_number:
                    parsedLesson !==
                      null &&
                    Number.isFinite(
                      parsedLesson
                    )
                      ? parsedLesson
                      : null,

                  series_title:
                    raw.series_title ??
                    raw.devotional_series_title ??
                    null,
                };
              }
            }
          }

        } catch {
          weeklyRpcAvailable =
            false;
        }


        /*
         * Graceful fallback only when the RPC itself
         * is not yet available.
         *
         * If the RPC works but the Member has no
         * assigned daily devotional, keep null.
         */
        if (!weeklyRpcAvailable) {
          const {
            data: legacyDevotional,
          } =
            await supabase
              .from(
                'devotionals'
              )
              .select(
                'id,title,bible_passage,reflection_text'
              )
              .eq(
                'is_published',
                true
              )
              .lte(
                'publish_date',
                today
              )
              .order(
                'publish_date',
                {
                  ascending:
                    false,
                }
              )
              .limit(1)
              .maybeSingle();


          weeklyDevotional =
            legacyDevotional as
              Devotional | null;
        }


        setDevotional(
          weeklyDevotional
        );

        /*
         * Mission Bulletin
         *
         * Until Patch 153A is actually migrated,
         * this query may return a "table not found"
         * error. That is intentionally ignored so
         * the current staging/local app does not break.
         */
        try {
          const db = supabase as any;

          let bulletinQuery = db
            .from('mission_bulletins')
            .select(
              'id,church_id,title,body,priority,is_pinned,starts_at,expires_at,church:church_id(name)'
            )
            .eq('is_published', true)
            .lte('starts_at', now)
            .order('is_pinned', {
              ascending: false,
            })
            .order('priority', {
              ascending: false,
            })
            .order('starts_at', {
              ascending: false,
            })
            .limit(20);

          /*
           * Home should show:
           * - system-wide bulletin
           * - bulletin for member's own Local
           *
           * A Pastor may manage several Locals,
           * but their personal Home remains based
           * on their own member Local.
           */
          if (profile?.church_id) {
            bulletinQuery =
              bulletinQuery.or(
                `church_id.is.null,church_id.eq.${profile.church_id}`
              );
          } else {
            bulletinQuery =
              bulletinQuery.is(
                'church_id',
                null
              );
          }

          const { data: bulletinRows } =
            await bulletinQuery;

          const rows =
            (bulletinRows ??
              []) as MissionBulletin[];

          const active =
            rows.filter((item) => {
              if (!item.expires_at) return true;

              return (
                new Date(
                  item.expires_at
                ).getTime() >
                Date.now()
              );
            });

          setBulletin(active[0] ?? null);
        } catch {
          setBulletin(null);
        }

        if (profile?.id) {
          const from = new Date();

          from.setDate(
            from.getDate() - 6
          );

          const {
            count: completionCount,
          } = await supabase
            .from('devotional_completions')
            .select('*', {
              count: 'exact',
              head: true,
            })
            .eq(
              'user_id',
              profile.id
            )
            .gte(
              'completion_date',
              from
                .toISOString()
                .slice(0, 10)
            );

          setCount(
            completionCount ?? 0
          );
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [
    profile?.id,
    profile?.church_id,
  ]);

  useEffect(() => {
    let active = true;

    const loadHomeLeaderboard = async () => {
      setTopLoading(true);

      try {
        const { data, error } =
          await (supabase as any).rpc(
            'get_buklod_points_leaderboard',
            {
              p_period: 'all_time',
              p_limit: 10,
              p_church_id: null,
            }
          );

        if (error) throw error;

        if (active) {
          setHomeTop(
            (data ?? []) as HomeLeaderboardRow[]
          );
        }
      } catch {
        if (active) {
          setHomeTop([]);
        }
      } finally {
        if (active) {
          setTopLoading(false);
        }
      }
    };

    loadHomeLeaderboard();

    return () => {
      active = false;
    };
  }, []);

  const bulletinChurch =
    bulletin
      ? churchName(bulletin.church)
      : null;

  return (
    <ScrollView
      style={shared.screen}
      contentContainerStyle={[
        shared.content,
        {
          /* PATCH_179E_PUBLIC_HOME_THINNER_SPACING */
          paddingHorizontal: 8,
          gap: 6,
        },
        {
          /* UI_002_R4_R6_HOME_EDGE */
          paddingHorizontal: 0,
          marginHorizontal: 0,
          gap: 6,
        }
      ]}
      showsVerticalScrollIndicator={
        false
      }
    >
      {/* CONTINUOUS_USE_STABILITY_R1: Home refreshes quietly; no blocking spinner/layout jump. */}
      <EnvironmentBadge />

      <HomeMotionSection delay={20}>
        <BuklodSystemAnnouncementBoard slot="public_home" />
      </HomeMotionSection>

      <BuklodFocusScaleIn
        delay={80}
        duration={270}
        fromOpacity={0.68}
        fromScale={0.95}
      >
        <BuklodHomeScopeBulletins />
      </BuklodFocusScaleIn>

      {/* BUKLOD_COMMUNITY_CONTRIBUTION_HOME_R1: move only; preserve original card and Wall layout. */}
      <View style={{ paddingHorizontal: 10 }}>
        <BuklodCommunityContributionCard />
      </View>

      <HomeMotionSection delay={180}>
        <View style={{ paddingHorizontal: 12 }}>
          <SectionTitle>
            TOP 10 MEMBERS
          </SectionTitle>

          <HomeTopTenCompact
            weekly={
              homeTop.slice(0, 10)
            }
            weeklyLoading={
              topLoading
            }
          />

          <HomeImportantReminder />
        </View>
      </HomeMotionSection>

      <BuklodScreenBottomBanner placement="home" variant="large" />
</ScrollView>
  );
}


/* ============================================================
   PATCH 154J
   COMPACT HOME DAILY BIBLE
============================================================ */


/* ============================================================
   PATCH 154T
   HOME DAILY DEVOTION + BUKLOD BAYANIHAN DOORWAY
============================================================ */

function HomeDailyBayanihanPair({
  circleRank,
}: {
  circleRank: string;
}) {
  const { colors, shared } = useBuklodPresentation();
  /* PATCH_165H_HOME_ENTITLEMENT */
  const { hasEntitlement } = useBuklodAccess();
  const canUseBayanihan = hasEntitlement('bayanihan');
  /* MY_BIBLE_HOME_SPLIT_V2 */
  /* CONTINUOUS_USE_STABILITY_R1: no mount-time Daily Bible RPC here. */
  return(
    <View
      style={{
        flexDirection:'row',
        gap: 6,
        alignItems:'stretch',
        marginTop:3,
        marginBottom:0,
        minHeight:112
      }}
    >

      {/* ==================================================
          LEFT SIDE
          DAILY DEVOTION + MY BIBLE
      =================================================== */}

      <HomeMotionSection
        delay={0}
        style={{
          flex:1,
        }}
      >
      <View
        style={{
          flex:1,
          gap:6
        }}
      >

        {/* DAILY BIBLE — canonical landing doorway */}
        <HomePressable
          haptic={false}
          wrapStyle={{
            flex:1,
            minHeight:44,
          }}
          onPress={() => router.push('/bible' as any)}
          accessibilityRole="button"
          accessibilityLabel="Open Daily Bible"
          style={({pressed})=>({
            flex:1,
            minHeight:44,
            opacity:pressed ? 0.82 : 1
          })}
        >
          <View
            style={{
              flex:1,
              minHeight:44,
              borderWidth:1,
              borderColor:colors.line,
              borderRadius:15,
              backgroundColor:colors.white,
              paddingHorizontal:9,
              paddingVertical:7
            }}
          >
            <View
              style={{
                flexDirection:'row',
                alignItems:'center',
                gap:5
              }}
            >
              <MaterialCommunityIcons
                name="book-open-page-variant-outline"
                size={16}
                color={colors.greenDark}
              />
              <Text
                numberOfLines={1}
                style={{
                  flex:1,
                  fontSize:9,
                  fontWeight:'900',
                  color:colors.greenDark,
                  letterSpacing:.35
                }}
              >
                DAILY BIBLE
              </Text>
            </View>

            <Text
              numberOfLines={1}
              style={{
                marginTop:4,
                fontSize:11,
                lineHeight:14,
                fontWeight:'900',
                color:colors.text
              }}
            >
              Daily Bible Reading
            </Text>

            <Text
              numberOfLines={2}
              style={{
                marginTop:2,
                fontSize:8.5,
                lineHeight:11,
                color:colors.muted
              }}
            >
              Choose a date, read Scripture, reflect, and complete.
            </Text>
          </View>
        </HomePressable>


        {/* MY BIBLE */}

        <HomePressable
          haptic={false}
          wrapStyle={{
            flex:1,
            minHeight: 44,
          }}
          onPress={()=>
            router.push({
              pathname:'/bible/read',
              params:{
                source:'my_bible'
              }
            } as any)
          }
          accessibilityRole="button"
          accessibilityLabel="Open My Bible"
          style={({pressed})=>({
            flex:1,
            minHeight: 44,
            opacity:pressed ? 0.82 : 1
          })}
        >
          <View
            style={{
              flex:1,
              minHeight:44,
              borderWidth:1,
              borderColor:colors.line,
              borderRadius:15,
              backgroundColor:colors.white,
              paddingHorizontal:9,
              paddingVertical:7,
              justifyContent:'center'
            }}
          >

            <View
              style={{
                flexDirection:'row',
                alignItems:'center',
                gap:6
              }}
            >
              <MaterialCommunityIcons
                name="book-heart-outline"
                size={17}
                color={colors.greenDark}
              />

              <View style={{flex:1}}>
                <Text
                  style={{
                    fontSize:10,
                    fontWeight:'900',
                    color:colors.greenDark,
                    letterSpacing:.6
                  }}
                >
                  MY BIBLE
                </Text>

                <Text
                  numberOfLines={1}
                  style={{
                    marginTop:1,
                    fontSize:8.5,
                    color:colors.muted
                  }}
                >
                  Read \u2022 Highlight \u2022 Notes
                </Text>
              </View>

              <MaterialCommunityIcons
                name="chevron-right"
                size={18}
                color={colors.greenDark}
              />
            </View>

          </View>
        </HomePressable>

      </View>
      </HomeMotionSection>


      {/* ==================================================
          RIGHT SIDE
          BUKLOD BAYANIHAN
      =================================================== */}

      {canUseBayanihan && (
      <HomeMotionSection
        delay={40}
        style={{
          flex:1,
        }}
      >
<HomePressable
        haptic={false}
        wrapStyle={{
          flex:1,
          minHeight: 44,
        }}
        onPress={()=>
          router.push('/bayanihan' as any)
        }
        accessibilityRole="button"
        accessibilityLabel="Open BUKLOD Bayanihan"
        style={({pressed})=>({
          flex:1,
          minHeight: 44,
          opacity:pressed ? 0.82 : 1
        })}
      >
        <View
          style={{
            minHeight:112,
            flex:1,
            borderWidth:1,
            borderColor:colors.line,
            borderRadius:16,
            backgroundColor:colors.white,
            padding:10
          }}
        >

          <View
            style={{
              flexDirection:'row',
              alignItems:'center',
              gap:6
            }}
          >
            <MaterialCommunityIcons
              name="hand-heart-outline"
              size={18}
              color={colors.greenDark}
            />

            <Text
              style={{
                flex:1,
                fontSize:10,
                fontWeight:'900',
                color:colors.greenDark,
                letterSpacing:.4
              }}
            >
              BUKLOD BAYANIHAN
            </Text>
          </View>


          <Text
            style={{
              marginTop:5,
              fontSize:9,
              lineHeight:12,
              color:colors.muted
            }}
          >
            Participation \u2022 Growth \u2022 Community
          </Text>


          <Text
            numberOfLines={2}
            style={{
              marginTop:6,
              fontSize:13,
              lineHeight:17,
              fontWeight:'900',
              color:colors.text
            }}
          >
            {circleRank}
          </Text>

        </View>
      </HomePressable>
      </HomeMotionSection>
      )}

    </View>
  );
}



function HomeDailyBibleStrip() {
  const { colors, shared } = useBuklodPresentation();
const [reading, setReading] = useState<{
    reading_date: string;
    bible_reference: string;
    chapters_today: number;
  } | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const { data } =
          await (supabase as any).rpc(
            'get_automatic_bible_today'
          );

        if (!active) return;

        const raw =
          Array.isArray(data)
            ? data[0] ?? null
            : data ?? null;

        if (raw) {
          setReading({
            reading_date:
              String(
                raw.reading_date ?? ''
              ),

            bible_reference:
              String(
                raw.bible_reference ??
                  'Daily Bible Reading'
              ),

            chapters_today:
              Number(
                raw.chapters_today ?? 1
              ),
          });
        }
      } catch {
        if (active) {
          setReading(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const openReading = () => {
    if (
      reading?.reading_date
    ) {
      router.push({
        pathname: '/bible/read',
        params: {
          source: 'daily_plan',
          assignedDate:
            reading.reading_date,
        },
      } as any);

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
  };

  return (
    <Pressable
      onPress={openReading}
      accessibilityRole="button"
      accessibilityLabel="Open Daily Bible Reading"
      style={({ pressed }) => ({
        marginTop: 6,
        marginBottom: 2,
        minHeight: 60,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.white,
        paddingHorizontal: 11,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor:
            colors.greenSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MaterialCommunityIcons
          name="book-open-page-variant-outline"
          size={21}
          color={colors.greenDark}
        />
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 9,
            fontWeight: '900',
            letterSpacing: 0.8,
            color: colors.greenDark,
          }}
        >
          DAILY BIBLE READING
        </Text>

        <Text
          numberOfLines={1}
          style={{
            marginTop: 2,
            fontSize: 13.5,
            fontWeight: '900',
            color: colors.text,
          }}
        >
          {loading
            ? 'Loading today\u2019s reading...'
            : reading?.bible_reference ||
              'Open today\u2019s reading'}
        </Text>

        {!loading &&
          !!reading && (
            <Text
              style={{
                marginTop: 1,
                fontSize: 9.5,
                color: colors.muted,
              }}
            >
              {reading.chapters_today}{' '}
              {reading.chapters_today === 1
                ? 'chapter'
                : 'chapters'}{' '}
              today
            </Text>
          )}
      </View>

      <MaterialCommunityIcons
        name="chevron-right"
        size={23}
        color={colors.greenDark}
      />
    </Pressable>
  );
}

/* ============================================================
   PATCH 154B
   MULTIPLE ACTIVE MISSION BULLETINS
============================================================ */



/* ============================================================
   HOME_NEWS_COMPONENTS_V1
============================================================ */


type HomeChurchNewsItem = {

  id: string;

  source_name: string;

  source_domain: string;

  original_title: string;

  english_summary:
    string | null;

  tagalog_title:
    string | null;

  tagalog_summary:
    string | null;

  original_url: string;

  published_at:
    string | null;

  fetched_at:
    string;
};


type HomeImportantReminderRow = {
  slot: string;
  title: string;
  body: string;
  is_active: boolean;
  starts_at: string;
  ends_at: string | null;
  updated_at: string;
  media_path?: string | null;
  media_url?: string | null;
};


function homeNewsAge(
  value:
    string |
    null
) {

  if (!value) {
    return 'Latest update';
  }


  const time =
    new Date(
      value
    ).getTime();


  if (
    !Number.isFinite(
      time
    )
  ) {
    return 'Latest update';
  }


  const diff =
    Math.max(
      0,
      Date.now() -
      time
    );


  const minutes =
    Math.floor(
      diff /
      60000
    );


  if (
    minutes <
    60
  ) {

    return minutes <= 1
      ? 'Just now'
      : minutes + ' min ago';

  }


  const hours =
    Math.floor(
      minutes /
      60
    );


  if (
    hours <
    24
  ) {

    return hours === 1
      ? '1 hour ago'
      : hours + ' hours ago';

  }


  const days =
    Math.floor(
      hours /
      24
    );


  if (
    days <
    7
  ) {

    return days === 1
      ? 'Yesterday'
      : days + ' days ago';

  }


  return new Date(
    value
  ).toLocaleDateString();

}




/* ============================================================
   HOME_NEWS_LOCAL_TAGALOG_V1

   FREE / JS-ONLY FLOW

   English source
        \u2193
   MyMemory free sentence translation
        \u2193
   Local BUKLOD Tagalog reconstruction
        \u2193
   AsyncStorage cache
        \u2193
   TAGALOG / ORIGINAL toggle
============================================================ */


type LocalTagalogNews = {

  source:
    string;

  title:
    string;

  summary:
    string | null;

  translated_at:
    string;

};


type LocalTagalogNewsCache =
  Record<
    string,
    LocalTagalogNews
  >;


const HOME_NEWS_TAGALOG_CACHE_KEY =
  'buklod.home.church_news.tagalog.v10';


function cleanTranslatedNewsText(
  value:
    string
) {

  return String(
    value ??
    ''
  )
    .replace(
      /&quot;/gi,
      '"'
    )
    .replace(
      /&#39;|&apos;/gi,
      "'"
    )
    .replace(
      /&amp;/gi,
      '&'
    )
    .replace(
      /&lt;/gi,
      '<'
    )
    .replace(
      /&gt;/gi,
      '>'
    )
    .replace(
      /\s+/g,
      ' '
    )
    .trim();

}


function capitalizeFirst(
  value:
    string
) {

  if (!value) {
    return value;
  }


  return (
    value
      .charAt(0)
      .toUpperCase() +
    value.slice(1)
  );

}


/*
 * This does NOT touch the original English.
 *
 * These are presentation rules only for the
 * locally translated Tagalog copy.
 */
function reconstructChurchTagalog(
  input:
    string
) {

  let text =
    cleanTranslatedNewsText(
      input
    );


  /*
   * Church terminology.
   */
  text =
    text
      .replace(
        /\bmga simbahan\b/gi,
        'mga iglesia'
      )
      .replace(
        /\bsimbahan\b/gi,
        'iglesia'
      )
      .replace(
        /\bmga bautista\b/gi,
        'mga Baptist'
      )
      .replace(
        /\bbautista\b/gi,
        'Baptist'
      )
      .replace(
        /\bebanghelyo\b/gi,
        'Ebanghelyo'
      )
      .replace(
        /\bmga misyonero\b/gi,
        'mga misyonero'
      )
      .replace(
        /\bmisyonero\b/gi,
        'misyonero'
      )
      .replace(
        /\bmga misyon\b/gi,
        'mga gawaing misyon'
      )
      .replace(
        /\bministeryo\b/gi,
        'ministeryo'
      )
      .replace(
        /\bpastor\b/gi,
        'pastor'
      );


  /*
   * Make common machine-translated
   * "Ang X ay nag..." sentences sound
   * more naturally Filipino:
   *
   * Ang mga iglesia ay naglunsad...
   *      \u2193
   * Naglunsad ang mga iglesia...
   */
  const angNag =
    text.match(
      /^Ang\s+(.+?)\s+ay\s+(nag[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF-]+)(.*)$/i
    );


  if (
    angNag
  ) {

    text =
      capitalizeFirst(
        angNag[2]
      ) +
      ' ang ' +
      angNag[1] +
      angNag[3];

  }


  /*
   * Si Juan ay nagsabi...
   *      \u2193
   * Nagsabi si Juan...
   */
  const siNag =
    text.match(
      /^Si\s+(.+?)\s+ay\s+(nag[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF-]+)(.*)$/i
    );


  if (
    siNag
  ) {

    text =
      capitalizeFirst(
        siNag[2]
      ) +
      ' si ' +
      siNag[1] +
      siNag[3];

  }


  /*
   * Clean common mechanical phrasing.
   */
  text =
    text
      .replace(
        /\bsa pamamagitan ng kanilang mga pagsisikap\b/gi,
        'sa kanilang mga gawain'
      )
      .replace(
        /\bsa komunidad ng simbahan\b/gi,
        'sa komunidad ng iglesia'
      )
      .replace(
        /\bKristiyanong ministeryo\b/gi,
        'Christian ministry'
      )
      .replace(
        /\s+([,.!?;:])/g,
        '$1'
      )
      .replace(
        /\s+/g,
        ' '
      )
      .trim();


  return text;

}


/*
 * MyMemory accepts short translation segments.
 * We keep each request comfortably below the
 * service's maximum by using ~350-char chunks.
 */
function splitNewsForTranslation(
  input:
    string
) {

  const text =
    String(
      input ??
      ''
    )
      .replace(
        /\s+/g,
        ' '
      )
      .trim();


  if (!text) {
    return [];
  }


  const sentences =
    text.match(
      /[^.!?]+[.!?]+|[^.!?]+$/g
    ) ??
    [
      text,
    ];


  const chunks:
    string[] = [];


  for (
    const sentence
    of sentences
  ) {

    const clean =
      sentence.trim();


    if (
      clean.length <=
      350
    ) {

      chunks.push(
        clean
      );

      continue;

    }


    const words =
      clean.split(
        /\s+/
      );


    let current =
      '';


    for (
      const word
      of words
    ) {

      const candidate =
        current
          ? current +
            ' ' +
            word
          : word;


      if (
        candidate.length >
        350
      ) {

        if (
          current
        ) {

          chunks.push(
            current
          );

        }


        current =
          word;

      }
      else {

        current =
          candidate;

      }

    }


    if (
      current
    ) {

      chunks.push(
        current
      );

    }

  }


  return chunks;

}


async function translateNewsSegmentToTagalog(
  segment:
    string
) {

  const url =
    'https://api.mymemory.translated.net/get' +
    '?q=' +
    encodeURIComponent(
      segment
    ) +
    '&langpair=en%7Ctl' +
    '&mt=1';


  const response =
    await fetch(
      url,
      {
        method:
          'GET',

        headers: {
          Accept:
            'application/json',
        },
      }
    );


  if (
    !response.ok
  ) {

    throw new Error(
      'Translation HTTP ' +
      response.status
    );

  }


  const payload =
    await response.json();


  const translated =
    payload
      ?.responseData
      ?.translatedText;


  if (
    typeof translated !==
      'string' ||
    !translated.trim()
  ) {

    const details =
      payload
        ?.responseDetails;


    throw new Error(
      typeof details ===
        'string'
        ? details
        : 'Translation returned no text.'
    );

  }


  return cleanTranslatedNewsText(
    translated
  );

}


async function translateNewsToTagalog(
  input:
    string
) {

  const cleanInput =
    sanitizeHomeNewsText(
      input
    );


  if (
    !cleanInput
  ) {

    return '';

  }


  const chunks =
    splitNewsForTranslation(
      cleanInput
    );


  if (
    chunks.length ===
    0
  ) {

    return '';

  }


  const translated:
    string[] = [];


  /*
   * Sequential requests are intentional.
   * We do not flood the free service.
   */
  for (
    const chunk
    of chunks
  ) {

    const result =
      await translateNewsSegmentToTagalog(
        chunk
      );


    translated.push(
      result
    );

  }


  return reconstructChurchTagalog(
    translated.join(
      ' '
    )
  );

}


async function readHomeNewsTagalogCache() {

  try {

    const raw =
      await AsyncStorage
        .getItem(
          HOME_NEWS_TAGALOG_CACHE_KEY
        );


    if (!raw) {
      return {};
    }


    const parsed =
      JSON.parse(
        raw
      );


    if (
      !parsed ||
      typeof parsed !==
        'object'
    ) {

      return {};

    }


    return parsed as
      LocalTagalogNewsCache;

  }
  catch {

    return {};

  }

}


async function saveHomeNewsTagalogCache(
  cache:
    LocalTagalogNewsCache
) {

  try {

    /*
     * Keep the local cache reasonably small.
     */
    const entries =
      Object.entries(
        cache
      )
        .sort(
          (
            a,
            b
          ) =>
            String(
              b[1]
                ?.translated_at ??
              ''
            ).localeCompare(
              String(
                a[1]
                  ?.translated_at ??
                ''
              )
            )
        )
        .slice(
          0,
          100
        );


    await AsyncStorage
      .setItem(
        HOME_NEWS_TAGALOG_CACHE_KEY,
        JSON.stringify(
          Object.fromEntries(
            entries
          )
        )
      );

  }
  catch {
    // Translation still displays during this session.
  }

}


/* HOME_NEWS_READABILITY_V1 */

/* HOME_NEWS_NO_EXCESS_SPACE_V2 */

/* HOME_NEWS_RECENT_SOURCE_UI_V3 */

/* HOME_NEWS_RECENT_SOURCE_UI_V3 */



/* HOME_NEWS_CONTENT_SANITIZER_V1 */

function sanitizeHomeNewsText(
  value:
    string | null | undefined
) {

  let text =
    String(
      value ?? ''
    )
      .replace(
        /\s+/g,
        ' '
      )
      .trim();


  /*
   * -------------------------------------------------------
   * 1. READER METADATA
   * -------------------------------------------------------
   */
  text =
    text.replace(
      /\b(?:Title|URL\s*Source|Published\s*Time|Markdown\s*Content|Markdown|Content|Nilalaman|Source\s*URL|Web\s*Address|Website)\s*:?\s*/gi,
      ' '
    );


  /*
   * -------------------------------------------------------
   * 2. NORMAL RAW URLs
   * -------------------------------------------------------
   */
  text =
    text.replace(
      /https?:\/\/[^\s<>"']+/gi,
      ' '
    );


  text =
    text.replace(
      /www\.[^\s<>"']+/gi,
      ' '
    );


  /*
   * -------------------------------------------------------
   * 3. MANGLED / TRANSLATED URLS
   *
   * Examples:
   *
   * com/resource - library/news/article-name
   * baptistpress.com / resource - library / news
   * org/stories/something
   * -------------------------------------------------------
   */
  text =
    text.replace(
      /\b(?:[a-z0-9-]+\.)?(?:com|org|net|news|co|uk|ph)\s*(?:\/|\\)\s*(?:[a-z0-9_-]+\s*(?:[-/]\s*)?){1,30}/gi,
      ' '
    );


  text =
    text.replace(
      /\b[a-z0-9.-]+\.(?:com|org|net|news|co|uk|ph)(?:\s*[/\\-]\s*[a-z0-9._-]+)+/gi,
      ' '
    );


  /*
   * -------------------------------------------------------
   * 4. IF A REAL NEWS DATELINE EXISTS,
   *    DISCARD EVERYTHING BEFORE IT.
   *
   * Example:
   * junk junk BOSTON (BP) \u2013 actual story...
   * -------------------------------------------------------
   */
  const dateline =
    text.match(
      /\b[A-Z][A-Z .,'\u2019/-]{2,45}\s*\([A-Z0-9]{2,8}\)\s*[\u2014\u2013-]\s*/
    );


  if (
    dateline &&
    typeof dateline.index ===
      'number'
  ) {

    text =
      text.slice(
        dateline.index +
        dateline[0].length
      );

  }


  /*
   * Dateline without parenthetical source:
   * MANILA, Philippines \u2014 actual story...
   */
  text =
    text.replace(
      /^[A-Z][A-Za-z\u00C0-\u00FF .,'\u2019/-]{2,55}\s*[\u2014\u2013-]\s*/,
      ''
    );


  /*
   * -------------------------------------------------------
   * 5. REMOVE LEFTOVER MARKDOWN / PATH GARBAGE
   * -------------------------------------------------------
   */
  text =
    text
      .replace(
        /\[([^\]]+)\]\([^)]*\)/g,
        '$1'
      )
      .replace(
        /\b(?:resource|library|news|article|stories)\s*[/\\-]\s*(?:[a-z0-9_-]+\s*[/\\-]?\s*){2,}/gi,
        ' '
      );


  /*
   * -------------------------------------------------------
   * 6. REMOVE PROMO / TRANSLATION JUNK
   * -------------------------------------------------------
   */
  text =
    text
      .replace(
        /\b(?:Subukan Natin|Subukan natin|Matuto Pa|Matuto pa|Alamin Pa|Alamin pa|Basahin Pa|Basahin pa|Read More|Learn More|Find Out More)\b[.!]?\s*$/gi,
        ''
      );


  /*
   * -------------------------------------------------------
   * 7. FINAL TYPOGRAPHIC CLEAN
   * -------------------------------------------------------
   */
  text =
    text
      .replace(
        /\s+-\s+/g,
        '-'
      )
      .replace(
        /\s+([,.!?;:])/g,
        '$1'
      )
      .replace(
        /\(\s*\)/g,
        ' '
      )
      .replace(
        /\s{2,}/g,
        ' '
      )
      .trim();


  /*
   * URL-only content must show NOTHING.
   */
  if (
    text.length <
      35 ||
    !/[A-Za-z\u00C0-\u00FF]/.test(
      text
    )
  ) {

    return '';

  }


  return text;

}

function HomeChurchNewsCarousel() {
  const { colors, shared } = useBuklodPresentation();

  const [
    items,
    setItems,
  ] =
    useState<
      HomeChurchNewsItem[]
    >([]);


  const [
    loading,
    setLoading,
  ] =
    useState(true);


  const [
    language,
    setLanguage,
  ] =
    useState<
      'fil' |
      'en'
    >(
      'fil'
    );


  const [
    activeIndex,
    setActiveIndex,
  ] =
    useState(0);


  /* HOME_NEWS_LOCAL_TRANSLATION_STATE_V1 */

  const [
    localTagalog,
    setLocalTagalog,
  ] =
    useState<
      LocalTagalogNewsCache
    >({});


  const [
    translatingTagalog,
    setTranslatingTagalog,
  ] =
    useState(false);


  const cardWidth =
    Math.max(
      280,
      Dimensions
        .get('window')
        .width -
        36
    );


  useEffect(
    () => {

      let active =
        true;


      const loadCached =
        async () => {

          const {
            data,
            error,
          } =
            await supabase
              .from(
                'church_news_items'
              )
              .select(
                'id,source_name,source_domain,original_title,english_summary,tagalog_title,tagalog_summary,original_url,published_at,fetched_at'
              )
              .eq(
                'is_published',
                true
              )
              .order(
                'published_at',
                {
                  ascending:
                    false,
                }
              )
              .limit(
                10
              );


          if (!active) {
            return;
          }


          if (error) {

            console.warn(
              'Home Church News:',
              error.message
            );

            return;

          }


          if (!active) {
            return;
          }


          /* HOME_NEWS_MOUNT_GUARD_V1 */

          setItems(
            (
              data ??
              []
            ) as HomeChurchNewsItem[]
          );

        };


      const run =
        async () => {

          setLoading(
            true
          );


          await loadCached();

          if (!active) {
            return;
          }



          /*
           * Background refresh.
           * The Edge Function has its own
           * 3-hour throttle so many Home
           * opens do not create many AI calls.
           */
          try {

            const {
              error:
                syncError,
            } =
              await supabase
                .functions
                .invoke(
                  'sync-church-news',
                  {
                    body: {
                      source:
                        'home',
                    },
                  }
                );


            if (
              !syncError &&
              active
            ) {

              await loadCached();

            }

          }
          catch {
            // Cached news remains usable.
          }


          if (active) {

            setLoading(
              false
            );

          }

        };


      void run();


      return () => {

        active =
          false;

      };

    },
    []
  );




  /* ========================================================
     HOME_NEWS_AUTO_TRANSLATE_EFFECT_V1
  ======================================================== */

  useEffect(
    () => {

      let active =
        true;


      if (
        items.length ===
        0
      ) {

        return () => {

          active =
            false;

        };

      }


      const run =
        async () => {

          const cache =
            await readHomeNewsTagalogCache();


          if (
            !active
          ) {
            return;
          }


          setLocalTagalog({
            ...cache,
          });


          setTranslatingTagalog(
            true
          );


          /*
           * Home currently shows up to 10 news.
           * Translate only those currently loaded.
           */
          for (
            const item
            of items.slice(
              0,
              10
            )
          ) {

            if (
              !active
            ) {
              break;
            }


            const sourceFingerprint =
              item.original_title +
              '\n' +
              (
                item.english_summary ??
                ''
              );


            const existing =
              cache[
                item.id
              ];


            if (
              existing &&
              existing.source ===
                sourceFingerprint &&
              existing.title
            ) {

              continue;

            }


            try {

              const translatedTitle =
                await translateNewsToTagalog(
                  item.original_title
                );


              let translatedSummary:
                string |
                null =
                  null;


              if (
                item
                  .english_summary
                  ?.trim()
              ) {

                translatedSummary =
                  await translateNewsToTagalog(
                    item
                      .english_summary
                  );

              }


              cache[
                item.id
              ] = {

                source:
                  sourceFingerprint,

                title:
                  translatedTitle ||
                  item.original_title,

                summary:
                  translatedSummary,

                translated_at:
                  new Date()
                    .toISOString(),

              };


              if (
                active
              ) {

                setLocalTagalog({
                  ...cache,
                });

              }


              await saveHomeNewsTagalogCache(
                cache
              );

            }
            catch (
              error
            ) {

              console.warn(
                'Home News Tagalog:',
                String(
                  error
                )
              );


              /*
               * Stop the batch when the free service
               * reaches a quota/rate limit.
               * Existing cached translations remain.
               */
              break;

            }

          }


          if (
            active
          ) {

            setTranslatingTagalog(
              false
            );

          }

        };


      void run();


      return () => {

        active =
          false;

      };

    },
    [
      items,
    ]
  );


  return (

    <View
      style={{
        marginTop:
          14,

        marginBottom:
          6,
      }}
    >

      <View
        style={{
          flexDirection:
            'row',

          alignItems:
            'center',

          justifyContent:
            'space-between',

          marginBottom:
            8,
        }}
      >

        <View
          style={{
            flex:
              1,

            paddingRight:
              10,
          }}
        >

          <Text
            style={{
              fontSize:
                11,

              fontWeight:
                '900',

              letterSpacing:
                0.8,

              color:
                colors.greenDark,
            }}
          >
            CHURCH NEWS & UPDATES
          </Text>


          <Text
            style={[
              shared.muted,
              {
                marginTop:
                  2,

                fontSize:
                  9,
              },
            ]}
          >
            {language === 'fil' &&
            translatingTagalog
              ? 'Isinasalin sa Tagalog...'
              : 'Baptist \u2022 Missions \u2022 Evangelical'}
          </Text>

        </View>


        <View
          style={{
            flexDirection:
              'row',

            padding:
              3,

            borderRadius:
              10,

            backgroundColor:
              '#EEF3F0',
          }}
        >

          <Pressable
            onPress={() =>
              setLanguage(
                'fil'
              )
            }
            style={{
              paddingHorizontal:
                8,

              paddingVertical:
                5,

              borderRadius:
                8,

              backgroundColor:
                language ===
                  'fil'
                  ? colors.greenDark
                  : 'transparent',
            }}
          >

            <Text
              style={{
                fontSize:
                  8,

                fontWeight:
                  '900',

                color:
                  language ===
                    'fil'
                    ? '#FFFFFF'
                    : colors.muted,
              }}
            >
              TAGALOG
            </Text>

          </Pressable>


          <Pressable
            onPress={() =>
              setLanguage(
                'en'
              )
            }
            style={{
              paddingHorizontal:
                8,

              paddingVertical:
                5,

              borderRadius:
                8,

              backgroundColor:
                language ===
                  'en'
                  ? colors.greenDark
                  : 'transparent',
            }}
          >

            <Text
              style={{
                fontSize:
                  8,

                fontWeight:
                  '900',

                color:
                  language ===
                    'en'
                    ? '#FFFFFF'
                    : colors.muted,
              }}
            >
              ORIGINAL
            </Text>

          </Pressable>

        </View>

      </View>


      {loading &&
        items.length === 0 ? (

        <Card>

          <ActivityIndicator
            color={
              colors.green
            }
          />

          <Text
            style={[
              shared.muted,
              {
                marginTop:
                  8,

                textAlign:
                  'center',
              },
            ]}
          >
            Loading church news...
          </Text>

        </Card>

      ) : items.length === 0 ? (

        <Card>

          <Text
            style={
              shared.h2
            }
          >
            Church News is being prepared.
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
            Latest Baptist and evangelical updates will appear here automatically.
          </Text>

        </Card>

      ) : (

        <>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }

            decelerationRate="fast"

            snapToInterval={
              cardWidth +
              10
            }

            snapToAlignment="start"

            disableIntervalMomentum

            onMomentumScrollEnd={
              event => {

                const x =
                  event
                    .nativeEvent
                    .contentOffset
                    .x;


                const next =
                  Math.round(
                    x /
                    (
                      cardWidth +
                      10
                    )
                  );


                setActiveIndex(
                  Math.max(
                    0,
                    Math.min(
                      items.length -
                        1,
                      next
                    )
                  )
                );

              }
            }

            contentContainerStyle={{ paddingLeft: 0, marginLeft: 0, paddingStart: 0, marginStart: 0, gap: 6,
            }}
          >

            {items.map(
              item => {

                const localTranslation =
                  localTagalog[
                    item.id
                  ];


                const title =
                  language ===
                    'fil'
                    ? (
                        item.tagalog_title || localTranslation?.title ||
                        item
                          .original_title
                      )
                    : item
                        .original_title;


                const summary =
                  language ===
                    'fil'
                    ? (
                        item.tagalog_summary || localTranslation?.summary ||
                        item
                          .english_summary
                      )
                    : item
                        .english_summary;

                const displayNewsTitle =
                  sanitizeHomeNewsText(
                    title
                  );

                const displayNewsSummary =
                  sanitizeHomeNewsText(
                    summary
                  );


                return (

                  <View
                    key={
                      item.id
                    }

                    style={{
                      width:
                        cardWidth,
borderWidth:
                        1,

                      borderColor:
                        colors.line,

                      borderRadius:
                        17,

                      backgroundColor:
                        colors.white,

                      padding:
                        17,
                    }}
                  >

                    <View
                      style={{
                        flexDirection:
                          'row',

                        alignItems:
                          'center',

                        justifyContent:
                          'space-between',

                        gap: 6,
                      }}
                    >

                      <Text
                        style={{
                          flex:
                            1,

                          color:
                            colors.green,

                          fontSize:
                            10,

                          fontWeight:
                            '900',

                          letterSpacing:
                            0.6,
                        }}
                      >
                        {
                          item
                            .source_name
                            .toUpperCase()
                        }
                      </Text>


                      <Text
                        style={{
                          fontSize:
                            9.5,

                          color:
                            colors.muted,
                        }}
                      >
                        {
                          homeNewsAge(
                            item
                              .published_at
                          )
                        }
                      </Text>

                    </View>


                    <Text
                      style={{
                        marginTop:
                          10,

                        fontSize:
                          18,

                        lineHeight:
                          24,

                        fontWeight:
                          '900',

                        color:
                          colors.text,
                      }}
                    >
                      {sanitizeHomeNewsText(displayNewsTitle)}
                    </Text>


                    {!!summary && (

                      <Text
                        style={{
                          marginTop:
                            8,

                          fontSize:
                            13.5,

                          lineHeight:
                            20,

                          color:
                            colors.text,
                        }}
                      >
                        {sanitizeHomeNewsText(displayNewsSummary)}
                      </Text>

                    )}


                    <Pressable
                      onPress={() => {

                        void Linking
                          .openURL(
                            item
                              .original_url
                          )
                          .catch(
                            () => {}
                          );

                      }}

                      style={{
                        marginTop:
                          9,

                        alignSelf:
                          'flex-start',

                        flexDirection:
                          'row',

                        alignItems:
                          'center',

                        gap:
                          5,
                      }}
                    >

                      <Text
                        style={{
                          fontSize:
                            9,

                          fontWeight:
                            '900',

                          color:
                            colors.greenDark,
                        }}
                      >
                        BASAHIN ANG ORIGINAL
                      </Text>


                      <MaterialCommunityIcons
                        name="open-in-new"
                        size={
                          13
                        }
                        color={
                          colors.greenDark
                        }
                      />

                    </Pressable>

                    {/* HOME_NEWS_SOURCE_AFTER_ORIGINAL_V1 */}

                    <Text
                      style={{
                        marginTop:
                          5,

                        fontSize:
                          11.5,

                        lineHeight:
                          16,

                        color:
                          colors.muted,

                        fontWeight:
                          '600',
                      }}
                    >
                      Source:{' '}
                      <Text
                        style={{
                          fontWeight:
                            '800',

                          color:
                            colors.text,
                        }}
                      >
                        {item.source_name}
                      </Text>
                    </Text>


                  </View>

                );

              }
            )}

          </ScrollView>

      <Text
        style={{
          marginTop:
            7,

          marginBottom:
            2,

          textAlign:
            'center',

          fontSize:
            11,

          fontWeight:
            '800',

          letterSpacing:
            0.5,

          color:
            colors.muted,
        }}
      >
        SWIPE FOR MORE \u2192
      </Text>


          <View
            style={{
              marginTop:
                8,

              flexDirection:
                'row',

              justifyContent:
                'center',

              gap:
                5,
            }}
          >

            {items.map(
              (
                item,
                index
              ) => (

                <View
                  key={
                    'dot-' +
                    item.id
                  }
                  style={{
                    width:
                      index ===
                        activeIndex
                        ? 15
                        : 6,

                    height:
                      6,

                    borderRadius:
                      99,

                    backgroundColor:
                      index ===
                        activeIndex
                        ? colors.greenDark
                        : colors.line,
                  }}
                />

              )
            )}

          </View>


          <Text
            style={{
              marginTop:
                5,

              textAlign:
                'center',

              fontSize:
                8,

              color:
                colors.muted,
            }}
          >
            Swipe left or right for the next update.
          </Text>

        </>

      )}

    </View>

  );

}


function HomeImportantReminder() {
  const { colors, shared } = useBuklodPresentation();

  const {
    hasRole,
  } =
    useAuth();


  const [
    reminder,
    setReminder,
  ] =
    useState<
      HomeImportantReminderRow |
      null
    >(null);


  useEffect(
    () => {

      let active =
        true;


      const load =
        async () => {

          const {
            data,
            error,
          } =
            await supabase
              .from(
                'home_important_reminders'
              )
              .select(
                'slot,title,body,is_active,starts_at,ends_at,updated_at,media_path'
              )
              .eq(
                'slot',
                'home_primary'
              )
              .maybeSingle();


          if (
            !active ||
            error ||
            !data
          ) {
            return;
          }


          const now =
            Date.now();


          const visible =
            data.is_active &&
            Date.parse(
              data.starts_at
            ) <= now &&
            (
              !data.ends_at ||
              Date.parse(
                data.ends_at
              ) > now
            );


          if (!visible) {

            setReminder(
              null
            );

            return;
          }


          let mediaUrl:
            string |
            null =
            null;


          if (
            data.media_path
          ) {

            const {
              data: signed,
            } =
              await supabase
                .storage
                .from(
                  'bulletin-media'
                )
                .createSignedUrl(
                  data.media_path,
                  3600
                );


            if (!active) {
              return;
            }


            mediaUrl =
              signed?.signedUrl ??
              null;
          }


          setReminder({
            ...(data as HomeImportantReminderRow),
            media_url:
              mediaUrl,
          });

        };


      void load();


      return () => {
        active =
          false;
      };

    },
    []
  );


  const canEdit =
    hasRole(
      'system_admin'
    );


  if (
    !reminder &&
    !canEdit
  ) {
    return null;
  }


  return (

    <View
      style={{
        marginTop: 8,
      }}
    >

      <SectionTitle>
        IMPORTANT REMINDER
      </SectionTitle>


      <Card>

        {reminder ? (

          <View>

            {!!reminder.media_url && (

              <BulletinImage
                source={{
                  uri:
                    reminder.media_url,
                }}
                style={{
                  width: '100%',
                  aspectRatio: 16 / 9,
                  borderRadius: 14,
                  marginBottom: 14,
                }}
                contentFit="cover"
                transition={180}
              />

            )}


            <View
              style={{
                /* UI_002_R12_REMINDER_LEFT_SPACE */
                borderLeftWidth: 4,
                borderLeftColor:
                  colors.greenDark,
                paddingLeft: 18,
              }}
            >

              <Text
                style={{
                  fontSize: 17,
                  fontWeight: '900',
                  color:
                    colors.greenDark,
                  marginBottom: 7,
                }}
              >
                {reminder.title}
              </Text>


              <Text
                style={{
                  fontSize: 14,
                  lineHeight: 21,
                  color: '#374151',
                }}
              >
                {reminder.body}
              </Text>

            </View>

          </View>

        ) : (

          <Text
            style={
              shared.muted
            }
          >
            No active reminder.
          </Text>

        )}


        {canEdit && (

          <Pressable
            onPress={() =>
              router.push(
                '/admin/home-reminder' as any
              )
            }
            style={{
              marginTop: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent:
                'center',
              gap: 6,
              paddingVertical: 9,
            }}
          >

            <Text
              style={{
                fontSize: 12,
                fontWeight: '900',
                color:
                  colors.greenDark,
              }}
            >
              EDIT IMPORTANT REMINDER
            </Text>

            <MaterialCommunityIcons
              name="pencil-outline"
              size={16}
              color={
                colors.greenDark
              }
            />

          </Pressable>

        )}

      </Card>

    </View>

  );

}


function HomeMissionBulletins() {
  const { colors, shared } = useBuklodPresentation();

  const {
    profile,
  } =
    useAuth();


  const mounted =
    useBulletinRef(
      true
    );


  const [
    items,
    setItems,
  ] =
    useState<
      MissionBulletin[]
    >([]);


  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );


  const [
    engagement,
    setEngagement,
  ] =
    useState<
      Record<
        string,
        {
          love: number;
          praying: number;
          amen: number;
          mine:
            | 'love'
            | 'praying'
            | 'amen'
            | null;
        }
      >
    >({});


  const [
    comments,
    setComments,
  ] =
    useState<
      Record<
        string,
        any[]
      >
    >({});


  const [
    commentDrafts,
    setCommentDrafts,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});


  const [
    replyingTo,
    setReplyingTo,
  ] =
    useState<{
      bulletinId: string;
      commentId: string;
      name: string;
    } | null>(
      null
    );


  const [
    replyDraft,
    setReplyDraft,
  ] =
    useState('');


  const [
    busyKey,
    setBusyKey,
  ] =
    useState<
      string |
      null
    >(null);


  useEffect(
    () => {

      mounted.current =
        true;


      return () => {
        mounted.current =
          false;
      };

    },
    []
  );


  const load =
    async () => {

      if (
        mounted.current
      ) {
        setLoading(
          true
        );
      }


      const now =
        new Date()
          .toISOString();


      let query =
        supabase
          .from(
            'mission_bulletins'
          )
          .select(
            'id,church_id,title,body,priority,is_pinned,starts_at,expires_at,created_at,media_path,church:church_id(name)'
          )
          .eq(
            'is_published',
            true
          )
          .lte(
            'starts_at',
            now
          )
          .order(
            'is_pinned',
            {
              ascending:
                false,
            }
          )
          .order(
            'priority',
            {
              ascending:
                false,
            }
          )
          .order(
            'created_at',
            {
              ascending:
                false,
            }
          );


      if (
        profile?.church_id
      ) {

        query =
          query.or(
            'church_id.is.null,church_id.eq.' +
            profile.church_id
          );

      } else {

        query =
          query.is(
            'church_id',
            null
          );

      }


      const {
        data,
        error,
      } =
        await query;


      if (
        !mounted.current
      ) {
        return;
      }


      if (error) {

        console.warn(
          'Could not load Mission Bulletins:',
          error.message
        );

        setItems([]);
        setLoading(false);

        return;
      }


      const activeItems =
        (
          data ??
          []
        )
          .filter(
            (item: any) =>
              !item.expires_at ||
              Date.parse(
                item.expires_at
              ) >
                Date.now()
          );


      const withMedia =
        await Promise.all(

          activeItems.map(
            async (
              item: any
            ) => {

              if (
                !item.media_path
              ) {
                return {
                  ...item,
                  media_url:
                    null,
                };
              }


              const {
                data:
                  signed,
              } =
                await supabase
                  .storage
                  .from(
                    'bulletin-media'
                  )
                  .createSignedUrl(
                    item.media_path,
                    3600
                  );


              return {
                ...item,
                media_url:
                  signed?.signedUrl ??
                  null,
              };

            }
          )

        );


      if (
        !mounted.current
      ) {
        return;
      }


      setItems(
        withMedia as
          MissionBulletin[]
      );


      const ids =
        withMedia.map(
          (item: any) =>
            item.id
        );


      if (
        !ids.length
      ) {

        setEngagement({});
        setComments({});
        setLoading(false);

        return;
      }


      const [
        reactionResult,
        commentResult,
      ] =
        await Promise.all([

          supabase
            .from(
              'mission_bulletin_reactions'
            )
            .select(
              'bulletin_id,user_id,reaction'
            )
            .in(
              'bulletin_id',
              ids
            ),

          supabase
            .from(
              'mission_bulletin_comments'
            )
            .select(
              'id,bulletin_id,user_id,parent_id,body,created_at'
            )
            .in(
              'bulletin_id',
              ids
            )
            .order(
              'created_at',
              {
                ascending:
                  true,
              }
            ),

        ]);


      if (
        !mounted.current
      ) {
        return;
      }


      const nextEngagement:
        Record<
          string,
          {
            love: number;
            praying: number;
            amen: number;
            mine:
              | 'love'
              | 'praying'
              | 'amen'
              | null;
          }
        > =
          {};


      ids.forEach(
        (id: string) => {

          nextEngagement[id] = {
            love: 0,
            praying: 0,
            amen: 0,
            mine: null,
          };

        }
      );


      (
        reactionResult.data ??
        []
      ).forEach(
        (row: any) => {

          const bucket =
            nextEngagement[
              row.bulletin_id
            ];


          if (!bucket) {
            return;
          }


          if (
            row.reaction ===
            'love'
          ) {
            bucket.love += 1;
          }


          if (
            row.reaction ===
            'praying'
          ) {
            bucket.praying += 1;
          }


          if (
            row.reaction ===
            'amen'
          ) {
            bucket.amen += 1;
          }


          if (
            row.user_id ===
            profile?.id
          ) {

            bucket.mine =
              row.reaction;

          }

        }
      );


      const rawComments =
        commentResult.data ??
        [];


      const userIds =
        Array.from(
          new Set(
            rawComments.map(
              (row: any) =>
                row.user_id
            )
          )
        );


      const nameMap:
        Record<
          string,
          string
        > =
          {};


      if (
        userIds.length
      ) {

        const {
          data:
            profileRows,
        } =
          await supabase
            .from(
              'profiles'
            )
            .select(
              'id,full_name'
            )
            .in(
              'id',
              userIds as string[]
            );


        (
          profileRows ??
          []
        ).forEach(
          (row: any) => {

            nameMap[
              row.id
            ] =
              row.full_name ||
              'Member';

          }
        );

      }


      if (
        !mounted.current
      ) {
        return;
      }


      const nextComments:
        Record<
          string,
          any[]
        > =
          {};


      ids.forEach(
        (id: string) => {
          nextComments[id] =
            [];
        }
      );


      rawComments.forEach(
        (row: any) => {

          if (
            !nextComments[
              row.bulletin_id
            ]
          ) {
            return;
          }


          nextComments[
            row.bulletin_id
          ].push({
            ...row,
            author_name:
              nameMap[
                row.user_id
              ] ||
              (
                row.user_id ===
                profile?.id
                  ? (
                      profile as any
                    )?.full_name ||
                    'You'
                  : 'Member'
              ),
          });

        }
      );


      setEngagement(
        nextEngagement
      );

      setComments(
        nextComments
      );

      setLoading(
        false
      );

    };


  useEffect(
    () => {

      void load();

    },
    [
      profile?.church_id,
      profile?.id,
    ]
  );


  const react =
    async (
      bulletinId:
        string,
      reaction:
        'love' |
        'praying' |
        'amen'
    ) => {

      if (
        !profile?.id
      ) {
        return;
      }


      const current =
        engagement[
          bulletinId
        ]?.mine ??
        null;


      const next =
        current === reaction
          ? null
          : reaction;


      setBusyKey(
        'reaction:' +
        bulletinId
      );


      const {
        error,
      } =
        await (
          supabase as any
        ).rpc(
          'set_mission_bulletin_reaction_v1',
          {
            p_bulletin_id:
              bulletinId,
            p_reaction:
              next,
          }
        );


      if (error) {

        BulletinAlert.alert(
          'Reaction',
          error.message
        );

        setBusyKey(
          null
        );

        return;
      }


      await load();


      if (
        mounted.current
      ) {
        setBusyKey(
          null
        );
      }

    };


  const submitComment =
    async (
      bulletinId:
        string,
      parentId:
        string |
        null =
        null
    ) => {

      if (
        !profile?.id
      ) {
        return;
      }


      const text =
        parentId
          ? replyDraft.trim()
          : (
              commentDrafts[
                bulletinId
              ] ??
              ''
            ).trim();


      if (!text) {
        return;
      }


      setBusyKey(
        'comment:' +
        bulletinId
      );


      const {
        error,
      } =
        await supabase
          .from(
            'mission_bulletin_comments'
          )
          .insert({
            bulletin_id:
              bulletinId,
            user_id:
              profile.id,
            parent_id:
              parentId,
            body:
              text,
          });


      if (error) {

        BulletinAlert.alert(
          parentId
            ? 'Reply'
            : 'Comment',
          error.message
        );

        setBusyKey(
          null
        );

        return;
      }


      if (parentId) {

        setReplyDraft('');
        setReplyingTo(
          null
        );

      } else {

        setCommentDrafts(
          (previous) => ({
            ...previous,
            [bulletinId]:
              '',
          })
        );

      }


      await load();


      if (
        mounted.current
      ) {
        setBusyKey(
          null
        );
      }

    };


  const deleteComment =
    async (
      commentId:
        string
    ) => {

      const {
        error,
      } =
        await supabase
          .from(
            'mission_bulletin_comments'
          )
          .delete()
          .eq(
            'id',
            commentId
          );


      if (error) {

        BulletinAlert.alert(
          'Comment',
          error.message
        );

        return;
      }


      await load();

    };


  if (loading) {

    return (

      <Card>

        <ActivityIndicator
          color={
            colors.green
          }
        />

      </Card>

    );

  }


  if (
    !items.length
  ) {

    return (

      <Card>

        <Text
          style={
            shared.muted
          }
        >
          No Mission Bulletins yet.
        </Text>

      </Card>

    );

  }


  return (

    <View
      style={{
        gap: 4,
      }}
    >

      {items.map(
        (item) => {

          const churchName =
            Array.isArray(
              item.church
            )
              ? item.church[
                  0
                ]?.name
              : item.church
                  ?.name;


          const reaction =
            engagement[
              item.id
            ] ?? {
              love: 0,
              praying: 0,
              amen: 0,
              mine: null,
            };


          const allComments =
            comments[
              item.id
            ] ??
            [];


          const rootComments =
            allComments.filter(
              (comment) =>
                !comment.parent_id
            );


          return (

            <Card
              key={
                item.id
              }
            >

              {!!item.media_url && (

                <BulletinImage
                  source={{
                    uri:
                      item.media_url,
                  }}
                  style={{
                    width:
                      '100%',
                    aspectRatio:
                      16 / 9,
                    borderRadius:
                      14,
                    marginBottom:
                      14,
                  }}
                  contentFit="cover"
                  transition={180}
                />

              )}


              <View
                style={{
                  borderLeftWidth:
                    5,
                  borderLeftColor:
                    colors.green,
                  paddingLeft: 0,
                }}
              >

                <Text
                  style={{
                    color:
                      colors.green,
                    fontWeight:
                      '900',
                    fontSize: 11,
                    letterSpacing:
                      1,
                  }}
                >

                  {item.is_pinned
                    ? 'PINNED | '
                    : ''}

                  {churchName ||
                    'ALL LOCALS'}

                </Text>


                <Text
                  style={{
                    marginTop: 7,
                    fontSize: 18,
                    lineHeight: 23,
                    fontWeight:
                      '900',
                    color:
                      '#111827',
                  }}
                >
                  {item.title}
                </Text>


                <Text
                  style={{
                    marginTop: 8,
                    fontSize: 14,
                    lineHeight: 21,
                    color:
                      '#374151',
                  }}
                >
                  {item.body}
                </Text>


                <Text
                  style={{
                    marginTop: 9,
                    fontSize: 11,
                    color:
                      '#6B7280',
                  }}
                >
                  {new Date(
                    item.starts_at
                  ).toLocaleString()}
                </Text>

              </View>


              {/* REACTIONS */}

              <View
                style={{
                  flexDirection:
                    'row',
                  gap: 6,
                  marginTop: 14,
                }}
              >

                {([
                  [
                    'love',
                    '\u2764\uFE0F',
                    'Love',
                    reaction.love,
                  ],
                  [
                    'praying',
                    '\uD83D\uDE4F',
                    'Praying',
                    reaction.praying,
                  ],
                  [
                    'amen',
                    '\uD83D\uDE4C',
                    'Amen',
                    reaction.amen,
                  ],
                ] as const)
                  .map(
                    (
                      [
                        key,
                        icon,
                        label,
                        count,
                      ]
                    ) => {

                      const selected =
                        reaction.mine ===
                        key;


                      return (

                        <Pressable
                          key={
                            key
                          }
                          disabled={
                            busyKey ===
                            'reaction:' +
                              item.id
                          }
                          onPress={() =>
                            void react(
                              item.id,
                              key
                            )
                          }
                          style={{
                            flex: 1,
                            minHeight:
                              40,
                            borderRadius:
                              12,
                            borderWidth:
                              1,
                            borderColor:
                              selected
                                ? colors.green
                                : '#E5E7EB',
                            backgroundColor:
                              selected
                                ? '#ECFDF3'
                                : '#FFFFFF',
                            alignItems:
                              'center',
                            justifyContent:
                              'center',
                            paddingHorizontal:
                              4,
                          }}
                        >

                          <Text
                            style={{
                              fontSize:
                                12,
                              fontWeight:
                                selected
                                  ? '900'
                                  : '700',
                              color:
                                selected
                                  ? colors.greenDark
                                  : '#4B5563',
                            }}
                          >
                            {icon}{' '}
                            {label}{' '}
                            {count}
                          </Text>

                        </Pressable>

                      );

                    }
                  )}

              </View>


              {/* COMMENTS */}

              <View
                style={{
                  marginTop:
                    15,
                  borderTopWidth:
                    1,
                  borderTopColor:
                    '#E5E7EB',
                  paddingTop:
                    12,
                }}
              >

                <Text
                  style={{
                    fontSize: 13,
                    fontWeight:
                      '900',
                    color:
                      colors.greenDark,
                    marginBottom:
                      9,
                  }}
                >
                  COMMENTS ({allComments.length})
                </Text>


                {rootComments.map(
                  (
                    comment
                  ) => {

                    const replies =
                      allComments.filter(
                        (
                          child
                        ) =>
                          child.parent_id ===
                          comment.id
                      );


                    const own =
                      comment.user_id ===
                      profile?.id;


                    return (

                      <View
                        key={
                          comment.id
                        }
                        style={{
                          marginBottom:
                            11,
                        }}
                      >

                        <View
                          style={{
                            backgroundColor:
                              '#F3F4F6',
                            borderRadius:
                              12,
                            padding:
                              10,
                          }}
                        >

                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: '900',
                              color: '#1F2937',
                            }}
                          >
                            {comment.author_name}
                          </Text>
                          <Text
                            style={{
                              marginTop: 2,
                              fontSize: 10,
                              color: '#9CA3AF',
                            }}
                          >
                            {new Date(
                              comment.created_at
                            ).toLocaleString()}
                          </Text>


                            <BuklodMentionText
                              text={comment.body}
                              style={{
                                marginTop: 3,
                                fontSize: 13,
                                lineHeight: 19,
                                color: '#374151',
                              }}
                              mentionStyle={{
                                fontWeight: '800',
                                color: colors.green,
                              }}
                            />


                            <View
                            style={{
                              marginTop: 6,
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            {own && (
                              <Pressable
                                onPress={() =>
                                  void deleteComment(
                                    comment.id
                                  )
                                }
                              >
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: '800',
                                    color: '#B91C1C',
                                  }}
                                >
                                  Delete
                                </Text>
                              </Pressable>
                            )}
                            <Pressable
                              onPress={() => {
                                setReplyingTo({
                                  bulletinId: item.id,
                                  commentId: comment.id,
                                  name: comment.author_name,
                                });
                                setReplyDraft(
                                  `@${comment.author_name} `
                                );
                              }}
                              style={{ marginLeft: 'auto' }}
                            >
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: '800',
                                  color: colors.green,
                                }}
                              >
                                Reply
                              </Text>
                            </Pressable>
                          </View>

                        </View>


                        {replies.map(
                          (
                            reply
                          ) => {

                            const ownReply =
                              reply.user_id ===
                              profile?.id;


                            return (

                              <View
                                key={
                                  reply.id
                                }
                                style={{
                                  marginLeft: 0,
                                  marginTop:
                                    6,
                                  backgroundColor:
                                    '#F9FAFB',
                                  borderRadius:
                                    11,
                                  borderLeftWidth:
                                    3,
                                  borderLeftColor:
                                    '#D1D5DB',
                                  padding:
                                    9,
                                }}
                              >

                                <Text
                                  style={{
                                    fontSize:
                                      11,
                                    fontWeight:
                                      '900',
                                    color:
                                      '#374151',
                                  }}
                                >
                                  {reply.author_name}
                                </Text>


                                <BuklodMentionText
                                  text={reply.body}
                                  style={{
                                    marginTop: 3,
                                    fontSize: 12.5,
                                    lineHeight: 18,
                                    color: '#4B5563',
                                  }}
                                  mentionStyle={{
                                    fontWeight: '800',
                                    color: colors.green,
                                  }}
                                />


                                {ownReply && (

                                  <Pressable
                                    onPress={() =>
                                      void deleteComment(
                                        reply.id
                                      )
                                    }
                                    style={{
                                      marginTop:
                                        5,
                                    }}
                                  >
                                    <Text
                                      style={{
                                        fontSize:
                                          10,
                                        fontWeight:
                                          '800',
                                        color:
                                          '#B91C1C',
                                      }}
                                    >
                                      Delete
                                    </Text>
                                  </Pressable>

                                )}

                              </View>

                            );

                          }
                        )}


                        {replyingTo?.commentId ===
                          comment.id && (

                          <View
                            style={{
                              marginLeft: 0,
                              marginTop:
                                7,
                            }}
                          >

                            <BuklodMentionText
                              text={`@${replyingTo?.name ?? ''}`}
                              style={{
                                fontSize: 11,
                                fontWeight: '800',
                                color: colors.green,
                                marginBottom: 5,
                              }}
                              mentionStyle={{
                                fontWeight: '800',
                                color: colors.green,
                              }}
                            />


                            <BulletinTextInput
                              value={
                                replyDraft
                              }
                              onChangeText={
                                setReplyDraft
                              }
                              placeholder="Write a reply..."
                              multiline
                              style={{
                                minHeight:
                                  42,
                                borderWidth:
                                  1,
                                borderColor:
                                  '#D1D5DB',
                                borderRadius:
                                  11,
                                paddingHorizontal:
                                  10,
                                paddingVertical:
                                  8,
                                fontSize:
                                  13,
                                backgroundColor:
                                  '#FFFFFF',
                              }}
                            />


                            <View
                              style={{
                                flexDirection:
                                  'row',
                                gap: 6,
                                marginTop:
                                  6,
                              }}
                            >

                              <Pressable
                                onPress={() =>
                                  void submitComment(
                                    item.id,
                                    comment.id
                                  )
                                }
                                style={{
                                  backgroundColor:
                                    colors.green,
                                  borderRadius:
                                    9,
                                  paddingHorizontal:
                                    12,
                                  paddingVertical:
                                    7,
                                }}
                              >
                                <Text
                                  style={{
                                    color:
                                      '#FFFFFF',
                                    fontWeight:
                                      '900',
                                    fontSize:
                                      11,
                                  }}
                                >
                                  REPLY
                                </Text>
                              </Pressable>


                              <Pressable
                                onPress={() => {

                                  setReplyingTo(
                                    null
                                  );

                                  setReplyDraft(
                                    ''
                                  );

                                }}
                                style={{
                                  paddingHorizontal:
                                    10,
                                  paddingVertical:
                                    7,
                                }}
                              >
                                <Text
                                  style={{
                                    color:
                                      '#6B7280',
                                    fontWeight:
                                      '800',
                                    fontSize:
                                      11,
                                  }}
                                >
                                  CANCEL
                                </Text>
                              </Pressable>

                            </View>

                          </View>

                        )}

                      </View>

                    );

                  }
                )}


                <View
                  style={{
                    flexDirection:
                      'row',
                    alignItems:
                      'flex-end',
                    gap: 6,
                    marginTop: 3,
                  }}
                >

                  <BulletinTextInput
                    value={
                      commentDrafts[
                        item.id
                      ] ??
                      ''
                    }
                    onChangeText={(
                      text
                    ) =>
                      setCommentDrafts(
                        (
                          previous
                        ) => ({
                          ...previous,
                          [item.id]:
                            text,
                        })
                      )
                    }
                    placeholder="Write a comment..."
                    multiline
                    style={{
                      flex: 1,
                      minHeight:
                        42,
                      maxHeight:
                        110,
                      borderWidth:
                        1,
                      borderColor:
                        '#D1D5DB',
                      borderRadius:
                        12,
                      paddingHorizontal:
                        11,
                      paddingVertical:
                        9,
                      backgroundColor:
                        '#FFFFFF',
                      fontSize:
                        13,
                    }}
                  />


                  <Pressable
                    disabled={
                      busyKey ===
                      'comment:' +
                        item.id
                    }
                    onPress={() =>
                      void submitComment(
                        item.id
                      )
                    }
                    style={{
                      minHeight:
                        42,
                      justifyContent:
                        'center',
                      backgroundColor:
                        colors.green,
                      borderRadius:
                        11,
                      paddingHorizontal:
                        13,
                    }}
                  >
                    <Text
                      style={{
                        color:
                          '#FFFFFF',
                        fontSize:
                          11,
                        fontWeight:
                          '900',
                      }}
                    >
                      POST
                    </Text>
                  </Pressable>

                </View>

              </View>

            </Card>

          );

        }
      )}

    </View>

  );

}

/* ============================================================
   PATCH 153H-5A
   HOME DAILY BIBLE REMINDER
============================================================ */

type HomeBiblePlan = {
  reading_date: string;
  plan_day_number: number;
  plan_week_number: number;
  cycle_number: number;
  chapters_today: number;

  start_book_no: number;
  start_book_name: string;
  start_chapter: number;

  end_book_no: number;
  end_book_name: string;
  end_chapter: number;

  bible_reference: string;
};


function HomeDailyBibleReminder() {
  const { colors, shared } = useBuklodPresentation();

  const [
    plan,
    setPlan,
  ] =
    React.useState<HomeBiblePlan | null>(
      null
    );


  const [
    loading,
    setLoading,
  ] =
    React.useState(true);


  React.useEffect(() => {

    let cancelled =
      false;


    const loadToday =
      async () => {

        try {

          const result =
            await (supabase as any).rpc(
              'get_automatic_bible_today'
            );


          if (
            cancelled
          ) {
            return;
          }


          if (
            result?.error
          ) {

            /*
             * Graceful fallback while automatic
             * Bible migrations are not deployed.
             */
            console.warn(
              'Home Daily Bible:',
              result.error?.message
            );

            setPlan(null);
            return;
          }


          const raw =
            Array.isArray(
              result?.data
            )
              ? result.data[0]
              : result?.data;


          if (
            raw &&
            raw.start_book_no &&
            raw.start_chapter &&
            raw.reading_date
          ) {

            setPlan({
              reading_date:
                String(
                  raw.reading_date
                ),

              plan_day_number:
                Number(
                  raw.plan_day_number ??
                  0
                ),

              plan_week_number:
                Number(
                  raw.plan_week_number ??
                  0
                ),

              cycle_number:
                Number(
                  raw.cycle_number ??
                  1
                ),

              chapters_today:
                Number(
                  raw.chapters_today ??
                  1
                ),

              start_book_no:
                Number(
                  raw.start_book_no
                ),

              start_book_name:
                String(
                  raw.start_book_name ??
                  ''
                ),

              start_chapter:
                Number(
                  raw.start_chapter
                ),

              end_book_no:
                Number(
                  raw.end_book_no ??
                  raw.start_book_no
                ),

              end_book_name:
                String(
                  raw.end_book_name ??
                  raw.start_book_name ??
                  ''
                ),

              end_chapter:
                Number(
                  raw.end_chapter ??
                  raw.start_chapter
                ),

              bible_reference:
                String(
                  raw.bible_reference ??
                  ''
                ),
            });

          } else {

            setPlan(null);
          }

        } catch (
          e: any
        ) {

          if (
            !cancelled
          ) {
            console.warn(
              'Home Daily Bible unavailable:',
              e?.message ?? e
            );

            setPlan(null);
          }

        } finally {

          if (
            !cancelled
          ) {
            setLoading(false);
          }
        }
      };


    loadToday();


    return () => {
      cancelled = true;
    };

  }, []);


  const openReading =
    () => {

      /*
       * Automatic-plan direct reader.
       */
      if (
        plan &&
        plan.start_book_no > 0 &&
        plan.start_chapter > 0
      ) {

        router.push({
          pathname:
            '/bible/read',

          params: {
            book:
              String(
                plan.start_book_no
              ),

            chapter:
              String(
                plan.start_chapter
              ),

            source:
              'daily_plan',

            assignedDate:
              plan.reading_date,
          },
        });

        return;
      }


      /*
       * Open the canonical Daily Reading doorway even when the
       * assignment RPC has not returned a plan row yet.
       */
      router.push({
        pathname: '/bible/read',
        params: {
          source: 'daily_plan',
          assignedDate: new Date(
            Date.now() + 8 * 60 * 60 * 1000
          ).toISOString().slice(0, 10),
        },
      } as any);
    };


  return (
    <Pressable
      onPress={
        openReading
      }
      style={({
        pressed,
      }) => ({
        opacity:
          pressed
            ? 0.7
            : 1,

        borderWidth: 1,

        borderColor:
          colors.line,

        borderRadius: 12,

        padding: 12,

        backgroundColor:
          colors.greenSoft,
      })}
    >

      <View
        style={{
          flexDirection:
            'row',

          alignItems:
            'center',

          justifyContent:
            'space-between',

          gap: 6,
        }}
      >

        <View
          style={{
            flex: 1,
          }}
        >

          <Text
            style={{
              fontSize: 9,

              fontWeight:
                '900',

              color:
                colors.green,

              letterSpacing:
                0.6,

              marginBottom:
                4,
            }}
          >
            TODAY'S DAILY BIBLE
          </Text>


          <Text
            style={{
              fontSize: 15,

              fontWeight:
                '900',

              color:
                colors.greenDark,
            }}
          >
            {
              loading
                ? 'Loading today\'s reading...'
                : plan?.bible_reference ||
                  'Daily Bible Reading'
            }
          </Text>


          <Text
            style={[
              shared.muted,
              {
                marginTop: 4,
                lineHeight: 17,
              },
            ]}
          >
            {
              plan
                ? `${
                    plan.chapters_today
                  } ${
                    plan.chapters_today ===
                    1
                      ? 'chapter'
                      : 'chapters'
                  } today | Read Scripture, reflect, and submit for validation.`
                : 'Open your Daily Bible plan, read Scripture, and submit your reflection.'
            }
          </Text>


          {!!plan && (
            <Text
              style={{
                marginTop: 7,

                fontSize: 9,

                fontWeight:
                  '800',

                color:
                  colors.greenDark,
              }}
            >
              WEEK {
                plan.plan_week_number
              } | CYCLE {
                plan.cycle_number
              }
            </Text>
          )}

        </View>


        <Text
          style={{
            fontSize: 10,

            fontWeight:
              '900',

            color:
              colors.greenDark,
          }}
        >
          READ {'>'}
        </Text>

      </View>

    </Pressable>
  );
}


/* PATCH_157C_HOME_TOP10 */
/* HOME_TOP10_ALL_TIME_PRIMARY_R1 */
function HomeTopTenCompact({
  weekly,
  weeklyLoading,
}: {
  weekly: HomeLeaderboardRow[];
  weeklyLoading: boolean;
}) {
  const { colors, shared } = useBuklodPresentation();
  const { profile } = useAuth();
  const currentUserId =
    String((profile as any)?.id ?? '');

  const [
    monthly,
    setMonthly,
  ] = useState<HomeLeaderboardRow[]>([]);

  const [
    monthlyLoading,
    setMonthlyLoading,
  ] = useState(true);

  const [
    myWeeklyRank,
    setMyWeeklyRank,
  ] = useState<number | null>(null);

  const [
    myMonthlyRank,
    setMyMonthlyRank,
  ] = useState<number | null>(null);

  const [
    myWeeklyPoints,
    setMyWeeklyPoints,
  ] = useState(0);

  const [
    myMonthlyPoints,
    setMyMonthlyPoints,
  ] = useState(0);

  useEffect(() => {
    let active = true;

    const loadMonthly = async () => {
      setMonthlyLoading(true);

      const load = async (period: string) =>
        (supabase as any).rpc(
          'get_buklod_points_leaderboard',
          {
            p_period: period,
            p_limit: 10,
            p_church_id: null,
          }
        );

      let result = await load('month');

      if (result?.error) {
        result = await load('monthly');
      }

      if (!active) {
        return;
      }

      if (result?.error) {
        console.warn(
          'Home monthly Top 10:',
          result.error.message
        );
        setMonthly([]);
      } else {
        setMonthly(
          ((result?.data ?? []) as HomeLeaderboardRow[])
            .slice(0, 10)
        );
      }

      setMonthlyLoading(false);
    };

    void loadMonthly();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadMyRank = async () => {
      try {
        const dashboard =
          await loadBuklodPointsDashboard();

        if (!active || !dashboard) {
          return;
        }

        setMyWeeklyRank(dashboard.all_time_rank);
        setMyMonthlyRank(dashboard.monthly_rank);
        setMyWeeklyPoints(dashboard.lifetime_points);
        setMyMonthlyPoints(dashboard.monthly_points);
      } catch (error: any) {
        console.warn(
          'Home ranking:',
          error?.message ?? error
        );
      }
    };

    void loadMyRank();

    return () => {
      active = false;
    };
  }, []);

  const renderMyRank = (
    rankValue: number | null,
    points: number
  ) => (
    <View
      style={{
        marginTop: 10,
        paddingHorizontal: 10,
        paddingVertical: 9,
        borderRadius: 12,
        backgroundColor: '#EEF6F1',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 11,
            fontWeight: '800',
            color: colors.text,
          }}
        >
          Your rank
        </Text>
        <Text
          style={{
            marginTop: 2,
            fontSize: 10,
            fontWeight: '700',
            color: colors.muted,
          }}
        >
          {Number(points).toLocaleString()} pts
        </Text>
      </View>
      <Text
        style={{
          fontSize: 16,
          fontWeight: '900',
          color: colors.greenDark,
        }}
      >
        {rankValue && rankValue > 0
          ? `#${rankValue}`
          : '—'}
      </Text>
    </View>
  );

  const renderRows = (
    rows: HomeLeaderboardRow[],
    loading: boolean
  ) => {
    if (loading) {
      return (
        <ActivityIndicator
          color={colors.green}
        />
      );
    }

    if (!rows.length) {
      return (
        <Text style={shared.muted}>
          No leaderboard results yet.
        </Text>
      );
    }

    const visible = rows.slice(0, 10);

    return (
      <View>
        {visible.map((item, index) => {
          const memberName =
            resolvePersonDisplayName(
              {
                full_name:
                  item.full_name ??
                  item.member_name ??
                  item.name,
                user_id: item.user_id,
              },
              item.user_id,
            );

          const points = Number(
            item.total_points ??
            item.points ??
            0
          );

          const rankNumber = Number(
            item.rank_position ??
            item.rank ??
            index + 1
          );

          const isMe =
            !!currentUserId &&
            String(item.user_id ?? '') ===
              currentUserId;

          return (
            <View
              key={
                item.user_id ||
                `${memberName}-${index}`
              }
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 7,
                paddingHorizontal: isMe ? 6 : 0,
                marginHorizontal: isMe ? -6 : 0,
                borderRadius: isMe ? 10 : 0,
                backgroundColor: isMe
                  ? '#EEF6F1'
                  : 'transparent',
                borderBottomWidth:
                  index < visible.length - 1
                    ? 1
                    : 0,
                borderBottomColor: colors.line,
              }}
            >
              <Text
                style={{
                  width: 28,
                  fontSize: 11,
                  fontWeight: '900',
                  color: colors.greenDark,
                }}
              >
                {rankNumber}
              </Text>

              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  fontSize: 12,
                  fontWeight: isMe ? '900' : '800',
                  color: colors.text,
                }}
              >
                {isMe ? `${memberName} (You)` : memberName}
              </Text>

              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '900',
                  color: colors.greenDark,
                }}
              >
                {points.toLocaleString()}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <Card>
      <Text style={shared.h2}>
        Top 10 Members
      </Text>

      <Text
        style={{
          marginTop: 12,
          marginBottom: 5,
          fontSize: 10,
          fontWeight: '900',
          letterSpacing: 0.4,
          color: colors.greenDark,
        }}
      >
        ALL TIME
      </Text>

      {renderRows(weekly, weeklyLoading)}
      {renderMyRank(myWeeklyRank, myWeeklyPoints)}

      <View
        style={{
          height: 1,
          backgroundColor: colors.line,
          marginVertical: 12,
        }}
      />

      <Text
        style={{
          marginBottom: 5,
          fontSize: 10,
          fontWeight: '900',
          letterSpacing: 0.4,
          color: colors.greenDark,
        }}
      >
        THIS MONTH
      </Text>

      {renderRows(monthly, monthlyLoading)}
      {renderMyRank(myMonthlyRank, myMonthlyPoints)}
    </Card>
  );
}
