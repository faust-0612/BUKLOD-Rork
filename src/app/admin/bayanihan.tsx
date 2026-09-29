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
import { colors } from '@/lib/theme';

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {!!note && <Text style={styles.metricNote}>{note}</Text>}
    </View>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      {children}
    </View>
  );
}

export default function AdminBayanihanScreen() {
  const [report, setReport] = useState<BuklodR38AdminEconomyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setReport(await loadAdminBuklodR38EconomyReport());
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
    if (!report?.period) return 'No economic period created yet';
    const key = report.period.period_key;
    const status = report.period.status;
    return `${typeof key === 'string' ? key : 'Period'} · ${typeof status === 'string' ? status : 'UNKNOWN'}`;
  }, [report]);

  const revenue = report?.revenue_chain;
  const checks = report?.invariant_checks ?? {};
  const shareCount = report?.user_shares?.length ?? 0;

  return (
    <AdminGate>
      <ScrollView
        style={shared.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>SYSTEM ADMIN · ECONOMY REPORT</Text>
            <Text style={shared.h1}>Economy, Bayanihan & Shares</Text>
            <Text style={shared.muted}>
              Canonical Finance V3 reconciliation, 30% User Pool allocation, Qualified Monthly Points, first-line referral settlement and payout controls.
            </Text>
          </View>
          <MaterialCommunityIcons name="finance" size={31} color={colors.greenDark} />
        </View>

        <View style={styles.guardCard}>
          <MaterialCommunityIcons name="shield-lock-outline" size={23} color={colors.greenDark} />
          <View style={{ flex: 1 }}>
            <Text style={styles.guardTitle}>Hard economic invariant</Text>
            <Text style={styles.guardText}>
              Points, Circle Rank, Character and Collectibles never mint pesos. Qualified Monthly Points are distribution weights only. Cash comes only from eligible finalized platform value and canonical settlement.
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => router.push('/admin/economy-operations' as any)}
          style={({ pressed }) => [styles.operationsButton, pressed && { opacity: 0.78 }]}
        >
          <MaterialCommunityIcons name="finance" size={19} color="#FFFFFF" />
          <View style={{ flex: 1 }}>
            <Text style={styles.operationsTitle}>OPEN ECONOMY OPERATIONS</Text>
            <Text style={styles.operationsSubtitle}>Periods, revenue/cost reconciliation, referral review and payout queue</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#FFFFFF" />
        </Pressable>

        {loading && !report ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.greenDark} />
            <Text style={styles.muted}>Loading economy report...</Text>
          </View>
        ) : error && !report ? (
          <View style={styles.loadingCard}>
            <Text style={styles.errorTitle}>Economy report unavailable</Text>
            <Text style={styles.muted}>{error}</Text>
            <Pressable onPress={() => void load()} style={styles.retryButton}>
              <Text style={styles.retryText}>TRY AGAIN</Text>
            </Pressable>
          </View>
        ) : report ? (
          <>
            <Section title="Current Economic Period" subtitle={periodLabel}>
              {revenue ? (
                <View style={styles.grid}>
                  <Metric label="Reconciled Revenue" value={formatPhp(revenue.actual_reconciled_revenue)} />
                  <Metric label="Reconciled Costs" value={formatPhp(revenue.actual_reconciled_costs)} />
                  <Metric label="Distributable Base" value={formatPhp(revenue.distributable_base)} />
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No financial period yet</Text>
                  <Text style={styles.muted}>
                    No PHP is being estimated, finalized or distributed. Create/reconcile periods only when actual platform revenue and costs are available.
                  </Text>
                </View>
              )}
            </Section>

            <Section
              title="Funded Allocation"
              subtitle="Pools are percentages of the reconciled distributable base — never of user Points."
            >
              <View style={styles.grid}>
                <Metric label="User Revenue Pool 30%" value={formatPhp(revenue?.bayanihan_pool)} />
                <Metric label="First-Line Referral Settlement" value={formatPhp(revenue?.referral_pool)} />
                <Metric label="Qualification Reserve" value={formatPhp(revenue?.reserve)} />
              </View>
            </Section>

            <Section
              title="Qualified Monthly Points"
              subtitle="Qualified Monthly Points are monthly proportional weights for the 30% User Revenue Pool. They never have a fixed peso conversion rate."
            >
              <View style={styles.grid}>
                <Metric
                  label="Qualified Monthly Points"
                  value={asMoney(report.qualified_units?.bcu).toLocaleString('en-PH', { maximumFractionDigits: 6 })}
                />
                <Metric
                  label="Retrospective PHP / Qualified Point"
                  value={report.effective_rates_analytics_only.php_per_bcu == null ? '—' : formatPhp(report.effective_rates_analytics_only.php_per_bcu)}
                  note="Analytics only — never a promised rate"
                />
              </View>
            </Section>

            <Section title="Finalized Distribution" subtitle={`${shareCount.toLocaleString('en-PH')} finalized user-share records in the selected period.`}>
              <View style={styles.grid}>
                <Metric label="User Pool Distributed" value={formatPhp(report.distributed.bayanihan)} />
                <Metric label="First-Line Referral Distributed" value={formatPhp(report.distributed.direct_referral)} />
                <Metric label="Canonical Cash Ledger" value="See withdrawal / payout ledger" note="No synthetic zero balances are shown." />
              </View>

              {report.user_shares.length ? (
                <View style={styles.tableCard}>
                  <Text style={styles.tableTitle}>Finalized user shares</Text>
                  {report.user_shares.slice(0, 50).map((item) => (
                    <View key={`${item.user_id}-${item.pool_key}`} style={styles.shareRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.shareName}>{item.full_name}</Text>
                        <Text style={styles.shareMeta}>
                          {item.pool_key === 'DIRECT_REFERRAL' ? 'First-Line Referral' : 'User Pool'} · {asMoney(item.qualified_units).toLocaleString('en-PH', { maximumFractionDigits: 6 })} units
                        </Text>
                      </View>
                      <Text style={styles.shareAmount}>{formatPhp(item.finalized_share_amount)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </Section>

            <Section title="Safety Checks">
              <View style={styles.flagCard}>
                {Object.keys(checks).length ? (
                  Object.entries(checks).map(([key, value]) => (
                    <View key={key} style={styles.checkRow}>
                      <MaterialCommunityIcons
                        name={value === true ? 'check-circle-outline' : value === false ? 'alert-circle-outline' : 'information-outline'}
                        size={18}
                        color={value === false ? '#A35C00' : colors.greenDark}
                      />
                      <Text style={styles.checkKey}>{key.replace(/_/g, ' ')}</Text>
                      <Text style={styles.checkValue}>{String(value)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.muted}>No period-specific invariant checks yet.</Text>
                )}
              </View>
            </Section>

            <Section title="Referral & Withdrawal Status">
              <View style={styles.statusColumns}>
                <View style={styles.statusCard}>
                  <Text style={styles.tableTitle}>Referral states</Text>
                  {Object.keys(report.referral_states).length ? Object.entries(report.referral_states).map(([key, value]) => (
                    <View key={key} style={styles.smallRow}>
                      <Text style={styles.smallLabel}>{key.replace(/_/g, ' ')}</Text>
                      <Text style={styles.smallValue}>{Number(value).toLocaleString('en-PH')}</Text>
                    </View>
                  )) : <Text style={styles.muted}>No referral-state records.</Text>}
                </View>
                <View style={styles.statusCard}>
                  <Text style={styles.tableTitle}>Withdrawals</Text>
                  {Object.keys(report.withdrawals).length ? Object.entries(report.withdrawals).map(([key, value]) => (
                    <View key={key} style={styles.smallRow}>
                      <Text style={styles.smallLabel}>{key.replace(/_/g, ' ')}</Text>
                      <Text style={styles.smallValue}>{Number(value).toLocaleString('en-PH')}</Text>
                    </View>
                  )) : <Text style={styles.muted}>No withdrawal records.</Text>}
                </View>
              </View>
            </Section>
          </>
        ) : null}
      </ScrollView>
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 70, gap: 12 },
  hero: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8, color: colors.greenDark, marginBottom: 4 },
  guardCard: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#D5E7DC', backgroundColor: '#EEF8F2' },
  guardTitle: { fontSize: 14, fontWeight: '900', color: colors.text },
  guardText: { marginTop: 4, fontSize: 11.5, lineHeight: 17, color: colors.muted },
  operationsButton: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.greenDark },
  operationsTitle: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  operationsSubtitle: { marginTop: 2, color: 'rgba(255,255,255,0.78)', fontSize: 9.5, lineHeight: 13 },
  loadingCard: { padding: 28, alignItems: 'center', gap: 10, backgroundColor: colors.white, borderRadius: 14 },
  errorTitle: { fontSize: 15, fontWeight: '900', color: colors.text },
  muted: { fontSize: 11.5, lineHeight: 17, color: colors.muted },
  retryButton: { marginTop: 4, backgroundColor: colors.greenDark, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  retryText: { color: colors.white, fontWeight: '900', fontSize: 11 },
  section: { gap: 8, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
  sectionSubtitle: { marginTop: -4, fontSize: 11, lineHeight: 16, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { minWidth: 145, flexGrow: 1, flexBasis: '30%', padding: 13, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  metricValue: { fontSize: 18, fontWeight: '900', color: colors.greenDark },
  metricLabel: { marginTop: 5, fontSize: 10.5, fontWeight: '800', color: colors.text },
  metricNote: { marginTop: 3, fontSize: 9.5, color: colors.muted },
  emptyCard: { padding: 14, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  emptyTitle: { fontSize: 13, fontWeight: '900', color: colors.text, marginBottom: 4 },
  tableCard: { borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, padding: 12 },
  tableTitle: { fontSize: 12.5, fontWeight: '900', color: colors.text, marginBottom: 7 },
  shareRow: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
  shareName: { fontSize: 11.5, fontWeight: '800', color: colors.text },
  shareMeta: { marginTop: 2, fontSize: 9.5, color: colors.muted },
  shareAmount: { fontSize: 12, fontWeight: '900', color: colors.greenDark },
  flagCard: { padding: 12, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  flagRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: 1, borderTopColor: colors.line },
  flagDot: { width: 9, height: 9, borderRadius: 5 },
  flagDotOn: { backgroundColor: '#2F8B59' },
  flagDotOff: { backgroundColor: '#AAB3AE' },
  flagLabel: { flex: 1, fontSize: 11, color: colors.text, textTransform: 'capitalize' },
  flagState: { fontSize: 9.5, fontWeight: '900', color: colors.muted },
  flagStateOn: { color: '#2F8B59' },
  checkRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: colors.line },
  checkKey: { flex: 1, fontSize: 10.5, color: colors.text, textTransform: 'capitalize' },
  checkValue: { maxWidth: '38%', fontSize: 9.5, fontWeight: '800', color: colors.muted },
  statusColumns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusCard: { minWidth: 220, flex: 1, padding: 12, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  smallRow: { minHeight: 32, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.line },
  smallLabel: { flex: 1, fontSize: 10, color: colors.muted, textTransform: 'capitalize' },
  smallValue: { fontSize: 11, fontWeight: '900', color: colors.text },
});