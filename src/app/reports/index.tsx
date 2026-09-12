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
import BuklodWeeklyReportForm from '@/components/BuklodWeeklyReportForm';
import { BUKLOD_REPORT_ICON_URI } from '@/lib/buklodReportBranding';
import { colors } from '@/lib/theme';
import {
  fetchMyActionableReportAssignments,
  fetchReportDomainStatus,
  isReportScopeEntitled,
  setPreferredReportAssignment,
} from '@/lib/buklodReportDomain';
import type { ReportAssignmentCard } from '@/lib/buklodReportContracts';
import {
  buklodReportDefinitionsPath,
  buklodReportLandingPath,
  readReportAssignmentId,
  readReportScopeId,
} from '@/lib/buklodReportRoutes';
import { verifyOrganizationManageAccess } from '@/lib/buklodOrganization';
import { supabase } from '@/lib/supabase';

function formatReportDeadline(value: string) {
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

export default function BuklodReportLandingScreen() {
  const params = useLocalSearchParams();
  const scopeId = readReportScopeId(params as Record<string, unknown>);
  const routeAssignmentId = readReportAssignmentId(params as Record<string, unknown>);
  const routePreferenceKey = `${scopeId}:${routeAssignmentId}`;

  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState('');
  const [scopeName, setScopeName] = useState<string | null>(null);
  const [scopeType, setScopeType] = useState<string | null>(null);
  const [entitled, setEntitled] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [assignments, setAssignments] = useState<ReportAssignmentCard[]>([]);
  const [preparedRouteKey, setPreparedRouteKey] = useState('');

  useEffect(() => {
    if (scopeId) {
      setPreferredReportAssignment(scopeId, routeAssignmentId || null);
    }
    setPreparedRouteKey(routePreferenceKey);
  }, [routeAssignmentId, routePreferenceKey, scopeId]);

  const routeReady = preparedRouteKey === routePreferenceKey;

  const actionableAssignments = useMemo(
    () => assignments.filter((row) => row.assignment_status !== 'SUBMITTED'),
    [assignments]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const status = await fetchReportDomainStatus();
      setPhase(status.implementation_phase);

      if (scopeId) {
        const [entitlement, manageAccess, scopeResult, assignmentRows] = await Promise.all([
          isReportScopeEntitled(scopeId),
          verifyOrganizationManageAccess(scopeId),
          (supabase as any)
            .from('buklod_scopes')
            .select('name, scope_type')
            .eq('id', scopeId)
            .maybeSingle(),
          fetchMyActionableReportAssignments(20, scopeId),
        ]);

        setEntitled(entitlement);
        setCanManage(manageAccess.allowed);
        setScopeName(scopeResult.data?.name ?? manageAccess.scopeName ?? null);
        setScopeType(scopeResult.data?.scope_type ?? null);
        setAssignments(assignmentRows);
      } else {
        setEntitled(false);
        setCanManage(false);
        setScopeName(null);
        setScopeType(null);
        setAssignments([]);
      }
    } catch (error: any) {
      console.warn('BUKLOD Report landing:', error);
      setLoadError(error?.message || 'BUKLOD Report could not be opened.');
    } finally {
      setLoading(false);
    }
  }, [scopeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openAssignment = useCallback(
    (assignmentId: string) => {
      if (!scopeId || !assignmentId) return;
      router.push(buklodReportLandingPath(scopeId, assignmentId) as any);
    },
    [scopeId]
  );

  return (
    <>
      <Stack.Screen options={{ title: 'BUKLOD Report' }} />

      <BuklodPortalScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Image
            source={{ uri: BUKLOD_REPORT_ICON_URI }}
            resizeMode="cover"
            style={styles.heroIcon}
          />
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>REPORT → EVIDENCE → ACTION</Text>
            <Text style={styles.heroTitle}>BUKLOD Report</Text>
            <Text style={styles.heroSubtitle}>
              Simple reporting in front. Intelligent monitoring and follow-up behind it.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.green} />
            <Text style={styles.muted}>Opening your report workspace…</Text>
          </View>
        ) : (
          <>
            {loadError ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{loadError}</Text>
                <Pressable onPress={() => void load()} style={styles.retryButton}>
                  <Text style={styles.retryText}>TRY AGAIN</Text>
                </Pressable>
              </View>
            ) : null}

            {scopeId ? (
              <View style={styles.scopeCard}>
                <View style={styles.scopeIcon}>
                  <MaterialCommunityIcons
                    name={scopeType === 'CLUSTER' ? 'account-group' : 'domain'}
                    size={22}
                    color={colors.greenDark}
                  />
                </View>
                <View style={styles.scopeCopy}>
                  <Text style={styles.scopeLabel}>ACTIVE CONTEXT</Text>
                  <Text style={styles.scopeName}>{scopeName || 'Selected scope'}</Text>
                  <Text style={styles.scopeMeta}>
                    {scopeType || 'Organization / Cluster'} · Same BUKLOD account · No second sign-in
                  </Text>
                </View>
                {entitled ? (
                  <View style={styles.enabledPill}>
                    <Text style={styles.enabledText}>ENABLED</Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.infoCard}>
                <MaterialCommunityIcons name="door-open" size={24} color={colors.greenDark} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Open from Organization or Cluster Home</Text>
                  <Text style={styles.note}>
                    The BUKLOD Report doorway carries the exact active scope automatically so you do not need to choose it again.
                  </Text>
                </View>
              </View>
            )}

            {scopeId && entitled && actionableAssignments.length > 0 ? (
              <View style={styles.currentCard}>
                <View style={styles.currentHeader}>
                  <View>
                    <Text style={styles.currentEyebrow}>CURRENT REPORTS</Text>
                    <Text style={styles.currentTitle}>To submit</Text>
                  </View>
                  <View style={styles.currentCountPill}>
                    <Text style={styles.currentCountText}>{actionableAssignments.length}</Text>
                  </View>
                </View>

                {actionableAssignments.map((assignment) => {
                  const selected = assignment.report_assignment_id === routeAssignmentId;
                  return (
                    <Pressable
                      key={assignment.report_assignment_id}
                      onPress={() => openAssignment(assignment.report_assignment_id)}
                      style={({ pressed }) => [
                        styles.assignmentRow,
                        selected && styles.assignmentRowSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.assignmentIcon}>
                        <MaterialCommunityIcons
                          name={assignment.home_status === 'EXPIRED' ? 'clock-alert-outline' : 'clipboard-text-clock-outline'}
                          size={20}
                          color={assignment.home_status === 'EXPIRED' ? '#92400E' : colors.greenDark}
                        />
                      </View>
                      <View style={styles.assignmentCopy}>
                        <Text style={styles.assignmentTitle}>{assignment.report_title}</Text>
                        <Text style={styles.assignmentMeta}>{assignment.period_label}</Text>
                        <Text style={styles.assignmentDeadline}>
                          {assignment.home_status === 'EXPIRED' ? 'Late · ' : 'Deadline · '}
                          {formatReportDeadline(assignment.deadline_at)}
                        </Text>
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.greenDark} />
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {scopeId && entitled ? (
              routeReady ? (
                <BuklodWeeklyReportForm scopeId={scopeId} onSubmitted={() => void load()} />
              ) : (
                <View style={styles.center}>
                  <ActivityIndicator color={colors.green} />
                  <Text style={styles.muted}>Opening the selected report…</Text>
                </View>
              )
            ) : scopeId ? (
              <View style={styles.warningCard}>
                <MaterialCommunityIcons name="lock-outline" size={22} color="#92400E" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.warningTitle}>Reporting is not enabled for this scope</Text>
                  <Text style={styles.warningText}>
                    Ask the Organization or Cluster administrator to activate BUKLOD Report access.
                  </Text>
                </View>
              </View>
            ) : null}

            {scopeId && canManage ? (
              <Pressable
                onPress={() => router.push(buklodReportDefinitionsPath(scopeId) as any)}
                style={({ pressed }) => [styles.manageButton, pressed && styles.pressed]}
              >
                <MaterialCommunityIcons name="clipboard-text-clock-outline" size={20} color={colors.greenDark} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.manageTitle}>Report settings</Text>
                  <Text style={styles.manageMeta}>Manage definitions and scope reporting rules</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.greenDark} />
              </Pressable>
            ) : null}

            <View style={styles.footerLine}>
              <Text style={styles.footerText}>
                {phase || 'PHASE_4_SUBMISSION'} · Scope-isolated · Evidence preserved
              </Text>
            </View>

            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="arrow-left" size={17} color={colors.greenDark} />
              <Text style={styles.backText}>Back to BUKLOD Main</Text>
            </Pressable>
          </>
        )}
      </BuklodPortalScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 14, gap: 12, backgroundColor: colors.background },
  hero: { borderRadius: 20, padding: 15, backgroundColor: colors.greenDark, flexDirection: 'row', alignItems: 'center', gap: 13 },
  heroIcon: { width: 72, height: 72, borderRadius: 18, backgroundColor: '#FFFFFF' },
  heroCopy: { flex: 1, minWidth: 0, gap: 4 },
  heroEyebrow: { color: 'rgba(255,255,255,0.72)', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  heroTitle: { fontSize: 24, fontWeight: '900', color: '#FFFFFF' },
  heroSubtitle: { fontSize: 11, lineHeight: 16, color: 'rgba(255,255,255,0.86)' },
  center: { paddingVertical: 32, alignItems: 'center', gap: 8 },
  muted: { color: colors.muted, fontSize: 11 },
  scopeCard: { borderRadius: 15, borderWidth: 1, borderColor: '#DCE5E0', backgroundColor: '#FFFFFF', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  scopeIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#E8F5EE', alignItems: 'center', justifyContent: 'center' },
  scopeCopy: { flex: 1, minWidth: 0 },
  scopeLabel: { color: '#61766C', fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  scopeName: { color: '#173B2F', fontSize: 14, fontWeight: '900' },
  scopeMeta: { marginTop: 2, color: '#6C7B73', fontSize: 9, lineHeight: 13 },
  enabledPill: { borderRadius: 999, backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4 },
  enabledText: { color: '#166534', fontSize: 8, fontWeight: '900' },
  infoCard: { borderRadius: 15, borderWidth: 1, borderColor: '#DCE5E0', backgroundColor: '#FFFFFF', padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitle: { color: '#173B2F', fontSize: 13, fontWeight: '900' },
  note: { marginTop: 3, color: '#6C7B73', fontSize: 10, lineHeight: 15 },
  currentCard: { borderRadius: 15, borderWidth: 1, borderColor: '#DCE5E0', backgroundColor: '#FFFFFF', padding: 12, gap: 8 },
  currentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  currentEyebrow: { color: '#61766C', fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  currentTitle: { color: '#173B2F', fontSize: 14, fontWeight: '900' },
  currentCountPill: { minWidth: 28, height: 28, borderRadius: 14, backgroundColor: '#E8F5EE', alignItems: 'center', justifyContent: 'center' },
  currentCountText: { color: colors.greenDark, fontSize: 11, fontWeight: '900' },
  assignmentRow: { minHeight: 66, borderRadius: 12, borderWidth: 1, borderColor: '#E4EBE7', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  assignmentRowSelected: { borderColor: colors.greenDark, backgroundColor: '#F1F8F4' },
  assignmentIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3F7F5', alignItems: 'center', justifyContent: 'center' },
  assignmentCopy: { flex: 1, minWidth: 0 },
  assignmentTitle: { color: '#173B2F', fontSize: 11, fontWeight: '900' },
  assignmentMeta: { marginTop: 1, color: '#6C7B73', fontSize: 9 },
  assignmentDeadline: { marginTop: 3, color: '#55665E', fontSize: 9, fontWeight: '700' },
  warningCard: { borderRadius: 14, borderWidth: 1, borderColor: '#F4D8A6', backgroundColor: '#FFFBEB', padding: 13, flexDirection: 'row', gap: 9 },
  warningTitle: { color: '#92400E', fontSize: 12, fontWeight: '900' },
  warningText: { marginTop: 2, color: '#8A5A12', fontSize: 10, lineHeight: 14 },
  errorCard: { borderRadius: 14, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2', padding: 12, gap: 8 },
  errorText: { color: '#991B1B', fontSize: 11, lineHeight: 16 },
  retryButton: { alignSelf: 'flex-start', borderRadius: 9, backgroundColor: '#991B1B', paddingHorizontal: 10, paddingVertical: 7 },
  retryText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  manageButton: { minHeight: 58, borderRadius: 14, borderWidth: 1, borderColor: '#DCE5E0', backgroundColor: '#FFFFFF', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  manageTitle: { color: '#173B2F', fontSize: 11, fontWeight: '900' },
  manageMeta: { marginTop: 2, color: '#6C7B73', fontSize: 9 },
  footerLine: { alignItems: 'center', paddingVertical: 4 },
  footerText: { color: '#7B8982', fontSize: 8, fontWeight: '700' },
  backButton: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#DCE5E0', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  backText: { color: colors.greenDark, fontSize: 11, fontWeight: '900' },
  pressed: { opacity: 0.74 },
});