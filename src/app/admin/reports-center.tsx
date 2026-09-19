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
  formatPhp,
  loadAdminBuklodR38EconomyReport,
  type BuklodR38AdminEconomyReport,
} from '@/lib/buklodR38Economy';
import { colors } from '@/lib/theme';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

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

export default function AdminReportsCenterScreen() {
  const [economy, setEconomy] = useState<BuklodR38AdminEconomyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      setEconomy(await loadAdminBuklodR38EconomyReport());
    } catch (nextError: unknown) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load the economy report.');
    } finally {
      setLoading(false);
    }
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

  const shareCount = economy?.user_shares?.length ?? 0;
  const revenue = economy?.revenue_chain;

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
              One clean entry point for economy, Bayanihan, app-sharing revenue, payouts,
              attendance, formation monitoring and scope reports.
            </Text>
          </View>
          <MaterialCommunityIcons name="chart-box-outline" size={30} color={colors.greenDark} />
        </View>

        <View style={styles.guardCard}>
          <MaterialCommunityIcons name="shield-check-outline" size={22} color={colors.greenDark} />
          <Text style={styles.guardText}>
            Points and Circle Rank are progression only. Cash reports below come from actual
            reconciled platform revenue and finalized funded shares, never a Points-to-peso rate.
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>ECONOMY SNAPSHOT</Text>
              <Text style={styles.sectionTitle}>Bayanihan & Shares</Text>
            </View>
            <Text style={styles.period}>{periodLabel}</Text>
          </View>

          {loading && !economy ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={colors.greenDark} />
              <Text style={shared.muted}>Loading current reports…</Text>
            </View>
          ) : error && !economy ? (
            <View style={styles.loadingCard}>
              <Text style={styles.errorTitle}>Economy snapshot unavailable</Text>
              <Text style={shared.muted}>{error}</Text>
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
                <Metric label="Bayanihan Pool" value={formatPhp(revenue?.bayanihan_pool)} />
                <Metric label="Referral Pool" value={formatPhp(revenue?.referral_pool)} />
                <Metric label="Finalized Share Records" value={shareCount.toLocaleString('en-PH')} />
                <Metric label="Bayanihan Distributed" value={formatPhp(economy?.distributed?.bayanihan)} />
                <Metric label="Referral Distributed" value={formatPhp(economy?.distributed?.direct_referral)} />
                <Metric label="Available Cash" value={formatPhp(economy?.cash_ledger?.available)} />
                <Metric label="Reserved Cash" value={formatPhp(economy?.cash_ledger?.reserved)} />
                <Metric label="Paid Earnings" value={formatPhp(economy?.cash_ledger?.paid)} />
              </View>

              <View style={styles.quickLinks}>
                <ReportRow
                  icon="finance"
                  title="Full Economy, Bayanihan & Shares"
                  subtitle="Pools, BCU/RCU, finalized user shares, referral states and withdrawals"
                  path="/admin/bayanihan"
                />
                <ReportRow
                  icon="cash-sync"
                  title="Economy Operations"
                  subtitle="Actual revenue/cost reconciliation, finalization and payout processing"
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
              subtitle="Open the exact Organization or Cluster context, then its Reports workspace"
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
            Legacy global “Reports & Analytics” screens are not restored here. Current reporting
            stays scope-aware and uses the active BUKLOD Report, Attendance and Economy systems.
          </Text>
        </View>
      </ScrollView>
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 90, gap: 14 },
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
  loadingCard: { minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 13, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, padding: 18 },
  errorTitle: { fontSize: 13, fontWeight: '900', color: colors.text },
  retryButton: { marginTop: 3, borderRadius: 9, backgroundColor: colors.greenDark, paddingHorizontal: 12, paddingVertical: 8 },
  retryText: { color: colors.white, fontSize: 9.5, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { minWidth: 145, flexGrow: 1, flexBasis: '30%', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  metricValue: { fontSize: 16, fontWeight: '900', color: colors.greenDark },
  metricLabel: { marginTop: 4, fontSize: 9.5, fontWeight: '800', color: colors.text },
  metricNote: { marginTop: 2, fontSize: 8.5, color: colors.muted },
  quickLinks: { gap: 7, marginTop: 2 },
  reportList: { gap: 7 },
  reportRow: { minHeight: 65, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  reportIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF8F2' },
  reportTitle: { fontSize: 12, fontWeight: '900', color: colors.text },
  reportSubtitle: { marginTop: 2, fontSize: 9.5, lineHeight: 13.5, color: colors.muted },
  noteCard: { flexDirection: 'row', gap: 9, padding: 13, borderRadius: 13, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  noteText: { flex: 1, fontSize: 9.5, lineHeight: 14, color: colors.muted },
});
