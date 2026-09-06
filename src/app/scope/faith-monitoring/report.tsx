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
import { shareCsv } from '@/lib/reports/export';
import { colors } from '@/lib/theme';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

function MetricRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

export default function ScopeFaithMonitoringReportScreen() {
  const { activeScope } = useBuklodScope();
  const { isExactScopeAdmin, isSystemAdmin } = useBuklodAccess();

  const [summary, setSummary] =
    useState<ScopeFaithMonitoringSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const isAdmin =
    Boolean(activeScope?.is_admin) ||
    isExactScopeAdmin ||
    isSystemAdmin;

  const load = useCallback(async () => {
    if (!activeScope?.scope_id) {
      setSummary(null);
      setLoading(false);
      return;
    }

    try {
      const result = await fetchScopeFaithMonitoringSummaryResilient({
        scopeId: activeScope.scope_id,
        scopeName: activeScope.name,
      });

      setSummary(result.summary);
    } catch (error) {
      Alert.alert(
        'Faith monitoring report',
        String(
          (error as Error)?.message ??
            'Could not load report.'
        )
      );
      setSummary(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeScope?.name, activeScope?.scope_id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  const analysis = useMemo(
    () => (summary ? buildFaithMonitoringAnalysis(summary) : []),
    [summary]
  );

  const exportReport = useCallback(async () => {
    if (!summary || !activeScope?.scope_id) return;

    setExporting(true);

    try {
      const rows = faithMonitoringSummaryToCsvRows(summary);
      const safeName = activeScope.name
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();

      await shareCsv(
        `faith-monitoring-${safeName || 'scope'}-${summary.summary_date}.csv`,
        rows
      );
    } catch (error) {
      Alert.alert(
        'Export',
        String(
          (error as Error)?.message ??
            'Could not export report.'
        )
      );
    } finally {
      setExporting(false);
    }
  }, [activeScope?.name, activeScope?.scope_id, summary]);

  if (!activeScope?.scope_id) {
    return (
      <BuklodScopedWorkspaceScrollView
        style={shared.screen}
        contentContainerStyle={shared.content}
      >
        <Text style={shared.h2}>Report unavailable</Text>
        <Text style={shared.muted}>
          Open a workspace home first.
        </Text>
      </BuklodScopedWorkspaceScrollView>
    );
  }

  if (!isAdmin) {
    return (
      <BuklodScopedWorkspaceScrollView
        style={shared.screen}
        contentContainerStyle={shared.content}
      >
        <Text style={shared.h2}>Admin access required</Text>
        <Text style={shared.muted}>
          Faith monitoring reports are limited to exact-scope admins.
        </Text>
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
        <Pressable
          style={styles.back}
          onPress={() => router.back()}
          accessibilityLabel="Back"
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={22}
            color={colors.greenDark}
          />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={shared.h1}>Faith Monitoring Report</Text>
          <Text style={shared.muted}>{activeScope.name}</Text>
        </View>
        <Pressable
          style={styles.exportBtn}
          onPress={() => router.push('/scope/formation-approvals' as any)}
        >
          <MaterialCommunityIcons
            name="clipboard-check-outline"
            size={18}
            color={colors.greenDark}
          />
          <Text style={styles.exportText}>Approvals</Text>
        </Pressable>
        <Pressable
          style={styles.exportBtn}
          disabled={!summary || exporting}
          onPress={() => void exportReport()}
        >
          <MaterialCommunityIcons
            name="export-variant"
            size={18}
            color={colors.greenDark}
          />
          <Text style={styles.exportText}>
            {exporting ? '…' : 'Export'}
          </Text>
        </Pressable>
      </View>

      {loading && !summary ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.green} />
          <Text style={shared.muted}>Building report…</Text>
        </View>
      ) : summary ? (
        <>
          <SectionTitle>SNAPSHOT</SectionTitle>
          <Card>
            <MetricRow
              label="Active members"
              value={summary.active_members}
            />
            <MetricRow
              label="Daily Reading approved today"
              value={`${summary.daily_reading.approved_today} (${formatFaithMonitoringRate(
                summary.daily_reading.approved_today,
                summary.active_members
              )})`}
            />
            <MetricRow
              label="Devotion completed today"
              value={`${summary.devotion.completed_today} (${formatFaithMonitoringRate(
                summary.devotion.completed_today,
                summary.active_members
              )})`}
            />
            <MetricRow
              label="Lesson members active"
              value={summary.buklod_lesson.members_active}
            />
            <MetricRow
              label="Report date"
              value={summary.summary_date}
            />
          </Card>

          <SectionTitle>ANALYSIS</SectionTitle>
          <Card>
            <View style={styles.analysisWrap}>
              {analysis.map((section) => (
                <View key={section.key} style={styles.analysisBlock}>
                  <Text style={styles.analysisKey}>
                    {section.key}
                  </Text>
                  <Text style={styles.analysisBody}>
                    {section.body}
                  </Text>
                </View>
              ))}
            </View>
          </Card>

          <SectionTitle>MEMBER FEEDBACK</SectionTitle>
          <BuklodScopeFaithMonitoringAdminFeedbackCard
            scopeId={activeScope.scope_id}
            scopeName={activeScope.name}
          />
        </>
      ) : (
        <Text style={shared.muted}>
          No report data available right now.
        </Text>
      )}
    </BuklodScopedWorkspaceScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
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
  exportText: {
    color: colors.greenDark,
    fontSize: 10,
    fontWeight: '900',
  },
  loading: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 4,
  },
  metricLabel: {
    flex: 1,
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  metricValue: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  analysisWrap: {
    gap: 10,
  },
  analysisBlock: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 12,
    backgroundColor: colors.white,
    gap: 6,
  },
  analysisKey: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: colors.greenDark,
  },
  analysisBody: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.text,
  },
});
