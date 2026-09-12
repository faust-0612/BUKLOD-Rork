import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { MaterialCommunityIcons } from '@expo/vector-icons';

import { shared } from '@/components/UI';
import BuklodRankCard from '@/components/BuklodRankCard';
import BuklodPointsStage from '@/components/points/BuklodPointsStage';
import BuklodCharacterRewardRoadmap from '@/components/points/BuklodCharacterRewardRoadmap';
import BuklodParticipationProgress from '@/components/points/BuklodParticipationProgress';
import BuklodPointsClaimCelebration from '@/components/points/BuklodPointsClaimCelebration';
import BuklodMyCollectionCard from '@/components/points/BuklodMyCollectionCard';
import BuklodRedeemCatalogSection from '@/components/points/BuklodRedeemCatalogSection';
import BuklodCharacterCustomizeSheet from '@/components/points/BuklodCharacterCustomizeSheet';
import BuklodCharacterFaceAvatar from '@/components/points/BuklodCharacterFaceAvatar';
import { useBuklodCharacterEventsOptional } from '@/components/character/BuklodCharacterEventProvider';
import { PointsFocusCard } from '@/components/points/PointsMotion';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import {
  DEFAULT_CHARACTER,
  loadBuklodCharacter,
  reconcileCharacterForPoints,
  type BuklodCharacterConfig,
} from '@/lib/buklodCharacter';
import { itemsUnlockedBetween } from '@/lib/character-lab-core/unlock';
import { loadCharacterProgressionConfig } from '@/lib/buklodCharacterProgression';
import { CharacterEventType } from '@/lib/buklodCharacterEvents';
import { supabase } from '@/lib/supabase';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';
import {
  claimBuklodRewardGroup,
  loadBuklodClaimGroups,
  loadBuklodPointsDashboard,
  type BuklodClaimGroup,
  type BuklodPointsDashboard,
} from '@/lib/buklodRewards';
import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';

type PointsDashboard = BuklodPointsDashboard;

type RankDashboard = {
  disclaimer: string;

  lifetime: {
    points: number;
    rank_code: string | null;
    rank_name: string | null;
    badge_key: string | null;
    points_to_next: number;
    next_rank_name: string | null;
    progress_percent: number;
  };

  season: {
    id: string;
    number: number;
    title: string;
    starts_on: string;
    ends_on: string;
    points: number;
    rank_code: string | null;
    rank_name: string | null;
    badge_key: string | null;
    points_to_next: number;
    next_rank_name: string | null;
    progress_percent: number;
    overall_position: number | null;
    local_position: number | null;
  } | null;
};

type PointRow = {
  id: string;
  direction: 'credit' | 'debit';
  claim_state: 'pending' | 'claimed' | 'legacy' | string;
  points: number;
  activity_type: string;
  source_key: string;
  source_id: string | null;
  description: string | null;
  created_at: string;
};

type EvaluationRow = {
  id: string;
  period_type: 'monthly' | 'quarterly' | 'custom';
  period_start: string;
  period_end: string;
  points_snapshot: number;
  performance_score: number | null;
  bayanihan_bonus: number;
  admin_note: string | null;
  evaluated_at: string;
};

type CircleRankAchievement = {
  rank_order: number;
  rank_family: string;
  rank_level: string;
  rank_name: string;
  min_points: number;
  achieved_at: string;
  lifetime_points_at_achievement: number;
  achievement_source: string;
  source_activity_type: string | null;
  source_description: string | null;
};
type Filter =
  | 'all'
  | 'formation'
  | 'bible'
  | 'devotional'
  | 'mentoring'
  | 'community'
  | 'other';

const FILTERS: {
  key: Filter;
  label: string;
}[] = [
  { key: 'all', label: 'All' },
  { key: 'formation', label: 'Formation' },
  { key: 'bible', label: 'Bible' },
  { key: 'devotional', label: 'Devotional' },
  { key: 'mentoring', label: 'Mentoring' },
  { key: 'community', label: 'Community' },
  { key: 'other', label: 'Other' },
];

function points(value: unknown) {
  const number = Number(value ?? 0);

  return `◉ ${number.toLocaleString('en-PH')}`;
}

function rank(value: number | null | undefined) {
  if (!value) {
    return '—';
  }

  return `#${value}`;
}

function dateLabel(value: string) {
  return new Date(value).toLocaleString('en-PH');
}

function activityLabel(type: string) {
  switch (type) {
    case 'formation_lesson':
      return 'Formation Lesson';

    case 'daily_bible':
      return 'Daily Bible Reading';

    case 'devotional':
      return 'Devotional';

    case 'mentor_session':
      return 'Mentor Teaching Session';

    case 'mentoring_release':
      return 'Mentoring Lesson';

    case 'reflection_quality_bonus':
      return 'Reflection Quality Bonus';

    case 'community_post':
      return 'Community Contribution';

    case 'community_comment':
      return 'Community Reply';

    case 'community_reaction':
  return 'Community Reaction';

case 'prayer_response':
  return 'Prayer / Encouragement';

case 'ministry_activity':
  return 'Ministry Participation';

case 'event_attendance':
  return 'Official Activity Attendance';

case 'scope_attendance':
  return 'Scope Attendance';

    case 'daily_bible_verification':
      return 'Daily Bible Reading — Verified';

    case 'learning_progress_verification':
      return 'Learning Progress — Verified';

case 'weekly_consistency':
      return 'Weekly Consistency';

    case 'stage_completion':
      return 'Stage Completion';

    case 'verified_giving_participation':
      return 'Verified Giving Participation';

    case 'admin_bonus':
      return 'Performance Bonus';

    default:
      return type
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (letter) =>
          letter.toUpperCase()
        );
  }
}

function claimGroupKeyForActivity(type: string) {
  if ([
    'community_post',
    'r36_publish_wall',
  ].includes(type)) {
    return 'posting';
  }

  if ([
    'community_comment',
    'community_reaction',
    'prayer_response',
    'r36_engager_comment',
    'r36_engager_reaction',
    'r36_engager_reply',
  ].includes(type)) {
    return 'engagement';
  }

  if ([
    'daily_bible',
    'daily_bible_verification',
  ].includes(type)) {
    return 'daily_bible';
  }

  if (type === 'devotional') {
    return 'devotional';
  }

  if ([
    'abc_growth_lesson',
    'formation_lesson',
    'learning_progress_verification',
    'stage_completion',
  ].includes(type)) {
    return 'formation';
  }

  if ([
    'mentor_session',
    'mentoring_release',
  ].includes(type)) {
    return 'mentoring';
  }

  if ([
    'event_attendance',
    'scope_attendance',
    'ministry_activity',
  ].includes(type)) {
    return 'attendance';
  }

  if ([
    'reflection_quality_bonus',
    'weekly_consistency',
    'verified_giving_participation',
    'admin_bonus',
  ].includes(type)) {
    return 'bonus';
  }

  return 'other';
}

function StatCard({
  label,
  value,
  primary = false,
}: {
  label: string;
  value: string;
  primary?: boolean;
}) {
  return (
    <View
      style={[
        styles.statCard,
        primary && styles.statCardPrimary,
      ]}
    >
      <Text
        style={[
          styles.statValue,
          primary && styles.statValuePrimary,
        ]}
      >
        {value}
      </Text>

      <Text
        style={[
          styles.statLabel,
          primary && styles.statLabelPrimary,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}


function CircleRankTracker({
  progress,
  ladder,
  character,
}: {
  progress: any;
  ladder: any[];
  character: BuklodCharacterConfig;
}) {
  const lifetimePoints =
    Number(progress?.lifetime_points ?? 0);

  const weeklyPoints =
    Number(progress?.weekly_points ?? 0);

  const monthlyPoints =
    Number(progress?.monthly_points ?? 0);

  const currentOrder =
    Number(progress?.rank_order ?? 1);

  const progressPercent =
    Math.max(
      0,
      Math.min(
        100,
        Number(
          progress?.progress_percent ?? 0
        )
      )
    );

  const pointsToNext =
    Number(
      progress?.points_to_next ?? 0
    );

  const grouped = ladder.reduce(
    (
      result: Record<string, any[]>,
      item: any
    ) => {
      const family =
        item.rank_family || 'BUKLOD Rank';

      if (!result[family]) {
        result[family] = [];
      }

      result[family].push(item);

      return result;
    },
    {}
  );

  const families =
    Object.entries(grouped) as [
      string,
      any[]
    ][];

  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 22,
        padding: 18,
        marginBottom: 18,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#DDE5E0',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '900',
              letterSpacing: 1.1,
              color: '#6E7D75',
            }}
          >
            MY CIRCLE RANK
          </Text>

          <Text
            style={{
              marginTop: 5,
              fontSize: 25,
              lineHeight: 30,
              fontWeight: '900',
              color: '#183D2C',
            }}
          >
            {progress?.rank_name ||
              'Circle Starter V'}
          </Text>
        </View>

        <BuklodCharacterFaceAvatar
          body={character.body}
          equipment={
            character.equipment
          }
          size={54}
        />
      </View>

      <Text
        style={{
          marginTop: 12,
          fontSize: 27,
          fontWeight: '900',
          color: '#1E2923',
        }}
      >
        {lifetimePoints.toLocaleString(
          'en-PH'
        )}{' '}
        pts
      </Text>

      <Text
        style={{
          marginTop: 2,
          fontSize: 12,
          color: '#77847D',
        }}
      >
        Lifetime BUKLOD Points
      </Text>

      <View
        style={{
          height: 11,
          marginTop: 16,
          borderRadius: 999,
          overflow: 'hidden',
          backgroundColor: '#E8ECEA',
        }}
      >
        <View
          style={{
            width: `${progressPercent}%`,
            height: '100%',
            borderRadius: 999,
            backgroundColor: '#275D45',
          }}
        />
      </View>

      <View
        style={{
          marginTop: 8,
          flexDirection: 'row',
          justifyContent: 'space-between',
          gap: 6,
        }}
      >
        <Text
          style={{
            flex: 1,
            fontSize: 12,
            fontWeight: '800',
            color: '#405047',
          }}
        >
          {progressPercent.toFixed(1)}%
          toward next rank
        </Text>

        <Text
          style={{
            fontSize: 12,
            fontWeight: '900',
            color: '#275D45',
          }}
        >
          {pointsToNext > 0
            ? `${pointsToNext.toLocaleString(
                'en-PH'
              )} pts remaining`
            : 'Highest rank reached'}
        </Text>
      </View>

      {progress?.next_rank_name ? (
        <View
          style={{
            marginTop: 13,
            padding: 12,
            borderRadius: 14,
            backgroundColor: '#F4F7F5',
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: '900',
              letterSpacing: 0.8,
              color: '#7B8780',
            }}
          >
            NEXT RANK
          </Text>

          <Text
            style={{
              marginTop: 3,
              fontSize: 15,
              fontWeight: '900',
              color: '#223029',
            }}
          >
            {progress.next_rank_name}
          </Text>

          <Text
            style={{
              marginTop: 2,
              fontSize: 11,
              color: '#78847D',
            }}
          >
            Unlocks at{' '}
            {Number(
              progress?.next_rank_points ??
                0
            ).toLocaleString('en-PH')}{' '}
            lifetime points
          </Text>
        </View>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          gap: 6,
          marginTop: 14,
        }}
      >
        <View
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 14,
            backgroundColor: '#F7F9F8',
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: '900',
              color: '#7A867F',
            }}
          >
            THIS WEEK
          </Text>

          <Text
            style={{
              marginTop: 4,
              fontSize: 18,
              fontWeight: '900',
              color: '#223029',
            }}
          >
            +
            {weeklyPoints.toLocaleString(
              'en-PH'
            )}
          </Text>
        </View>

        <View
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 14,
            backgroundColor: '#F7F9F8',
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: '900',
              color: '#7A867F',
            }}
          >
            THIS MONTH
          </Text>

          <Text
            style={{
              marginTop: 4,
              fontSize: 18,
              fontWeight: '900',
              color: '#223029',
            }}
          >
            +
            {monthlyPoints.toLocaleString(
              'en-PH'
            )}
          </Text>
        </View>
      </View>

      <View
        style={{
          marginTop: 22,
          paddingTop: 18,
          borderTopWidth:
            StyleSheet.hairlineWidth,
          borderTopColor: '#DDE5E0',
        }}
      >
        <Text
          style={{
            fontSize: 13,
            fontWeight: '900',
            color: '#223029',
          }}
        >
          CIRCLE RANK ROADMAP
        </Text>

        <Text
          style={{
            marginTop: 4,
            marginBottom: 14,
            fontSize: 11,
            lineHeight: 16,
            color: '#77847D',
          }}
        >
          V is the entry level. I is the
          highest level inside each Circle.
          Point requirements become wider as
          you advance.
        </Text>

        {families.map(
          ([family, rows]) => {
            const sortedRows = [...rows].sort(
              (a, b) =>
                Number(a.rank_order) -
                Number(b.rank_order)
            );

            const activeFamily =
              sortedRows.some(
                (row) =>
                  Number(row.rank_order) ===
                  currentOrder
              );

            const familyPassed =
              sortedRows.every(
                (row) =>
                  Number(row.rank_order) <
                  currentOrder
              );

            return (
              <View
                key={family}
                style={{
                  marginBottom: 11,
                  padding: 12,
                  borderRadius: 15,
                  backgroundColor:
                    activeFamily
                      ? '#EEF6F1'
                      : '#FAFBFA',
                  borderWidth:
                    activeFamily ? 1 : 0,
                  borderColor:
                    activeFamily
                      ? '#9DBAAA'
                      : 'transparent',
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent:
                      'space-between',
                    gap: 6,
                  }}
                >
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 12,
                      fontWeight: '900',
                      color:
                        activeFamily
                          ? '#275D45'
                          : '#35443C',
                    }}
                  >
                    {family}
                  </Text>

                  {activeFamily ? (
                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight: '900',
                        color: '#275D45',
                      }}
                    >
                      CURRENT
                    </Text>
                  ) : familyPassed ? (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={16}
                      color="#638071"
                    />
                  ) : null}
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    gap: 5,
                    marginTop: 10,
                  }}
                >
                  {sortedRows.map(
                    (row: any) => {
                      const rowOrder =
                        Number(
                          row.rank_order
                        );

                      const isCurrent =
                        rowOrder ===
                        currentOrder;

                      const isPassed =
                        rowOrder <
                        currentOrder;

                      return (
                        <View
                          key={
                            row.rank_name
                          }
                          style={{
                            flex: 1,
                            minHeight: 51,
                            alignItems:
                              'center',
                            justifyContent:
                              'center',
                            paddingVertical: 6,
                            paddingHorizontal: 2,
                            borderRadius: 9,
                            backgroundColor:
                              isCurrent
                                ? '#275D45'
                                : isPassed
                                ? '#DDE9E2'
                                : '#FFFFFF',
                            borderWidth:
                              isCurrent ||
                              isPassed
                                ? 0
                                : StyleSheet.hairlineWidth,
                            borderColor:
                              '#D8DFDB',
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight:
                                '900',
                              color:
                                isCurrent
                                  ? '#FFFFFF'
                                  : isPassed
                                  ? '#365545'
                                  : '#727E78',
                            }}
                          >
                            {
                              row.rank_level
                            }
                          </Text>

                          <Text
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            style={{
                              marginTop: 2,
                              fontSize: 8,
                              fontWeight:
                                '700',
                              color:
                                isCurrent
                                  ? '#E5F1EA'
                                  : '#87928C',
                            }}
                          >
                            {Number(
                              row.min_points ??
                                0
                            ).toLocaleString(
                              'en-PH'
                            )}
                          </Text>
                        </View>
                      );
                    }
                  )}
                </View>
              </View>
            );
          }
        )}
      </View>

      <View
        style={{
          marginTop: 4,
          padding: 12,
          borderRadius: 13,
          backgroundColor: '#F7F5EF',
        }}
      >
        <Text
          style={{
            fontSize: 10.5,
            lineHeight: 15,
            color: '#706B5C',
          }}
        >
          Circle Rank reflects recorded
          participation and progress inside
          BUKLOD. It does not represent
          spiritual maturity, holiness, church
          office, or ministry authority.
        </Text>
      </View>
    </View>
  );
}

function CircleRankAchievementHistory({
  history,
  currentOrder,
  available,
}: {
  history: CircleRankAchievement[];
  currentOrder: number;
  available: boolean;
}) {
  if (!available) {
    return null;
  }

  const rows = [...history].sort(
    (a, b) =>
      Number(b.rank_order) -
      Number(a.rank_order)
  );

  return (
    <View
      style={{
        marginBottom: 18,
        padding: 17,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#DDE5E0',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#EDF5F0',
          }}
        >
          <MaterialCommunityIcons
            name="trophy-variant-outline"
            size={23}
            color="#275D45"
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 10,
              fontWeight: '900',
              letterSpacing: 0.8,
              color: '#76837C',
            }}
          >
            CIRCLE RANK MILESTONES
          </Text>

          <Text
            style={{
              marginTop: 3,
              fontSize: 19,
              fontWeight: '900',
              color: '#202C26',
            }}
          >
            Achievement History
          </Text>
        </View>
      </View>

      <Text
        style={{
          marginTop: 11,
          fontSize: 11,
          lineHeight: 17,
          color: '#748078',
        }}
      >
        This is your permanent record of Circle
        Ranks genuinely reached after achievement
        tracking was enabled. A later point
        correction may change your current rank,
        but it does not erase an earned milestone.
      </Text>

      {rows.length === 0 ? (
        <View
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 14,
            backgroundColor: '#F7F9F8',
          }}
        >
          <Text
            style={{
              fontSize: 12,
              lineHeight: 18,
              color: '#6E7B74',
            }}
          >
            No Circle Rank milestones have been
            recorded yet since achievement tracking
            was enabled.
          </Text>
        </View>
      ) : (
        <View
          style={{
            marginTop: 15,
          }}
        >
          {rows.map((item, index) => {
            const isCurrent =
              Number(item.rank_order) ===
              Number(currentOrder);

            const sourceLabel =
              item.achievement_source === 'baseline'
                ? 'Starting Circle Rank'
                : item.source_activity_type
                ? activityLabel(
                    item.source_activity_type
                  )
                : 'BUKLOD activity';

            return (
              <View
                key={`${item.rank_order}:${item.rank_name}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'stretch',
                }}
              >
                <View
                  style={{
                    width: 32,
                    alignItems: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isCurrent
                        ? '#275D45'
                        : '#DDEBE2',
                    }}
                  >
                    <MaterialCommunityIcons
                      name="check-bold"
                      size={14}
                      color={
                        isCurrent
                          ? '#FFFFFF'
                          : '#275D45'
                      }
                    />
                  </View>

                  {index < rows.length - 1 && (
                    <View
                      style={{
                        width: 2,
                        flex: 1,
                        minHeight: 42,
                        backgroundColor: '#E1E7E3',
                      }}
                    />
                  )}
                </View>

                <View
                  style={{
                    flex: 1,
                    marginLeft: 0,
                    marginBottom:
                      index < rows.length - 1
                        ? 13
                        : 0,
                    padding: 13,
                    borderRadius: 14,
                    backgroundColor: isCurrent
                      ? '#EEF6F1'
                      : '#FAFBFA',
                    borderWidth: isCurrent
                      ? 1
                      : StyleSheet.hairlineWidth,
                    borderColor: isCurrent
                      ? '#9DBAAA'
                      : '#E0E5E2',
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      justifyContent:
                        'space-between',
                      gap: 6,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          lineHeight: 19,
                          fontWeight: '900',
                          color: '#203029',
                        }}
                      >
                        {item.rank_name}
                      </Text>

                      <Text
                        style={{
                          marginTop: 3,
                          fontSize: 10,
                          fontWeight: '800',
                          color: '#718078',
                        }}
                      >
                        {item.rank_family}
                        {' • '}
                        LEVEL {item.rank_level}
                      </Text>
                    </View>

                    {isCurrent && (
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 999,
                          backgroundColor:
                            '#275D45',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 8,
                            fontWeight: '900',
                            color: '#FFFFFF',
                          }}
                        >
                          CURRENT
                        </Text>
                      </View>
                    )}
                  </View>

                  <View
                    style={{
                      marginTop: 10,
                      paddingTop: 10,
                      borderTopWidth:
                        StyleSheet.hairlineWidth,
                      borderTopColor: '#DDE4E0',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: '900',
                        color: '#275D45',
                      }}
                    >
                      ACHIEVED
                    </Text>

                    <Text
                      style={{
                        marginTop: 3,
                        fontSize: 12,
                        fontWeight: '800',
                        color: '#3E4B44',
                      }}
                    >
                      {dateLabel(
                        item.achieved_at
                      )}
                    </Text>
                  </View>

                  <View
                    style={{
                      marginTop: 9,
                      flexDirection: 'row',
                      gap: 6,
                    }}
                  >
                    <View
                      style={{
                        flex: 1,
                        padding: 9,
                        borderRadius: 10,
                        backgroundColor: '#FFFFFF',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 8,
                          fontWeight: '900',
                          color: '#849089',
                        }}
                      >
                        RANK THRESHOLD
                      </Text>

                      <Text
                        style={{
                          marginTop: 3,
                          fontSize: 12,
                          fontWeight: '900',
                          color: '#27342D',
                        }}
                      >
                        {Number(
                          item.min_points ?? 0
                        ).toLocaleString('en-PH')}{' '}
                        pts
                      </Text>
                    </View>

                    <View
                      style={{
                        flex: 1,
                        padding: 9,
                        borderRadius: 10,
                        backgroundColor: '#FFFFFF',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 8,
                          fontWeight: '900',
                          color: '#849089',
                        }}
                      >
                        REACHED AT
                      </Text>

                      <Text
                        style={{
                          marginTop: 3,
                          fontSize: 12,
                          fontWeight: '900',
                          color: '#27342D',
                        }}
                      >
                        {Number(
                          item
                            .lifetime_points_at_achievement ??
                            0
                        ).toLocaleString('en-PH')}{' '}
                        pts
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={{
                      marginTop: 9,
                      fontSize: 10,
                      lineHeight: 16,
                      color: '#77837C',
                    }}
                  >
                    Source: {sourceLabel}
                  </Text>

                  {!!item.source_description && (
                    <Text
                      style={{
                        marginTop: 3,
                        fontSize: 10,
                        lineHeight: 16,
                        color: '#77837C',
                      }}
                    >
                      {item.source_description}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
export default function BuklodPointsScreen() {
  const { session } = useAuth();
  const { theme } = useBuklodPresentation();
  const characterEvents = useBuklodCharacterEventsOptional();
  const userId = session?.user?.id ?? null;

  const [dashboard, setDashboard] =
    useState<PointsDashboard | null>(null);

  const [claimGroups, setClaimGroups] =
    useState<BuklodClaimGroup[]>([]);

  const [claimingGroup, setClaimingGroup] =
    useState<string | null>(null);

  const [claimError, setClaimError] =
    useState<string | null>(null);

  const [expandedClaimGroups, setExpandedClaimGroups] =
    useState<Record<string, boolean>>({});

  const [character, setCharacter] =
    useState<BuklodCharacterConfig>({
      ...DEFAULT_CHARACTER,
    });

  const [customizeOpen, setCustomizeOpen] =
    useState(false);

  const [celebrationActive, setCelebrationActive] =
    useState(false);

  const [celebrationPoints, setCelebrationPoints] =
    useState<number | null>(null);

  const [hudPop, setHudPop] = useState(false);
  const previousLifetimeRef = useRef<number | null>(null);

  const [confirmedBalance, setConfirmedBalance] =
    useState<number | null>(null);

  const [confirmedAvailableBalance, setConfirmedAvailableBalance] =
    useState<number | null>(null);

  const [rankDashboard, setRankDashboard] =
    useState<RankDashboard | null>(null);

const [circleProgress, setCircleProgress] =
useState<any | null>(null);

const [circleLadder, setCircleLadder] =
useState<any[]>([]);

  const [

    circleRankHistory,

    setCircleRankHistory,

  ] = useState<CircleRankAchievement[]>([]);


  const [

    circleRankHistoryAvailable,

    setCircleRankHistoryAvailable,

  ] = useState(false);

  const [history, setHistory] =
    useState<PointRow[]>([]);

  const [evaluations, setEvaluations] =
    useState<EvaluationRow[]>([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [search, setSearch] = useState('');

  const [filter, setFilter] =
    useState<Filter>('all');

  // PATCH_154H_LEADERBOARD_STATE
  const [leaderboardOpen, setLeaderboardOpen] = useState(true);
  const [leaderboardPeriod, setLeaderboardPeriod] =
    useState<'weekly' | 'monthly' | 'all_time'>('all_time');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [leaderboardBusy, setLeaderboardBusy] = useState(false);

  const loadLeaderboard = useCallback(
    async (period: 'weekly' | 'monthly' | 'all_time') => {
      setLeaderboardBusy(true);

      const { data, error } = await (supabase as any).rpc(
        'get_buklod_points_leaderboard',
        {
          p_period: period,
          p_limit: 10,
          p_church_id: null,
        }
      );

      if (error) {
        console.warn('BUKLOD leaderboard:', error.message);
        setLeaderboard([]);
      } else {
        const rankingRows =
          Array.isArray(data)
            ? [...data]
            : [];

        rankingRows.sort((a: any, b: any) => {
          const aPoints = Number(
            a?.points ??
            a?.total_points ??
            a?.lifetime_points ??
            a?.score ??
            0
          );
          const bPoints = Number(
            b?.points ??
            b?.total_points ??
            b?.lifetime_points ??
            b?.score ??
            0
          );

          if (bPoints !== aPoints) {
            return bPoints - aPoints;
          }

          const aName = String(
            a?.full_name ??
            a?.name ??
            a?.display_name ??
            a?.user_id ??
            ''
          );
          const bName = String(
            b?.full_name ??
            b?.name ??
            b?.display_name ??
            b?.user_id ??
            ''
          );

          return aName.localeCompare(bName);
        });

        setLeaderboard(rankingRows);
      }

      setLeaderboardBusy(false);
    },
    []
  );

  // RESTORE_TOP10_VISIBLE_R1
  useEffect(() => {
    void loadLeaderboard('all_time');
  }, [loadLeaderboard]);

  const loadCircleRank =
    useCallback(async () => {
      try {
        const [
          progressResult,
          ladderResult,
          historyResult,
        ] = await Promise.all([
          (supabase as any).rpc(
            'get_my_buklod_rank_progress'
          ),

          (supabase as any).rpc(
            'get_buklod_rank_ladder'
          ),

          (supabase as any).rpc(
            'get_my_buklod_rank_history'
          ),
        ]);

        if (!progressResult.error) {
          const raw =
            progressResult.data;

          const row =
            Array.isArray(raw)
              ? raw[0] ?? null
              : raw ?? null;

          setCircleProgress(row);
        }

        if (!ladderResult.error) {
          setCircleLadder(
            Array.isArray(
              ladderResult.data
            )
              ? ladderResult.data
              : []
          );
        }

        if (!historyResult.error) {
          setCircleRankHistory(
            Array.isArray(
              historyResult.data
            )
              ? historyResult.data
              : []
          );

          setCircleRankHistoryAvailable(
            true
          );
        } else {
          // PATCH 153G-5A may not be
          // deployed to the remote DB yet.
          // Keep the existing Points screen
          // completely usable.
          setCircleRankHistory([]);
          setCircleRankHistoryAvailable(
            false
          );
        }
      } catch {
        // New Circle Rank migrations may not
        // be applied to the remote DB yet.
        setCircleRankHistory([]);
        setCircleRankHistoryAvailable(
          false
        );
      }
    }, []);
const load = useCallback(async () => {
  await loadCircleRank();
    const [
      rankResult,
      historyResult,
      evaluationResult,
    ] = await Promise.all([
      supabase.rpc(
        'get_my_buklod_rank_dashboard'
      ),

      supabase
        .from('buklod_points_ledger')
        .select(
          'id,direction,claim_state,points,activity_type,source_key,source_id,description,created_at'
        )
        .order('created_at', {
          ascending: false,
        })
        .limit(300),

      supabase
        .from('buklod_points_evaluations')
        .select(
          'id,period_type,period_start,period_end,points_snapshot,performance_score,bayanihan_bonus,admin_note,evaluated_at'
        )
        .order('evaluated_at', {
          ascending: false,
        })
        .limit(50),
    ]);

    try {
      const nextDashboard = await loadBuklodPointsDashboard();
      setDashboard(nextDashboard);
    } catch (dashboardError: unknown) {
      Alert.alert(
        'BUKLOD Points',
        dashboardError instanceof Error
          ? dashboardError.message
          : 'Could not load BUKLOD Points.',
      );
    }

    try {
      const groups = await loadBuklodClaimGroups();
      setClaimGroups(groups);
      setClaimError(null);
    } catch (claimGroupsError: unknown) {
      const message =
        claimGroupsError instanceof Error
          ? claimGroupsError.message
          : 'Could not load claimable activities.';
      console.warn('BUKLOD claim groups:', message);
      setClaimGroups([]);
      setClaimError(message);
    }

    if (rankResult.error) {
      Alert.alert(
        'BUKLOD Rank',
        rankResult.error.message
      );
    } else {
      setRankDashboard(
        rankResult.data as RankDashboard
      );
    }

    if (historyResult.error) {
      Alert.alert(
        'Points History',
        historyResult.error.message
      );
    } else {
      setHistory(
        (historyResult.data ?? []) as PointRow[]
      );
    }

    if (evaluationResult.error) {
      Alert.alert(
        'Points Evaluation',
        evaluationResult.error.message
      );
    } else {
      setEvaluations(
        (evaluationResult.data ??
          []) as EvaluationRow[]
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    void loadCharacterProgressionConfig();
  }, [load]);

  useEffect(() => {
    const lifetimePoints =
      confirmedBalance ??
      dashboard?.lifetime_points ??
      dashboard?.total_points ??
      0;
    void loadBuklodCharacter(userId).then((loaded) => {
      const reconciled = reconcileCharacterForPoints(
        loaded,
        lifetimePoints
      );
      setCharacter(reconciled);
    });
  }, [
    userId,
    confirmedBalance,
    dashboard?.lifetime_points,
    dashboard?.total_points,
  ]);

  useEffect(() => {
    if (dashboard) {
      setConfirmedBalance(
        dashboard.lifetime_points ?? dashboard.total_points,
      );
      setConfirmedAvailableBalance(
        dashboard.available_points ?? dashboard.total_points,
      );
    }
  }, [
    dashboard?.lifetime_points,
    dashboard?.available_points,
    dashboard?.total_points,
  ]);

  useEffect(() => {
    if (!dashboard || !characterEvents) return;

    const current =
      dashboard.lifetime_points ?? dashboard.total_points;
    const previous = previousLifetimeRef.current;

    if (previous !== null && current > previous) {
      const unlocked = itemsUnlockedBetween(
        previous,
        current,
        character.body
      );

      if (unlocked.length > 0) {
        const first = unlocked[0];
        characterEvents.emit({
          type: CharacterEventType.ITEM_REVEAL,
          success: true,
          itemName: first.name,
          itemId: first.id,
        });
      } else if (current - previous >= 5) {
        characterEvents.emit({
          type: CharacterEventType.POINTS_EARNED,
          success: true,
          points: current - previous,
        });
      }
    }

    previousLifetimeRef.current = current;
  }, [character.body, characterEvents, dashboard?.total_points]);

  const claimGroup = async (group: BuklodClaimGroup) => {
    if (claimingGroup) {
      return;
    }

    setClaimingGroup(group.group_key);
    setClaimError(null);

    try {
      const result = await claimBuklodRewardGroup(group.group_key);

      if (result.claimed_count <= 0 || result.claimed_points <= 0) {
        setClaimError(
          'Wala nang pending points sa activity group na ito. Ni-refresh ang listahan.',
        );
        await load();
        return;
      }

      setConfirmedBalance(result.lifetime_points);
      setConfirmedAvailableBalance(result.available_points);
      setDashboard((current) =>
        current
          ? {
              ...current,
              total_points: result.lifetime_points,
              lifetime_points: result.lifetime_points,
              available_points: result.available_points,
              pending_claimable_points: Math.max(
                0,
                current.pending_claimable_points - result.claimed_points,
              ),
            }
          : current,
      );

      setClaimGroups((current) =>
        current.filter((item) => item.group_key !== group.group_key),
      );
      setExpandedClaimGroups((current) => ({
        ...current,
        [group.group_key]: false,
      }));

      if (result.rank_up) {
        characterEvents?.emit({
          type: CharacterEventType.MILESTONE_REACHED,
          success: true,
          spokenText: result.rank_name
            ? `Rank up! You are now ${result.rank_name}.`
            : undefined,
        });
      }

      characterEvents?.emit({
        type: CharacterEventType.POINTS_CLAIMED,
        success: true,
        points: result.claimed_points,
        spokenText:
          `${group.group_label}: ${result.claimed_points.toLocaleString('en-PH')} points claimed.`,
        dialogue:
          `${group.group_label} — +${result.claimed_points.toLocaleString('en-PH')} pts`,
      });

      setCelebrationPoints(result.claimed_points);
      setCelebrationActive(true);
      setHudPop(true);

      await load();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Claim failed. No points were awarded.';
      console.warn('BUKLOD grouped claim:', message);
      setClaimError(message);
    } finally {
      setClaimingGroup(null);
    }
  };

  const onCelebrationComplete = () => {
    setCelebrationActive(false);
    setCelebrationPoints(null);
    setHudPop(false);
  };

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return history.filter((item) => {
      const type = item.activity_type;

      let matches = true;

      if (filter === 'formation') {
        matches =
          type === 'formation_lesson' ||
          type === 'stage_completion';
      }

      if (filter === 'bible') {
        matches = type === 'daily_bible';
      }

      if (filter === 'devotional') {
        matches =
          type === 'devotional' ||
          type === 'reflection_quality_bonus';
      }

      if (filter === 'mentoring') {
        matches =
          type === 'mentor_session' ||
          type === 'mentoring_release';
      }

      if (filter === 'community') {
        matches =
          type === 'community_post' ||
          type === 'community_comment';
      }

      if (filter === 'other') {
        matches = ![
          'formation_lesson',
          'stage_completion',
          'daily_bible',
          'devotional',
          'reflection_quality_bonus',
          'mentor_session',
          'mentoring_release',
          'community_post',
          'community_comment',
        ].includes(type);
      }

      if (!matches) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = [
        activityLabel(type),
        item.description ?? '',
        item.source_key ?? '',
        String(item.points),
      ]
        .join(' ')
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [history, search, filter]);

  const pendingClaimRows = useMemo(
    () =>
      history.filter(
        (item) =>
          item.direction === 'credit' &&
          item.claim_state === 'pending',
      ),
    [history],
  );

  const claimableCount = claimGroups.reduce(
    (sum, group) => sum + group.event_count,
    0,
  );

  const recentHistory = filtered.slice(0, 5);

  return (
    <>
      <BuklodPortalScrollView
      style={shared.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
        />
      }
    >
      {loading || !dashboard ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            Loading BUKLOD Points...
          </Text>
        </View>
      ) : (
        <>
          <View style={{ position: 'relative' }}>
            <BuklodPointsStage
              character={character}
              lifetimePoints={
                confirmedBalance ??
                dashboard.lifetime_points ??
                dashboard.total_points
              }
              availablePoints={
                confirmedAvailableBalance ??
                dashboard.available_points ??
                dashboard.total_points
              }
              claimableCount={claimableCount}
              hudPop={hudPop}
              pointsToNext={
                circleProgress?.points_to_next ??
                rankDashboard?.lifetime.points_to_next ??
                null
              }
              rankName={
                circleProgress?.rank_name ??
                rankDashboard?.lifetime.rank_name ??
                null
              }
              nextRankName={
                circleProgress?.next_rank_name ??
                rankDashboard?.lifetime.next_rank_name ??
                null
              }
              onOpenCustomize={() => setCustomizeOpen(true)}
            />

            <BuklodPointsClaimCelebration
              active={celebrationActive}
              points={celebrationPoints}
              onComplete={onCelebrationComplete}
            />
          </View>

          <View style={styles.sectionPad}>
            <BuklodParticipationProgress
              rankName={
                circleProgress?.rank_name ??
                rankDashboard?.lifetime.rank_name
              }
              progressPercent={
                Number(
                  circleProgress?.progress_percent ??
                    rankDashboard?.lifetime
                      .progress_percent ??
                    0
                )
              }
              pointsToNext={
                circleProgress?.points_to_next ??
                rankDashboard?.lifetime.points_to_next
              }
              nextRankName={
                circleProgress?.next_rank_name ??
                rankDashboard?.lifetime.next_rank_name
              }
              weeklyPoints={dashboard.weekly_points}
              monthlyPoints={dashboard.monthly_points}
            />
          </View>

          {/* BUKLOD_CHARACTER_REWARD_ROADMAP_500K_INSERT */}
          <View style={styles.sectionPad}>
            <BuklodCharacterRewardRoadmap
              lifetimePoints={
                confirmedBalance ??
                dashboard.lifetime_points ??
                dashboard.total_points
              }
              body={character.body}
              currentRankName={
                circleProgress?.rank_name ??
                rankDashboard?.lifetime.rank_name ??
                null
              }
              nextRankName={
                circleProgress?.next_rank_name ??
                rankDashboard?.lifetime.next_rank_name ??
                null
              }
              onOpenCustomize={() =>
                setCustomizeOpen(true)
              }
            />
          </View>
          {(claimGroups.length > 0 || claimError) && (
            <View style={styles.sectionPad}>
              <Text style={styles.sectionEyebrow}>
                CLAIMABLE REWARDS
              </Text>
              <Text style={[styles.sectionTitle, { marginBottom: 4 }]}>
                Ready to Claim
              </Text>
              <Text
                style={{
                  marginBottom: 10,
                  fontSize: 11,
                  lineHeight: 16,
                  color: theme.textMuted,
                }}
              >
                Each list shows the completed activities that created your pending points. Claim All applies only to that activity group.
              </Text>

              {claimGroups.map((group, index) => {
                const groupItems = pendingClaimRows.filter(
                  (item) =>
                    claimGroupKeyForActivity(item.activity_type) ===
                    group.group_key,
                );
                const expanded = Boolean(
                  expandedClaimGroups[group.group_key],
                );
                const visibleItems = expanded
                  ? groupItems
                  : groupItems.slice(0, 5);
                const notLoadedCount = Math.max(
                  0,
                  group.event_count - groupItems.length,
                );
                const busy = claimingGroup === group.group_key;
                const anyBusy = claimingGroup !== null;

                return (
                  <PointsFocusCard
                    key={group.group_key}
                    index={index}
                  >
                    <View
                      style={[
                        styles.historyCard,
                        { padding: 14, marginBottom: 10 },
                      ]}
                    >
                      <View style={styles.rowBetween}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={styles.historyTitle}>
                            {group.group_label}
                          </Text>
                          <Text style={styles.meta}>
                            {group.event_count.toLocaleString('en-PH')}{' '}
                            {group.event_count === 1
                              ? 'completed activity'
                              : 'completed activities'}
                          </Text>
                        </View>
                        <Text style={[styles.pointsAmount, styles.pointsCredit]}>
                          +{group.total_points.toLocaleString('en-PH')} pts
                        </Text>
                      </View>

                      <View
                        style={{
                          marginTop: 10,
                          borderTopWidth: StyleSheet.hairlineWidth,
                          borderTopColor: theme.border,
                        }}
                      >
                        {visibleItems.length === 0 ? (
                          <Text
                            style={{
                              paddingVertical: 10,
                              fontSize: 10.5,
                              lineHeight: 16,
                              color: theme.textMuted,
                            }}
                          >
                            Pending activity details are being reconciled. The group total above remains authoritative.
                          </Text>
                        ) : (
                          visibleItems.map((item) => (
                            <View
                              key={item.id}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'flex-start',
                                gap: 8,
                                paddingVertical: 9,
                                borderBottomWidth: StyleSheet.hairlineWidth,
                                borderBottomColor: theme.border,
                              }}
                            >
                              <View style={{ flex: 1 }}>
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: '900',
                                    color: theme.textPrimary,
                                  }}
                                >
                                  {activityLabel(item.activity_type)}
                                </Text>
                                {!!item.description && (
                                  <Text
                                    numberOfLines={2}
                                    style={{
                                      marginTop: 2,
                                      fontSize: 10,
                                      lineHeight: 14,
                                      color: theme.textMuted,
                                    }}
                                  >
                                    {item.description}
                                  </Text>
                                )}
                                <Text style={[styles.meta, { marginTop: 2 }]}>
                                  {dateLabel(item.created_at)}
                                </Text>
                              </View>
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: '900',
                                  color: theme.accent,
                                }}
                              >
                                +{Number(item.points).toLocaleString('en-PH')} pts
                              </Text>
                            </View>
                          ))
                        )}
                      </View>

                      {groupItems.length > 5 ? (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() =>
                            setExpandedClaimGroups((current) => ({
                              ...current,
                              [group.group_key]: !expanded,
                            }))
                          }
                          style={{
                            alignSelf: 'flex-start',
                            paddingVertical: 8,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 9.5,
                              fontWeight: '900',
                              color: theme.accent,
                            }}
                          >
                            {expanded
                              ? 'SHOW LESS'
                              : `SHOW ALL ${groupItems.length.toLocaleString('en-PH')} ACTIVITIES`}
                          </Text>
                        </Pressable>
                      ) : null}

                      {notLoadedCount > 0 ? (
                        <Text
                          style={{
                            marginBottom: 8,
                            fontSize: 9.5,
                            lineHeight: 14,
                            color: theme.textMuted,
                          }}
                        >
                          +{notLoadedCount.toLocaleString('en-PH')} more pending activities are included in this Claim All.
                        </Text>
                      ) : null}

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Claim all ${group.group_label} points`}
                        disabled={anyBusy}
                        onPress={() => void claimGroup(group)}
                        style={({ pressed }) => ({
                          minHeight: 44,
                          marginTop: 4,
                          borderRadius: 13,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: theme.buttonPrimary,
                          opacity: anyBusy && !busy ? 0.55 : pressed ? 0.86 : 1,
                        })}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: '900',
                            letterSpacing: 0.45,
                            color: theme.white,
                          }}
                        >
                          {busy
                            ? 'CLAIMING...'
                            : `CLAIM ALL · +${group.total_points.toLocaleString('en-PH')} PTS`}
                        </Text>
                      </Pressable>
                    </View>
                  </PointsFocusCard>
                );
              })}

              {claimError ? (
                <Text
                  style={{
                    marginTop: 2,
                    fontSize: 10,
                    lineHeight: 15,
                    color: theme.danger,
                  }}
                >
                  {claimError}
                </Text>
              ) : null}
            </View>
          )}

          <View style={styles.sectionPad}>
            <BuklodRedeemCatalogSection
              availablePoints={
                confirmedAvailableBalance ??
                dashboard.available_points ??
                0
              }
              onRedeemed={(nextAvailable) => {
                setConfirmedAvailableBalance(nextAvailable);
                setDashboard((current) =>
                  current
                    ? { ...current, available_points: nextAvailable }
                    : current,
                );
              }}
            />
          </View>

          <View style={styles.sectionPad}>
            <BuklodMyCollectionCard
              index={1}
              lifetimePoints={
                confirmedBalance ??
                dashboard.lifetime_points ??
                dashboard.total_points
              }
              body={character.body}
              equipment={character.equipment}
            />
          </View>

          <View style={styles.sectionPad}>
            <PointsFocusCard index={2}>
              <Pressable
                onPress={() => setCustomizeOpen(true)}
                style={({ pressed }) => [
                  styles.customizeEntry,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                  pressed && { opacity: 0.9 },
                ]}
              >
                <MaterialCommunityIcons
                  name="account-edit-outline"
                  size={22}
                  color={theme.accent}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.customizeTitle,
                      { color: theme.textPrimary },
                    ]}
                  >
                    Customize Character
                  </Text>
                  <Text
                    style={[
                      styles.customizeSub,
                      { color: theme.textMuted },
                    ]}
                  >
                    Local preview — not synced across devices
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={22}
                  color={theme.textMuted}
                />
              </Pressable>
            </PointsFocusCard>
          </View>

          <View style={styles.sectionPad}>
            <Text style={styles.sectionEyebrow}>
              RECENT ACTIVITY
            </Text>
            <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>
              Latest Points
            </Text>

            {recentHistory.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  No points activity yet.
                </Text>
              </View>
            ) : (
              recentHistory.map((item, index) => {
                const credit =
                  item.direction === 'credit';

                return (
                  <PointsFocusCard
                    key={item.id}
                    index={index + 3}
                  >
                    <View style={styles.historyCard}>
                      <View style={styles.rowBetween}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.historyTitle}>
                            {activityLabel(
                              item.activity_type
                            )}
                          </Text>
                          <Text style={styles.meta}>
                            {dateLabel(item.created_at)}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.pointsAmount,
                            credit
                              ? styles.pointsCredit
                              : styles.pointsDebit,
                          ]}
                        >
                          {credit ? '+' : '-'}
                          {points(item.points)}
                        </Text>
                      </View>
                    </View>
                  </PointsFocusCard>
                );
              })
            )}

            <Pressable
              style={{ marginTop: 6 }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '800',
                  color: theme.accent,
                }}
              >
                Full history below ↓
              </Text>
            </Pressable>
          </View>
          {/* CIRCLE_TRACKER_153G2 */}
          {circleProgress ? (
            <View style={styles.sectionPad}>
              <CircleRankTracker
                progress={circleProgress}
                ladder={circleLadder}
                character={character}
              />
            </View>
          ) : null}
          {/* CIRCLE_RANK_HISTORY_153G5B */}
          <View style={styles.sectionPad}>
            <CircleRankAchievementHistory
              history={circleRankHistory}
              currentOrder={Number(
                circleProgress?.rank_order ?? 1
              )}
              available={
                circleRankHistoryAvailable
              }
            />
          </View>
          {rankDashboard && !circleProgress && (
            <View style={styles.rankFeature}>
              <BuklodRankCard
                rankName={rankDashboard.lifetime.rank_name}
                points={rankDashboard.lifetime.points}
                nextRankName={
                  rankDashboard.lifetime.next_rank_name
                }
                pointsToNext={
                  rankDashboard.lifetime.points_to_next
                }
                progressPercent={
                  rankDashboard.lifetime.progress_percent
                }
                seasonTitle={
                  rankDashboard.season?.title ?? null
                }
                overallPosition={
                  rankDashboard.season
                    ?.overall_position ?? null
                }
                localPosition={
                  rankDashboard.season
                    ?.local_position ?? null
                }
              />
            </View>
          )}

          <View style={styles.statsRow}>
            <StatCard
              label="This Week"
              value={points(
                dashboard.weekly_points
              )}
              primary
            />

            <StatCard
              label="This Month"
              value={points(
                dashboard.monthly_points
              )}
            />
          </View>

                    {/* PATCH_154H_LEADERBOARD_TRIGGER */}
          <Pressable
            style={styles.sectionHeader}
            onPress={() => {
              const next = !leaderboardOpen;
              setLeaderboardOpen(next);
              if (next) void loadLeaderboard(leaderboardPeriod);
            }}
            accessibilityRole="button"
            accessibilityLabel="Open Top 10 Members leaderboard"
          >
            <Text style={styles.sectionEyebrow}>MY RANKING</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.sectionTitle}>Top 10 Members</Text>
              <MaterialCommunityIcons name={leaderboardOpen ? 'chevron-up' : 'chevron-down'} size={23} color={"#275D45"} />
            </View>
          </Pressable>

          <View style={styles.rankCard}>
            <RankRow
              label="Weekly"
              value={rank(
                dashboard.weekly_rank
              )}
            />

            <RankRow
              label="Monthly"
              value={rank(
                dashboard.monthly_rank
              )}
            />

            <RankRow
              label="All-Time"
              value={rank(
                dashboard.all_time_rank
              )}
              last
            />
          </View>

          {/* PATCH_154H_LEADERBOARD_PANEL */}
          {leaderboardOpen && (
            <View
              style={{
                marginTop: 10,
                backgroundColor: '#FFFFFF',
                borderRadius: 18,
                borderWidth: 1,
                borderColor: 'rgba(25,45,35,0.09)',
                padding: 12,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  gap: 6,
                  marginBottom: 12,
                }}
              >
                {(['weekly', 'monthly', 'all_time'] as const).map(
                  (period) => (
                    <Pressable
                      key={period}
                      onPress={() => {
                        setLeaderboardPeriod(period);
                        void loadLeaderboard(period);
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 9,
                        borderRadius: 12,
                        alignItems: 'center',
                        backgroundColor:
                          leaderboardPeriod === period
                            ? '#E7F2EC'
                            : '#F6F8F7',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '900',
                          color: '#275D45',
                        }}
                      >
                        {period === 'all_time'
                          ? 'ALL-TIME'
                          : period.toUpperCase()}
                      </Text>
                    </Pressable>
                  )
                )}
              </View>

              {leaderboardBusy ? (
                <Text style={shared.muted}>
                  Loading Top Notchers...
                </Text>
              ) : leaderboard.length === 0 ? (
                <Text style={shared.muted}>
                  No ranking data yet.
                </Text>
              ) : (
                leaderboard.map((item: any) => (
                  <View
                    key={`${leaderboardPeriod}-${item.user_id}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 10,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: 'rgba(25,45,35,0.09)',
                    }}
                  >
                    <Text
                      style={{
                        width: 42,
                        fontSize: 17,
                        fontWeight: '900',
                        color: '#275D45',
                      }}
                    >
                      #{item.rank_position}
                    </Text>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: '800',
                          color: '#183D2C',
                        }}
                      >
                        {resolvePersonDisplayName(
                          item.full_name,
                          item.user_id,
                        )}
                      </Text>

                      <Text
                        style={{
                          marginTop: 2,
                          fontSize: 10.5,
                          color: '#6E7D75',
                        }}
                      >
                        {item.church_name || 'No Local'}
                      </Text>
                    </View>

                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '900',
                        color: '#275D45',
                      }}
                    >
                      {Number(item.total_points ?? 0).toLocaleString()} pts
                    </Text>
                  </View>
                ))
              )}
            </View>
          )}

          {evaluations.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text
                  style={styles.sectionEyebrow}
                >
                  ADMIN EVALUATION
                </Text>

                <Text style={styles.sectionTitle}>
                  Performance Rewards
                </Text>
              </View>

              {evaluations.map((item) => (
                <View
                  key={item.id}
                  style={styles.evaluationCard}
                >
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={
                          styles.evaluationTitle
                        }
                      >
                        {item.period_type
                          .replace('_', ' ')
                          .toUpperCase()}{' '}
                        EVALUATION
                      </Text>

                      <Text style={styles.meta}>
                        {item.period_start} to{' '}
                        {item.period_end}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={
                      styles.evaluationMetrics
                    }
                  >
                    <Text
                      style={
                        styles.evaluationMetric
                      }
                    >
                      Points snapshot:{' '}
                      {points(
                        item.points_snapshot
                      )}
                    </Text>

                    {item.performance_score !==
                      null && (
                      <Text
                        style={
                          styles.evaluationMetric
                        }
                      >
                        Evaluation:{' '}
                        {Number(
                          item.performance_score
                        ).toFixed(1)}
                        %
                      </Text>
                    )}
                  </View>

                  {!!item.admin_note && (
                    <Text style={styles.note}>
                      {item.admin_note}
                    </Text>
                  )}
                </View>
              ))}
            </>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEyebrow}>
              ACTIVITY
            </Text>

            <Text style={styles.sectionTitle}>
              Points History
            </Text>
          </View>

          <View style={styles.searchBox}>
            <MaterialCommunityIcons
              name="magnify"
              size={21}
              color="#7C8881"
            />

            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search points history"
            />

            {!!search && (
              <Pressable
                onPress={() => setSearch('')}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color="#7C8881"
                />
              </Pressable>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
            contentContainerStyle={
              styles.filters
            }
          >
            {FILTERS.map((item) => (
              <Pressable
                key={item.key}
                onPress={() =>
                  setFilter(item.key)
                }
                style={[
                  styles.filterChip,
                  filter === item.key &&
                    styles.filterChipOn,
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    filter === item.key &&
                      styles.filterTextOn,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {filtered.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>
                No matching points yet
              </Text>

              <Text style={styles.emptyText}>
                Approved eligible activities
                will appear here automatically.
              </Text>
            </View>
          ) : (
            filtered.map((item) => {
              const credit =
                item.direction === 'credit';

              return (
                <View
                  key={item.id}
                  style={styles.historyCard}
                >
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={
                          styles.historyTitle
                        }
                      >
                        {activityLabel(
                          item.activity_type
                        )}
                      </Text>

                      <Text style={styles.meta}>
                        {dateLabel(
                          item.created_at
                        )}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.pointsAmount,
                        credit
                          ? styles.pointsCredit
                          : styles.pointsDebit,
                      ]}
                    >
                      {credit ? '+' : '-'}
                      {points(item.points)}
                    </Text>
                  </View>

                  {!!item.description && (
                    <Text style={styles.note}>
                      {item.description}
                    </Text>
                  )}
                </View>
              );
            })
          )}
        </>
      )}

      <View style={styles.disclaimer}>
        <MaterialCommunityIcons
          name="information-outline"
          size={21}
          color="#275D45"
        />

        <Text style={styles.disclaimerText}>
          BUKLOD Points recognize recorded
          participation and progress. Rankings
          are not measurements of spirituality,
          faith, character or personal worth.
        </Text>
      </View>

      <Text style={styles.brand}>
        SAMAHANG BINUKLOD NG PAG-IBIG
      </Text>
      </BuklodPortalScrollView>

      <BuklodCharacterCustomizeSheet
        visible={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        userId={userId}
        lifetimePoints={
          confirmedBalance ?? dashboard?.total_points ?? 0
        }
        onSaved={setCharacter}
      />
    </>
  );
}

function RankRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.rankRow,
        last && {
          borderBottomWidth: 0,
        },
      ]}
    >
      <Text style={styles.rankLabel}>
        {label}
      </Text>

      <Text style={styles.rankValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 0,
    paddingTop: 12,
    paddingBottom: 160,
  },

  sectionPad: {
    paddingHorizontal: 12,
    marginBottom: 8,
  },

  customizeEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },

  customizeTitle: {
    fontSize: 14,
    fontWeight: '900',
  },

  customizeSub: {
    marginTop: 3,
    fontSize: 10.5,
  },

  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 18,
    marginBottom: 6,
    borderRadius: 0,
    backgroundColor: 'rgba(39,93,69,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(39,93,69,0.13)',
    paddingLeft: 0,
    marginLeft: 0,
    paddingStart: 0,
    marginStart: 0,
  },

  symbol: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 29,
    backgroundColor: '#275D45',
  },

  symbolText: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  eyebrow: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: '#7A867F',
  },

  title: {
    marginTop: 3,
    fontSize: 27,
    fontWeight: '900',
    color: '#1E2A24',
  },

  subtitle: {
    display: 'none',
    marginTop: 5,
    fontSize: 11.5,
    lineHeight: 17,
    color: '#6D7972',
  },

  totalCard: {
    padding: 22,
    marginBottom: 6,
    borderRadius: 0,
    backgroundColor: '#275D45',
    paddingLeft: 0,
    marginLeft: 0,
    paddingStart: 0,
    marginStart: 0,
  },

  totalEyebrow: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.72)',
  },

  totalValue: {
    marginTop: 6,
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  totalNote: {
    marginTop: 6,
    fontSize: 10.5,
    lineHeight: 15,
    color: 'rgba(255,255,255,0.75)',
  },

  rankFeature: {
    marginBottom: 6,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },

  statCard: {
    flex: 1,
    minHeight: 92,
    justifyContent: 'center',
    padding: 13,
    borderRadius: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,45,35,0.09)',
    paddingLeft: 0,
    marginLeft: 0,
    paddingStart: 0,
    marginStart: 0,
  },

  statCardPrimary: {
    backgroundColor: 'rgba(39,93,69,0.07)',
    borderColor: 'rgba(39,93,69,0.17)',
  },

  statValue: {
    fontSize: 17,
    fontWeight: '900',
    color: '#344139',
  },

  statValuePrimary: {
    color: '#275D45',
  },

  statLabel: {
    marginTop: 5,
    fontSize: 10,
    color: '#7D8982',
  },

  statLabelPrimary: {
    color: '#65726B',
  },

  sectionHeader: {
    marginTop: 4,
    marginBottom: 6,
  },

  sectionEyebrow: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: '#89938D',
  },

  sectionTitle: {
    marginTop: 2,
    fontSize: 20,
    fontWeight: '900',
    color: '#202C26',
  },

  rankCard: {
    marginBottom: 6,
    paddingHorizontal: 15,
    borderRadius: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,45,35,0.09)',
    paddingLeft: 0,
    marginLeft: 0,
    paddingStart: 0,
    marginStart: 0,
  },

  rankRow: {
    minHeight: 57,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth:
      StyleSheet.hairlineWidth,
    borderBottomColor:
      'rgba(25,45,35,0.09)',
  },

  rankLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#59665F',
  },

  rankValue: {
    fontSize: 19,
    fontWeight: '900',
    color: '#275D45',
  },

  evaluationCard: {
    padding: 15,
    marginBottom: 6,
    borderRadius: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,45,35,0.09)',
    paddingLeft: 0,
    marginLeft: 0,
    paddingStart: 0,
    marginStart: 0,
  },

  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },

  evaluationTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#27342D',
  },

  evaluationMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },

  evaluationMetric: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#647169',
  },

  bonusAmount: {
    fontSize: 17,
    fontWeight: '900',
    color: '#275D45',
  },

  bonusNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    padding: 9,
    borderRadius: 11,
    backgroundColor: 'rgba(39,93,69,0.06)',
  },

  bonusNoticeText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 14,
    color: '#65726B',
  },

  searchBox: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,45,35,0.10)',
  },

  searchInput: {
    flex: 1,
    color: '#25322B',
  },

  filters: {
    gap: 6,
    paddingVertical: 11,
    paddingRight: 15,
  },

  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,45,35,0.10)',
  },

  filterChipOn: {
    backgroundColor: '#275D45',
    borderColor: '#275D45',
  },

  filterText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#68756E',
  },

  filterTextOn: {
    color: '#FFFFFF',
    fontWeight: '900',
  },

  historyCard: {
    padding: 14,
    marginBottom: 6,
    borderRadius: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,45,35,0.08)',
    paddingLeft: 0,
    marginLeft: 0,
    paddingStart: 0,
    marginStart: 0,
  },

  historyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#25322B',
  },

  pointsAmount: {
    fontSize: 14,
    fontWeight: '900',
  },

  pointsCredit: {
    color: '#275D45',
  },

  pointsDebit: {
    color: '#8A4444',
  },

  meta: {
    marginTop: 3,
    fontSize: 10,
    color: '#87918B',
  },

  note: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 16,
    color: '#6E7A73',
  },

  emptyCard: {
    padding: 22,
    alignItems: 'center',
    borderRadius: 0,
    backgroundColor: '#FFFFFF',
    paddingLeft: 0,
    marginLeft: 0,
    paddingStart: 0,
    marginStart: 0,
  },

  emptyTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#3B4841',
  },

  emptyText: {
    marginTop: 4,
    fontSize: 11,
    textAlign: 'center',
    color: '#849089',
  },

  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 6,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(39,93,69,0.055)',
  },

  disclaimerText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 15,
    color: '#6C7871',
  },

  brand: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: '#939D97',
  },
});


