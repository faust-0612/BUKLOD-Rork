import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { AdminGate } from '@/components/AdminGate';
import { shared } from '@/components/UI';
import { formatMinorPhp } from '@/lib/buklodCommunityContributionEconomy';
import {
  financeMoneyOrUnavailable,
  hasFinalizedFinanceMonth,
  isEconomyMonth,
  loadCanonicalAdminEconomy,
  manilaEconomyMonth,
  type CanonicalAdminEconomySnapshot,
} from '@/lib/buklodCanonicalAdminEconomy';
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

function safeCount(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value.toLocaleString('en-PH') : '—';
}

export default function AdminBayanihanScreen() {
  const [monthKey, setMonthKey] = useState(manilaEconomyMonth);
  const [draftMonth, setDraftMonth] = useState(monthKey);
  const [report, setReport] = useState<CanonicalAdminEconomySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSerial = useRef(0);

  const load = useCallback(async () => {
    const generation = ++requestSerial.current;
    setLoading(true);
    setReport(null);
    setError(null);
    try {
      const next = await loadCanonicalAdminEconomy(monthKey);
      if (generation === requestSerial.current) setReport(next);
    } catch (nextError: unknown) {
      if (generation === requestSerial.current) {
        setError(nextError instanceof Error ? nextError.message : 'Canonical finance report unavailable.');
      }
    } finally {
      if (generation === requestSerial.current) setLoading(false);
    }
  }, [monthKey]);

  useEffect(() => {
    void load();
    return () => { requestSerial.current++; };
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const selectMonth = () => {
    const next = draftMonth.trim();
    if (!isEconomyMonth(next)) {
      setError('Enter a valid Manila month using YYYY-MM (01-12).');
      return;
    }
    if (next === monthKey) void load();
    else setMonthKey(next);
  };

  const finance = report?.finance;
  const qmp = report?.qmp;
  const provisional = report?.admob_provisional;
  const settlement = finance?.settlement ?? null;
  const finalized = hasFinalizedFinanceMonth(report);
  const money = (value: unknown) => financeMoneyOrUnavailable(value, finalized);
  const policy = finance?.policy;

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
            <Text style={styles.eyebrow}>SYSTEM ADMIN · CANONICAL ECONOMY</Text>
            <Text style={shared.h1}>Economy, QMP & Earnings</Text>
            <Text style={shared.muted}>
              Finance V3 is the only actual earnings and settlement ledger. QMP is a monthly weight; provisional AdMob is not cash.
            </Text>
          </View>
          <MaterialCommunityIcons name="finance" size={31} color={colors.greenDark} />
        </View>

        <View style={styles.guardCard}>
          <MaterialCommunityIcons name="shield-lock-outline" size={23} color={colors.greenDark} />
          <View style={{ flex: 1 }}>
            <Text style={styles.guardTitle}>Hard economic invariant · One authoritative source</Text>
            <Text style={styles.guardText}>
              Legacy R38 BCU/RCU allocations and Community Wall analytics are excluded from cash totals. Never infer pesos from points or from preliminary ad income.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Manila reporting month</Text>
          <Text style={styles.sectionSubtitle}>
            Only the loaded month is displayed. Changing this field does not silently mix or refresh other periods.
          </Text>
          <TextInput
            value={draftMonth}
            onChangeText={setDraftMonth}
            placeholder="YYYY-MM"
            autoCapitalize="none"
            style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 10, color: colors.text }}
          />
          <Pressable onPress={selectMonth} style={styles.operationsButton}>
            <MaterialCommunityIcons name="calendar-search" size={18} color="#FFFFFF" />
            <Text style={styles.operationsTitle}>LOAD CANONICAL MONTH</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.push('/admin/economy-operations' as any)}
          style={({ pressed }) => [styles.operationsButton, pressed && { opacity: 0.78 }]}
        >
          <MaterialCommunityIcons name="finance" size={19} color="#FFFFFF" />
          <View style={{ flex: 1 }}>
            <Text style={styles.operationsTitle}>OPEN ECONOMY OPERATIONS</Text>
            <Text style={styles.operationsSubtitle}>Finance V3 journal, actual settlement controls and canonical withdrawal queue</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#FFFFFF" />
        </Pressable>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.greenDark} />
            <Text style={styles.muted}>Synchronizing {monthKey} canonical finance sources...</Text>
          </View>
        ) : error ? (
          <View style={styles.loadingCard}>
            <Text style={styles.errorTitle}>Economy report unavailable</Text>
            <Text style={styles.muted}>{error}</Text>
            <Pressable onPress={() => void load()} style={styles.retryButton}>
              <Text style={styles.retryText}>TRY AGAIN</Text>
            </Pressable>
          </View>
        ) : report ? (
          <>
            <Section title="Finance V3 · canonical settlement" subtitle={`Period ${report.period_key} · ${finalized ? 'FINALIZED' : 'NOT FINALIZED'} · Source: Finance V3`}>
              <View style={styles.grid}>
                <Metric label="Eligible revenue" value={money(settlement?.normal_eligible_revenue_php)} />
                <Metric label="30% User Pool" value={money(settlement?.user_pool_php)} />
                <Metric label="User pool distributed" value={money(settlement?.user_pool_distributed_php)} />
                <Metric label="User pool reserved" value={money(settlement?.user_pool_reserved_php)} />
                <Metric label="First-line referral" value={money(settlement?.first_line_php)} />
                <Metric label="Cluster / Organization Fund" value={money(settlement?.community_fund_php)} />
                <Metric label="BUKLOD retained" value={money(settlement?.buklod_retained_php)} />
                <Metric label="Operating costs" value={money(settlement?.operating_cost_php)} />
                <Metric label="Tax reserve" value={money(settlement?.tax_reserve_php)} />
                <Metric label="Final net" value={money(settlement?.estimated_final_net_php)} />
              </View>
              {!finalized && <Text style={styles.muted}>No finalized settlement for this month. A missing settlement is not ₱0 revenue and no user cash can be inferred from it.</Text>}
            </Section>

            <Section title="Monthly QMP · source qualification" subtitle="Automatic source-verified participation weights; not BP or a cash wallet.">
              {qmp?.period_exists ? (
                <View style={styles.grid}>
                  <Metric label="Qualified QMP" value={safeCount(qmp.qualified_monthly_qmp)} />
                  <Metric label="Qualified members" value={safeCount(qmp.qualified_users)} />
                  <Metric label="Unlinked identities" value={safeCount(qmp.unlinked_finance_identities)} />
                  <Metric label="Pending validation" value={safeCount(qmp.pending_qmp_reviews)} />
                  <Metric label="Held for risk" value={safeCount(qmp.held_qmp_reviews)} />
                  <Metric label="Eligible revenue records" value={safeCount(qmp.reconciled_eligible_revenue_sources)} />
                </View>
              ) : <Text style={styles.muted}>No QMP period has been created for this month.</Text>}
              <Text style={styles.muted}>Finance readiness: {qmp?.ready_for_finalization === true ? 'PASS' : 'LOCKED / NOT READY'}. A report does not activate settlement or payout.</Text>
            </Section>

            <Section title="Provisional AdMob · separate noncash estimate" subtitle="Official provider/admin snapshot only; never added to finalized Finance totals.">
              {provisional ? (
                <View style={styles.grid}>
                  <Metric label="Estimated AdMob revenue" value={formatMinorPhp(provisional.amount_minor)} />
                  <Metric label="Source" value={provisional.source_mode === 'OFFICIAL_ADMOB_API' ? 'Official AdMob' : 'Admin report'} />
                </View>
              ) : <Text style={styles.muted}>No provider-backed preliminary snapshot for {monthKey}. No amount has been assumed.</Text>}
              {!!provisional && <Text style={styles.muted}>Reported {new Date(provisional.observed_at).toLocaleString('en-PH')} · {provisional.source_reference}</Text>}
            </Section>

            <Section title="Finance V3 allocation policy" subtitle="Live canonical policy, not retired R38 BCU/RCU pool percentages.">
              <View style={styles.grid}>
                <Metric label="Monthly user pool" value={policy ? `${policy.user_pool_pct}%` : '—'} />
                <Metric label="First-line" value={policy ? `${policy.first_line_pct}%` : '—'} />
                <Metric label="Cluster fund" value={policy ? `${policy.cluster_pct}%` : '—'} />
                <Metric label="Organization fund" value={policy ? `${policy.organization_pct}%` : '—'} />
              </View>
              <Text style={styles.muted}>Community fund tier is either Cluster or Organization for eligible allocations, never both.</Text>
            </Section>

            <Section title="Actual financial journal" subtitle="Only Finance V3 source records. Entries are not automatically finalized revenue.">
              {finance?.financial_entries.length ? (
                finance.financial_entries.slice(0, 20).map(entry => (
                  <View key={entry.id} style={styles.checkRow}>
                    <Text style={styles.checkKey}>{entry.entry_type.replace(/_/g, ' ')} · {entry.reconciliation_state} · {entry.direction}</Text>
                    <Text style={styles.checkValue}>
                      {typeof entry.amount_php === 'number' && Number.isFinite(entry.amount_php)
                        ? entry.amount_php.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })
                        : '—'}
                    </Text>
                  </View>
                ))
              ) : <Text style={styles.muted}>No canonical financial journal entries for {monthKey}.</Text>}
            </Section>

            <Section title="Finalized distribution" subtitle="Amounts below are published only after an actual finalized settlement.">
              <View style={styles.grid}>
                <Metric label="Settled user shares" value={finalized ? safeCount(finance?.user_shares.length) : '—'} />
                <Metric label="Community allocations" value={finalized ? safeCount(finance?.community_allocations.length) : '—'} />
                <Metric label="Finalized QMP weight" value={finalized ? safeCount(settlement?.qualified_monthly_points) : '—'} />
              </View>
            </Section>

            <Section title="Cash safety gates">
              <View style={styles.flagCard}>
                <FlagRow label="Economics" enabled={finance?.controls.economics_enabled === true} />
                <FlagRow label="Settlement" enabled={finance?.controls.settlement_enabled === true} />
                <FlagRow label="Withdrawal" enabled={finance?.controls.withdrawal_enabled === true} />
                <FlagRow label="Payout processing" enabled={finance?.controls.payout_processing_enabled === true} />
              </View>
              <Text style={styles.muted}>Minimum withdrawal and each actual member balance remain in the canonical Finance V3 payout workflow, not the retired R38 ledger.</Text>
            </Section>

            <Text style={styles.muted}>Synchronized snapshot for {report.period_key} · {new Date(report.generated_at).toLocaleString('en-PH')}</Text>
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