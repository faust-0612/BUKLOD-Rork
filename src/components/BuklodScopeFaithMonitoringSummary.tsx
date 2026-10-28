import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import BuklodScopeFaithMonitoringMemberFeedback from '@/components/BuklodScopeFaithMonitoringMemberFeedback';
import { useBuklodAccess } from '@/hooks/useBuklodAccess';
import {
  fetchScopeFaithMonitoringSummaryResilient,
  formatFaithMonitoringRate,
  type ScopeFaithMonitoringSummary,
} from '@/lib/buklodScopeFaithMonitoring';
import type { BuklodScope } from '@/lib/buklodScope';
import { scopeRouteParams } from '@/lib/buklodScopeManage';
import { canViewClusterProgress } from '@/lib/buklodOrgGovernance';
import { colors } from '@/lib/theme';

type Props = {
  scope: BuklodScope;
};

function summaryEmptyCopy(scopeName: string, activeMembers: number) {
  if (activeMembers <= 0) {
    return `No active members in ${scopeName} yet. Counts will appear once members join and start Daily Reading, Devotion, and Buklod Lessons.`;
  }

  return `No member activity recorded yet today in ${scopeName}. Counts update as members submit Daily Reading, complete Devotion, and progress in Buklod Lessons.`;
}

function ProgressBar({
  value,
  total,
  tone = 'green',
}: {
  value: number;
  total: number;
  tone?: 'green' | 'amber' | 'blue';
}) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const fillColor =
    tone === 'amber'
      ? '#D97706'
      : tone === 'blue'
        ? '#2563EB'
        : colors.green;

  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressFill,
          {
            width: `${pct}%`,
            backgroundColor: fillColor,
          },
        ]}
      />
    </View>
  );
}

function MetricRow({
  label,
  value,
  emphasize = false,
  onPress,
}: {
  label: string;
  value: string | number;
  emphasize?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `View members: ${label}, ${value}` : undefined}
      onPress={(event) => {
        event.stopPropagation();
        onPress?.();
      }}
      style={styles.metricRow}
    >
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, emphasize && styles.metricValueStrong]}>{value}</Text>
      {onPress ? <MaterialCommunityIcons name="chevron-right" size={16} color={colors.greenDark} /> : null}
    </Pressable>
  );
}

function MonitorSection({
  title,
  subtitle,
  icon,
  children,
  onPress,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  children: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${title} member progress`}
      onPress={onPress}
      style={styles.section}
    >
      <View style={styles.sectionHead}>
        <View style={styles.sectionIcon}>
          <MaterialCommunityIcons
            name={icon}
            size={18}
            color={colors.greenDark}
          />
        </View>
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? (
            <Text style={styles.sectionSubtitle}>{subtitle}</Text>
          ) : null}
        </View>
      </View>
      {children}
    </Pressable>
  );
}

export default function BuklodScopeFaithMonitoringSummary({
  scope,
}: Props) {
  const { isExactScopeAdmin } = useBuklodAccess();
  const [canLeadership, setCanLeadership] = useState(false);
  const isAdmin =
    Boolean(scope.is_admin) ||
    isExactScopeAdmin ||
    canLeadership;

  const [summary, setSummary] =
    useState<ScopeFaithMonitoringSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emptyNotice, setEmptyNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setEmptyNotice(null);

    try {
      if (scope.scope_type === 'CLUSTER') {
        setCanLeadership(await canViewClusterProgress(scope.scope_id));
      } else {
        setCanLeadership(false);
      }

      const result = await fetchScopeFaithMonitoringSummaryResilient({
        scopeId: scope.scope_id,
        scopeName: scope.name,
      });

      setSummary(result.summary);

      if (result.isHardError && result.warning) {
        setError(result.warning);
        return;
      }

      if (result.warning) {
        setEmptyNotice(result.warning);
      } else if (result.isEmpty) {
        setEmptyNotice(
          summaryEmptyCopy(scope.name, result.summary.active_members)
        );
      }
    } catch (e: unknown) {
      setError('Could not load faith monitoring. Please try again.');
      setSummary(null);
      console.warn('Faith monitoring summary:', e);
    } finally {
      setLoading(false);
    }
  }, [scope.scope_id, scope.name]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (!scope.show_faith_content) {
    return null;
  }

  if (loading && !summary) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={colors.green} />
        <Text style={styles.loadingText}>Loading faith monitoring...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>FAITH MONITORING</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={() => void load()} style={styles.retry}>
          <Text style={styles.retryText}>RETRY</Text>
        </Pressable>
      </View>
    );
  }

  if (!summary) {
    return null;
  }

  const members = summary.active_members;
  const daily = summary.daily_reading;
  const devotion = summary.devotion;
  const lesson = summary.buklod_lesson;

  const openMembers = (
    area: 'daily' | 'devotion' | 'lesson',
    filter: string = 'all',
    stage?: number,
  ) => router.push({
    pathname: '/scope/faith-monitoring/members' as any,
    params: {
      ...scopeRouteParams(scope.scope_id),
      area,
      filter,
      ...(stage ? { stage: String(stage) } : {}),
    },
  } as any);

  return (
    <View style={styles.wrap}>
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>FAITH MONITORING</Text>
        <View style={styles.cardHeadRight}>
          <Text style={styles.cardMeta}>
            {summary.active_members} active member
            {summary.active_members === 1 ? '' : 's'}
          </Text>
          {isAdmin ? (
            <Pressable
              style={styles.reportLink}
              onPress={() =>
                router.push({
                  pathname: '/scope/faith-monitoring/report',
                  params: scopeRouteParams(scope.scope_id),
                } as any)
              }
            >
              <MaterialCommunityIcons
                name="chart-box-outline"
                size={14}
                color={colors.greenDark}
              />
              <Text style={styles.reportLinkText}>
                Report
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <Text style={styles.cardIntro}>
        Separate progress summary for this {scope.name} workspace — Daily
        Reading, Devotion, and Buklod Lesson.
      </Text>

      {emptyNotice ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{emptyNotice}</Text>
        </View>
      ) : null}

      <MonitorSection
        title="Daily Reading"
        subtitle={
          daily.bible_reference
            ? `Today: ${daily.bible_reference}`
            : 'Today’s reading plan'
        }
        icon="calendar-text-outline"
        onPress={() => openMembers("daily")}
      >
        <ProgressBar
          value={daily.approved_today}
          total={members}
          tone="green"
        />
        <MetricRow
          label="Approved today"
          value={`${daily.approved_today} / ${members} (${formatFaithMonitoringRate(daily.approved_today, members)})`}
          emphasize
          onPress={() => openMembers("daily", "approved")}
        />
        <MetricRow
          label="Submitted today"
          value={`${daily.submitted_today} / ${members}`}
          onPress={() => openMembers("daily", "submitted")}
        />
        <MetricRow
          label="Pending review"
          value={daily.pending_review}
          onPress={() => openMembers("daily", "checking")}
        />
        <MetricRow label="Needs revision" value={daily.needs_revision} onPress={() => openMembers("daily", "revision")} />
        <MetricRow
          label="Not yet submitted"
          value={daily.not_submitted_today}
          onPress={() => openMembers("daily", "missing")}
        />
        <MetricRow
          label="Approved this week"
          value={`${daily.approved_this_week} / ${members}`}
          onPress={() => openMembers("daily", "weekly")}
        />
      </MonitorSection>

      <MonitorSection
        title="Devotion"
        subtitle="Daily devotional (Word)"
        icon="book-open-page-variant-outline"
        onPress={() => openMembers("devotion")}
      >
        <ProgressBar
          value={devotion.completed_today}
          total={members}
          tone="amber"
        />
        <MetricRow
          label="Completed today"
          value={`${devotion.completed_today} / ${members} (${formatFaithMonitoringRate(devotion.completed_today, members)})`}
          emphasize
          onPress={() => openMembers("devotion", "completed")}
        />
        <MetricRow
          label="Not completed today"
          value={devotion.not_completed_today}
          onPress={() => openMembers("devotion", "missing")}
        />
        <MetricRow
          label="Submitted today"
          value={`${devotion.submitted_today} / ${members}`}
          onPress={() => openMembers("devotion", "submitted")}
        />
        <MetricRow
          label="Automatic checking"
          value={devotion.automatic_checking}
          onPress={() => openMembers("devotion", "checking")}
        />
        <MetricRow
          label="Needs revision"
          value={devotion.needs_revision}
          onPress={() => openMembers("devotion", "revision")}
        />
        <MetricRow
          label="Completed this week"
          value={`${devotion.completed_this_week} / ${members}`}
          onPress={() => openMembers("devotion", "weekly")}
        />
      </MonitorSection>

      <MonitorSection
        title="Buklod Lesson"
        subtitle="BUKLOD learning progress by stage"
        icon="school-outline"
        onPress={() => openMembers("lesson")}
      >
        <MetricRow
          label="Members with lesson activity"
          value={lesson.members_active}
          emphasize
          onPress={() => openMembers("lesson", "active")}
        />
        <MetricRow
          label="Not yet started"
          value={lesson.members_not_started}
          onPress={() => openMembers("lesson", "missing")}
        />

        {lesson.stages.length ? (
          <View style={styles.stageList}>
            {lesson.stages.map((stage) => (
              <Pressable
                key={stage.stage_code}
                accessibilityRole="button"
                accessibilityLabel={`View BUKLOD ${stage.stage_code} members`}
                onPress={(event) => {
                  event.stopPropagation();
                  openMembers('lesson', 'all', stage.stage_code);
                }}
                style={styles.stageRow}
              >
                <View style={styles.stageHead}>
                  <Text style={styles.stageCode}>
                    BUKLOD {stage.stage_code}
                  </Text>
                  <Text style={styles.stageTitle} numberOfLines={1}>
                    {stage.stage_title}
                  </Text>
                </View>
                <View style={styles.stageStats}>
                  <Text style={styles.stageStat}>
                    Done: {stage.completed_count}
                  </Text>
                  <Text style={styles.stageStat}>
                    In progress: {stage.in_progress_count}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={18} color={colors.greenDark} style={styles.stageChevron} />
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={styles.muted}>No lesson stage data yet.</Text>
        )}
      </MonitorSection>
    </View>

    <BuklodScopeFaithMonitoringMemberFeedback
      scopeId={scope.scope_id}
    />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 12,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardHeadRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  reportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#F4F8F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reportLinkText: {
    color: colors.greenDark,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  cardTitle: {
    color: '#173B2F',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  cardMeta: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  cardIntro: {
    color: '#5F6F67',
    fontSize: 11,
    lineHeight: 16,
  },
  notice: {
    borderRadius: 12,
    backgroundColor: '#F4F8F6',
