import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import BuklodScopeFaithMonitoringAdminFeedbackCard from '@/components/BuklodScopeFaithMonitoringAdminFeedbackCard';
import BuklodScopeFaithMonitoringMetricDetailsModal, { type FaithMonitoringMetricKey } from '@/components/BuklodScopeFaithMonitoringMetricDetailsModal';
import BuklodScopeFormationRecentSubmissions from '@/components/BuklodScopeFormationRecentSubmissions';
import BuklodScopedWorkspaceScrollView from '@/components/BuklodScopedWorkspaceScrollView';
import { Card, SectionTitle, shared } from '@/components/UI';
import { useBuklodAccess } from '@/hooks/useBuklodAccess';
import {
  buildFaithMonitoringAnalysis,
  faithMonitoringSummaryToCsvRows,
} from '@/lib/buklodScopeFaithMonitoringAnalysis';
import {
  fetchScopeFaithMonitoringSummaryResilient,
  formatFaithMonitoringRate,
  type ScopeFaithMonitoringSummary,
} from '@/lib/buklodScopeFaithMonitoring';
import { canViewClusterProgress } from '@/lib/buklodOrgGovernance';
import { shareCsv } from '@/lib/reports/export';
import { colors } from '@/lib/theme';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

function MetricRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string | number;
  onPress?: () => void;
}) {
  const content = (
    <>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricValueWrap}>
        <Text style={styles.metricValue}>{value}</Text>
        {onPress ? (
          <MaterialCommunityIcons
            name="chevron-right"
            size={16}
            color={colors.greenDark}
          />
        ) : null}
      </View>
    </>
  );

  return onPress ? (
    <Pressable
      style={({ pressed }) => [
        styles.metricRow,
        styles.metricRowPressable,
        pressed && styles.metricRowPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}. Open details.`}
    >
      {content}
    </Pressable>
  ) : (
    <View style={styles.metricRow}>{content}</View>
  );
}

function PipelineCard({
  title,
  submitted,
  approved,
  checking,
  revision,
  total,
  metricPrefix,
  onOpenMetric,
}: {
  title: string;
  submitted: number;
  approved: number;
  checking: number;
  revision: number;
  total: number;
  metricPrefix: 'DAILY_READING' | 'DEVOTION' | 'LESSON';
  onOpenMetric: (
    metric: FaithMonitoringMetricKey,
    title: string
  ) => void;
}) {
  return (
    <Card>
      <Text style={styles.pipelineTitle}>{title}</Text>
      <MetricRow
        label="Submitted today"
        value={`${submitted} (${formatFaithMonitoringRate(submitted, total)})`}
        onPress={() =>
          onOpenMetric(
            `${metricPrefix}_SUBMITTED_TODAY` as FaithMonitoringMetricKey,
            `${title} · Submitted today`
          )
        }
      />
      <MetricRow
        label="Automatically approved"
        value={approved}
        onPress={() =>
          onOpenMetric(
            `${metricPrefix}_APPROVED_TODAY` as FaithMonitoringMetricKey,
            `${title} · Automatically approved`
          )
        }
      />
      <MetricRow
        label="Automatic checking"
        value={checking}
        onPress={() =>
          onOpenMetric(
            `${metricPrefix}_CHECKING` as FaithMonitoringMetricKey,
            `${title} · Automatic checking`
          )
        }
      />
      <MetricRow
        label="Needs revision"
        value={revision}
        onPress={() =>
          onOpenMetric(
            `${metricPrefix}_NEEDS_REVISION` as FaithMonitoringMetricKey,
            `${title} · Needs revision`
          )
        }
      />
    </Card>
  );
}

export default function ScopeFaithMonitoringReportScreen() {
  const { activeScope } = useBuklodScope();
  const { isExactScopeAdmin, isSystemAdmin } = useBuklodAccess();
  const [summary, setSummary] = useState<ScopeFaithMonitoringSummary | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [canLeadership, setCanLeadership] = useState(false);
  const [detail, setDetail] = useState<{
    metric: FaithMonitoringMetricKey;
    title: string;
  } | null>(null);

  const isAdmin = Boolean(activeScope?.is_admin) || isExactScopeAdmin || isSystemAdmin || canLeadership;

  const load = useCallback(async () => {
    if (!activeScope?.scope_id) {
      setSummary(null);
      setWarning(null);
      setCanLeadership(false);
      setLoading(false);
      return;
    }

    try {
      if (activeScope.scope_type === 'CLUSTER') {
        setCanLeadership(await canViewClusterProgress(activeScope.scope_id));
      } else {
        setCanLeadership(false);
      }

      const result = await fetchScopeFaithMonitoringSummaryResilient({
        scopeId: activeScope.scope_id,
        scopeName: activeScope.name,
      });
      setSummary(result.summary);
      setWarning(result.warning);
    } catch (error) {
      const message = String((error as Error)?.message ?? 'Could not load report.');
      Alert.alert('Formation Submission Report', message);
      setSummary(null);
      setWarning(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeScope?.name, activeScope?.scope_id, activeScope?.scope_type]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  const analysis = useMemo(() => (summary ? buildFaithMonitoringAnalysis(summary) : []), [summary]);

  const openMetric = useCallback(
    (metric: FaithMonitoringMetricKey, title: string) => {
      setDetail({ metric, title });
    },
    []
  );

  const analysisMetric = useCallback(
    (key: string): { metric: FaithMonitoringMetricKey; title: string } | null => {
      if (key === 'OVERVIEW') {
        return {
          metric: 'OVERVIEW_ACTIVE_MEMBERS',
          title: 'Overview · Active members',
        };
      }

      if (key === 'DAILY READING') {
        return {
          metric: 'DAILY_READING_APPROVED_TODAY',
          title: 'Daily Reading · Approved today',
        };
      }

      if (key === 'DEVOTION') {
        return {
          metric: 'DEVOTION_SUBMITTED_TODAY',
          title: 'Daily Devotion · Completed today',
        };
      }

      if (key === 'BUKLOD LESSON') {
        return {
          metric: 'LESSON_ACTIVITY',
          title: 'BUKLOD Lesson · Members with activity',
        };
      }

      if (key === 'ATTENTION') {
        return {
          metric: 'DAILY_READING_NOT_SUBMITTED',
          title: 'Daily Reading · Not submitted today',
        };
      }

      if (key === 'DEVOTION FOLLOW-UP') {
        return {
          metric: 'DEVOTION_NOT_COMPLETED',
          title: 'Daily Devotion · Not completed today',
        };
      }

      return null;
    },
    []
  );

  const exportReport = useCallback(async () => {
    if (!summary || !activeScope?.scope_id) return;
    setExporting(true);
    try {
      const rows = faithMonitoringSummaryToCsvRows(summary);
      const safeName = activeScope.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
      await shareCsv(`formation-submission-${safeName || 'scope'}-${summary.summary_date}.csv`, rows);
    } catch (error) {
      Alert.alert('Export', String((error as Error)?.message ?? 'Could not export report.'));
    } finally {
      setExporting(false);
    }
  }, [activeScope?.name, activeScope?.scope_id, summary]);

  if (!activeScope?.scope_id) {
    return (
      <BuklodScopedWorkspaceScrollView style={shared.screen} contentContainerStyle={shared.content}>
        <Text style={shared.h2}>Report unavailable</Text>
        <Text style={shared.muted}>Open a workspace home first.</Text>
      </BuklodScopedWorkspaceScrollView>
    );
  }

  if (!isAdmin) {
    return (
      <BuklodScopedWorkspaceScrollView style={shared.screen} contentContainerStyle={shared.content}>
        <Text style={shared.h2}>Leadership access required</Text>
        <Text style={shared.muted}>Formation reports are limited to authorized scope leadership.</Text>
      </BuklodScopedWorkspaceScrollView>
    );
  }

  return (
    <BuklodScopedWorkspaceScrollView
      style={shared.screen}
      contentContainerStyle={shared.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
        />
      }
    >
      <View style={styles.headerRow}>
        <Pressable style={styles.back} onPress={() => router.back()} accessibilityLabel="Back">
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.greenDark} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={shared.h1}>Formation Submission Report</Text>
          <Text style={shared.muted}>{activeScope.name}</Text>
        </View>
        <Pressable style={styles.exportBtn} disabled={!summary || exporting} onPress={() => void exportReport()}>
          <MaterialCommunityIcons name="export-variant" size={18} color={colors.greenDark} />
          <Text style={styles.exportText}>{exporting ? '…' : 'Export'}</Text>
        </Pressable>
      </View>

      {warning ? (
        <Card>
          <View style={styles.warningRow}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#B3261E" />
            <View style={{ flex: 1 }}>
              <Text style={styles.warningTitle}>REPORT DATA WARNING</Text>
              <Text style={styles.warningText}>{warning}</Text>
            </View>
          </View>
        </Card>
      ) : null}

      {loading && !summary ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.green} />
          <Text style={shared.muted}>Building report…</Text>
        </View>
      ) : summary ? (
        <>
          <SectionTitle>AUTOMATIC PIPELINE</SectionTitle>
          <Card>
            <Text style={styles.autoTitle}>AUTOMATIC SUBMISSION & CHECKING</Text>
            <Text style={shared.muted}>
              Completing Daily Reading, Daily Devotion, or a BUKLOD Lesson automatically creates its submission and sends it through BUKLOD validation. No separate manual submission or Admin approval is required.
            </Text>
            <MetricRow label="Active members" value={summary.active_members} />
            <MetricRow label="Submission mode" value={summary.submission_mode ?? 'AUTOMATIC'} />
            <MetricRow label="Human approval required" value={summary.human_approval_required === true ? 'Yes' : 'No'} />
            <MetricRow label="Report date" value={summary.summary_date} />
          </Card>

          <SectionTitle>DAILY READING</SectionTitle>
          <PipelineCard
            title={summary.daily_reading.bible_reference || 'Daily Reading'}
            submitted={summary.daily_reading.submitted_today}
            approved={summary.daily_reading.approved_today}
            checking={summary.daily_reading.automatic_checking}
            revision={summary.daily_reading.needs_revision}
            total={summary.active_members}
            metricPrefix="DAILY_READING"
            onOpenMetric={openMetric}
          />

          <SectionTitle>DAILY DEVOTION</SectionTitle>
          <PipelineCard
            title="Daily Devotion"
            submitted={summary.devotion.submitted_today}
            approved={summary.devotion.approved_today}
            checking={summary.devotion.automatic_checking}
            revision={summary.devotion.needs_revision}
            total={summary.active_members}
            metricPrefix="DEVOTION"
            onOpenMetric={openMetric}
          />

          <SectionTitle>BUKLOD LESSON</SectionTitle>
          <PipelineCard
            title="Lesson completion"
            submitted={summary.buklod_lesson.submitted_today}
            approved={summary.buklod_lesson.approved_today}
            checking={summary.buklod_lesson.automatic_checking}
            revision={summary.buklod_lesson.needs_revision}
            total={summary.active_members}
            metricPrefix="LESSON"
            onOpenMetric={openMetric}
          />

          <SectionTitle>RECENT SUBMISSIONS</SectionTitle>
          <BuklodScopeFormationRecentSubmissions
            scopeId={activeScope.scope_id}
          />

          <SectionTitle>ANALYSIS</SectionTitle>
          <Card>
            <View style={styles.analysisWrap}>
              {analysis.map((section) => {
                const target = analysisMetric(section.key);

                return (
                  <Pressable
                    key={section.key}
                    disabled={!target}
                    onPress={() => {
                      if (target) {
                        openMetric(target.metric, target.title);
                      }
                    }}
                    style={({ pressed }) => [
                      styles.analysisBlock,
                      target && styles.analysisBlockPressable,
                      pressed && target && styles.analysisBlockPressed,
                    ]}
                    accessibilityRole={target ? 'button' : undefined}
                  >
                    <View style={styles.analysisHeader}>
                      <Text style={styles.analysisKey}>{section.key}</Text>
                      {target ? (
                        <MaterialCommunityIcons
                          name="chevron-right"
                          size={17}
                          color={colors.greenDark}
                        />
                      ) : null}
                    </View>
                    <Text style={styles.analysisBody}>{section.body}</Text>
                    {target ? (
                      <Text style={styles.tapHint}>
                        Tap to see who and why
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <SectionTitle>MEMBER FEEDBACK</SectionTitle>
          <BuklodScopeFaithMonitoringAdminFeedbackCard scopeId={activeScope.scope_id} scopeName={activeScope.name} />

          <BuklodScopeFaithMonitoringMetricDetailsModal
            visible={Boolean(detail)}
            scopeId={activeScope.scope_id}
            metric={detail?.metric ?? null}
            title={detail?.title ?? 'Report details'}
            onClose={() => setDetail(null)}
          />
        </>
      ) : (
        <Text style={shared.muted}>No report data available right now.</Text>
      )}
    </BuklodScopedWorkspaceScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  back: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.white,
  },
  exportText: { color: colors.greenDark, fontSize: 10, fontWeight: '900' },
  loading: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  warningRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  warningTitle: { color: '#B3261E', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  warningText: { marginTop: 4, color: colors.text, fontSize: 11, lineHeight: 17 },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 4,
  },
  metricLabel: { flex: 1, color: colors.muted, fontSize: 11, fontWeight: '600' },
  metricValueWrap: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metricValue: { color: colors.text, fontSize: 11, fontWeight: '800' },
  metricRowPressable: { borderRadius: 10, paddingHorizontal: 6, marginHorizontal: -6 },
  metricRowPressed: { backgroundColor: '#F1F7F3' },
  pipelineTitle: { color: colors.greenDark, fontSize: 13, fontWeight: '900', marginBottom: 8 },
  autoTitle: { color: colors.greenDark, fontSize: 11, fontWeight: '900', letterSpacing: 0.5, marginBottom: 6 },
  analysisWrap: { gap: 10 },
  analysisBlock: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 12,
    backgroundColor: colors.white,
    gap: 6,
  },
  analysisHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  analysisBlockPressable: { borderColor: '#CFE0D7' },
  analysisBlockPressed: { backgroundColor: '#F4F9F6' },
  analysisKey: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8, color: colors.greenDark },
  tapHint: { fontSize: 9, fontWeight: '800', color: colors.green, marginTop: 2 },
  analysisBody: { fontSize: 12, lineHeight: 18, color: colors.text },
});
