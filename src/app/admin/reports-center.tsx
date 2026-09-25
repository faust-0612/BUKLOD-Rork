import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { AdminGate } from '@/components/AdminGate';
import { shared } from '@/components/UI';
import {
  asMoney,
  formatPhp,
  loadAdminBuklodR38EconomyReport,
  type BuklodR38AdminEconomyReport,
} from '@/lib/buklodR38Economy';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type PointBalanceRow = {
  user_id: string;
  lifetime_points: number | string | null;
  available_points: number | string | null;
};

type PointLedgerRow = {
  user_id: string;
  direction: string | null;
  points: number | string | null;
  activity_type: string | null;
  claim_state: string | null;
};

type PointsHealth = {
  membersWithBalances: number;
  lifetimePoints: number;
  availablePoints: number;
  pendingPoints: number;
  ledgerCredits: number;
  ledgerDebits: number;
  pendingEntries: number;
  activityTypes: number;
  topActivities: Array<{ key: string; points: number; entries: number }>;
};

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {!!note && <Text style={styles.metricNote}>{note}</Text>}
    </View>
  );
}

function ReportRow({
  icon,
  title,
  subtitle,
  path,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  path: string;
}) {
  return (
    <Pressable
      onPress={() => router.push(path as any)}
      style={({ pressed }) => [styles.reportRow, pressed && { opacity: 0.72 }]}
    >
      <View style={styles.reportIcon}>
        <MaterialCommunityIcons name={icon} size={20} color={colors.greenDark} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.reportTitle}>{title}</Text>
        <Text style={styles.reportSubtitle}>{subtitle}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={21} color={colors.muted} />
    </Pressable>
  );
}

function StatusRows({
  rows,
  empty,
}: {
  rows: Record<string, number>;
  empty: string;
}) {
  const entries = Object.entries(rows);
  if (!entries.length) return <Text style={styles.emptyText}>{empty}</Text>;

  return (
    <View style={styles.statusList}>
      {entries.map(([key, value]) => (
        <View key={key} style={styles.statusRow}>
          <Text style={styles.statusLabel}>{key.replace(/_/g, ' ')}</Text>
          <Text style={styles.statusValue}>{Number(value).toLocaleString('en-PH')}</Text>
        </View>
      ))}
    </View>
  );
}

async function fetchAllRows<T>(table: string, columns: string): Promise<T[]> {
  const pageSize = 1000;
  const result: T[] = [];
  let from = 0;

  while (from < 100000) {
    const { data, error } = await (supabase as any)
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message || `Could not read ${table}.`);

    const page = (data ?? []) as T[];
    result.push(...page);
    if (page.length < pageSize) return result;
    from += pageSize;
  }

  throw new Error(`${table} exceeded the protected admin report paging limit.`);
}

async function loadPointsHealth(): Promise<PointsHealth> {
  const [balances, ledger] = await Promise.all([
    fetchAllRows<PointBalanceRow>(
      'buklod_user_points_balances',
      'user_id,lifetime_points,available_points',
    ),
    fetchAllRows<PointLedgerRow>(
      'buklod_points_ledger',
      'user_id,direction,points,activity_type,claim_state',
    ),
  ]);

  const lifetimePoints = balances.reduce(
    (sum, row) => sum + asMoney(row.lifetime_points),
    0,
  );
  const availablePoints = balances.reduce(
    (sum, row) => sum + asMoney(row.available_points),
    0,
  );

  let pendingPoints = 0;
  let ledgerCredits = 0;
  let ledgerDebits = 0;
  let pendingEntries = 0;
  const activity = new Map<string, { points: number; entries: number }>();

  for (const row of ledger) {
    const points = asMoney(row.points);
    const direction = String(row.direction ?? '').toLowerCase();
    const claimState = String(row.claim_state ?? '').toLowerCase();
    const activityKey = String(row.activity_type ?? 'other').trim() || 'other';

    if (direction === 'credit') {
      ledgerCredits += points;
      if (claimState === 'pending') {
        pendingPoints += points;
        pendingEntries += 1;
      }

      const current = activity.get(activityKey) ?? { points: 0, entries: 0 };
      current.points += points;
      current.entries += 1;
      activity.set(activityKey, current);
    } else if (direction === 'debit') {
      ledgerDebits += points;
    }
  }

  const topActivities = [...activity.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 8);

  return {
    membersWithBalances: balances.length,
    lifetimePoints,
    availablePoints,
    pendingPoints,
    ledgerCredits,
    ledgerDebits,
    pendingEntries,
    activityTypes: activity.size,
    topActivities,
  };
}

export default function AdminReportsCenterScreen() {
  const [economy, setEconomy] = useState<BuklodR38AdminEconomyReport | null>(null);
  const [points, setPoints] = useState<PointsHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [economyError, setEconomyError] = useState('');
  const [pointsError, setPointsError] = useState('');

  const load = useCallback(async () => {
    setEconomyError('');
    setPointsError('');

    const [economyResult, pointsResult] = await Promise.allSettled([
      loadAdminBuklodR38EconomyReport(),
      loadPointsHealth(),
    ]);

    if (economyResult.status === 'fulfilled') {
      setEconomy(economyResult.value);
    } else {
      setEconomyError(
        economyResult.reason instanceof Error
          ? economyResult.reason.message
          : 'Could not load the economy report.',
      );
    }

    if (pointsResult.status === 'fulfilled') {
      setPoints(pointsResult.value);
    } else {
      setPointsError(
        pointsResult.reason instanceof Error
          ? pointsResult.reason.message
          : 'Could not load Points health.',
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const periodLabel = useMemo(() => {
    if (!economy?.period) return 'No current economic period';
    const key = economy.period.period_key;
    const status = economy.period.status;
    return `${typeof key === 'string' ? key : 'Period'} · ${typeof status === 'string' ? status : 'UNKNOWN'}`;
  }, [economy]);

  const economyHealth = useMemo(() => {
    if (!economy?.period) {
      return { label: 'NO PERIOD', note: 'Economy is installed; no period is active yet.', kind: 'neutral' as const };
    }

    const checks = Object.values(economy.invariant_checks ?? {});
    const failed = checks.filter((value) => value === false).length;
    if (failed > 0) {
      return { label: 'REVIEW', note: `${failed} invariant check${failed === 1 ? '' : 's'} need attention.`, kind: 'warning' as const };
    }

    return { label: 'OK', note: 'Current invariant checks have no recorded failure.', kind: 'ok' as const };
  }, [economy]);

  const shareCount = economy?.user_shares?.length ?? 0;
  const revenue = economy?.revenue_chain;
  const qualifiedBcu = economy?.qualified_units?.bcu;
  const entryGroups = economy?.financial_entry_breakdown?.length ?? 0;

  return (
    <AdminGate>
      <ScrollView
        style={shared.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <MaterialCommunityIcons name="arrow-left" size={18} color={colors.greenDark} />
          <Text style={styles.backText}>ADMIN</Text>
        </Pressable>

        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>SYSTEM ADMIN · REPORTING</Text>
            <Text style={shared.h1}>Admin Reports Center</Text>
            <Text style={shared.muted}>
              One clean entry point for Points health, canonical User Pool, first-line referrals,
              finalized shares, payouts, attendance, formation and scope reports.
            </Text>
          </View>
          <MaterialCommunityIcons name="chart-box-outline" size={30} color={colors.greenDark} />
        </View>

        <View style={styles.guardCard}>
          <MaterialCommunityIcons name="shield-check-outline" size={22} color={colors.greenDark} />
          <Text style={styles.guardText}>
            Points, Circle Rank and Character are progression signals, not money. Qualified Monthly
            Points are weights for the 30% User Revenue Pool. Cash reports come only from finalized
            platform value and canonical settlement; no fixed Points-to-peso rate is used.
          </Text>
        </View>

        {loading && !economy && !points ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.greenDark} />
            <Text style={shared.muted}>Loading admin reports…</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>PROGRESSION HEALTH</Text>
              <Text style={styles.sectionTitle}>BUKLOD Points</Text>
            </View>
            <Text style={styles.period}>Separate from cash</Text>
          </View>

          {pointsError && !points ? (
            <View style={styles.loadingCard}>
              <Text style={styles.errorTitle}>Points health unavailable</Text>
              <Text style={shared.muted}>{pointsError}</Text>
            </View>
          ) : points ? (
            <>
              <View style={styles.grid}>
                <Metric
                  label="Lifetime Points"
                  value={points.lifetimePoints.toLocaleString('en-PH')}
                  note="Canonical member balances"
                />
                <Metric
                  label="Available Points"
                  value={points.availablePoints.toLocaleString('en-PH')}
                  note="Spendable progression balance"
                />
                <Metric
                  label="Pending Claimable"
                  value={points.pendingPoints.toLocaleString('en-PH')}
                  note={`${points.pendingEntries.toLocaleString('en-PH')} pending ledger entries`}
                />
                <Metric
                  label="Ledger Credits"
                  value={points.ledgerCredits.toLocaleString('en-PH')}
                />
                <Metric
                  label="Ledger Debits"
                  value={points.ledgerDebits.toLocaleString('en-PH')}
                />
                <Metric
                  label="Members with Point Balance"
                  value={points.membersWithBalances.toLocaleString('en-PH')}
                />
              </View>

              <View style={styles.tableCard}>
                <Text style={styles.tableTitle}>Top point activity types</Text>
                <Text style={styles.tableHint}>
                  Credit activity only · {points.activityTypes.toLocaleString('en-PH')} activity type{points.activityTypes === 1 ? '' : 's'} recorded
                </Text>
                {points.topActivities.length ? points.topActivities.map((item) => (
                  <View key={item.key} style={styles.tableRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tableKey}>{item.key.replace(/_/g, ' ')}</Text>
                      <Text style={styles.tableMeta}>{item.entries.toLocaleString('en-PH')} credit entries</Text>
                    </View>
                    <Text style={styles.tableValue}>{item.points.toLocaleString('en-PH')} pts</Text>
                  </View>
                )) : <Text style={styles.emptyText}>No point-credit activity yet.</Text>}
              </View>

              <ReportRow
                icon="account-details-outline"
                title="Member Master & Point Audit"
                subtitle="Per-member Lifetime, Available, Pending, ledger reconciliation, scopes and roles"
                path="/admin/member-master"
              />
            </>
          ) : null}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>ECONOMY SNAPSHOT</Text>
              <Text style={styles.sectionTitle}>User Pool, Referral & Revenue</Text>
            </View>
            <Text style={styles.period}>{periodLabel}</Text>
          </View>

          <View
            style={[
              styles.healthCard,
              economyHealth.kind === 'warning' && styles.healthCardWarning,
              economyHealth.kind === 'ok' && styles.healthCardOk,
            ]}
          >
            <MaterialCommunityIcons
              name={economyHealth.kind === 'warning' ? 'alert-circle-outline' : economyHealth.kind === 'ok' ? 'check-circle-outline' : 'information-outline'}
              size={20}
              color={economyHealth.kind === 'warning' ? '#8A5B19' : colors.greenDark}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.healthTitle}>ECONOMY HEALTH · {economyHealth.label}</Text>
              <Text style={styles.healthText}>{economyHealth.note}</Text>
            </View>
          </View>

          {economyError && !economy ? (
            <View style={styles.loadingCard}>
              <Text style={styles.errorTitle}>Economy snapshot unavailable</Text>
              <Text style={shared.muted}>{economyError}</Text>
              <Pressable onPress={() => void load()} style={styles.retryButton}>
                <Text style={styles.retryText}>TRY AGAIN</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.grid}>
                <Metric label="Reconciled Revenue" value={formatPhp(revenue?.actual_reconciled_revenue)} />
                <Metric label="Reconciled Costs" value={formatPhp(revenue?.actual_reconciled_costs)} />
                <Metric label="Distributable Base" value={formatPhp(revenue?.distributable_base)} />
                <Metric label="User Revenue Pool 30%" value={formatPhp(revenue?.bayanihan_pool)} />
                <Metric label="First-Line Referral Settlement" value={formatPhp(revenue?.referral_pool)} />
                <Metric label="Finalized Share Records" value={shareCount.toLocaleString('en-PH')} />
                <Metric label="Qualified Monthly Points" value={qualifiedBcu == null ? '—' : asMoney(qualifiedBcu).toLocaleString('en-PH', { maximumFractionDigits: 6 })} />
                <Metric label="Financial Entry Groups" value={entryGroups.toLocaleString('en-PH')} />
                <Metric label="User Pool Distributed" value={formatPhp(economy?.distributed?.bayanihan)} />
                <Metric label="First-Line Referral Distributed" value={formatPhp(economy?.distributed?.direct_referral)} />
                <Metric label="Canonical Cash Ledger" value="Open full finance report" note="Aggregate AVAILABLE / RESERVED / PAID is not inferred from missing data." />
              </View>

              <View style={styles.twoColumn}>
                <View style={styles.tableCard}>
                  <Text style={styles.tableTitle}>App-sharing / referral states</Text>
                  <StatusRows
                    rows={economy?.referral_states ?? {}}
                    empty="No referral-state activity yet."
                  />
                </View>

                <View style={styles.tableCard}>
                  <Text style={styles.tableTitle}>Withdrawal states</Text>
                  <StatusRows
                    rows={economy?.withdrawals ?? {}}
                    empty="No withdrawal activity yet."
                  />
                </View>
              </View>

              <View style={styles.quickLinks}>
                <ReportRow
                  icon="finance"
                  title="Full Canonical Economy & User Shares"
                  subtitle="30% User Pool, Qualified Monthly Points, finalized per-user shares, first-line referrals and withdrawals"
                  path="/admin/bayanihan"
                />
                <ReportRow
                  icon="cash-sync"
                  title="Economy Operations & Payout Queue"
                  subtitle="Actual revenue/cost reconciliation, period finalization, withdrawal review and payout processing"
                  path="/admin/economy-operations"
                />
              </View>
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>OPERATIONAL REPORTS</Text>
          <Text style={styles.sectionTitle}>Platform & Scope</Text>

          <View style={styles.reportList}>
            <ReportRow
              icon="office-building-outline"
              title="Organization & Cluster Reports"
              subtitle="Choose the exact Organization or Cluster context, then open its current BUKLOD Report workspace"
              path="/organizations"
            />
            <ReportRow
              icon="calendar-check-outline"
              title="Attendance & Focus Apps"
              subtitle="Events, check-ins, adoption, subscriptions and Focus App usage"
              path="/admin/attendance"
            />
            <ReportRow
              icon="book-open-variant"
              title="Daily Bible & Formation Monitoring"
              subtitle="Daily reading submissions, reflection status and formation follow-up"
              path="/admin/bible"
            />
            <ReportRow
              icon="flag-outline"
              title="Content & Moderation Reports"
              subtitle="Reported posts and comments requiring System Admin review"
              path="/admin/content-reports"
            />
          </View>
        </View>

        <View style={styles.noteCard}>
          <MaterialCommunityIcons name="information-outline" size={20} color={colors.greenDark} />
          <Text style={styles.noteText}>
            Old global “Reports & Analytics” and point-to-cash admin structures are not restored.
            Current reporting stays scope-aware and uses the canonical Points, BUKLOD Report,
            Attendance and funded Economy systems.
          </Text>
        </View>
      </ScrollView>
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 90, gap: 16 },
  backRow: { alignSelf: 'flex-start', minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { fontSize: 10, fontWeight: '900', color: colors.greenDark, letterSpacing: 0.7 },
  hero: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1, color: colors.greenDark, marginBottom: 4 },
  guardCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderColor: '#D5E7DC', backgroundColor: '#EEF8F2', borderRadius: 14, padding: 13 },
  guardText: { flex: 1, fontSize: 10.5, lineHeight: 15, color: colors.muted },
  section: { gap: 9 },
  sectionHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  sectionEyebrow: { fontSize: 8.5, fontWeight: '900', letterSpacing: 1.1, color: colors.muted },
  sectionTitle: { marginTop: 2, fontSize: 18, fontWeight: '900', color: colors.text },
  period: { fontSize: 9.5, fontWeight: '800', color: colors.greenDark },
  loadingCard: { minHeight: 110, alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 13, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, padding: 18 },
  errorTitle: { fontSize: 13, fontWeight: '900', color: colors.text },
  retryButton: { marginTop: 3, borderRadius: 9, backgroundColor: colors.greenDark, paddingHorizontal: 12, paddingVertical: 8 },
  retryText: { color: colors.white, fontSize: 9.5, fontWeight: '900' },
  healthCard: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: '#F5F8F6' },
  healthCardWarning: { borderColor: '#E8D0A2', backgroundColor: '#FFF8EA' },
  healthCardOk: { borderColor: '#BFDCC9', backgroundColor: '#EEF8F2' },
  healthTitle: { fontSize: 10, fontWeight: '900', color: colors.text },
  healthText: { marginTop: 2, fontSize: 9.5, lineHeight: 13.5, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { minWidth: 145, flexGrow: 1, flexBasis: '30%', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  metricValue: { fontSize: 16, fontWeight: '900', color: colors.greenDark },
  metricLabel: { marginTop: 4, fontSize: 9.5, fontWeight: '800', color: colors.text },
  metricNote: { marginTop: 2, fontSize: 8.5, lineHeight: 12, color: colors.muted },
  quickLinks: { gap: 7, marginTop: 2 },
  reportList: { gap: 7 },
  reportRow: { minHeight: 65, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  reportIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF8F2' },
  reportTitle: { fontSize: 12, fontWeight: '900', color: colors.text },
  reportSubtitle: { marginTop: 2, fontSize: 9.5, lineHeight: 13.5, color: colors.muted },
  twoColumn: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tableCard: { flexGrow: 1, flexBasis: '45%', minWidth: 240, padding: 12, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  tableTitle: { fontSize: 12, fontWeight: '900', color: colors.text },
  tableHint: { marginTop: 2, marginBottom: 4, fontSize: 8.5, color: colors.muted },
  tableRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: colors.line },
  tableKey: { fontSize: 10, fontWeight: '800', color: colors.text, textTransform: 'capitalize' },
  tableMeta: { marginTop: 1, fontSize: 8.5, color: colors.muted },
  tableValue: { fontSize: 10.5, fontWeight: '900', color: colors.greenDark },
  statusList: { marginTop: 5 },
  statusRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: colors.line },
  statusLabel: { flex: 1, fontSize: 9.5, color: colors.muted, textTransform: 'capitalize' },
  statusValue: { fontSize: 10.5, fontWeight: '900', color: colors.text },
  emptyText: { marginTop: 7, fontSize: 9.5, lineHeight: 14, color: colors.muted },
  noteCard: { flexDirection: 'row', gap: 9, padding: 13, borderRadius: 13, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  noteText: { flex: 1, fontSize: 9.5, lineHeight: 14, color: colors.muted },
});
