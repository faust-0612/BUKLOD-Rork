import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import BuklodReportAssignmentForm from '@/components/BuklodReportAssignmentForm';
import { BUKLOD_REPORT_ICON_URI } from '@/lib/buklodReportBranding';
import type { ReportAssignmentCard, ReportHomeCardStatus } from '@/lib/buklodReportContracts';
import {
  fetchMyActionableReportAssignments,
  isReportScopeEntitled,
  setPreferredReportAssignment,
} from '@/lib/buklodReportDomain';
import {
  buklodReportDefinitionsPath,
  buklodReportLandingPath,
  readReportAssignmentId,
  readReportScopeId,
} from '@/lib/buklodReportRoutes';
import { verifyOrganizationManageAccess } from '@/lib/buklodOrganization';
import { colors, reportTheme } from '@/lib/theme';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

const ATTENTION_STATUSES = new Set<ReportHomeCardStatus>([
  'DUE',
  'DUE_SOON',
  'EXPIRED',
  'NEEDS_REVISION',
  'REJECTED',
]);

const STATUS_PRIORITY: Record<ReportHomeCardStatus, number> = {
  EXPIRED: 0,
  NEEDS_REVISION: 1,
  REJECTED: 2,
  DUE_SOON: 3,
  DUE: 4,
  NEEDS_REVIEW: 5,
  PROCESSING: 6,
  SUBMITTED: 7,
  APPROVED: 8,
};

function formatDeadline(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function needsAttention(row: ReportAssignmentCard) {
  return (
    row.assignment_status !== 'SUBMITTED' ||
    ATTENTION_STATUSES.has(row.home_status) ||
    Boolean(row.has_unread_remarks)
  );
}

function statusPresentation(row: ReportAssignmentCard) {
  if (row.has_unread_remarks) {
    return { label: 'NEW FEEDBACK', icon: 'message-alert-outline' as const, tone: 'attention' as const };
  }
  switch (row.home_status) {
    case 'EXPIRED':
      return { label: 'OVERDUE', icon: 'clock-alert-outline' as const, tone: 'danger' as const };
    case 'NEEDS_REVISION':
      return { label: 'FOLLOW-UP', icon: 'file-document-edit-outline' as const, tone: 'attention' as const };
    case 'REJECTED':
      return { label: 'ACTION NEEDED', icon: 'alert-circle-outline' as const, tone: 'danger' as const };
    case 'DUE_SOON':
      return { label: 'DUE SOON', icon: 'clock-fast' as const, tone: 'warning' as const };
    case 'DUE':
      return { label: 'DUE', icon: 'clipboard-text-clock-outline' as const, tone: 'warning' as const };
    case 'APPROVED':
      return { label: 'REVIEWED', icon: 'check-decagram-outline' as const, tone: 'success' as const };
    case 'PROCESSING':
    case 'NEEDS_REVIEW':
      return { label: 'IN REVIEW', icon: 'progress-clock' as const, tone: 'neutral' as const };
    default:
      return { label: 'SUBMITTED', icon: 'check-circle-outline' as const, tone: 'success' as const };
  }
}

export default function BuklodReportLandingScreen() {
  const params = useLocalSearchParams();
  const scopeId = readReportScopeId(params as Record<string, unknown>);
  const routeAssignmentId = readReportAssignmentId(params as Record<string, unknown>);
  const { scopes, loading: scopesLoading } = useBuklodScope();

  const [loading, setLoading] = useState(true);
  const [entitled, setEntitled] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [assignments, setAssignments] = useState<ReportAssignmentCard[]>([]);

  const reportScopes = useMemo(
    () => scopes.filter((scope) => ['ORGANIZATION', 'CLUSTER'].includes(String(scope.scope_type).toUpperCase())),
    [scopes],
  );
  const selectedScope = useMemo(
    () => reportScopes.find((scope) => scope.scope_id === scopeId) ?? null,
    [reportScopes, scopeId],
  );

  useEffect(() => {
    if (scopeId) setPreferredReportAssignment(scopeId, routeAssignmentId || null);
  }, [routeAssignmentId, scopeId]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      if (scopeId) {
        const [isEntitled, access, rows] = await Promise.all([
          isReportScopeEntitled(scopeId),
          verifyOrganizationManageAccess(scopeId),
          fetchMyActionableReportAssignments(50, scopeId),
        ]);
        setEntitled(isEntitled);
        setCanManage(access.allowed);
        setAssignments(rows);
      } else {
        setEntitled(false);
        setCanManage(false);
        setAssignments(await fetchMyActionableReportAssignments(100, null));
      }
    } catch (error: any) {
      setLoadError(error?.message || 'Unable to load your reports. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [scopeId]);

  useEffect(() => { void load(); }, [load]);

  const attentionAssignments = useMemo(
    () => assignments
      .filter(needsAttention)
      .sort((a, b) => (STATUS_PRIORITY[a.home_status] ?? 99) - (STATUS_PRIORITY[b.home_status] ?? 99)),
    [assignments],
  );

  const recentAssignments = useMemo(
    () => assignments.filter((row) => !needsAttention(row)).slice(0, 4),
    [assignments],
  );

  const summary = useMemo(() => ({
    overdue: assignments.filter((row) => row.home_status === 'EXPIRED').length,
    due: assignments.filter((row) => row.home_status === 'DUE' || row.home_status === 'DUE_SOON').length,
    feedback: assignments.filter((row) => row.home_status === 'NEEDS_REVISION' || row.home_status === 'REJECTED' || row.has_unread_remarks).length,
    sent: assignments.filter((row) => ['SUBMITTED', 'PROCESSING', 'NEEDS_REVIEW', 'APPROVED'].includes(row.home_status)).length,
  }), [assignments]);

  const openAssignment = (row: ReportAssignmentCard) => {
    router.push(buklodReportLandingPath(row.scope_id, row.report_assignment_id) as any);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'BUKLOD Report' }} />
      <BuklodPortalScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Image source={{ uri: BUKLOD_REPORT_ICON_URI }} resizeMode="cover" style={styles.heroIcon} />
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>REPORT • FOLLOW-UP • CARE</Text>
            <Text style={styles.heroTitle}>BUKLOD Report</Text>
            <Text style={styles.heroSubtitle}>
              Simple reporting for members. Clear attention and follow-up for leaders.
            </Text>
          </View>
        </View>

        {scopeId ? (
          <Pressable onPress={() => router.replace('/reports' as any)} style={styles.backRow}>
            <MaterialCommunityIcons name="arrow-left" size={18} color={colors.greenDark} />
            <Text style={styles.backText}>All reports</Text>
          </Pressable>
        ) : null}

        {loading || scopesLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.green} />
            <Text style={styles.muted}>Opening your report workspace…</Text>
          </View>
        ) : (
          <>
            {loadError ? (
              <View style={styles.errorCard}>
                <MaterialCommunityIcons name="wifi-alert" size={20} color={colors.danger} />
                <View style={styles.flexCopy}>
                  <Text style={styles.errorTitle}>Reports could not be loaded</Text>
                  <Text style={styles.errorText}>{loadError}</Text>
                </View>
                <Pressable onPress={() => void load()} style={styles.retryButton}>
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              </View>
            ) : null}

            {!scopeId ? (
              <>
                <View style={styles.summaryGrid}>
                  <SummaryTile label="Overdue" value={summary.overdue} icon="clock-alert-outline" tone="danger" />
                  <SummaryTile label="Due" value={summary.due} icon="calendar-clock-outline" tone="warning" />
                  <SummaryTile label="Feedback" value={summary.feedback} icon="message-alert-outline" tone="attention" />
                  <SummaryTile label="Sent" value={summary.sent} icon="check-circle-outline" tone="success" />
                </View>

                <SectionHeading eyebrow="MY WORK" title="Needs attention" count={attentionAssignments.length} />
                {attentionAssignments.length === 0 ? (
                  <View style={styles.successCard}>
                    <View style={styles.successIcon}>
                      <MaterialCommunityIcons name="check" size={20} color={colors.success} />
                    </View>
                    <View style={styles.flexCopy}>
                      <Text style={styles.cardTitle}>You are caught up</Text>
                      <Text style={styles.note}>No report currently needs action. New published requirements will appear here automatically.</Text>
                    </View>
                  </View>
                ) : attentionAssignments.map((row) => (
                  <AssignmentRow key={row.report_assignment_id} row={row} onPress={() => openAssignment(row)} showScope />
                ))}

                {recentAssignments.length > 0 ? (
                  <>
                    <SectionHeading eyebrow="RECENT" title="Submitted & reviewed" />
                    <View style={styles.listCard}>
                      {recentAssignments.map((row) => (
                        <AssignmentRow key={row.report_assignment_id} row={row} onPress={() => openAssignment(row)} showScope compact />
                      ))}
                    </View>
                  </>
                ) : null}

                <SectionHeading eyebrow="WORKSPACES" title="Organization & Cluster" />
                {reportScopes.length === 0 ? (
                  <View style={styles.infoCard}>
                    <MaterialCommunityIcons name="domain-off" size={24} color={colors.muted} />
                    <Text style={styles.note}>No active Organization or Cluster reporting workspace is available to this account.</Text>
                  </View>
                ) : reportScopes.map((scope) => (
                  <Pressable
                    key={scope.scope_id}
                    onPress={() => router.push(buklodReportLandingPath(scope.scope_id) as any)}
                    style={({ pressed }) => [styles.workspaceCard, pressed && styles.pressed]}
                  >
                    <View style={styles.workspaceIcon}>
                      <MaterialCommunityIcons name={scope.scope_type === 'CLUSTER' ? 'account-group' : 'domain'} size={21} color={colors.greenDark} />
                    </View>
                    <View style={styles.flexCopy}>
                      <Text style={styles.workspaceTitle}>{scope.name}</Text>
                      <Text style={styles.workspaceMeta}>{scope.scope_type}</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.greenDark} />
                  </Pressable>
                ))}
              </>
            ) : (
              <>
                <View style={styles.scopeCard}>
                  <View style={styles.workspaceIcon}>
                    <MaterialCommunityIcons name={selectedScope?.scope_type === 'CLUSTER' ? 'account-group' : 'domain'} size={21} color={colors.greenDark} />
                  </View>
                  <View style={styles.flexCopy}>
                    <Text style={styles.sectionEyebrow}>ACTIVE REPORT WORKSPACE</Text>
                    <Text style={styles.workspaceTitle}>{selectedScope?.name || 'Selected Organization / Cluster'}</Text>
                  </View>
                  {entitled ? <View style={styles.enabledPill}><Text style={styles.enabledText}>ENABLED</Text></View> : null}
                </View>

                {!entitled ? (
                  <View style={styles.warningCard}>
                    <MaterialCommunityIcons name="lock-outline" size={22} color={colors.amber} />
                    <View style={styles.flexCopy}>
                      <Text style={styles.warningTitle}>Reporting is not enabled for this scope</Text>
                      <Text style={styles.warningText}>BUKLOD Report is available only to entitled Organization and Cluster scopes.</Text>
                    </View>
                  </View>
                ) : (
                  <>
                    {!routeAssignmentId ? (
                      <>
                        <SectionHeading eyebrow="CURRENT" title="Reports needing attention" count={attentionAssignments.length} />
                        {attentionAssignments.length > 0 ? (
                          <View style={styles.listCard}>
                            {attentionAssignments.map((row) => (
                              <AssignmentRow key={row.report_assignment_id} row={row} onPress={() => openAssignment(row)} />
                            ))}
                          </View>
                        ) : (
                          <View style={styles.infoCard}>
                            <MaterialCommunityIcons name="clipboard-check-outline" size={24} color={colors.success} />
                            <View style={styles.flexCopy}>
                              <Text style={styles.cardTitle}>Nothing needs action</Text>
                              <Text style={styles.note}>A form appears only after a real report is published to this workspace.</Text>
                            </View>
                          </View>
                        )}
                      </>
                    ) : null}

                    {routeAssignmentId ? (
                      <BuklodReportAssignmentForm scopeId={scopeId} assignmentId={routeAssignmentId} onSubmitted={() => void load()} />
                    ) : null}
                  </>
                )}

                {canManage ? (
                  <Pressable onPress={() => router.push(buklodReportDefinitionsPath(scopeId) as any)} style={styles.manageButton}>
                    <View style={styles.manageIcon}>
                      <MaterialCommunityIcons name="folder-cog-outline" size={21} color={colors.greenDark} />
                    </View>
                    <View style={styles.flexCopy}>
                      <Text style={styles.manageTitle}>Report Library & management</Text>
                      <Text style={styles.manageMeta}>Templates, deadlines, assignments and consolidated reports</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.greenDark} />
                  </Pressable>
                ) : null}
              </>
            )}
          </>
        )}
      </BuklodPortalScrollView>
    </>
  );
}

function SectionHeading({ eyebrow, title, count }: { eyebrow: string; title: string; count?: number }) {
  return (
    <View style={styles.sectionHeader}>
      <View>
        <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {typeof count === 'number' ? <View style={styles.countPill}><Text style={styles.countText}>{count}</Text></View> : null}
    </View>
  );
}

function SummaryTile({ label, value, icon, tone }: { label: string; value: number; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; tone: 'danger' | 'warning' | 'attention' | 'success' }) {
  const palette = tone === 'danger'
    ? { bg: colors.dangerSoft, fg: colors.danger }
    : tone === 'warning'
      ? { bg: colors.amberSoft, fg: colors.amber }
      : tone === 'attention'
        ? { bg: colors.infoSoft, fg: colors.info }
        : { bg: colors.successSoft, fg: colors.success };
  return (
    <View style={styles.summaryTile}>
      <View style={[styles.summaryIcon, { backgroundColor: palette.bg }]}>
        <MaterialCommunityIcons name={icon} size={18} color={palette.fg} />
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function AssignmentRow({ row, onPress, showScope = false, compact = false }: { row: ReportAssignmentCard; onPress: () => void; showScope?: boolean; compact?: boolean }) {
  const status = statusPresentation(row);
  const palette = status.tone === 'danger'
    ? { bg: colors.dangerSoft, fg: colors.danger }
    : status.tone === 'warning'
      ? { bg: colors.amberSoft, fg: colors.amber }
      : status.tone === 'attention'
        ? { bg: colors.infoSoft, fg: colors.info }
        : status.tone === 'success'
          ? { bg: colors.successSoft, fg: colors.success }
          : { bg: colors.surfaceMuted, fg: colors.muted };
  const showDeadline = ['DUE', 'DUE_SOON', 'EXPIRED'].includes(row.home_status);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.assignmentRow, compact && styles.assignmentRowCompact, pressed && styles.pressed]}>
      <View style={[styles.assignmentIcon, { backgroundColor: palette.bg }]}>
        <MaterialCommunityIcons name={status.icon} size={20} color={palette.fg} />
      </View>
      <View style={styles.flexCopy}>
        <View style={styles.assignmentHeading}>
          <Text style={styles.assignmentTitle} numberOfLines={2}>{row.report_title}</Text>
          <View style={[styles.statusPill, { backgroundColor: palette.bg }]}><Text style={[styles.statusText, { color: palette.fg }]}>{status.label}</Text></View>
        </View>
        {showScope && row.scope_label ? <Text style={styles.assignmentScope}>{row.scope_label}</Text> : null}
        <Text style={styles.assignmentMeta}>{row.period_label}</Text>
        {showDeadline ? <Text style={[styles.assignmentDeadline, row.home_status === 'EXPIRED' && { color: colors.danger }]}>{row.home_status === 'EXPIRED' ? 'Overdue · ' : 'Deadline · '}{formatDeadline(row.deadline_at)}</Text> : null}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: reportTheme.layout.mobilePadding, gap: reportTheme.spacing.sm, backgroundColor: colors.background },
  flexCopy: { flex: 1, minWidth: 0 },
  hero: { borderRadius: reportTheme.radius.xl, padding: 16, backgroundColor: colors.greenDark, flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: { width: 66, height: 66, borderRadius: 17, backgroundColor: colors.white },
  heroCopy: { flex: 1, minWidth: 0, gap: 4 },
  heroEyebrow: { color: 'rgba(255,255,255,0.70)', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  heroTitle: { fontSize: 25, fontWeight: '900', color: colors.white },
  heroSubtitle: { fontSize: 11, lineHeight: 16, color: 'rgba(255,255,255,0.86)' },
  backRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  backText: { color: colors.greenDark, fontSize: 11, fontWeight: '900' },
  center: { paddingVertical: 38, alignItems: 'center', gap: 9 },
  muted: { color: colors.muted, fontSize: 11 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryTile: { minWidth: 118, flexGrow: 1, flexBasis: '22%', borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 11 },
  summaryIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  summaryValue: { marginTop: 8, color: colors.textStrong, fontSize: 22, fontWeight: '900' },
  summaryLabel: { marginTop: 1, color: colors.muted, fontSize: 10, fontWeight: '800' },
  sectionHeader: { marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionEyebrow: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 0.65 },
  sectionTitle: { color: colors.textStrong, fontSize: 16, fontWeight: '900' },
  countPill: { minWidth: 30, height: 30, borderRadius: 15, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  countText: { color: colors.greenDark, fontSize: 11, fontWeight: '900' },
  infoCard: { borderRadius: 15, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  successCard: { borderRadius: 15, borderWidth: 1, borderColor: '#CBE5D5', backgroundColor: colors.surface, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  successIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: colors.textStrong, fontSize: 13, fontWeight: '900' },
  note: { marginTop: 3, color: colors.muted, fontSize: 10, lineHeight: 15 },
  workspaceCard: { minHeight: 62, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  scopeCard: { minHeight: 64, borderRadius: 15, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  workspaceIcon: { width: 40, height: 40, borderRadius: 11, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  workspaceTitle: { color: colors.textStrong, fontSize: 13, fontWeight: '900' },
  workspaceMeta: { marginTop: 2, color: colors.muted, fontSize: 9 },
  enabledPill: { borderRadius: reportTheme.radius.pill, backgroundColor: colors.successSoft, paddingHorizontal: 8, paddingVertical: 4 },
  enabledText: { color: colors.success, fontSize: 8, fontWeight: '900' },
  listCard: { borderRadius: 15, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 8, gap: 7 },
  assignmentRow: { minHeight: 72, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  assignmentRowCompact: { minHeight: 62 },
  assignmentIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  assignmentHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  assignmentTitle: { flex: 1, color: colors.textStrong, fontSize: 11, fontWeight: '900' },
  assignmentScope: { color: colors.greenDark, fontSize: 9, fontWeight: '800', marginTop: 2 },
  assignmentMeta: { marginTop: 2, color: colors.muted, fontSize: 9 },
  assignmentDeadline: { marginTop: 3, color: colors.muted, fontSize: 9, fontWeight: '700' },
  statusPill: { borderRadius: reportTheme.radius.pill, paddingHorizontal: 7, paddingVertical: 4 },
  statusText: { fontSize: 7, fontWeight: '900', letterSpacing: 0.25 },
  warningCard: { borderRadius: 14, borderWidth: 1, borderColor: '#F0D5A5', backgroundColor: colors.amberSoft, padding: 13, flexDirection: 'row', gap: 9 },
  warningTitle: { color: '#7A4700', fontSize: 12, fontWeight: '900' },
  warningText: { marginTop: 2, color: '#785A25', fontSize: 10, lineHeight: 14 },
  manageButton: { minHeight: 64, borderRadius: 15, borderWidth: 1, borderColor: '#CFE3D8', backgroundColor: colors.surface, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  manageIcon: { width: 40, height: 40, borderRadius: 11, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  manageTitle: { color: colors.textStrong, fontSize: 11, fontWeight: '900' },
  manageMeta: { marginTop: 2, color: colors.muted, fontSize: 9 },
  errorCard: { borderRadius: 14, borderWidth: 1, borderColor: '#F3C4C1', backgroundColor: colors.dangerSoft, padding: 12, gap: 9, flexDirection: 'row', alignItems: 'center' },
  errorTitle: { color: colors.danger, fontSize: 11, fontWeight: '900' },
  errorText: { marginTop: 2, color: '#7D3936', fontSize: 10, lineHeight: 14 },
  retryButton: { borderRadius: 9, backgroundColor: colors.danger, paddingHorizontal: 10, paddingVertical: 8 },
  retryText: { color: colors.white, fontSize: 9, fontWeight: '900' },
  pressed: { opacity: 0.72 },
});
