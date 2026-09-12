import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';

import BuklodReportScrollView from '@/components/BuklodReportScrollView';
import {
  buildManagementAnalytics,
  exportScopeManagementXlsx,
  fetchScopeManagementData,
  managementRangeForPreset,
  upsertReportAction,
  type ManagementRangePreset,
  type ManagementSuggestion,
  type ScopeManagementAction,
  type ScopeManagementData,
} from '@/lib/buklodReportConsolidation';
import { reportColors as colors, reportTheme } from '@/lib/buklodReportTheme';
import { verifyOrganizationManageAccess } from '@/lib/buklodOrganization';

const RANGE_OPTIONS: Array<{ value: ManagementRangePreset; label: string }> = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'SEMIANNUAL', label: '6 months' },
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'ALL', label: 'All' },
];

function firstParam(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0].trim();
  return '';
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusLabel(value: string) {
  return value.replace(/_/g, ' ');
}

export default function BuklodReportConsolidatedScreen() {
  const params = useLocalSearchParams();
  const scopeId = firstParam(params.scopeId ?? params.scope_id ?? params.organization);
  const initialDefinitionId = firstParam(params.definitionId ?? params.definition_id);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [mutatingActionId, setMutatingActionId] = useState('');
  const [allowed, setAllowed] = useState(false);
  const [preset, setPreset] = useState<ManagementRangePreset>('MONTHLY');
  const [definitionId, setDefinitionId] = useState(initialDefinitionId);
  const [data, setData] = useState<ScopeManagementData | null>(null);
  const [actionDrafts, setActionDrafts] = useState<Record<string, { outcome: string; nextAction: string }>>({});

  const load = useCallback(async () => {
    if (!scopeId) { setLoading(false); return; }
    setLoading(true);
    try {
      const access = await verifyOrganizationManageAccess(scopeId);
      setAllowed(access.allowed);
      if (!access.allowed) { setData(null); return; }
      const next = await fetchScopeManagementData({ scopeId, preset, definitionId: definitionId || null });
      setData(next);
      setActionDrafts((current) => {
        const nextDrafts = { ...current };
        for (const action of next.actions) {
          if (!nextDrafts[action.id]) nextDrafts[action.id] = { outcome: action.outcome ?? '', nextAction: action.next_action ?? '' };
        }
        return nextDrafts;
      });
    } catch (error: unknown) {
      Alert.alert('BUKLOD Report', error instanceof Error ? error.message : 'Could not load management consolidation.');
    } finally { setLoading(false); }
  }, [definitionId, preset, scopeId]);

  useEffect(() => { void load(); }, [load]);

  const analytics = useMemo(() => data ? buildManagementAnalytics(data) : null, [data]);
  const rangeLabel = managementRangeForPreset(preset).label;

  const createSuggestion = async (suggestion: ManagementSuggestion) => {
    if (!data || mutatingActionId) return;
    setMutatingActionId(suggestion.key);
    try {
      await upsertReportAction({
        scopeId,
        actionType: suggestion.actionType,
        title: suggestion.title,
        assigneeUserId: suggestion.assigneeUserId,
        submissionId: suggestion.submissionId,
        rationale: suggestion.rationale,
        priority: suggestion.priority,
        status: 'PLANNED',
        sourceKind: 'AUTO_RULE',
      });
      await load();
    } catch (error: unknown) {
      Alert.alert('Could not create action', error instanceof Error ? error.message : 'The suggested action could not be created.');
    } finally { setMutatingActionId(''); }
  };

  const updateAction = async (action: ScopeManagementAction, status: ScopeManagementAction['status']) => {
    if (mutatingActionId) return;
    setMutatingActionId(action.id);
    try {
      const draft = actionDrafts[action.id] ?? { outcome: action.outcome ?? '', nextAction: action.next_action ?? '' };
      await upsertReportAction({
        scopeId,
        actionId: action.id,
        actionType: action.action_type,
        title: action.title,
        assigneeUserId: action.assignee_user_id,
        submissionId: action.submission_id,
        rationale: action.rationale,
        dueAt: action.due_at,
        priority: action.priority,
        status,
        outcome: draft.outcome || action.outcome,
        nextAction: draft.nextAction || action.next_action,
        sourceKind: action.source_kind,
      });
      await load();
    } catch (error: unknown) {
      Alert.alert('Could not update action', error instanceof Error ? error.message : 'The action status could not be updated.');
    } finally { setMutatingActionId(''); }
  };

  const doExport = async () => {
    if (!data || !analytics || exporting) return;
    setExporting(true);
    try {
      await exportScopeManagementXlsx(data, analytics, rangeLabel);
      Alert.alert('Export ready', 'Management summary, analytics, people, submissions, actions, suggestions and reported concerns are included.');
    } catch (error: unknown) {
      Alert.alert('Export failed', error instanceof Error ? error.message : 'Could not export report management workbook.');
    } finally { setExporting(false); }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Report Management' }} />
      <BuklodReportScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <MaterialCommunityIcons name="arrow-left" size={19} color={colors.greenDark} />
          <Text style={styles.backText}>Report Library</Text>
        </Pressable>

        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>REPORT → ANALYSIS → ACTION → ENDPOINT</Text>
          <Text style={styles.heroTitle}>Report Management</Text>
          <Text style={styles.heroText}>Consolidate reporting evidence, identify what needs attention, record the action taken, and follow it through to completion or the next authorized intervention.</Text>
        </View>

        {loading && !data ? (
          <View style={styles.center}><ActivityIndicator color={colors.green} /><Text style={styles.note}>Loading management data…</Text></View>
        ) : !allowed ? (
          <View style={styles.card}><Text style={styles.note}>Exact-scope admin access is required.</Text></View>
        ) : data && analytics ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>CONSOLIDATION RANGE</Text>
              <View style={styles.chips}>{RANGE_OPTIONS.map((option) => <Chip key={option.value} label={option.label} selected={preset === option.value} onPress={() => setPreset(option.value)} />)}</View>
              <Text style={styles.note}>{rangeLabel} · {data.scope.name}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>REPORT FILTER</Text>
              <View style={styles.chips}>
                <Chip label="All reports" selected={!definitionId} onPress={() => setDefinitionId('')} />
                {data.definitions.map((definition) => <Chip key={definition.id} label={definition.title} selected={definitionId === definition.id} onPress={() => setDefinitionId(definition.id)} />)}
              </View>
            </View>

            <View style={styles.metricsRow}>
              <Metric label="Coverage" value={`${analytics.coverageRate}%`} icon="chart-donut" />
              <Metric label="Pending" value={String(analytics.pending)} icon="clock-outline" attention={analytics.pending > 0} />
              <Metric label="Overdue" value={String(analytics.overdue)} icon="alert-circle-outline" attention={analytics.overdue > 0} />
              <Metric label="Open actions" value={String(analytics.activeActions)} icon="clipboard-check-outline" attention={analytics.activeActions > 0} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>AUTO SUMMARY</Text>
              <Text style={styles.summaryText}>{analytics.summary}</Text>
              <Text style={styles.note}>This summary is derived from actual assignments, submissions, review states and recorded management actions in the selected range.</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>REPORTING ANALYTICS</Text>
              <Text style={styles.note}>Coverage by report type. This is a management signal, not a punitive quota.</Text>
              {analytics.byDefinition.length === 0 ? <Text style={styles.note}>No published reporting periods in this range.</Text> : analytics.byDefinition.map((row) => (
                <View key={row.definitionId} style={styles.graphRow}>
                  <View style={styles.graphHead}><Text style={styles.graphLabel} numberOfLines={1}>{row.title}</Text><Text style={styles.graphValue}>{row.submitted}/{row.assigned} · {row.coverageRate}%</Text></View>
                  <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(2, Math.min(100, row.coverageRate))}%` }]} /></View>
                  {row.overdue > 0 ? <Text style={styles.overdueText}>{row.overdue} overdue</Text> : null}
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <View style={styles.sectionHead}>
                <View style={styles.flexCopy}><Text style={styles.cardTitle}>SUGGESTED MANAGEMENT ACTION</Text><Text style={styles.note}>Suggestions are rule-based decision support. Counselling, reassignment, suspension, or dismissal never happens automatically.</Text></View>
                <View style={styles.countPill}><Text style={styles.countText}>{analytics.suggestions.length}</Text></View>
              </View>
              {analytics.suggestions.length === 0 ? <Text style={styles.goodText}>No new action suggestion from the selected range.</Text> : analytics.suggestions.map((suggestion) => (
                <View key={suggestion.key} style={styles.suggestionCard}>
                  <View style={styles.flexCopy}>
                    <Text style={styles.suggestionType}>{statusLabel(suggestion.actionType)}</Text>
                    <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
                    {suggestion.assigneeName ? <Text style={styles.personLine}>{suggestion.assigneeName}</Text> : null}
                    <Text style={styles.note}>{suggestion.rationale}</Text>
                  </View>
                  <Pressable disabled={Boolean(mutatingActionId)} onPress={() => void createSuggestion(suggestion)} style={styles.primarySmall}>
                    {mutatingActionId === suggestion.key ? <ActivityIndicator size="small" color={colors.white} /> : <MaterialCommunityIcons name="plus-circle-outline" size={15} color={colors.white} />}
                    <Text style={styles.primarySmallText}>Create action</Text>
                  </Pressable>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>ACTION TAKEN / ENDPOINT TRACKING</Text>
              <Text style={styles.note}>A report is not closed by collection alone. Track the intervention until Done, then record the outcome and next action when needed.</Text>
              {data.actions.length === 0 ? <Text style={styles.note}>No management action recorded in this range.</Text> : data.actions.map((action) => {
                const draft = actionDrafts[action.id] ?? { outcome: action.outcome ?? '', nextAction: action.next_action ?? '' };
                const busy = mutatingActionId === action.id;
                return (
                  <View key={action.id} style={styles.actionCard}>
                    <View style={styles.sectionHead}>
                      <View style={styles.flexCopy}>
                        <Text style={styles.suggestionType}>{statusLabel(action.action_type)} · {action.priority}</Text>
                        <Text style={styles.actionTitle}>{action.title}</Text>
                        {action.assignee_name ? <Text style={styles.personLine}>{action.assignee_name}</Text> : null}
                      </View>
                      <View style={[styles.statusPill, action.status === 'DONE' && styles.donePill]}><Text style={[styles.statusText, action.status === 'DONE' && styles.doneText]}>{statusLabel(action.status)}</Text></View>
                    </View>
                    {action.rationale ? <Text style={styles.note}>{action.rationale}</Text> : null}
                    <TextInput
                      value={draft.outcome}
                      onChangeText={(outcome) => setActionDrafts((current) => ({ ...current, [action.id]: { ...draft, outcome } }))}
                      placeholder="Outcome / what happened"
                      placeholderTextColor={colors.muted}
                      multiline
                      style={styles.input}
                    />
                    <TextInput
                      value={draft.nextAction}
                      onChangeText={(nextAction) => setActionDrafts((current) => ({ ...current, [action.id]: { ...draft, nextAction } }))}
                      placeholder="Next action, if still needed"
                      placeholderTextColor={colors.muted}
                      multiline
                      style={styles.input}
                    />
                    <View style={styles.actionButtons}>
                      {action.status !== 'IN_PROGRESS' && action.status !== 'DONE' ? <ActionButton label="Start" icon="play-outline" disabled={busy} onPress={() => void updateAction(action, 'IN_PROGRESS')} /> : null}
                      {action.status !== 'DONE' ? <ActionButton label="Mark done" icon="check-circle-outline" disabled={busy} onPress={() => void updateAction(action, 'DONE')} /> : null}
                      {action.status === 'DONE' ? <ActionButton label="Reopen" icon="refresh" disabled={busy} onPress={() => void updateAction(action, 'IN_PROGRESS')} /> : null}
                    </View>
                    <Text style={styles.actionMeta}>Created {formatDate(action.created_at)}{action.completed_at ? ` · Done ${formatDate(action.completed_at)}` : ''}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>PEOPLE REQUIRING FOLLOW-UP</Text>
              {data.people.filter((person) => person.pending_count > 0).length === 0 ? <Text style={styles.goodText}>No pending person-level follow-up in this range.</Text> : data.people.filter((person) => person.pending_count > 0).slice(0, 40).map((person) => (
                <View key={person.user_id} style={styles.personRow}>
                  <View style={styles.flexCopy}><Text style={styles.personName}>{person.name}</Text><Text style={styles.note}>{person.submitted_count}/{person.assigned_count} submitted</Text></View>
                  <Text style={person.overdue_count > 0 ? styles.overdueBadge : styles.pendingBadge}>{person.overdue_count > 0 ? `${person.overdue_count} overdue` : `${person.pending_count} pending`}</Text>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>REPORTED CONCERNS / SUPPORT SIGNALS</Text>
              <Text style={styles.note}>Only responses from form fields explicitly labeled as concern, challenge, issue, problem, need, assistance, support or help are surfaced here.</Text>
              {analytics.concernHighlights.length === 0 ? <Text style={styles.goodText}>No non-empty concern/support response detected in this range.</Text> : analytics.concernHighlights.map((row, index) => (
                <View key={`${row.reporter}-${row.report}-${index}`} style={styles.concernRow}>
                  <Text style={styles.personName}>{row.reporter} · {row.report}</Text>
                  <Text style={styles.concernText}>{row.text}</Text>
                </View>
              ))}
            </View>

            <Pressable disabled={exporting} onPress={() => void doExport()} style={[styles.exportButton, exporting && styles.disabled]}>
              {exporting ? <ActivityIndicator size="small" color={colors.white} /> : <MaterialCommunityIcons name="microsoft-excel" size={19} color={colors.white} />}
              <Text style={styles.exportText}>{exporting ? 'Building workbook…' : `Export ${rangeLabel} management workbook`}</Text>
            </Pressable>
          </>
        ) : null}
      </BuklodReportScrollView>
    </>
  );
}

function Metric({ label, value, icon, attention = false }: { label: string; value: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; attention?: boolean }) {
  return <View style={[styles.metric, attention && styles.metricAttention]}><MaterialCommunityIcons name={icon} size={18} color={attention ? colors.amber : colors.greenDark} /><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}
function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>{label}</Text></Pressable>;
}
function ActionButton({ label, icon, onPress, disabled }: { label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; onPress: () => void; disabled?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.actionButton, disabled && styles.disabled]}><MaterialCommunityIcons name={icon} size={15} color={colors.greenDark} /><Text style={styles.actionButtonText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  content: { padding: reportTheme.layout.mobilePadding, gap: 12, backgroundColor: colors.background },
  flexCopy: { flex: 1, minWidth: 0 },
  backRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  backText: { color: colors.greenDark, fontSize: 12, fontWeight: '900' },
  hero: { borderRadius: reportTheme.radius.xl, padding: 16, backgroundColor: colors.greenDark, gap: 5 },
  heroEyebrow: { color: 'rgba(255,255,255,0.68)', fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  heroTitle: { color: colors.white, fontSize: 21, fontWeight: '900' },
  heroText: { color: 'rgba(255,255,255,0.86)', fontSize: 11, lineHeight: 16 },
  center: { paddingVertical: 28, alignItems: 'center', gap: 8 },
  card: { borderRadius: 15, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 13, gap: 9 },
  cardTitle: { color: colors.textStrong, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  note: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  summaryText: { color: colors.textStrong, fontSize: 13, lineHeight: 19, fontWeight: '800' },
  goodText: { color: colors.success, fontSize: 10, lineHeight: 15, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { maxWidth: 220, minHeight: 36, borderRadius: reportTheme.radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 7, justifyContent: 'center' },
  chipSelected: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  chipText: { color: colors.text, fontSize: 9, fontWeight: '800' },
  chipTextSelected: { color: colors.white },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { minWidth: 92, flexGrow: 1, flexBasis: '22%', borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingVertical: 11, paddingHorizontal: 9, alignItems: 'center', gap: 2 },
  metricAttention: { borderColor: '#E8C98C', backgroundColor: '#FFFCF5' },
  metricValue: { color: colors.textStrong, fontSize: 19, fontWeight: '900' },
  metricLabel: { color: colors.muted, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  graphRow: { gap: 5, paddingTop: 5 },
  graphHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  graphLabel: { flex: 1, color: colors.textStrong, fontSize: 10, fontWeight: '850' },
  graphValue: { color: colors.muted, fontSize: 9, fontWeight: '800' },
  track: { height: 8, borderRadius: 999, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 999, backgroundColor: colors.greenDark },
  overdueText: { color: colors.danger, fontSize: 8, fontWeight: '800' },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  countPill: { minWidth: 27, height: 27, borderRadius: 14, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  countText: { color: colors.greenDark, fontSize: 10, fontWeight: '900' },
  suggestionCard: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 9, gap: 7 },
  suggestionType: { color: colors.greenDark, fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  suggestionTitle: { color: colors.textStrong, fontSize: 12, fontWeight: '900' },
  personLine: { color: colors.text, fontSize: 9, fontWeight: '800', marginTop: 2 },
  primarySmall: { minHeight: 36, alignSelf: 'flex-start', borderRadius: 9, backgroundColor: colors.greenDark, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  primarySmallText: { color: colors.white, fontSize: 9, fontWeight: '900' },
  actionCard: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 10, gap: 7 },
  actionTitle: { color: colors.textStrong, fontSize: 12, fontWeight: '900' },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.amberSoft },
  donePill: { backgroundColor: colors.successSoft },
  statusText: { color: colors.amber, fontSize: 8, fontWeight: '900' },
  doneText: { color: colors.success },
  input: { minHeight: 40, borderRadius: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 8, color: colors.text, fontSize: 10 },
  actionButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actionButton: { minHeight: 34, borderRadius: 9, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionButtonText: { color: colors.greenDark, fontSize: 9, fontWeight: '900' },
  actionMeta: { color: colors.muted, fontSize: 8 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 8 },
  personName: { color: colors.textStrong, fontSize: 10, fontWeight: '900' },
  overdueBadge: { color: colors.danger, fontSize: 8, fontWeight: '900' },
  pendingBadge: { color: colors.amber, fontSize: 8, fontWeight: '900' },
  concernRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 8, gap: 4 },
  concernText: { color: colors.text, fontSize: 10, lineHeight: 15 },
  exportButton: { minHeight: 48, borderRadius: 13, backgroundColor: colors.greenDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 14 },
  exportText: { color: colors.white, fontSize: 11, fontWeight: '900' },
  disabled: { opacity: 0.5 },
});
