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

function MetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function PipelineCard({
  title,
  submitted,
  approved,
  checking,
  revision,
  total,
}: {
  title: string;
  submitted: number;
  approved: number;
  checking: number;
  revision: number;
  total: number;
}) {
  return (
    <Card>
      <Text style={styles.pipelineTitle}>{title}</Text>
      <MetricRow label="Submitted today" value={`${submitted} (${formatFaithMonitoringRate(submitted, total)})`} />
      <MetricRow label="Automatically approved" value={approved} />
      <MetricRow label="Automatic checking" value={checking} />
      <MetricRow label="Needs revision" value={revision} />
    </Card>
  );
}

export default function ScopeFaithMonitoringReportScreen() {
  const { activeScope } = useBuklodScope();
  const { isExactScopeAdmin } = useBuklodAccess();
  const [summary, setSummary] = useState<ScopeFaithMonitoringSummary | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [canLeadership, setCanLeadership] = useState(false);

  const isAdmin = Boolean(activeScope?.is_admin) || isExactScopeAdmin || canLeadership;

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
          />

          <SectionTitle>DAILY DEVOTION</SectionTitle>
          <PipelineCard
            title="Daily Devotion"
            submitted={summary.devotion.submitted_today}
            approved={summary.devotion.approved_today}
            checking={summary.devotion.automatic_checking}
            revision={summary.devotion.needs_revision}
            total={summary.active_members}
          />

          <SectionTitle>BUKLOD LESSON</SectionTitle>
          <PipelineCard
            title="Lesson completion"
            submitted={summary.buklod_lesson.submitted_today}
            approved={summary.buklod_lesson.approved_today}
            checking={summary.buklod_lesson.automatic_checking}
            revision={summary.buklod_lesson.needs_revision}
            total={summary.active_members}
          />

          <SectionTitle>ANALYSIS</SectionTitle>
          <Card>
            <View style={styles.analysisWrap}>
              {analysis.map((section) => (
                <View key={section.key} style={styles.analysisBlock}>
                  <Text style={styles.analysisKey}>{section.key}</Text>
                  <Text style={styles.analysisBody}>{section.body}</Text>
                </View>
              ))}
            </View>
          </Card>

          <SectionTitle>MEMBER FEEDBACK</SectionTitle>
          <BuklodScopeFaithMonitoringAdminFeedbackCard scopeId={activeScope.scope_id} scopeName={activeScope.name} />
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
  metricValue: { color: colors.text, fontSize: 11, fontWeight: '800' },
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
  analysisKey: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8, color: colors.greenDark },
  analysisBody: { fontSize: 12, lineHeight: 18, color: colors.text },
});
