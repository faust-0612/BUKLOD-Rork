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
}: {
  label: string;
  value: string | number;
  emphasize?: boolean;
}) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, emphasize && styles.metricValueStrong]}>
        {value}
      </Text>
    </View>
  );
}

function MonitorSection({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
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
    </View>
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
        />
        <MetricRow
          label="Submitted today"
          value={`${daily.submitted_today} / ${members}`}
        />
        <MetricRow
          label="Pending review"
          value={daily.pending_review}
        />
        <MetricRow
          label="Not yet submitted"
          value={daily.not_submitted_today}
        />
        <MetricRow
          label="Approved this week"
          value={`${daily.approved_this_week} / ${members}`}
        />
      </MonitorSection>

      <MonitorSection
        title="Devotion"
        subtitle="Daily devotional (Word)"
        icon="book-open-page-variant-outline"
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
        />
        <MetricRow
          label="Not completed today"
          value={devotion.not_completed_today}
        />
        <MetricRow
          label="Completed this week"
          value={`${devotion.completed_this_week} / ${members}`}
        />
      </MonitorSection>

      <MonitorSection
        title="Buklod Lesson"
        subtitle="BUKLOD learning progress by stage"
        icon="school-outline"
      >
        <MetricRow
          label="Members with lesson activity"
          value={lesson.members_active}
          emphasize
        />
        <MetricRow
          label="Not yet started"
          value={lesson.members_not_started}
        />

        {lesson.stages.length ? (
          <View style={styles.stageList}>
            {lesson.stages.map((stage) => (
              <View key={stage.stage_code} style={styles.stageRow}>
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
              </View>
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
    borderWidth: 1,
    borderColor: '#DCE5E0',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noticeText: {
    color: '#476055',
    fontSize: 11,
    lineHeight: 16,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 11,
    textAlign: 'center',
  },
  errorText: {
    color: '#991B1B',
    fontSize: 11,
    lineHeight: 16,
  },
  retry: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#F4F7F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  retryText: {
    color: colors.greenDark,
    fontSize: 10,
    fontWeight: '900',
  },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8EFEA',
    backgroundColor: '#F8FAF9',
    padding: 12,
    gap: 8,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCopy: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    color: '#173B2F',
    fontSize: 12,
    fontWeight: '900',
  },
  sectionSubtitle: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 10,
    lineHeight: 14,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E5ECE8',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  metricLabel: {
    flex: 1,
    color: '#5F6F67',
    fontSize: 10,
    fontWeight: '600',
  },
  metricValue: {
    color: '#173B2F',
    fontSize: 10,
    fontWeight: '800',
  },
  metricValueStrong: {
    color: colors.greenDark,
    fontSize: 11,
  },
  stageList: {
    gap: 8,
    marginTop: 4,
  },
  stageRow: {
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EFEA',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  stageHead: {
    gap: 2,
  },
  stageCode: {
    color: colors.greenDark,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  stageTitle: {
    color: '#173B2F',
    fontSize: 10,
    fontWeight: '700',
  },
  stageStats: {
    flexDirection: 'row',
    gap: 12,
  },
  stageStat: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '700',
  },
  muted: {
    color: colors.muted,
    fontSize: 10,
  },
});
