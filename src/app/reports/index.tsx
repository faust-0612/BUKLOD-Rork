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
import type { ReportAssignmentCard } from '@/lib/buklodReportContracts';
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
import { colors } from '@/lib/theme';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

function formatDeadline(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
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
    [scopes]
  );
  const selectedScope = useMemo(
    () => reportScopes.find((scope) => scope.scope_id === scopeId) ?? null,
    [reportScopes, scopeId]
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
      setLoadError(error?.message || 'BUKLOD Report could not be opened.');
    } finally {
      setLoading(false);
    }
  }, [scopeId]);

  useEffect(() => { void load(); }, [load]);

  const actionableAssignments = useMemo(
    () => assignments.filter((row) => row.assignment_status !== 'SUBMITTED'),
    [assignments]
  );

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
            <Text style={styles.heroEyebrow}>STANDALONE REPORTING APP</Text>
            <Text style={styles.heroTitle}>BUKLOD Report</Text>
            <Text style={styles.heroSubtitle}>One reporting engine for different Organization and Cluster reporting systems.</Text>
          </View>
        </View>

        {scopeId ? (
          <Pressable onPress={() => router.replace('/reports' as any)} style={styles.backRow}>
            <MaterialCommunityIcons name="arrow-left" size={18} color={colors.greenDark} />
            <Text style={styles.backText}>All reports</Text>
          </Pressable>
        ) : null}

        {loading || scopesLoading ? (
          <View style={styles.center}><ActivityIndicator color={colors.green} /><Text style={styles.muted}>Opening report workspace…</Text></View>
        ) : (
          <>
            {loadError ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{loadError}</Text>
                <Pressable onPress={() => void load()} style={styles.retryButton}><Text style={styles.retryText}>TRY AGAIN</Text></Pressable>
              </View>
            ) : null}

            {!scopeId ? (
              <>
                <View style={styles.sectionHeader}>
                  <View><Text style={styles.sectionEyebrow}>MY WORK</Text><Text style={styles.sectionTitle}>Current reports</Text></View>
                  <View style={styles.countPill}><Text style={styles.countText}>{actionableAssignments.length}</Text></View>
                </View>

                {actionableAssignments.length === 0 ? (
                  <View style={styles.infoCard}>
                    <MaterialCommunityIcons name="clipboard-check-outline" size={24} color={colors.greenDark} />
                    <View style={{ flex: 1 }}><Text style={styles.cardTitle}>No report assigned right now</Text><Text style={styles.note}>Published reports from your Organizations or Clusters will appear here automatically.</Text></View>
                  </View>
                ) : actionableAssignments.map((row) => (
                  <AssignmentRow key={row.report_assignment_id} row={row} onPress={() => openAssignment(row)} showScope />
                ))}

                <View style={styles.sectionHeader}>
                  <View><Text style={styles.sectionEyebrow}>WORKSPACES</Text><Text style={styles.sectionTitle}>Organization & Cluster</Text></View>
                </View>
                {reportScopes.length === 0 ? (
                  <View style={styles.infoCard}><MaterialCommunityIcons name="domain-off" size={24} color={colors.muted} /><Text style={styles.note}>No active Organization or Cluster reporting workspace is available to this account.</Text></View>
                ) : reportScopes.map((scope) => (
                  <Pressable
                    key={scope.scope_id}
                    onPress={() => router.push(buklodReportLandingPath(scope.scope_id) as any)}
                    style={({ pressed }) => [styles.workspaceCard, pressed && styles.pressed]}
                  >
                    <View style={styles.workspaceIcon}><MaterialCommunityIcons name={scope.scope_type === 'CLUSTER' ? 'account-group' : 'domain'} size={21} color={colors.greenDark} /></View>
                    <View style={{ flex: 1 }}><Text style={styles.workspaceTitle}>{scope.name}</Text><Text style={styles.workspaceMeta}>{scope.scope_type}</Text></View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.greenDark} />
                  </Pressable>
                ))}
              </>
            ) : (
              <>
                <View style={styles.scopeCard}>
                  <View style={styles.workspaceIcon}><MaterialCommunityIcons name={selectedScope?.scope_type === 'CLUSTER' ? 'account-group' : 'domain'} size={21} color={colors.greenDark} /></View>
                  <View style={{ flex: 1 }}><Text style={styles.sectionEyebrow}>ACTIVE REPORT WORKSPACE</Text><Text style={styles.workspaceTitle}>{selectedScope?.name || 'Selected Organization / Cluster'}</Text></View>
                  {entitled ? <View style={styles.enabledPill}><Text style={styles.enabledText}>ENABLED</Text></View> : null}
                </View>

                {!entitled ? (
                  <View style={styles.warningCard}><MaterialCommunityIcons name="lock-outline" size={22} color="#92400E" /><View style={{ flex: 1 }}><Text style={styles.warningTitle}>Reporting is not enabled for this scope</Text><Text style={styles.warningText}>BUKLOD Report is available only to entitled Organization and Cluster scopes.</Text></View></View>
                ) : (
                  <>
                    {actionableAssignments.length > 0 ? (
                      <View style={styles.listCard}>
                        <Text style={styles.sectionEyebrow}>CURRENT REPORTS</Text>
                        {actionableAssignments.map((row) => <AssignmentRow key={row.report_assignment_id} row={row} onPress={() => openAssignment(row)} />)}
                      </View>
                    ) : !routeAssignmentId ? (
                      <View style={styles.infoCard}><MaterialCommunityIcons name="clipboard-text-outline" size={24} color={colors.greenDark} /><View style={{ flex: 1 }}><Text style={styles.cardTitle}>No report assigned right now</Text><Text style={styles.note}>No sample or MZB form is created automatically. A form appears only after a real report is published.</Text></View></View>
                    ) : null}

                    {routeAssignmentId ? (
                      <BuklodReportAssignmentForm scopeId={scopeId} assignmentId={routeAssignmentId} onSubmitted={() => void load()} />
                    ) : null}
                  </>
                )}

                {canManage ? (
                  <Pressable onPress={() => router.push(buklodReportDefinitionsPath(scopeId) as any)} style={styles.manageButton}>
                    <MaterialCommunityIcons name="folder-cog-outline" size={21} color={colors.greenDark} />
                    <View style={{ flex: 1 }}><Text style={styles.manageTitle}>Report Library & management</Text><Text style={styles.manageMeta}>Templates, uploaded forms, deadlines and consolidated reports</Text></View>
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

function AssignmentRow({ row, onPress, showScope = false }: { row: ReportAssignmentCard; onPress: () => void; showScope?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.assignmentRow, pressed && styles.pressed]}>
      <View style={styles.assignmentIcon}><MaterialCommunityIcons name={row.home_status === 'EXPIRED' ? 'clock-alert-outline' : 'clipboard-text-clock-outline'} size={20} color={row.home_status === 'EXPIRED' ? '#92400E' : colors.greenDark} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.assignmentTitle}>{row.report_title}</Text>
        {showScope && row.scope_label ? <Text style={styles.assignmentScope}>{row.scope_label}</Text> : null}
        <Text style={styles.assignmentMeta}>{row.period_label}</Text>
        <Text style={styles.assignmentDeadline}>{row.home_status === 'EXPIRED' ? 'Late · ' : 'Deadline · '}{formatDeadline(row.deadline_at)}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.greenDark} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 14, gap: 12, backgroundColor: colors.background },
  hero: { borderRadius: 20, padding: 15, backgroundColor: colors.greenDark, flexDirection: 'row', alignItems: 'center', gap: 13 },
  heroIcon: { width: 68, height: 68, borderRadius: 17, backgroundColor: '#FFFFFF' },
  heroCopy: { flex: 1, minWidth: 0, gap: 4 },
  heroEyebrow: { color: 'rgba(255,255,255,0.72)', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  heroTitle: { fontSize: 24, fontWeight: '900', color: '#FFFFFF' },
  heroSubtitle: { fontSize: 11, lineHeight: 16, color: 'rgba(255,255,255,0.86)' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  backText: { color: colors.greenDark, fontSize: 11, fontWeight: '900' },
  center: { paddingVertical: 32, alignItems: 'center', gap: 8 },
  muted: { color: colors.muted, fontSize: 10 },
  sectionHeader: { marginTop: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionEyebrow: { color: '#61766C', fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  sectionTitle: { color: '#173B2F', fontSize: 15, fontWeight: '900' },
  countPill: { minWidth: 30, height: 30, borderRadius: 15, backgroundColor: '#E8F5EE', alignItems: 'center', justifyContent: 'center' },
  countText: { color: colors.greenDark, fontSize: 11, fontWeight: '900' },
  infoCard: { borderRadius: 15, borderWidth: 1, borderColor: '#DCE5E0', backgroundColor: '#FFFFFF', padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitle: { color: '#173B2F', fontSize: 13, fontWeight: '900' },
  note: { marginTop: 3, color: '#6C7B73', fontSize: 10, lineHeight: 15, flex: 1 },
  workspaceCard: { minHeight: 62, borderRadius: 14, borderWidth: 1, borderColor: '#DCE5E0', backgroundColor: '#FFFFFF', padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  scopeCard: { minHeight: 64, borderRadius: 15, borderWidth: 1, borderColor: '#DCE5E0', backgroundColor: '#FFFFFF', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  workspaceIcon: { width: 40, height: 40, borderRadius: 11, backgroundColor: '#E8F5EE', alignItems: 'center', justifyContent: 'center' },
  workspaceTitle: { color: '#173B2F', fontSize: 13, fontWeight: '900' },
  workspaceMeta: { marginTop: 2, color: '#6C7B73', fontSize: 9 },
  enabledPill: { borderRadius: 999, backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4 },
  enabledText: { color: '#166534', fontSize: 8, fontWeight: '900' },
  listCard: { borderRadius: 15, borderWidth: 1, borderColor: '#DCE5E0', backgroundColor: '#FFFFFF', padding: 11, gap: 8 },
  assignmentRow: { minHeight: 68, borderRadius: 12, borderWidth: 1, borderColor: '#E4EBE7', backgroundColor: '#FFFFFF', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  assignmentIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3F7F5', alignItems: 'center', justifyContent: 'center' },
  assignmentTitle: { color: '#173B2F', fontSize: 11, fontWeight: '900' },
  assignmentScope: { color: colors.greenDark, fontSize: 9, fontWeight: '800', marginTop: 1 },
  assignmentMeta: { marginTop: 1, color: '#6C7B73', fontSize: 9 },
  assignmentDeadline: { marginTop: 3, color: '#55665E', fontSize: 9, fontWeight: '700' },
  warningCard: { borderRadius: 14, borderWidth: 1, borderColor: '#F4D8A6', backgroundColor: '#FFFBEB', padding: 13, flexDirection: 'row', gap: 9 },
  warningTitle: { color: '#92400E', fontSize: 12, fontWeight: '900' },
  warningText: { marginTop: 2, color: '#8A5A12', fontSize: 10, lineHeight: 14 },
  manageButton: { minHeight: 60, borderRadius: 14, borderWidth: 1, borderColor: '#CFE3D8', backgroundColor: '#F1F8F4', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  manageTitle: { color: '#173B2F', fontSize: 11, fontWeight: '900' },
  manageMeta: { marginTop: 2, color: '#6C7B73', fontSize: 9 },
  errorCard: { borderRadius: 14, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2', padding: 12, gap: 8 },
  errorText: { color: '#991B1B', fontSize: 11, lineHeight: 16 },
  retryButton: { alignSelf: 'flex-start', borderRadius: 9, backgroundColor: '#991B1B', paddingHorizontal: 10, paddingVertical: 7 },
  retryText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  pressed: { opacity: 0.72 },
});
