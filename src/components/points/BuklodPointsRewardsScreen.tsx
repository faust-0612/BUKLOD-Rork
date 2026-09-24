import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

import {
  buildBuklodUserFeedback,
  trackBuklodFeedbackEvent,
} from '@/lib/buklodUserFeedback';

import { shared } from '@/components/UI';
import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import BuklodPointsClaimCelebration from '@/components/points/BuklodPointsClaimCelebration';
import BuklodRedeemCatalogSection from '@/components/points/BuklodRedeemCatalogSection';
import { useClaimButtonGlow } from '@/components/points/PointsMotion';
import { useBuklodReduceMotion } from '@/components/HomeMotion';
import { useBuklodCharacterEventsOptional } from '@/components/character/BuklodCharacterEventProvider';
import { CharacterEventType } from '@/lib/buklodCharacterEvents';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';
import {
  claimBuklodRewardGroup,
  loadBuklodClaimGroups,
  loadBuklodPointsDashboard,
  type BuklodClaimGroup,
  type BuklodPointsDashboard,
} from '@/lib/buklodRewards';
import { supabase } from '@/lib/supabase';

const CLAIM_SUCCESS_SOUND = require('../../../assets/sounds/buklod-points-claim.wav');
const SOFT_TAP_SOUND = require('../../../assets/sounds/buklod-reaction.wav');

const COLORS = {
  ink: '#10251B',
  text: '#203229',
  muted: '#6F7E76',
  green: '#0A7436',
  greenDark: '#075A2A',
  greenSoft: '#ECF8F0',
  border: '#D8E7DE',
  cream: '#FFF9EC',
  gold: '#E69A12',
  goldSoft: '#FFF5D8',
  blue: '#1688C7',
  blueSoft: '#ECF7FE',
  danger: '#C74747',
  dangerSoft: '#FFF0EE',
  white: '#FFFFFF',
  canvas: '#F5FAF7',
};

type PointRow = {
  id: string;
  direction: 'credit' | 'debit';
  claim_state: string | null;
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

type Filter =
  | 'all'
  | 'formation'
  | 'bible'
  | 'devotional'
  | 'mentoring'
  | 'community'
  | 'attendance'
  | 'other';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'formation', label: 'Formation' },
  { key: 'bible', label: 'Bible' },
  { key: 'devotional', label: 'Devotional' },
  { key: 'mentoring', label: 'Mentoring' },
  { key: 'community', label: 'Community' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'other', label: 'Other' },
];

const GROUP_META: Record<
  string,
  {
    icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
    accent: string;
    tint: string;
  }
> = {
  posting: {
    icon: 'file-document-outline',
    accent: COLORS.green,
    tint: COLORS.greenSoft,
  },
  engagement: {
    icon: 'message-text-outline',
    accent: '#D98B08',
    tint: COLORS.cream,
  },
  daily_bible: {
    icon: 'book-open-page-variant-outline',
    accent: COLORS.blue,
    tint: COLORS.blueSoft,
  },
  devotional: {
    icon: 'heart-outline',
    accent: '#C85E7C',
    tint: '#FFF0F5',
  },
  formation: {
    icon: 'school-outline',
    accent: '#7658B8',
    tint: '#F5F1FF',
  },
  mentoring: {
    icon: 'account-supervisor-outline',
    accent: '#168F7A',
    tint: '#ECFAF7',
  },
  attendance: {
    icon: 'account-group-outline',
    accent: COLORS.blue,
    tint: COLORS.blueSoft,
  },
  bonus: {
    icon: 'star-four-points-outline',
    accent: COLORS.gold,
    tint: COLORS.goldSoft,
  },
  other: {
    icon: 'gift-outline',
    accent: '#61756A',
    tint: '#F1F5F3',
  },
};

function number(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateLabel(value: string) {
  return new Date(value).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function activityLabel(type: string) {
  switch (type) {
    case 'formation_lesson':
      return 'Formation Lesson';
    case 'abc_growth_lesson':
      return 'ABC Growth Lesson';
    case 'daily_bible':
      return 'Daily Bible Reading';
    case 'daily_bible_verification':
      return 'Daily Bible Reading — Verified';
    case 'devotional':
      return 'Devotional';
    case 'mentor_session':
      return 'Mentor Teaching Session';
    case 'mentoring_release':
      return 'Mentoring Lesson';
    case 'reflection_quality_bonus':
      return 'Reflection Quality Bonus';
    case 'community_post':
    case 'r36_publish_wall':
      return 'Community Contribution';
    case 'community_comment':
      return 'Community Reply';
    case 'community_reaction':
      return 'Community Reaction';
    case 'prayer_response':
      return 'Prayer / Encouragement';
    case 'r36_engager_comment':
      return 'R36 Engager Comment';
    case 'r36_engager_reaction':
      return 'R36 Engager Reaction';
    case 'r36_engager_reply':
      return 'R36 Engager Reply';
    case 'ministry_activity':
      return 'Ministry Participation';
    case 'event_attendance':
      return 'Official Activity Attendance';
    case 'scope_attendance':
      return 'Scope Attendance';
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
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}

function claimGroupKeyForActivity(type: string) {
  if (['community_post', 'r36_publish_wall'].includes(type)) return 'posting';
  if (
    [
      'community_comment',
      'community_reaction',
      'prayer_response',
      'r36_engager_comment',
      'r36_engager_reaction',
      'r36_engager_reply',
    ].includes(type)
  ) {
    return 'engagement';
  }
  if (['daily_bible', 'daily_bible_verification'].includes(type)) return 'daily_bible';
  if (type === 'devotional') return 'devotional';
  if (
    [
      'abc_growth_lesson',
      'formation_lesson',
      'learning_progress_verification',
      'stage_completion',
    ].includes(type)
  ) {
    return 'formation';
  }
  if (['mentor_session', 'mentoring_release'].includes(type)) return 'mentoring';
  if (['event_attendance', 'scope_attendance', 'ministry_activity'].includes(type)) {
    return 'attendance';
  }
  if (
    [
      'reflection_quality_bonus',
      'weekly_consistency',
      'verified_giving_participation',
      'admin_bonus',
    ].includes(type)
  ) {
    return 'bonus';
  }
  return 'other';
}

function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object') {
    const row = error as Record<string, unknown>;
    for (const key of ['message', 'details', 'hint', 'code']) {
      const value = row[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  if (typeof error === 'string' && error.trim()) return error.trim();
  return 'Claim could not be completed.';
}

function friendlyClaimError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes('auth') || lower.includes('jwt') || lower.includes('session')) {
    return 'Your BUKLOD session needs a refresh. Reopen the app, then try the claim again.';
  }
  if (
    lower.includes('already') ||
    lower.includes('pending') ||
    lower.includes('eligible') ||
    lower.includes('no points')
  ) {
    return 'Some activities may already be claimed or are no longer eligible. Refresh and try again.';
  }
  return 'The claim did not finish. Your points were not deducted or lost. Refresh and try again.';
}

function rank(value: number | null | undefined) {
  return value ? `#${value}` : '—';
}

function playAudio(player: ReturnType<typeof useAudioPlayer>) {
  try {
    void player.seekTo(0).catch(() => undefined);
    player.play();
  } catch {
    // Feedback is decorative and must never block Points.
  }
}

function SummaryTile({
  icon,
  label,
  value,
  warm = false,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  value: number;
  warm?: boolean;
}) {
  return (
    <View style={[styles.summaryTile, warm && styles.summaryTileWarm]}>
      <MaterialCommunityIcons
        name={icon}
        size={19}
        color={warm ? '#C97900' : COLORS.green}
      />
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, warm && { color: '#A75F00' }]}>
        {value.toLocaleString('en-PH')}
      </Text>
    </View>
  );
}

function FeedbackToggle({
  icon,
  label,
  value,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  value: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={onPress}
      style={({ pressed }) => [styles.feedbackToggle, pressed && { opacity: 0.86 }]}
    >
      <MaterialCommunityIcons name={icon} size={18} color={COLORS.greenDark} />
      <Text style={styles.feedbackToggleText}>{label}</Text>
      <View style={[styles.switchTrack, value && styles.switchTrackOn]}>
        <View style={[styles.switchKnob, value && styles.switchKnobOn]} />
      </View>
    </Pressable>
  );
}

function ClaimGroupCard({
  group,
  rows,
  expanded,
  busy,
  blocked,
  motionEnabled,
  onToggle,
  onClaim,
}: {
  group: BuklodClaimGroup;
  rows: PointRow[];
  expanded: boolean;
  busy: boolean;
  blocked: boolean;
  motionEnabled: boolean;
  onToggle: () => void;
  onClaim: () => void;
}) {
  const meta = GROUP_META[group.group_key] ?? GROUP_META.other;
  const visibleRows = expanded ? rows : rows.slice(0, 3);
  const reveal = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const { scale, glow } = useClaimButtonGlow(!blocked, !motionEnabled);

  useEffect(() => {
    if (!motionEnabled) {
      reveal.setValue(expanded ? 1 : 0);
      return;
    }
    Animated.timing(reveal, {
      toValue: expanded ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [expanded, motionEnabled, reveal]);

  const listMotion = {
    opacity: expanded ? reveal : 1,
    transform: [
      {
        translateY: expanded
          ? reveal.interpolate({ inputRange: [0, 1], outputRange: [5, 0] })
          : 0,
      },
    ],
  };

  const shownCount = rows.length;
  const notLoadedCount = Math.max(0, group.event_count - shownCount);

  return (
    <View style={[styles.claimCard, { backgroundColor: meta.tint, borderColor: `${meta.accent}3A` }]}>
      <View style={styles.claimHeader}>
        <View style={[styles.groupIcon, { backgroundColor: meta.accent }]}>
          <MaterialCommunityIcons name={meta.icon} size={22} color={COLORS.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.claimTitle}>{group.group_label}</Text>
          <Text style={styles.claimCount}>
            {group.event_count.toLocaleString('en-PH')}{' '}
            {group.event_count === 1 ? 'completed activity' : 'completed activities'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.claimTotal, { color: meta.accent }]}>+{group.total_points} pts</Text>
          <MaterialCommunityIcons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={meta.accent}
          />
        </View>
      </View>

      <Animated.View style={[styles.activityPreview, listMotion]}>
        {visibleRows.length === 0 ? (
          <Text style={styles.reconcileText}>
            Activity details are syncing. The group total remains authoritative.
          </Text>
        ) : (
          visibleRows.map((item) => (
            <View key={item.id} style={styles.claimActivityRow}>
              <View style={[styles.activityGlyph, { backgroundColor: `${meta.accent}18` }]}>
                <MaterialCommunityIcons name={meta.icon} size={14} color={meta.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.activityTitle}>{activityLabel(item.activity_type)}</Text>
                {!!item.description && (
                  <Text numberOfLines={1} style={styles.activityDescription}>
                    {item.description}
                  </Text>
                )}
                <Text style={styles.activityDate}>{dateLabel(item.created_at)}</Text>
              </View>
              <Text style={[styles.activityPoints, { color: meta.accent }]}>+{item.points}</Text>
            </View>
          ))
        )}
      </Animated.View>

      {rows.length > 3 ? (
        <Pressable
          accessibilityRole="button"
          onPress={onToggle}
          style={({ pressed }) => [styles.viewAllButton, pressed && { opacity: 0.68 }]}
        >
          <Text style={[styles.viewAllText, { color: meta.accent }]}>
            {expanded ? 'Show less' : `View all ${rows.length} activities`}
          </Text>
          <MaterialCommunityIcons
            name={expanded ? 'chevron-up' : 'arrow-right'}
            size={17}
            color={meta.accent}
          />
        </Pressable>
      ) : null}

      {notLoadedCount > 0 ? (
        <Text style={styles.morePendingText}>
          +{notLoadedCount} more pending activities are included in this Claim All.
        </Text>
      ) : null}

      <View style={styles.claimButtonWrap}>
        {motionEnabled && !blocked ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.claimGlow, { backgroundColor: meta.accent, opacity: glow }]}
          />
        ) : null}
        <Animated.View style={{ transform: [{ scale: motionEnabled && !blocked ? scale : 1 }] }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Claim all ${group.group_label} points`}
            disabled={blocked}
            onPress={onClaim}
            style={({ pressed }) => [
              styles.claimButton,
              { backgroundColor: meta.accent },
              blocked && !busy && { opacity: 0.48 },
              pressed && !blocked && { opacity: 0.87 },
            ]}
          >
            <MaterialCommunityIcons
              name={busy ? 'progress-clock' : 'circle-multiple-outline'}
              size={19}
              color={COLORS.white}
            />
            <Text style={styles.claimButtonText}>
              {busy
                ? `ADDING +${group.total_points.toLocaleString('en-PH')} PTS…`
                : `CLAIM ALL  +${group.total_points.toLocaleString('en-PH')} PTS`}
            </Text>
            {!busy ? (
              <MaterialCommunityIcons name="star-four-points" size={14} color="#FFE798" />
            ) : null}
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

export default function BuklodPointsRewardsScreen() {
  const reduceMotion = useBuklodReduceMotion();
  const characterEvents = useBuklodCharacterEventsOptional();
  const claimSound = useAudioPlayer(CLAIM_SUCCESS_SOUND);
  const tapSound = useAudioPlayer(SOFT_TAP_SOUND);

  const [dashboard, setDashboard] = useState<BuklodPointsDashboard | null>(null);
  const [claimGroups, setClaimGroups] = useState<BuklodClaimGroup[]>([]);
  const [history, setHistory] = useState<PointRow[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationRow[]>([]);
  const [rankDashboard, setRankDashboard] = useState<RankDashboard | null>(null);
  const [claimingGroup, setClaimingGroup] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimTechnicalError, setClaimTechnicalError] = useState<string | null>(null);
  const [lastSuccess, setLastSuccess] = useState<{ label: string; points: number } | null>(null);
  const [celebrationActive, setCelebrationActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  const [dashboardSupportCode, setDashboardSupportCode] =
    useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [animationsOn, setAnimationsOn] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboardPeriod, setLeaderboardPeriod] =
    useState<'weekly' | 'monthly' | 'all_time'>('all_time');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [leaderboardBusy, setLeaderboardBusy] = useState(false);

  const motionEnabled = animationsOn && !reduceMotion;

  const loadLeaderboard = useCallback(async (period: 'weekly' | 'monthly' | 'all_time') => {
    setLeaderboardBusy(true);
    const { data, error } = await (supabase as any).rpc('get_buklod_points_leaderboard', {
      p_period: period,
      p_limit: 10,
      p_church_id: null,
    });
    if (error || !Array.isArray(data)) {
      setLeaderboard([]);
    } else {
      const rows = [...data];
      rows.sort((a: any, b: any) => {
        const pointDiff = number(b?.total_points ?? b?.points) - number(a?.total_points ?? a?.points);
        if (pointDiff !== 0) return pointDiff;
        return String(a?.full_name ?? '').localeCompare(String(b?.full_name ?? ''));
      });
      setLeaderboard(rows);
    }
    setLeaderboardBusy(false);
  }, []);

  const load = useCallback(async () => {
    const [rankResult, historyResult, evaluationResult] = await Promise.all([
      supabase.rpc('get_my_buklod_rank_dashboard'),
      supabase
        .from('buklod_points_ledger')
        .select('id,direction,claim_state,points,activity_type,source_key,source_id,description,created_at')
        .order('created_at', { ascending: false })
        .limit(300),
      supabase
        .from('buklod_points_evaluations')
        .select('id,period_type,period_start,period_end,points_snapshot,performance_score,bayanihan_bonus,admin_note,evaluated_at')
        .order('evaluated_at', { ascending: false })
        .limit(50),
    ]);

    try {
      setDashboardError('');
      setDashboardSupportCode(null);
      const nextDashboard = await loadBuklodPointsDashboard();
      setDashboard(nextDashboard);
    } catch (error) {
      console.warn('BUKLOD Points dashboard could not be loaded.');
      const feedback = buildBuklodUserFeedback(
        error,
        {
          context: 'general',
          fallbackTitle: 'BUKLOD Points unavailable',
          fallbackMessage:
            "BUKLOD couldn't load your Points dashboard right now.",
        },
      );
      setDashboard(null);
      setDashboardError(
        "BUKLOD couldn't load your Points dashboard right now. Your existing points are unchanged.",
      );
      setDashboardSupportCode(feedback.supportCode ?? 'SYS-500');
      void trackBuklodFeedbackEvent({
        event: 'error_shown',
        category: feedback.category,
        supportCode: feedback.supportCode ?? 'SYS-500',
        route: '/points',
        feature: 'Points',
        outcome: 'points_dashboard_failed',
      });
    }

    try {
      const groups = await loadBuklodClaimGroups();
      setClaimGroups(groups);
    } catch (error) {
      const technical = normalizeErrorMessage(error);
      console.warn('BUKLOD claim groups:', technical);
      setClaimTechnicalError(technical);
      setClaimError('Claimable activities could not be refreshed. Pull down to try again.');
    }

    if (!rankResult.error) setRankDashboard(rankResult.data as RankDashboard);
    if (!historyResult.error) setHistory((historyResult.data ?? []) as PointRow[]);
    if (!evaluationResult.error) setEvaluations((evaluationResult.data ?? []) as EvaluationRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!lastSuccess) return;
    const timer = setTimeout(() => setLastSuccess(null), 2300);
    return () => clearTimeout(timer);
  }, [lastSuccess]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setClaimError(null);
    setClaimTechnicalError(null);
    await load();
    setRefreshing(false);
  }, [load]);

  const pendingRows = useMemo(
    () => history.filter((item) => item.direction === 'credit' && item.claim_state === 'pending'),
    [history],
  );

  const claimableCount = useMemo(
    () => claimGroups.reduce((sum, group) => sum + group.event_count, 0),
    [claimGroups],
  );

  const claimablePoints = useMemo(
    () => claimGroups.reduce((sum, group) => sum + group.total_points, 0),
    [claimGroups],
  );

  const playTap = useCallback(() => {
    void Haptics.selectionAsync().catch(() => undefined);
    if (soundOn) playAudio(tapSound);
  }, [soundOn, tapSound]);

  const toggleGroup = useCallback(
    (groupKey: string) => {
      playTap();
      setExpandedGroups((current) => ({ ...current, [groupKey]: !current[groupKey] }));
    },
    [playTap],
  );

  const claimGroup = useCallback(
    async (group: BuklodClaimGroup) => {
      if (claimingGroup) return;

      setClaimingGroup(group.group_key);
      setClaimError(null);
      setClaimTechnicalError(null);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);

      try {
        const result = await claimBuklodRewardGroup(group.group_key);
        if (result.claimed_count <= 0 || result.claimed_points <= 0) {
          setClaimError('Some activities were already claimed or are no longer pending. The list has been refreshed.');
          await load();
          return;
        }

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
        setClaimGroups((current) => current.filter((item) => item.group_key !== group.group_key));
        setExpandedGroups((current) => ({ ...current, [group.group_key]: false }));

        if (soundOn) playAudio(claimSound);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);

        setLastSuccess({ label: group.group_label, points: result.claimed_points });
        setCelebrationActive(motionEnabled);

        if (result.rank_up) {
          characterEvents?.emit({
            type: CharacterEventType.MILESTONE_REACHED,
            success: true,
            spokenText: result.rank_name ? `Rank up! You are now ${result.rank_name}.` : undefined,
          });
        }
        characterEvents?.emit({
          type: CharacterEventType.POINTS_CLAIMED,
          success: true,
          points: result.claimed_points,
          spokenText: `${group.group_label}: ${result.claimed_points} points claimed.`,
          dialogue: `${group.group_label} — +${result.claimed_points} pts`,
        });

        await load();
      } catch (error) {
        const technical = normalizeErrorMessage(error);
        console.warn('BUKLOD grouped claim:', technical);
        setClaimTechnicalError(technical);
        setClaimError(friendlyClaimError(technical));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      } finally {
        setClaimingGroup(null);
      }
    },
    [characterEvents, claimSound, claimingGroup, load, motionEnabled, soundOn],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return history.filter((item) => {
      const type = item.activity_type;
      let categoryMatch = true;
      if (filter === 'formation') categoryMatch = ['formation_lesson', 'abc_growth_lesson', 'stage_completion', 'learning_progress_verification'].includes(type);
      if (filter === 'bible') categoryMatch = ['daily_bible', 'daily_bible_verification'].includes(type);
      if (filter === 'devotional') categoryMatch = ['devotional', 'reflection_quality_bonus'].includes(type);
      if (filter === 'mentoring') categoryMatch = ['mentor_session', 'mentoring_release'].includes(type);
      if (filter === 'community') categoryMatch = ['community_post', 'community_comment', 'community_reaction', 'prayer_response', 'r36_publish_wall', 'r36_engager_comment', 'r36_engager_reaction', 'r36_engager_reply'].includes(type);
      if (filter === 'attendance') categoryMatch = ['event_attendance', 'scope_attendance', 'ministry_activity'].includes(type);
      if (filter === 'other') {
        categoryMatch = !['formation_lesson', 'abc_growth_lesson', 'stage_completion', 'learning_progress_verification', 'daily_bible', 'daily_bible_verification', 'devotional', 'reflection_quality_bonus', 'mentor_session', 'mentoring_release', 'community_post', 'community_comment', 'community_reaction', 'prayer_response', 'r36_publish_wall', 'r36_engager_comment', 'r36_engager_reaction', 'r36_engager_reply', 'event_attendance', 'scope_attendance', 'ministry_activity'].includes(type);
      }
      if (!categoryMatch) return false;
      if (!query) return true;
      return [activityLabel(type), item.description ?? '', item.source_key ?? '', String(item.points)]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [filter, history, search]);

  const recentHistory = history.slice(0, 5);

  if (loading) {
    return (
      <View style={[shared.screen, styles.loadingScreen]}>
        <View style={styles.loadingCoin}>
          <MaterialCommunityIcons name="leaf" size={30} color={COLORS.gold} />
        </View>
        <Text style={styles.loadingTitle}>Loading BUKLOD Points…</Text>
      </View>
    );
  }

  if (!dashboard) {
    return (
      <View style={[shared.screen, styles.loadingScreen]}>
        <MaterialCommunityIcons
          name="alert-circle-outline"
          size={34}
          color={COLORS.danger}
        />
        <Text style={styles.loadingTitle}>BUKLOD Points unavailable</Text>
        <Text style={styles.dashboardErrorText}>
          {dashboardError ||
            "BUKLOD couldn't load your Points dashboard right now."}
        </Text>
        {!!dashboardSupportCode && (
          <Text style={styles.dashboardSupportCode}>
            Support code: {dashboardSupportCode}
          </Text>
        )}
        <View style={styles.dashboardErrorActions}>
          <Pressable
            onPress={() => void load()}
            style={styles.dashboardRetry}
          >
            <Text style={styles.dashboardRetryText}>TRY AGAIN</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              void trackBuklodFeedbackEvent({
                event: 'support_opened_after_error',
                supportCode: dashboardSupportCode,
                route: '/points',
                feature: 'Points',
                outcome: 'need_help',
              });
              router.push({
                pathname: '/help' as any,
                params: {
                  category: 'OTHER',
                  errorCode: dashboardSupportCode ?? 'SYS-500',
                  message:
                    dashboardError ||
                    "BUKLOD couldn't load your Points dashboard right now.",
                  sourceRoute: '/points',
                },
              });
            }}
            style={styles.dashboardHelp}
          >
            <Text style={styles.dashboardHelpText}>NEED HELP?</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <BuklodPortalScrollView
      style={[shared.screen, { backgroundColor: COLORS.canvas }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <View style={styles.heroWrap}>
        <View style={styles.heroTopBand}>
          <View style={styles.brandRow}>
            <View style={styles.brandLeaf}>
              <MaterialCommunityIcons name="leaf" size={22} color="#A9DE72" />
            </View>
            <View>
              <Text style={styles.brandName}>BUKLOD</Text>
              <Text style={styles.brandTagline}>Faith • Community • Impact</Text>
            </View>
          </View>
          <Text style={styles.heroMantra}>Small Actions{`\n`}Big Impact</Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.coinHero}>
            <View style={styles.coinInner}>
              <MaterialCommunityIcons name="leaf" size={35} color="#8C5800" />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroKicker}>Grow Good. Earn Together!</Text>
            <Text style={styles.heroTitle}>BUKLOD Points</Text>
            <Text style={styles.heroSubtitle}>Earn through participation and claim your rewards.</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <SummaryTile
            icon="circle-multiple-outline"
            label="Available Points"
            value={number(dashboard.available_points)}
          />
          <SummaryTile
            icon="chart-bar"
            label="Lifetime Points"
            value={number(dashboard.lifetime_points ?? dashboard.total_points)}
          />
          <SummaryTile
            icon="gift-outline"
            label="Ready to Claim"
            value={claimablePoints}
            warm
          />
        </View>

        <View style={styles.feedbackRow}>
          <FeedbackToggle
            icon={soundOn ? 'volume-high' : 'volume-off'}
            label={soundOn ? 'Sound On' : 'Sound Off'}
            value={soundOn}
            onPress={() => setSoundOn((value) => !value)}
          />
          <FeedbackToggle
            icon="creation"
            label={animationsOn ? 'Animations On' : 'Animations Off'}
            value={animationsOn}
            onPress={() => setAnimationsOn((value) => !value)}
          />
        </View>

        <BuklodPointsClaimCelebration
          active={celebrationActive}
          points={lastSuccess?.points ?? null}
          onComplete={() => setCelebrationActive(false)}
        />
      </View>

      {lastSuccess ? (
        <Animated.View style={styles.successBanner}>
          <View style={styles.successIcon}>
            <MaterialCommunityIcons name="check-bold" size={19} color={COLORS.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.successTitle}>+{lastSuccess.points} pts claimed!</Text>
            <Text style={styles.successSub}>{lastSuccess.label} added to your BUKLOD Points.</Text>
          </View>
          <MaterialCommunityIcons name="star-four-points" size={20} color={COLORS.gold} />
        </Animated.View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeadingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Ready to Claim</Text>
            <Text style={styles.sectionSub}>Review completed activities and claim points by group.</Text>
          </View>
          <View style={styles.readyBadge}>
            <MaterialCommunityIcons name="gift-outline" size={15} color="#A75F00" />
            <Text style={styles.readyBadgeText}>{claimableCount} ready</Text>
          </View>
        </View>

        {claimGroups.length === 0 && !claimError ? (
          <View style={styles.allCaughtUp}>
            <MaterialCommunityIcons name="check-decagram-outline" size={30} color={COLORS.green} />
            <View style={{ flex: 1 }}>
              <Text style={styles.allCaughtTitle}>All caught up</Text>
              <Text style={styles.allCaughtSub}>No completed activities are waiting to be claimed right now.</Text>
            </View>
          </View>
        ) : null}

        {claimGroups.map((group) => {
          const rows = pendingRows.filter(
            (item) => claimGroupKeyForActivity(item.activity_type) === group.group_key,
          );
          const busy = claimingGroup === group.group_key;
          return (
            <ClaimGroupCard
              key={group.group_key}
              group={group}
              rows={rows}
              expanded={Boolean(expandedGroups[group.group_key])}
              busy={busy}
              blocked={claimingGroup !== null}
              motionEnabled={motionEnabled}
              onToggle={() => toggleGroup(group.group_key)}
              onClaim={() => void claimGroup(group)}
            />
          );
        })}

        {claimError ? (
          <View style={styles.errorCard}>
            <View style={styles.errorIcon}>
              <MaterialCommunityIcons name="alert-circle-outline" size={21} color={COLORS.danger} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.errorTitle}>Claim needs another try</Text>
              <Text style={styles.errorMessage}>{claimError}</Text>
              {__DEV__ && claimTechnicalError ? (
                <Text style={styles.errorTechnical}>{claimTechnicalError}</Text>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => void refresh()}
              style={({ pressed }) => [styles.refreshButton, pressed && { opacity: 0.78 }]}
            >
              <MaterialCommunityIcons name="refresh" size={18} color={COLORS.danger} />
              <Text style={styles.refreshText}>Refresh</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeadingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <Text style={styles.sectionSub}>Your latest point-earning activity.</Text>
          </View>
        </View>

        <View style={styles.recentCard}>
          {recentHistory.length === 0 ? (
            <Text style={styles.emptyText}>No points activity yet.</Text>
          ) : (
            recentHistory.map((item, index) => (
              <View
                key={item.id}
                style={[styles.recentRow, index === recentHistory.length - 1 && { borderBottomWidth: 0 }]}
              >
                <View style={styles.recentIcon}>
                  <MaterialCommunityIcons
                    name={item.activity_type.includes('reaction') ? 'heart-outline' : 'message-text-outline'}
                    size={16}
                    color={item.activity_type.includes('reaction') ? '#D85D70' : '#5D6C65'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentTitle}>{activityLabel(item.activity_type)}</Text>
                  {!!item.description && (
                    <Text numberOfLines={1} style={styles.recentDescription}>{item.description}</Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.recentPoints, item.direction === 'debit' && { color: COLORS.danger }]}>
                    {item.direction === 'credit' ? '+' : '-'}{item.points} pts
                  </Text>
                  <Text style={styles.recentDate}>{dateLabel(item.created_at)}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </View>

      <View style={styles.section}>
        <BuklodRedeemCatalogSection
          availablePoints={number(dashboard.available_points)}
          onRedeemed={(nextAvailable) =>
            setDashboard((current) =>
              current ? { ...current, available_points: nextAvailable } : current,
            )
          }
        />
      </View>

      <View style={styles.section}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            const next = !leaderboardOpen;
            setLeaderboardOpen(next);
            if (next) void loadLeaderboard(leaderboardPeriod);
          }}
          style={styles.rankSummary}
        >
          <View style={styles.rankBadge}>
            <MaterialCommunityIcons name="trophy-outline" size={22} color={COLORS.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rankKicker}>CIRCLE RANK</Text>
            <Text style={styles.rankName}>{rankDashboard?.lifetime.rank_name ?? 'BUKLOD Member'}</Text>
            <Text style={styles.rankNext}>
              {number(rankDashboard?.lifetime.points_to_next) > 0
                ? `${number(rankDashboard?.lifetime.points_to_next).toLocaleString('en-PH')} pts to ${rankDashboard?.lifetime.next_rank_name ?? 'next rank'}`
                : 'Highest current rank reached'}
            </Text>
          </View>
          <MaterialCommunityIcons
            name={leaderboardOpen ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={COLORS.green}
          />
        </Pressable>

        {leaderboardOpen ? (
          <View style={styles.leaderboardCard}>
            <View style={styles.periodRow}>
              {(['weekly', 'monthly', 'all_time'] as const).map((period) => (
                <Pressable
                  key={period}
                  onPress={() => {
                    setLeaderboardPeriod(period);
                    void loadLeaderboard(period);
                  }}
                  style={[styles.periodChip, leaderboardPeriod === period && styles.periodChipOn]}
                >
                  <Text style={[styles.periodText, leaderboardPeriod === period && styles.periodTextOn]}>
                    {period === 'all_time' ? 'ALL-TIME' : period.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.myRanksRow}>
              <View style={styles.myRankCell}><Text style={styles.myRankLabel}>WEEKLY</Text><Text style={styles.myRankValue}>{rank(dashboard.weekly_rank)}</Text></View>
              <View style={styles.myRankCell}><Text style={styles.myRankLabel}>MONTHLY</Text><Text style={styles.myRankValue}>{rank(dashboard.monthly_rank)}</Text></View>
              <View style={styles.myRankCell}><Text style={styles.myRankLabel}>ALL-TIME</Text><Text style={styles.myRankValue}>{rank(dashboard.all_time_rank)}</Text></View>
            </View>

            {leaderboardBusy ? (
              <Text style={styles.emptyText}>Loading Top 10…</Text>
            ) : leaderboard.length === 0 ? (
              <Text style={styles.emptyText}>No ranking data yet.</Text>
            ) : (
              leaderboard.map((item: any) => (
                <View key={`${leaderboardPeriod}-${item.user_id}`} style={styles.leaderboardRow}>
                  <Text style={styles.leaderboardPosition}>#{item.rank_position}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.leaderboardName}>
                      {resolvePersonDisplayName(item.full_name, item.user_id)}
                    </Text>
                    <Text style={styles.leaderboardChurch}>{item.church_name || 'No Local'}</Text>
                  </View>
                  <Text style={styles.leaderboardPoints}>{number(item.total_points).toLocaleString('en-PH')} pts</Text>
                </View>
              ))
            )}
          </View>
        ) : null}
      </View>

      {evaluations.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance Rewards</Text>
          <Text style={styles.sectionSub}>Administrative evaluation records.</Text>
          {evaluations.map((item) => (
            <View key={item.id} style={styles.evaluationCard}>
              <View style={styles.sectionHeadingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.evaluationTitle}>{item.period_type.toUpperCase()} EVALUATION</Text>
                  <Text style={styles.evaluationDate}>{item.period_start} to {item.period_end}</Text>
                </View>
                {item.bayanihan_bonus > 0 ? (
                  <Text style={styles.bonusText}>+{item.bayanihan_bonus} bonus</Text>
                ) : null}
              </View>
              <Text style={styles.evaluationMeta}>Points snapshot: {item.points_snapshot.toLocaleString('en-PH')}</Text>
              {item.performance_score !== null ? (
                <Text style={styles.evaluationMeta}>Evaluation: {number(item.performance_score).toFixed(1)}%</Text>
              ) : null}
              {!!item.admin_note && <Text style={styles.evaluationNote}>{item.admin_note}</Text>}
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Points History</Text>
        <Text style={styles.sectionSub}>Search and review your recorded point activity.</Text>

        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={20} color="#77847D" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search points history"
            placeholderTextColor="#8A9690"
            style={styles.searchInput}
          />
          {!!search && (
            <Pressable onPress={() => setSearch('')}>
              <MaterialCommunityIcons name="close" size={20} color="#77847D" />
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {FILTERS.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => setFilter(item.key)}
              style={[styles.filterChip, filter === item.key && styles.filterChipOn]}
            >
              <Text style={[styles.filterText, filter === item.key && styles.filterTextOn]}>{item.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.historyList}>
          {filtered.length === 0 ? (
            <Text style={styles.emptyText}>No matching points activity.</Text>
          ) : (
            filtered.map((item, index) => (
              <View key={item.id} style={[styles.historyRow, index === filtered.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyTitle}>{activityLabel(item.activity_type)}</Text>
                  {!!item.description && <Text style={styles.historyDescription}>{item.description}</Text>}
                  <Text style={styles.historyDate}>{dateLabel(item.created_at)}</Text>
                </View>
                <Text style={[styles.historyPoints, item.direction === 'debit' && { color: COLORS.danger }]}>
                  {item.direction === 'credit' ? '+' : '-'}{item.points} pts
                </Text>
              </View>
            ))
          )}
        </View>
      </View>

      <View style={styles.disclaimer}>
        <MaterialCommunityIcons name="information-outline" size={20} color={COLORS.green} />
        <Text style={styles.disclaimerText}>
          BUKLOD Points recognize recorded participation and progress. Rankings are not measurements of spirituality, faith, character, or personal worth.
        </Text>
      </View>

      <Text style={styles.footerBrand}>SAMAHANG BINUKLOD NG PAG-IBIG</Text>
    </BuklodPortalScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 150,
    backgroundColor: COLORS.canvas,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.canvas,
  },
  loadingCoin: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.goldSoft,
    borderWidth: 2,
    borderColor: '#F0C55F',
  },
  dashboardErrorText: {
    marginTop: 8,
    maxWidth: 440,
    textAlign: 'center',
    color: COLORS.muted,
    fontSize: 12.5,
    lineHeight: 18,
  },
  dashboardSupportCode: {
    marginTop: 7,
    color: COLORS.danger,
    fontSize: 10.5,
    fontWeight: '900',
  },
  dashboardErrorActions: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dashboardRetry: {
    borderRadius: 10,
    backgroundColor: COLORS.green,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dashboardRetryText: {
    color: COLORS.white,
    fontSize: 10.5,
    fontWeight: '900',
  },
  dashboardHelp: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.green,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dashboardHelpText: {
    color: COLORS.green,
    fontSize: 10.5,
    fontWeight: '900',
  },
  loadingTitle: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.text,
  },
  heroWrap: {
    position: 'relative',
    marginBottom: 12,
    backgroundColor: '#EAF6EE',
  },
  heroTopBand: {
    minHeight: 92,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#075C2B',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandLeaf: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  brandName: {
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: COLORS.white,
  },
  brandTagline: {
    marginTop: 1,
    fontSize: 8.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.78)',
  },
  heroMantra: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
    fontStyle: 'italic',
    textAlign: 'right',
    color: '#D9F2C0',
  },
  heroCard: {
    marginHorizontal: 14,
    marginTop: -18,
    padding: 16,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#0B4226',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  coinHero: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7B729',
    borderWidth: 4,
    borderColor: '#FFE09A',
  },
  coinInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#D58B00',
    backgroundColor: '#F8C94E',
  },
  heroKicker: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.green,
  },
  heroTitle: {
    marginTop: 2,
    fontSize: 25,
    lineHeight: 28,
    fontWeight: '900',
    color: COLORS.ink,
  },
  heroSubtitle: {
    marginTop: 3,
    fontSize: 10.5,
    lineHeight: 15,
    color: COLORS.muted,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    marginTop: 10,
  },
  summaryTile: {
    flex: 1,
    minHeight: 88,
    padding: 10,
    borderRadius: 17,
    backgroundColor: '#F5FBF7',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryTileWarm: {
    backgroundColor: COLORS.goldSoft,
    borderColor: '#F1D99E',
  },
  summaryLabel: {
    marginTop: 5,
    minHeight: 24,
    fontSize: 8.5,
    lineHeight: 11,
    fontWeight: '800',
    color: '#516259',
  },
  summaryValue: {
    marginTop: 1,
    fontSize: 21,
    fontWeight: '900',
    color: COLORS.greenDark,
  },
  feedbackRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  feedbackToggle: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  feedbackToggleText: {
    flex: 1,
    fontSize: 9.5,
    fontWeight: '900',
    color: COLORS.text,
  },
  switchTrack: {
    width: 34,
    height: 20,
    borderRadius: 10,
    padding: 2,
    backgroundColor: '#C9D4CE',
  },
  switchTrackOn: {
    backgroundColor: '#19A950',
  },
  switchKnob: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.white,
  },
  switchKnobOn: {
    alignSelf: 'flex-end',
  },
  successBanner: {
    marginHorizontal: 14,
    marginBottom: 12,
    padding: 12,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#E9F9EE',
    borderWidth: 1,
    borderColor: '#A8DDB8',
  },
  successIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#20A550',
  },
  successTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.greenDark,
  },
  successSub: {
    marginTop: 2,
    fontSize: 9.5,
    color: '#557063',
  },
  section: {
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '900',
    color: COLORS.ink,
  },
  sectionSub: {
    marginTop: 2,
    fontSize: 10.5,
    lineHeight: 15,
    color: COLORS.muted,
  },
  readyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.goldSoft,
  },
  readyBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#A75F00',
  },
  allCaughtUp: {
    marginTop: 10,
    padding: 14,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.greenSoft,
    borderWidth: 1,
    borderColor: '#CBE4D3',
  },
  allCaughtTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.greenDark,
  },
  allCaughtSub: {
    marginTop: 2,
    fontSize: 10,
    lineHeight: 14,
    color: COLORS.muted,
  },
  claimCard: {
    marginTop: 11,
    padding: 12,
    borderRadius: 21,
    borderWidth: 1,
    overflow: 'hidden',
  },
  claimHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  groupIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.ink,
  },
  claimCount: {
    marginTop: 2,
    fontSize: 9.5,
    color: COLORS.muted,
  },
  claimTotal: {
    fontSize: 15,
    fontWeight: '900',
  },
  activityPreview: {
    marginTop: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  claimActivityRow: {
    minHeight: 55,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDE5E0',
  },
  activityGlyph: {
    width: 27,
    height: 27,
    borderRadius: 13.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: {
    fontSize: 10.5,
    fontWeight: '900',
    color: COLORS.text,
  },
  activityDescription: {
    marginTop: 1,
    fontSize: 9,
    color: COLORS.muted,
  },
  activityDate: {
    marginTop: 2,
    fontSize: 8.5,
    color: '#89958F',
  },
  activityPoints: {
    fontSize: 11,
    fontWeight: '900',
  },
  reconcileText: {
    paddingVertical: 12,
    fontSize: 10,
    lineHeight: 15,
    color: COLORS.muted,
  },
  viewAllButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 10,
    fontWeight: '900',
  },
  morePendingText: {
    marginTop: 3,
    fontSize: 9,
    lineHeight: 13,
    color: COLORS.muted,
  },
  claimButtonWrap: {
    marginTop: 7,
    position: 'relative',
  },
  claimGlow: {
    position: 'absolute',
    left: -5,
    right: -5,
    top: -5,
    bottom: -5,
    borderRadius: 18,
  },
  claimButton: {
    minHeight: 48,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 12,
    shadowColor: '#073C21',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  claimButtonText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.35,
    color: COLORS.white,
  },
  errorCard: {
    marginTop: 11,
    padding: 12,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: COLORS.dangerSoft,
    borderWidth: 1,
    borderColor: '#F1B8B1',
  },
  errorIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFE0DB',
  },
  errorTitle: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#9E2F2F',
  },
  errorMessage: {
    marginTop: 2,
    fontSize: 9.5,
    lineHeight: 14,
    color: '#A24A44',
  },
  errorTechnical: {
    marginTop: 4,
    fontSize: 8,
    color: '#A87672',
  },
  refreshButton: {
    minHeight: 38,
    paddingHorizontal: 10,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#E68E86',
  },
  refreshText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: COLORS.danger,
  },
  recentCard: {
    marginTop: 9,
    borderRadius: 19,
    paddingHorizontal: 11,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  recentRow: {
    minHeight: 65,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DFE7E2',
  },
  recentIcon: {
    width: 31,
    height: 31,
    borderRadius: 15.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F3',
  },
  recentTitle: {
    fontSize: 10.5,
    fontWeight: '900',
    color: COLORS.text,
  },
  recentDescription: {
    marginTop: 1,
    fontSize: 8.7,
    color: COLORS.muted,
  },
  recentPoints: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.green,
  },
  recentDate: {
    marginTop: 2,
    maxWidth: 110,
    fontSize: 7.8,
    textAlign: 'right',
    color: '#89958F',
  },
  rankSummary: {
    padding: 14,
    borderRadius: 19,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rankBadge: {
    width: 43,
    height: 43,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.greenSoft,
  },
  rankKicker: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 1,
    color: COLORS.muted,
  },
  rankName: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.ink,
  },
  rankNext: {
    marginTop: 2,
    fontSize: 9,
    color: COLORS.muted,
  },
  leaderboardCard: {
    marginTop: 8,
    padding: 11,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 6,
  },
  periodChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#F3F6F4',
  },
  periodChipOn: {
    backgroundColor: COLORS.greenSoft,
  },
  periodText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#708078',
  },
  periodTextOn: {
    color: COLORS.green,
  },
  myRanksRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 10,
  },
  myRankCell: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 11,
    backgroundColor: '#F7FAF8',
  },
  myRankLabel: {
    fontSize: 7.5,
    fontWeight: '900',
    color: '#829088',
  },
  myRankValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.greenDark,
  },
  leaderboardRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E1E7E3',
  },
  leaderboardPosition: {
    width: 34,
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.green,
  },
  leaderboardName: {
    fontSize: 10.5,
    fontWeight: '900',
    color: COLORS.text,
  },
  leaderboardChurch: {
    marginTop: 1,
    fontSize: 8.5,
    color: COLORS.muted,
  },
  leaderboardPoints: {
    fontSize: 10.5,
    fontWeight: '900',
    color: COLORS.greenDark,
  },
  evaluationCard: {
    marginTop: 8,
    padding: 13,
    borderRadius: 17,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  evaluationTitle: {
    fontSize: 10.5,
    fontWeight: '900',
    color: COLORS.text,
  },
  evaluationDate: {
    marginTop: 2,
    fontSize: 8.5,
    color: COLORS.muted,
  },
  bonusText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: COLORS.green,
  },
  evaluationMeta: {
    marginTop: 5,
    fontSize: 9.5,
    color: COLORS.muted,
  },
  evaluationNote: {
    marginTop: 7,
    fontSize: 10,
    lineHeight: 15,
    color: COLORS.text,
  },
  searchBox: {
    marginTop: 9,
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 11,
    color: COLORS.text,
  },
  filters: {
    gap: 6,
    paddingVertical: 10,
    paddingRight: 10,
  },
  filterChip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipOn: {
    backgroundColor: COLORS.green,
    borderColor: COLORS.green,
  },
  filterText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.muted,
  },
  filterTextOn: {
    color: COLORS.white,
  },
  historyList: {
    paddingHorizontal: 11,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  historyRow: {
    minHeight: 64,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E1E7E3',
  },
  historyTitle: {
    fontSize: 10.5,
    fontWeight: '900',
    color: COLORS.text,
  },
  historyDescription: {
    marginTop: 2,
    fontSize: 9,
    color: COLORS.muted,
  },
  historyDate: {
    marginTop: 3,
    fontSize: 8.3,
    color: '#89958F',
  },
  historyPoints: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.green,
  },
  emptyText: {
    paddingVertical: 14,
    textAlign: 'center',
    fontSize: 10.5,
    color: COLORS.muted,
  },
  disclaimer: {
    marginHorizontal: 14,
    marginTop: 2,
    padding: 13,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#ECF5EF',
  },
  disclaimerText: {
    flex: 1,
    fontSize: 9.5,
    lineHeight: 14,
    color: COLORS.muted,
  },
  footerBrand: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 1,
    color: '#94A098',
  },
});
