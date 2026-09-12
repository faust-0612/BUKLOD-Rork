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

function FlagRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <View style={styles.flagRow}>
      <View style={[styles.flagDot, enabled ? styles.flagDotOn : styles.flagDotOff]} />
      <Text style={styles.flagLabel}>{label}</Text>
      <Text style={[styles.flagState, enabled && styles.flagStateOn]}>
        {enabled ? 'ENABLED' : 'OFF'}
      </Text>
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
      setError(nextError instanceof Error ? nextError.message : 'Could not load R38 economy report.');
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
  const activation = report?.activation ?? {};
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
            <Text style={styles.eyebrow}>SYSTEM ADMIN · R38</Text>
            <Text style={shared.h1}>BUKLOD Economy & Bayanihan</Text>
            <Text style={shared.muted}>
              Platform revenue reconciliation, funded-pool allocation, BCU/RCU weights, finalized user shares and payout controls.
            </Text>
          </View>
          <MaterialCommunityIcons name="finance" size={31} color={colors.greenDark} />
        </View>

        <View style={styles.guardCard}>
          <MaterialCommunityIcons name="shield-lock-outline" size={23} color={colors.greenDark} />
          <View style={{ flex: 1 }}>
            <Text style={styles.guardTitle}>Hard economic invariant</Text>
            <Text style={styles.guardText}>
              Points, Circle Rank, Character, Collectibles, BCU and RCU never mint pesos. Cash may be created only from reconciled, finalized and funded platform revenue pools.
            </Text>
          </View>
        </View>

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
                <Metric label="Bayanihan 30%" value={formatPhp(revenue?.bayanihan_pool)} />
                <Metric label="Direct Referral 5%" value={formatPhp(revenue?.referral_pool)} />
                <Metric label="Founder 35%" value={formatPhp(revenue?.founder)} />
                <Metric label="Growth 20%" value={formatPhp(revenue?.growth)} />
                <Metric label="Reserve 10%" value={formatPhp(revenue?.reserve)} />
              </View>
            </Section>

            <Section
              title="Contribution Units"
              subtitle="BCU and RCU are proportional weights only. The effective PHP/unit shown after finalization is retrospective analytics, not a future rate."
            >
              <View style={styles.grid}>
                <Metric
                  label="Qualified BCU"
                  value={asMoney(report.qualified_units?.bcu).toLocaleString('en-PH', { maximumFractionDigits: 6 })}
                />
                <Metric
                  label="Qualified RCU"
                  value={asMoney(report.qualified_units?.rcu).toLocaleString('en-PH', { maximumFractionDigits: 6 })}
                />
                <Metric
                  label="Effective PHP / BCU"
                  value={report.effective_rates_analytics_only.php_per_bcu == null ? '—' : formatPhp(report.effective_rates_analytics_only.php_per_bcu)}
                  note="Analytics only"
                />
                <Metric
                  label="Effective PHP / RCU"
                  value={report.effective_rates_analytics_only.php_per_rcu == null ? '—' : formatPhp(report.effective_rates_analytics_only.php_per_rcu)}
                  note="Analytics only"
                />
              </View>
            </Section>

            <Section title="Finalized Distribution" subtitle={`${shareCount.toLocaleString('en-PH')} finalized user-share records in the selected period.`}>
              <View style={styles.grid}>
                <Metric label="Bayanihan Distributed" value={formatPhp(report.distributed.bayanihan)} />
                <Metric label="Referral Distributed" value={formatPhp(report.distributed.direct_referral)} />
                <Metric label="Cash Available" value={formatPhp(report.cash_ledger.available)} />
                <Metric label="Cash Reserved" value={formatPhp(report.cash_ledger.reserved)} />
                <Metric label="Cash Paid" value={formatPhp(report.cash_ledger.paid)} />
              </View>

              {report.user_shares.length ? (
                <View style={styles.tableCard}>
                  <Text style={styles.tableTitle}>Finalized user shares</Text>
                  {report.user_shares.slice(0, 50).map((item) => (
                    <View key={`${item.user_id}-${item.pool_key}`} style={styles.shareRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.shareName}>{item.full_name}</Text>
                        <Text style={styles.shareMeta}>
                          {item.pool_key === 'DIRECT_REFERRAL' ? 'Direct Referral' : 'Bayanihan'} · {asMoney(item.qualified_units).toLocaleString('en-PH', { maximumFractionDigits: 6 })} units
                        </Text>
                      </View>
                      <Text style={styles.shareAmount}>{formatPhp(item.finalized_share_amount)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </Section>

            <Section title="Activation Gates" subtitle="Money movement remains disabled until each controlled phase is explicitly activated.">
              <View style={styles.flagCard}>
                <FlagRow label="RCU accrual" enabled={activation.rcu_accrual_enabled === true} />
                <FlagRow label="Estimated economics" enabled={activation.estimated_economics_enabled === true} />
                <FlagRow label="Financial finalization" enabled={activation.financial_finalization_enabled === true} />
                <FlagRow label="Referral withdrawal" enabled={activation.referral_withdrawal_enabled === true} />
                <FlagRow label="Payout processing" enabled={activation.payout_processing_enabled === true} />
              </View>
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
