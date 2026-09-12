import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import {
  exportConsolidatedReportXlsx,
  fetchConsolidatedReportData,
  type ConsolidatedReportData,
} from '@/lib/buklodReportConsolidation';
import { verifyOrganizationManageAccess } from '@/lib/buklodOrganization';
import { colors } from '@/lib/theme';

function firstParam(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0].trim();
  return '';
}
function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}
function reportTitle(data: ConsolidatedReportData | null) {
  if (!data) return 'Consolidated Report';
  const requirements = objectValue(data.definition.content_requirements);
  return String(requirements.template_label ?? data.definition.title);
}
function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function BuklodReportConsolidatedScreen() {
  const params = useLocalSearchParams();
  const scopeId = firstParam(params.scopeId ?? params.scope_id ?? params.organization);
  const definitionId = firstParam(params.definitionId ?? params.definition_id);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [allData, setAllData] = useState<ConsolidatedReportData | null>(null);
  const [viewData, setViewData] = useState<ConsolidatedReportData | null>(null);

  const load = useCallback(async () => {
    if (!scopeId || !definitionId) { setLoading(false); return; }
    setLoading(true);
    try {
      const access = await verifyOrganizationManageAccess(scopeId);
      setAllowed(access.allowed);
      if (!access.allowed) return;
      const data = await fetchConsolidatedReportData(definitionId, null);
      if (data.definition.scope_id !== scopeId) throw new Error('This report belongs to a different scope.');
      setAllData(data);
      setViewData(data);
    } catch (error: unknown) {
      Alert.alert('BUKLOD Report', error instanceof Error ? error.message : 'Could not load consolidated report.');
    } finally { setLoading(false); }
  }, [definitionId, scopeId]);

  useEffect(() => { void load(); }, [load]);

  const selectPeriod = async (periodId: string) => {
    if (!definitionId || periodId === selectedPeriodId) return;
    setSelectedPeriodId(periodId);
    if (!periodId) { setViewData(allData); return; }
    setLoading(true);
    try { setViewData(await fetchConsolidatedReportData(definitionId, periodId)); }
    catch (error: unknown) { Alert.alert('BUKLOD Report', error instanceof Error ? error.message : 'Could not load that reporting period.'); }
    finally { setLoading(false); }
  };

  const totals = useMemo(() => (viewData?.periods ?? []).reduce(
    (acc, period) => ({ assigned: acc.assigned + Number(period.assigned_count ?? 0), submitted: acc.submitted + Number(period.submitted_count ?? 0) }),
    { assigned: 0, submitted: 0 }
  ), [viewData?.periods]);

  const doExport = async () => {
    if (!viewData || exporting) return;
    setExporting(true);
    try {
      await exportConsolidatedReportXlsx(viewData);
      Alert.alert('Export ready', 'The consolidated report was converted to an Excel file.');
    } catch (error: unknown) {
      Alert.alert('Export failed', error instanceof Error ? error.message : 'Could not export consolidated report.');
    } finally { setExporting(false); }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Consolidated Report' }} />
      <BuklodPortalScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <MaterialCommunityIcons name="arrow-left" size={19} color={colors.greenDark} />
          <Text style={styles.backText}>Report Library</Text>
        </Pressable>
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>CONSOLIDATED REPORT</Text>
          <Text style={styles.heroTitle}>{reportTitle(viewData)}</Text>
          <Text style={styles.heroText}>Combine submitted reports into one management view and exportable Excel file.</Text>
        </View>

        {loading && !viewData ? (
          <View style={styles.center}><ActivityIndicator color={colors.green} /><Text style={styles.note}>Loading submissions…</Text></View>
        ) : !allowed ? (
          <View style={styles.card}><Text style={styles.note}>Exact-scope admin access is required.</Text></View>
        ) : viewData ? (
          <>
            <View style={styles.metricsRow}>
              <Metric label="Assigned" value={totals.assigned} />
              <Metric label="Submitted" value={totals.submitted} />
              <Metric label="Pending" value={Math.max(0, totals.assigned - totals.submitted)} />
              <Metric label="Rows" value={viewData.submissions.length} />
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>REPORTING PERIOD</Text>
              <View style={styles.chips}>
                <Chip label="All periods" selected={!selectedPeriodId} onPress={() => void selectPeriod('')} />
                {(allData?.periods ?? []).map((period) => <Chip key={period.id} label={period.title} selected={selectedPeriodId === period.id} onPress={() => void selectPeriod(period.id)} />)}
              </View>
            </View>
            <View style={styles.card}>
              <View style={styles.sectionHead}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>PERIOD SUMMARY</Text><Text style={styles.note}>Assigned, submitted and pending counts per deadline.</Text></View>{loading ? <ActivityIndicator size="small" color={colors.green} /> : null}</View>
              {viewData.periods.length === 0 ? <Text style={styles.note}>No published deadline yet.</Text> : viewData.periods.map((period) => (
                <View key={period.id} style={styles.periodRow}><View style={{ flex: 1 }}><Text style={styles.periodTitle}>{period.title}</Text><Text style={styles.periodMeta}>Deadline {formatDate(period.due_at)}</Text></View><Text style={styles.periodCount}>{period.submitted_count}/{period.assigned_count}</Text></View>
              ))}
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>SUBMITTED REPORTS</Text>
              <Text style={styles.note}>The Excel export contains the full saved report fields. This preview shows submission identity and status.</Text>
              {viewData.submissions.length === 0 ? <Text style={styles.note}>No submitted report in this selection.</Text> : viewData.submissions.slice(0, 100).map((submission) => (
                <View key={submission.submission_id} style={styles.submissionRow}><View style={styles.avatar}><MaterialCommunityIcons name="account-outline" size={18} color={colors.greenDark} /></View><View style={{ flex: 1 }}><Text style={styles.submitter}>{submission.submitter_name}</Text><Text style={styles.submissionMeta}>{submission.period_title} · {submission.submission_status} · {formatDate(submission.submitted_at)}</Text></View></View>
              ))}
            </View>
            <Pressable disabled={exporting} onPress={() => void doExport()} style={[styles.exportButton, exporting && styles.disabled]}>
              {exporting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MaterialCommunityIcons name="microsoft-excel" size={19} color="#FFFFFF" />}
              <Text style={styles.exportText}>{exporting ? 'Building file…' : 'Export consolidated Excel'}</Text>
            </Pressable>
          </>
        ) : null}
      </BuklodPortalScrollView>
    </>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}
function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  content: { padding: 14, gap: 12, backgroundColor: colors.background },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { color: colors.greenDark, fontSize: 12, fontWeight: '900' },
  hero: { borderRadius: 18, padding: 16, backgroundColor: colors.greenDark, gap: 5 },
  heroEyebrow: { color: 'rgba(255,255,255,0.68)', fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  heroText: { color: 'rgba(255,255,255,0.86)', fontSize: 11, lineHeight: 16 },
  center: { paddingVertical: 28, alignItems: 'center', gap: 8 },
  card: { borderRadius: 15, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FFFFFF', padding: 13, gap: 9 },
  cardTitle: { color: colors.greenDark, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  note: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { minWidth: 76, flexGrow: 1, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FFFFFF', paddingVertical: 11, paddingHorizontal: 9, alignItems: 'center' },
  metricValue: { color: colors.greenDark, fontSize: 20, fontWeight: '900' },
  metricLabel: { color: colors.muted, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { maxWidth: 220, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 7 },
  chipSelected: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  chipText: { color: colors.text, fontSize: 9, fontWeight: '800' },
  chipTextSelected: { color: '#FFFFFF' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  periodRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 9 },
  periodTitle: { color: colors.text, fontSize: 11, fontWeight: '900' },
  periodMeta: { color: colors.muted, fontSize: 9, marginTop: 2 },
  periodCount: { color: colors.greenDark, fontSize: 13, fontWeight: '900' },
  submissionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 8 },
  avatar: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#EAF5EF', alignItems: 'center', justifyContent: 'center' },
  submitter: { color: colors.text, fontSize: 10, fontWeight: '900' },
  submissionMeta: { color: colors.muted, fontSize: 8, marginTop: 2 },
  exportButton: { minHeight: 47, borderRadius: 12, backgroundColor: colors.greenDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14 },
  exportText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  disabled: { opacity: 0.48 },
});
