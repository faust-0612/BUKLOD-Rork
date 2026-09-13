import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import {
  adminAddBuklodR38FinancialEntry,
  adminCreateBuklodR38EconomicPeriod,
  adminFinalizeBuklodR38EconomicPeriod,
  adminGetBuklodR38PayoutDetails,
  adminListBuklodR38Withdrawals,
  adminMarkBuklodR38WithdrawalPaid,
  adminReconcileBuklodR38Referrals,
  adminReviewBuklodR38Withdrawal,
  adminSetBuklodR38PeriodStatus,
  type BuklodR38AdminWithdrawalQueue,
  type BuklodR38PayoutDetails,
} from '@/lib/buklodR38AdminEconomy';
import {
  formatPhp,
  loadAdminBuklodR38EconomyReport,
  type BuklodR38AdminEconomyReport,
} from '@/lib/buklodR38Economy';
import { colors } from '@/lib/theme';

const ENTRY_KINDS = [
  'REVENUE',
  'INFRASTRUCTURE',
  'DATABASE',
  'STORAGE',
  'BANDWIDTH',
  'MEDIA',
  'AI_TTS',
  'PAYMENT_PROCESSING',
  'PLATFORM_FEE',
  'INVALID_TRAFFIC',
  'REFUND_CHARGEBACK',
  'OPERATIONAL_COST',
  'TAX_STATUTORY',
  'OTHER_COST',
  'ADJUSTMENT',
] as const;

function defaultMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = new Date(year, month, 1, 0, 0, 0, 0);
  const end = new Date(year, month + 1, 1, 0, 0, 0, 0);
  return {
    key: `${year}-${String(month + 1).padStart(2, '0')}`,
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function ActionButton({
  title,
  icon,
  onPress,
  disabled = false,
  danger = false,
}: {
  title: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        danger && styles.dangerButton,
        disabled && styles.disabledButton,
        pressed && !disabled && { opacity: 0.75 },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={16} color="#FFFFFF" />
      <Text style={styles.actionText}>{title}</Text>
    </Pressable>
  );
}

export default function AdminEconomyOperationsScreen() {
  const month = useMemo(defaultMonth, []);
  const [report, setReport] = useState<BuklodR38AdminEconomyReport | null>(null);
  const [queue, setQueue] = useState<BuklodR38AdminWithdrawalQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [periodKey, setPeriodKey] = useState(month.key);
  const [periodStart, setPeriodStart] = useState(month.start);
  const [periodEnd, setPeriodEnd] = useState(month.end);
  const [periodNotes, setPeriodNotes] = useState('');

  const [direction, setDirection] = useState<'revenue' | 'cost'>('revenue');
  const [entryKind, setEntryKind] = useState<string>('REVENUE');
  const [amount, setAmount] = useState('');
  const [sourceSystem, setSourceSystem] = useState('manual_admin');
  const [externalReference, setExternalReference] = useState('');
  const [entryState, setEntryState] = useState<'ESTIMATED' | 'RECONCILED'>('ESTIMATED');

  const [selectedPayout, setSelectedPayout] = useState<BuklodR38PayoutDetails | null>(null);
  const [transactionRef, setTransactionRef] = useState('');

  const load = useCallback(async () => {
    try {
      setError(null);
      const [nextReport, nextQueue] = await Promise.all([
        loadAdminBuklodR38EconomyReport(),
        adminListBuklodR38Withdrawals(),
      ]);
      setReport(nextReport);
      setQueue(nextQueue);
      const key = nextReport.period?.period_key;
      if (typeof key === 'string' && key.trim()) setPeriodKey(key);
    } catch (nextError: unknown) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load R38 operations.');
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

  const currentStatus = String(report?.period?.status ?? 'NO PERIOD');
  const activation = report?.activation ?? {};
  const canFinalize = activation.financial_finalization_enabled === true && currentStatus === 'READY_FOR_FINALIZATION';
  const payoutEnabled = activation.payout_processing_enabled === true;

  const run = async (key: string, work: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await work();
      await load();
      Alert.alert('R38 Economy', success);
    } catch (nextError: unknown) {
      Alert.alert('R38 Economy', nextError instanceof Error ? nextError.message : 'Operation failed.');
    } finally {
      setBusy(null);
    }
  };

  const createPeriod = () => {
    void run(
      'period',
      () => adminCreateBuklodR38EconomicPeriod({
        periodKey,
        startIso: periodStart,
        endIso: periodEnd,
        notes: periodNotes,
      }),
      'Economic period created or loaded.',
    );
  };

  const addEntry = () => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      Alert.alert('Financial Entry', 'Enter a valid non-negative amount.');
      return;
    }
    void run(
      'entry',
      () => adminAddBuklodR38FinancialEntry({
        periodKey,
        entryKind,
        direction,
        amount: numericAmount,
        sourceSystem,
        externalReference,
        reconciliationState: entryState,
      }),
      'Financial entry recorded.',
    );
  };

  const setPeriodStatus = (status: 'OPEN' | 'ESTIMATING' | 'RECONCILING' | 'READY_FOR_FINALIZATION') => {
    void run(
      `status-${status}`,
      () => adminSetBuklodR38PeriodStatus(periodKey, status, 'Changed from R38 admin operations console'),
      `Period moved to ${status}.`,
    );
  };

  const finalize = () => {
    if (!canFinalize) return;
    Alert.alert(
      'Finalize Funded Economy Period?',
      'This creates immutable finalized user cash shares from reconciled funded platform revenue. Points are not used. Continue only after all real revenue and costs are reconciled.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finalize',
          style: 'destructive',
          onPress: () => void run(
            'finalize',
            () => adminFinalizeBuklodR38EconomicPeriod(periodKey, 'System Admin finalization from operations console'),
            'Economic period finalized.',
          ),
        },
      ],
    );
  };

  const revealPayout = (withdrawalId: string) => {
    void (async () => {
      setBusy(`payout-${withdrawalId}`);
      try {
        setSelectedPayout(await adminGetBuklodR38PayoutDetails(withdrawalId));
        setTransactionRef('');
      } catch (nextError: unknown) {
        Alert.alert('Payout Details', nextError instanceof Error ? nextError.message : 'Could not access payout destination.');
      } finally {
        setBusy(null);
      }
    })();
  };

  const paySelected = () => {
    if (!selectedPayout || !transactionRef.trim() || !payoutEnabled) return;
    Alert.alert(
      'Confirm External Payment?',
      `${formatPhp(selectedPayout.requested_amount)} must already have been sent to ${selectedPayout.payout_method} ${selectedPayout.destination_masked}. Marking PAID records the transaction reference and consumes the reserved funded cash.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Paid',
          onPress: () => void run(
            'mark-paid',
            () => adminMarkBuklodR38WithdrawalPaid(selectedPayout.withdrawal_id, transactionRef),
            'Withdrawal marked paid.',
          ).then(() => setSelectedPayout(null)),
        },
      ],
    );
  };

  return (
    <AdminGate>
      <ScrollView
        style={shared.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <MaterialCommunityIcons name="arrow-left" size={19} color={colors.greenDark} />
          <Text style={styles.backText}>BACK</Text>
        </Pressable>

        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>SYSTEM ADMIN · R38 OPERATIONS</Text>
            <Text style={shared.h1}>Economy Operations</Text>
            <Text style={shared.muted}>
              Prepare real revenue periods, reconcile costs, finalize only when the central gate is active, and process funded referral withdrawals.
            </Text>
          </View>
          <MaterialCommunityIcons name="bank-cog" size={30} color={colors.greenDark} />
        </View>

        <View style={styles.guardCard}>
          <MaterialCommunityIcons name="shield-lock-outline" size={22} color={colors.greenDark} />
          <Text style={styles.guardText}>
            This console contains no activation switches and no point-conversion controls. Financial finalization and payout remain impossible while their server gates are OFF.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.greenDark} />
            <Text style={styles.muted}>Loading R38 operations...</Text>
          </View>
        ) : error ? (
          <View style={styles.loadingCard}>
            <Text style={styles.errorTitle}>Operations unavailable</Text>
            <Text style={styles.muted}>{error}</Text>
            <ActionButton title="TRY AGAIN" icon="refresh" onPress={() => void load()} />
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Activation state</Text>
              <View style={styles.flagGrid}>
                {[
                  ['RCU accrual', activation.rcu_accrual_enabled],
                  ['Estimated economics', activation.estimated_economics_enabled],
                  ['Financial finalization', activation.financial_finalization_enabled],
                  ['Referral withdrawal', activation.referral_withdrawal_enabled],
                  ['Payout processing', activation.payout_processing_enabled],
                ].map(([label, enabled]) => (
                  <View key={String(label)} style={styles.flagRow}>
                    <View style={[styles.dot, enabled === true ? styles.dotOn : styles.dotOff]} />
                    <Text style={styles.flagLabel}>{String(label)}</Text>
                    <Text style={styles.flagValue}>{enabled === true ? 'ON' : 'OFF'}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Economic period</Text>
              <Text style={styles.muted}>Current status: {currentStatus}</Text>
              <TextInput value={periodKey} onChangeText={setPeriodKey} placeholder="Period key, e.g. 2026-09" style={styles.input} autoCapitalize="characters" />
              <TextInput value={periodStart} onChangeText={setPeriodStart} placeholder="Start ISO timestamp" style={styles.input} autoCapitalize="none" />
              <TextInput value={periodEnd} onChangeText={setPeriodEnd} placeholder="End ISO timestamp" style={styles.input} autoCapitalize="none" />
              <TextInput value={periodNotes} onChangeText={setPeriodNotes} placeholder="Notes (optional)" style={styles.input} />
              <ActionButton title={busy === 'period' ? 'WORKING...' : 'CREATE / LOAD PERIOD'} icon="calendar-plus" onPress={createPeriod} disabled={!!busy} />
              <View style={styles.actionWrap}>
                <ActionButton title="RECONCILING" icon="sync" onPress={() => setPeriodStatus('RECONCILING')} disabled={!!busy || !report?.period} />
                <ActionButton title="READY TO FINALIZE" icon="check-decagram-outline" onPress={() => setPeriodStatus('READY_FOR_FINALIZATION')} disabled={!!busy || !report?.period} />
              </View>
              <ActionButton title="FINALIZE FUNDED PERIOD" icon="lock-check-outline" onPress={finalize} disabled={!!busy || !canFinalize} danger />
              {!canFinalize && (
                <Text style={styles.warningText}>
                  Finalization remains locked unless the period is READY_FOR_FINALIZATION and the centralized financial finalization gate is ON.
                </Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Record platform revenue / cost</Text>
              <View style={styles.segmentRow}>
                {(['revenue', 'cost'] as const).map((value) => (
                  <Pressable key={value} onPress={() => {
                    setDirection(value);
                    if (value === 'revenue' && entryKind !== 'ADJUSTMENT') setEntryKind('REVENUE');
                    if (value === 'cost' && entryKind === 'REVENUE') setEntryKind('OPERATIONAL_COST');
                  }} style={[styles.segment, direction === value && styles.segmentActive]}>
                    <Text style={[styles.segmentText, direction === value && styles.segmentTextActive]}>{value.toUpperCase()}</Text>
                  </Pressable>
                ))}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {ENTRY_KINDS.filter((kind) => direction === 'revenue' ? kind === 'REVENUE' || kind === 'ADJUSTMENT' : kind !== 'REVENUE').map((kind) => (
                  <Pressable key={kind} onPress={() => setEntryKind(kind)} style={[styles.chip, entryKind === kind && styles.chipActive]}>
                    <Text style={[styles.chipText, entryKind === kind && styles.chipTextActive]}>{kind.replace(/_/g, ' ')}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <TextInput value={amount} onChangeText={setAmount} placeholder="Amount in PHP" keyboardType="decimal-pad" style={styles.input} />
              <TextInput value={sourceSystem} onChangeText={setSourceSystem} placeholder="Source system (e.g. AdMob, manual_admin)" style={styles.input} />
              <TextInput value={externalReference} onChangeText={setExternalReference} placeholder="External reference / invoice / statement ID" style={styles.input} />
              <View style={styles.segmentRow}>
                {(['ESTIMATED', 'RECONCILED'] as const).map((value) => (
                  <Pressable key={value} onPress={() => setEntryState(value)} style={[styles.segment, entryState === value && styles.segmentActive]}>
                    <Text style={[styles.segmentText, entryState === value && styles.segmentTextActive]}>{value}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.muted}>
                Use RECONCILED only for actual recognized revenue/cost supported by the provider statement or real bill. Estimated entries cannot be finalized.
              </Text>
              <ActionButton title={busy === 'entry' ? 'RECORDING...' : 'ADD FINANCIAL ENTRY'} icon="database-plus-outline" onPress={addEntry} disabled={!!busy || !report?.period} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Current revenue chain</Text>
              <View style={styles.metrics}>
                <View style={styles.metric}><Text style={styles.metricValue}>{formatPhp(report?.revenue_chain?.actual_reconciled_revenue)}</Text><Text style={styles.metricLabel}>Revenue</Text></View>
                <View style={styles.metric}><Text style={styles.metricValue}>{formatPhp(report?.revenue_chain?.actual_reconciled_costs)}</Text><Text style={styles.metricLabel}>Costs</Text></View>
                <View style={styles.metric}><Text style={styles.metricValue}>{formatPhp(report?.revenue_chain?.distributable_base)}</Text><Text style={styles.metricLabel}>Distributable Base</Text></View>
              </View>
              <Pressable onPress={() => router.push('/admin/bayanihan' as any)} style={styles.reportLink}>
                <MaterialCommunityIcons name="chart-box-outline" size={17} color={colors.greenDark} />
                <Text style={styles.reportLinkText}>OPEN FULL ECONOMY REPORT</Text>
              </Pressable>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Referral qualification</Text>
              <Text style={styles.muted}>Recompute server-side direct referral states. This does not mint RCU while the RCU gate is OFF.</Text>
              <ActionButton title={busy === 'referrals' ? 'RECONCILING...' : 'RECONCILE REFERRALS'} icon="account-sync-outline" onPress={() => void run('referrals', () => adminReconcileBuklodR38Referrals(), 'Referral states reconciled.')} disabled={!!busy} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Withdrawal queue</Text>
              <Text style={styles.muted}>
                Payout destinations remain masked during review. Full destination access is blocked until payout processing is ON and the withdrawal is approved.
              </Text>
              {queue?.rows.length ? queue.rows.map((row) => (
                <View key={row.id} style={styles.withdrawalCard}>
                  <View style={styles.withdrawalHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.withdrawalName}>{row.full_name}</Text>
                      <Text style={styles.muted}>{row.payout_method || '—'} · {row.payout_destination_masked || 'No destination'} · {row.status}</Text>
                    </View>
                    <Text style={styles.withdrawalAmount}>{formatPhp(row.requested_amount)}</Text>
                  </View>
                  {['REQUESTED', 'UNDER_REVIEW'].includes(row.status) && (
                    <View style={styles.actionWrap}>
                      <ActionButton title="APPROVE" icon="check" onPress={() => void run(`approve-${row.id}`, () => adminReviewBuklodR38Withdrawal(row.id, true, 'Approved from R38 operations console'), 'Withdrawal approved.')} disabled={!!busy} />
                      <ActionButton title="REJECT" icon="close" onPress={() => void run(`reject-${row.id}`, () => adminReviewBuklodR38Withdrawal(row.id, false, 'Rejected by System Admin'), 'Withdrawal rejected and reserved cash released.')} disabled={!!busy} danger />
                    </View>
                  )}
                  {['APPROVED', 'PROCESSING'].includes(row.status) && (
                    <ActionButton title="ACCESS PAYOUT DESTINATION" icon="eye-lock-outline" onPress={() => revealPayout(row.id)} disabled={!!busy || !payoutEnabled} />
                  )}
                </View>
              )) : <Text style={styles.muted}>No withdrawal requests.</Text>}
            </View>

            {selectedPayout ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Authorized payout details</Text>
                <View style={styles.sensitiveCard}>
                  <MaterialCommunityIcons name="shield-key-outline" size={22} color={colors.greenDark} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.withdrawalName}>{selectedPayout.account_name}</Text>
                    <Text style={styles.sensitiveValue}>{selectedPayout.payout_method} · {selectedPayout.destination}</Text>
                    <Text style={styles.muted}>{formatPhp(selectedPayout.requested_amount)} · {selectedPayout.status}</Text>
                  </View>
                </View>
                <TextInput value={transactionRef} onChangeText={setTransactionRef} placeholder="External payout transaction reference" style={styles.input} />
                <ActionButton title="MARK PAID AFTER EXTERNAL TRANSFER" icon="cash-check" onPress={paySelected} disabled={!payoutEnabled || !transactionRef.trim() || !!busy} danger />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 90, gap: 13 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 5 },
  backText: { fontSize: 10.5, fontWeight: '900', color: colors.greenDark },
  hero: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 0.9, color: colors.greenDark },
  guardCard: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 14, borderWidth: 1, borderColor: '#D5E7DC', backgroundColor: '#EEF8F2', borderRadius: 14 },
  guardText: { flex: 1, fontSize: 11.5, lineHeight: 17, color: colors.muted },
  loadingCard: { padding: 26, alignItems: 'center', gap: 10, backgroundColor: colors.white, borderRadius: 14 },
  errorTitle: { fontSize: 15, fontWeight: '900', color: colors.text },
  muted: { fontSize: 11, lineHeight: 16, color: colors.muted },
  section: { gap: 9, paddingTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
  flagGrid: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 13, padding: 11 },
  flagRow: { minHeight: 35, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: colors.line },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOn: { backgroundColor: '#2F8B59' },
  dotOff: { backgroundColor: '#AAB3AE' },
  flagLabel: { flex: 1, fontSize: 11, color: colors.text },
  flagValue: { fontSize: 10, fontWeight: '900', color: colors.muted },
  input: { minHeight: 44, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 10, paddingHorizontal: 12, fontSize: 12, color: colors.text },
  actionButton: { minHeight: 42, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.greenDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, flexGrow: 1 },
  dangerButton: { backgroundColor: '#7C3B35' },
  disabledButton: { backgroundColor: '#9EA7A2', opacity: 0.65 },
  actionText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '900', textAlign: 'center' },
  actionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  warningText: { fontSize: 10.5, lineHeight: 15, color: '#8A5B19' },
  segmentRow: { flexDirection: 'row', gap: 7 },
  segment: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  segmentActive: { backgroundColor: '#E8F4EC', borderColor: '#9BC6AA' },
  segmentText: { fontSize: 10, fontWeight: '900', color: colors.muted },
  segmentTextActive: { color: colors.greenDark },
  chips: { gap: 6, paddingVertical: 2 },
  chip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  chipActive: { backgroundColor: '#E8F4EC', borderColor: '#9BC6AA' },
  chipText: { fontSize: 9.5, fontWeight: '800', color: colors.muted },
  chipTextActive: { color: colors.greenDark },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  metric: { flex: 1, minWidth: 135, minHeight: 82, justifyContent: 'center', padding: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 12 },
  metricValue: { fontSize: 16, fontWeight: '900', color: colors.greenDark },
  metricLabel: { marginTop: 4, fontSize: 10, fontWeight: '800', color: colors.muted },
  reportLink: { minHeight: 42, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#EEF8F2', borderWidth: 1, borderColor: '#D5E7DC' },
  reportLinkText: { fontSize: 10.5, fontWeight: '900', color: colors.greenDark },
  withdrawalCard: { padding: 12, gap: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 12 },
  withdrawalHeader: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  withdrawalName: { fontSize: 12.5, fontWeight: '900', color: colors.text },
  withdrawalAmount: { fontSize: 13, fontWeight: '900', color: colors.greenDark },
  sensitiveCard: { flexDirection: 'row', gap: 10, padding: 13, borderWidth: 1, borderColor: '#D5E7DC', backgroundColor: '#EEF8F2', borderRadius: 12 },
  sensitiveValue: { marginTop: 3, fontSize: 14, fontWeight: '900', color: colors.text },
});
