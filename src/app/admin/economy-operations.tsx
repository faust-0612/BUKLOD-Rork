import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  adminSetCommunityAdmobEstimate,
  formatMinorPhp,
} from '@/lib/buklodCommunityContributionEconomy';
import { shared } from '@/components/UI';
import {
  adminFailBuklodPfWithdrawal,
  adminFinalizeBuklodPfMonthV3,
  adminGetBuklodR38PayoutDetails,
  adminListBuklodR38Withdrawals,
  adminMarkBuklodPfWithdrawalProcessing,
  adminMarkBuklodR38WithdrawalPaid,
  adminRecordBuklodPfFinancialEntryV3,
  adminReviewBuklodR38Withdrawal,
  type BuklodR38AdminWithdrawalQueue,
  type BuklodR38PayoutDetails,
} from '@/lib/buklodR38AdminEconomy';
import { formatPhp } from '@/lib/buklodR38Economy';
import { financeMoneyOrUnavailable, isEconomyMonth, loadCanonicalAdminEconomy,
  manilaEconomyMonth, type CanonicalAdminEconomySnapshot } from '@/lib/buklodCanonicalAdminEconomy';
import { colors } from '@/lib/theme';

const ENTRY_KINDS = [
  'UNATTRIBUTED_ELIGIBLE_REVENUE',
  'REVENUE_REVERSAL',
  'OPERATING_COST',
  'INFRASTRUCTURE_COST',
  'PAYOUT_COST',
  'PAYMENT_PROCESSING_COST',
  'TAX_RESERVE',
  'OTHER_COST',
] as const;

function defaultMonth() { return { key: manilaEconomyMonth() }; }

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
  const [snapshot, setSnapshot] = useState<CanonicalAdminEconomySnapshot | null>(null);
  const [queue, setQueue] =
    useState<BuklodR38AdminWithdrawalQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [periodKey, setPeriodKey] = useState(month.key);
  const [draftPeriodKey, setDraftPeriodKey] = useState(month.key);
  const requestSerial = useRef(0);
  const report = snapshot?.finance ?? null;
  const qmpReadiness = snapshot?.qmp ?? null;
  const admobPreview = snapshot?.admob_provisional ?? null;
  const [admobReportAmount, setAdmobReportAmount] = useState('');
  const [admobReportCurrency, setAdmobReportCurrency] = useState<'USD' | 'PHP'>('USD');
  const [admobUsdPhpRate, setAdmobUsdPhpRate] = useState('');
  const [admobSourceRef, setAdmobSourceRef] = useState('');

  const [entryKind, setEntryKind] =
    useState<(typeof ENTRY_KINDS)[number]>(
      'UNATTRIBUTED_ELIGIBLE_REVENUE',
    );
  const [amount, setAmount] = useState('');
  const [sourceSystem, setSourceSystem] =
    useState('manual_admin');
  const [externalReference, setExternalReference] =
    useState('');
  const [entryNotes, setEntryNotes] = useState('');
  const [entryState, setEntryState] =
    useState<'ESTIMATED' | 'RECONCILED' | 'REVERSED'>(
      'ESTIMATED',
    );

  const [selectedPayout, setSelectedPayout] = useState<BuklodR38PayoutDetails | null>(null);
  const [transactionRef, setTransactionRef] = useState('');

  const load = useCallback(async () => {
    const generation = ++requestSerial.current;
    setSnapshot(null);
    setQueue(null);
    setLoading(true);
    setError(null);
    try {
      const [nextSnapshot, nextQueue] = await Promise.all([
        loadCanonicalAdminEconomy(periodKey),
        adminListBuklodR38Withdrawals(),
      ]);
      if (generation !== requestSerial.current) return;
      setSnapshot(nextSnapshot);
      setQueue(nextQueue);
    } catch (nextError: unknown) {
      if (generation !== requestSerial.current) return;
      setError(nextError instanceof Error ? nextError.message : 'Could not synchronize canonical BUKLOD Economy.');
    } finally {
      if (generation === requestSerial.current) setLoading(false);
    }
  }, [periodKey]);

  useEffect(() => {
    void load();
    return () => { requestSerial.current++; };
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const controls = report?.controls;
  const settlement = report?.settlement ?? null;
  const monthLoaded = draftPeriodKey.trim() === periodKey;
  const formatSettlement = (value: unknown) =>
    financeMoneyOrUnavailable(value, settlement?.status === 'FINALIZED');
  const currentStatus =
    settlement?.status ?? 'NOT FINALIZED';

  const canFinalize =
    !loading && !error && monthLoaded &&
    controls?.economics_enabled === true &&
    controls?.settlement_enabled === true &&
    qmpReadiness?.ready_for_finalization === true &&
    currentStatus !== 'FINALIZED';

  const payoutEnabled =
    queue?.payout_processing_enabled === true;

  const run = async (key: string, work: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await work();
      await load();
      Alert.alert('BUKLOD Economy', success);
    } catch (nextError: unknown) {
      Alert.alert('BUKLOD Economy', nextError instanceof Error ? nextError.message : 'Operation failed.');
    } finally {
      setBusy(null);
    }
  };

  const loadPeriod = () => {
    const next = draftPeriodKey.trim();
    if (!isEconomyMonth(next)) {
      Alert.alert('Finance Period', 'Enter a valid Manila month YYYY-MM (01-12).');
      return;
    }
    if (next !== periodKey) setPeriodKey(next);
    else void load();
  };

  const addEntry = () => {
    if (!monthLoaded || loading || !snapshot) {
      Alert.alert('Financial Entry', 'Load the selected month before recording an entry.');
      return;
    }
    const numericAmount = Number(amount);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount < 0
    ) {
      Alert.alert(
        'Financial Entry',
        'Enter a valid non-negative amount.',
      );
      return;
    }

    if (!/^\d{4}-\d{2}$/.test(periodKey.trim())) {
      Alert.alert(
        'Financial Entry',
        'Period must be YYYY-MM.',
      );
      return;
    }

    const direction: 'CREDIT' | 'DEBIT' =
      entryKind === 'UNATTRIBUTED_ELIGIBLE_REVENUE'
        ? 'CREDIT'
        : 'DEBIT';

    void run(
      'entry',
      () =>
        adminRecordBuklodPfFinancialEntryV3({
          periodKey,
          entryType: entryKind,
          direction,
          amount: numericAmount,
          sourceSystem,
          externalReference,
          reconciliationState: entryState,
          notes: entryNotes,
        }),
      'Canonical financial entry recorded.',
    ).then(() => {
      setAmount('');
      setExternalReference('');
      setEntryNotes('');
    });
  };

  const publishAdmobPreview = () => {
    if (!monthLoaded || loading || !snapshot) {
      Alert.alert('AdMob estimate', 'Load the selected month before saving a provisional estimate.');
      return;
    }
    const amount = Number(admobReportAmount.trim());
    const rate = admobReportCurrency === 'USD' ? Number(admobUsdPhpRate.trim()) : 1;
    const php = Math.round(amount * rate * 100) / 100;
    const reference = [
      admobSourceRef.trim(),
      `AdMob ${admobReportCurrency} ${amount.toFixed(6)}`,
      admobReportCurrency === 'USD' ? `FX PHP ${rate.toFixed(4)}/USD` : 'PHP report',
    ].join(' | ');
    if (!/^\\d{4}-(0[1-9]|1[0-2])$/.test(periodKey.trim())
        || !admobReportAmount.trim() || !Number.isFinite(amount) || amount <= 0
        || !Number.isFinite(rate) || rate <= 0
        || !Number.isFinite(php) || php <= 0 || php > 1000000000
        || admobSourceRef.trim().length < 3 || reference.length > 240) {
      Alert.alert('AdMob preliminary estimate',
        'Enter a valid month, the AdMob estimated earnings, an exchange rate if in USD, and its report reference. The PHP equivalent must be at least ₱0.01.');
      return;
    }
    Alert.alert('Publish preliminary estimate?',
      `Source ${admobReportCurrency} ${amount.toFixed(4)} → PHP ${php.toFixed(2)}. Qualified users may see a changing possible QMP share. This does not finalize revenue, fund balances, or unlock withdrawals.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Publish estimate', onPress: () => void run(
          'admob-preview',
          () => adminSetCommunityAdmobEstimate({
            periodKey, amountPhp: php, sourceReference: reference,
          }),
          'AdMob preview saved. User estimates recalculate from the Community QMP weights; cash remains locked.',
        ) },
      ]);
  };

  const finalize = () => {
    if (!canFinalize) return;

    Alert.alert(
      'Finalize Canonical Finance Month?',
      'This runs the authoritative Finance V3 settlement. Only finalized eligible revenue enters the distribution engine. Qualified Monthly Points are weights only and do not create money. Finalization is idempotent and cannot be used while the server economics or settlement gate is OFF.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Finalize',
          style: 'destructive',
          onPress: () =>
            void run(
              'finalize',
              () =>
                adminFinalizeBuklodPfMonthV3(
                  periodKey,
                ),
              'Canonical Finance V3 month finalized.',
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
            <Text style={styles.eyebrow}>SYSTEM ADMIN Ã‚Â· ECONOMY OPERATIONS</Text>
            <Text style={shared.h1}>Economy Operations</Text>
            <Text style={shared.muted}>
              Record canonical eligible revenue and costs, inspect Finance V3 settlement state, finalize only through the authoritative server settlement engine, and process finalized-cash withdrawals.
            </Text>
          </View>
          <MaterialCommunityIcons name="finance" size={30} color={colors.greenDark} />
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
            <Text style={styles.muted}>Loading BUKLOD Economy operations...</Text>
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
              <Text style={styles.sectionTitle}>
                Canonical Finance V3 controls
              </Text>

              <Text style={styles.muted}>
                Policy {report?.policy?.version || 'canonical_finance_v3'} · User Pool {String(report?.policy?.user_pool_pct ?? 30)}% · First-line {String(report?.policy?.first_line_pct ?? 10)}% · Community {String(report?.policy?.cluster_pct ?? 5)}% / {String(report?.policy?.organization_pct ?? 7)}%
              </Text>

              <View style={styles.flagGrid}>
                {[
                  ['Economics', controls?.economics_enabled],
                  ['Settlement', controls?.settlement_enabled],
                  ['Withdrawal', controls?.withdrawal_enabled],
                  ['Payout processing', controls?.payout_processing_enabled],
                ].map(([label, enabled]) => (
                  <View
                    key={String(label)}
                    style={styles.flagRow}
                  >
                    <View
                      style={[
                        styles.dot,
                        enabled === true
                          ? styles.dotOn
                          : styles.dotOff,
                      ]}
                    />
                    <Text style={styles.flagLabel}>
                      {String(label)}
                    </Text>
                    <Text style={styles.flagValue}>
                      {enabled === true ? 'ON' : 'OFF'}
                    </Text>
                  </View>
                ))}
              </View>

              <TextInput
                value={draftPeriodKey}
                onChangeText={setDraftPeriodKey}
                autoCapitalize="none"
                placeholder="YYYY-MM"
                style={styles.input}
              />

              <View style={styles.actionWrap}>
                <ActionButton
                  title={
                    busy === 'period-load'
                      ? 'LOADING...'
                      : 'LOAD MONTH'
                  }
                  icon="calendar-search"
                  onPress={() => {
                    void loadPeriod();
                  }}
                  disabled={!!busy}
                />

                <ActionButton
                  title={
                    currentStatus === 'FINALIZED'
                      ? 'MONTH FINALIZED'
                      : 'FINALIZE CANONICAL MONTH'
                  }
                  icon="lock-check-outline"
                  onPress={finalize}
                  disabled={
                    !!busy ||
                    !canFinalize ||
                    currentStatus === 'FINALIZED'
                  }
                  danger
                />
              </View>

              <Text style={styles.muted}>
                Loaded month: {periodKey} · Settlement status: {currentStatus}
              </Text>
              {!monthLoaded && <Text style={styles.warningText}>
                Month field changed. Press LOAD MONTH before any finance action.
              </Text>}
              <Text style={styles.muted}>
                Finance V3, monthly QMP and provisional AdMob are synchronized in one source-consistent server snapshot.
              </Text>
              <Text style={styles.muted}>
                Automated QMP audit (source-backed): {qmpReadiness?.period_exists
                  ? `${qmpReadiness.qualified_users ?? 0} qualified users ·
                  ${qmpReadiness.qualified_monthly_qmp ?? 0} QMP ·
                  ${qmpReadiness.unlinked_finance_identities ?? 0} identity links missing ·

                  ${qmpReadiness.legacy_share_records ?? 0} legacy allocations ·
                  ${qmpReadiness.reconciled_eligible_revenue_sources ?? 0} verified revenue records`
                  : 'Not verified. Finalization remains locked.'}
              </Text>

              {!canFinalize &&
                currentStatus !== 'FINALIZED' && (
                  <Text style={styles.warningText}>
                    Finalization requires a completed Manila month, automated QMP checks, reconciled Finance identities,
                    verified eligible revenue, no legacy allocations, and enabled server economics and settlement gates.
                    Incomplete or missing readiness data never authorizes a payout.
                  </Text>
                )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>AdMob estimate · user QMP preview</Text>
              <Text style={styles.muted}>
                Enter the AdMob report amount and source. For a USD report, enter the documented PHP per USD exchange rate; BUKLOD converts the amount to PHP and recalculates qualified users' previews. It never credits cash or activates payouts.
              </Text>
              {admobPreview ? (
                <Text style={styles.muted}>
                  Current preliminary report (not finalized revenue): {formatMinorPhp(admobPreview.amount_minor)} · observed {new Date(admobPreview.observed_at).toLocaleString()} · {admobPreview.source_reference}
                </Text>
              ) : (
                <Text style={styles.warningText}>No preliminary AdMob report recorded for this month.</Text>
              )}
              <View style={styles.actionWrap}>
                <Pressable onPress={() => setAdmobReportCurrency('USD')} style={[styles.input, { paddingVertical: 9, backgroundColor: admobReportCurrency === 'USD' ? '#E9F6EE' : '#FFFFFF' }]}>
                  <Text>USD ($)</Text>
                </Pressable>
                <Pressable onPress={() => setAdmobReportCurrency('PHP')} style={[styles.input, { paddingVertical: 9, backgroundColor: admobReportCurrency === 'PHP' ? '#E9F6EE' : '#FFFFFF' }]}>
                  <Text>PHP (₱)</Text>
                </Pressable>
              </View>
              <TextInput
                value={admobReportAmount}
                onChangeText={setAdmobReportAmount}
                keyboardType="decimal-pad"
                placeholder={admobReportCurrency === 'USD' ? 'AdMob estimated earnings in USD' : 'AdMob estimated earnings in PHP'}
                style={styles.input}
              />
              {admobReportCurrency === 'USD' ? (
                <TextInput
                  value={admobUsdPhpRate}
                  onChangeText={setAdmobUsdPhpRate}
                  keyboardType="decimal-pad"
                  placeholder="PHP per USD exchange rate (documented)"
                  style={styles.input}
                />
              ) : null}
              {Number(admobReportAmount) > 0 && (admobReportCurrency === 'PHP' || Number(admobUsdPhpRate) > 0) ? (
                <Text style={styles.muted}>
                  Provisional revenue equivalent: {formatMinorPhp(Math.round(Number(admobReportAmount) * (admobReportCurrency === 'USD' ? Number(admobUsdPhpRate) : 1) * 100))}
                </Text>
              ) : null}
              <TextInput
                value={admobSourceRef}
                onChangeText={setAdmobSourceRef}
                placeholder="Official AdMob report reference"
                style={styles.input}
              />
              <ActionButton title={busy === 'admob-preview' ? 'SAVING...' : 'PUBLISH NON-CASH ESTIMATE'}
                icon="chart-line" onPress={publishAdmobPreview} disabled={!!busy || loading || !monthLoaded || !snapshot} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Funded System Admin Rewards</Text>
              <Text style={styles.muted}>
                Only real, separately funded and attested external receipts can support
                admin-to-user cash rewards. No Points or preliminary AdMob estimates
                are convertible here. Canonical payouts and withdrawals stay gated.
              </Text>
              <ActionButton
                title="OPEN FUNDED REWARDS"
                icon="cash-plus"
                onPress={() => router.push('/admin/funded-rewards' as any)}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Record canonical financial entry
              </Text>

              <Text style={styles.muted}>
                UNATTRIBUTED_ELIGIBLE_REVENUE is the only manual eligible-revenue credit here. Other entry types are debits for reversals, operating/infrastructure/payout/payment-processing costs, tax reserve, or other cost. Recording a value does not itself create user cash.
              </Text>

              <View style={styles.actionWrap}>
                {ENTRY_KINDS.map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => setEntryKind(value)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      borderRadius: 9,
                      borderWidth: 1,
                      borderColor:
                        entryKind === value
                          ? colors.greenDark
                          : colors.line,
                      backgroundColor:
                        entryKind === value
                          ? '#EEF8F2'
                          : colors.white,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 9.5,
                        fontWeight: '900',
                        color:
                          entryKind === value
                            ? colors.greenDark
                            : colors.text,
                      }}
                    >
                      {value.replace(/_/g, ' ')}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.muted}>
                Direction: {entryKind === 'UNATTRIBUTED_ELIGIBLE_REVENUE' ? 'CREDIT' : 'DEBIT'}
              </Text>

              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="Amount in PHP"
                style={styles.input}
              />

              <TextInput
                value={sourceSystem}
                onChangeText={setSourceSystem}
                placeholder="Source system"
                style={styles.input}
              />

              <TextInput
                value={externalReference}
                onChangeText={setExternalReference}
                placeholder="Provider / external reference"
                style={styles.input}
              />

              <TextInput
                value={entryNotes}
                onChangeText={setEntryNotes}
                placeholder="Notes / supporting reference"
                style={styles.input}
              />

              <View style={styles.actionWrap}>
                {(
                  [
                    'ESTIMATED',
                    'RECONCILED',
                    'REVERSED',
                  ] as const
                ).map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => setEntryState(value)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 9,
                      borderRadius: 9,
                      borderWidth: 1,
                      borderColor:
                        entryState === value
                          ? colors.greenDark
                          : colors.line,
                      backgroundColor:
                        entryState === value
                          ? '#EEF8F2'
                          : colors.white,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: '900',
                        color:
                          entryState === value
                            ? colors.greenDark
                            : colors.text,
                      }}
                    >
                      {value}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.muted}>
                Use RECONCILED only when supported by an actual provider statement, receipt, bill, or verified accounting record. ESTIMATED values do not enter final settlement.
              </Text>

              <ActionButton
                title={
                  busy === 'entry'
                    ? 'RECORDING...'
                    : 'ADD CANONICAL ENTRY'
                }
                icon="database-plus-outline"
                onPress={addEntry}
                disabled={
                  !!busy || loading || !monthLoaded || !snapshot
                }
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Canonical settlement summary
              </Text>

              <View
                style={[
                  styles.metrics,
                  { flexWrap: 'wrap' },
                ]}
              >
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>
                    {formatSettlement(settlement?.normal_eligible_revenue_php)}
                  </Text>
                  <Text style={styles.metricLabel}>
                    Eligible Revenue
                  </Text>
                </View>

                <View style={styles.metric}>
                  <Text style={styles.metricValue}>
                    {formatSettlement(settlement?.user_pool_php)}
                  </Text>
                  <Text style={styles.metricLabel}>
                    30% User Pool
                  </Text>
                </View>

                <View style={styles.metric}>
                  <Text style={styles.metricValue}>
                    {formatSettlement(settlement?.first_line_php)}
                  </Text>
                  <Text style={styles.metricLabel}>
                    First-line
                  </Text>
                </View>

                <View style={styles.metric}>
                  <Text style={styles.metricValue}>
                    {formatSettlement(settlement?.community_fund_php)}
                  </Text>
                  <Text style={styles.metricLabel}>
                    Community Fund
                  </Text>
                </View>

                <View style={styles.metric}>
                  <Text style={styles.metricValue}>
                    {formatSettlement(settlement?.buklod_retained_php)}
                  </Text>
                  <Text style={styles.metricLabel}>
                    BUKLOD Retained
                  </Text>
                </View>

                <View style={styles.metric}>
                  <Text style={styles.metricValue}>
                    {formatSettlement(settlement?.operating_cost_php)}
                  </Text>
                  <Text style={styles.metricLabel}>
                    Operating Cost
                  </Text>
                </View>

                <View style={styles.metric}>
                  <Text style={styles.metricValue}>
                    {formatSettlement(settlement?.tax_reserve_php)}
                  </Text>
                  <Text style={styles.metricLabel}>
                    Tax Reserve
                  </Text>
                </View>

                <View style={styles.metric}>
                  <Text style={styles.metricValue}>
                    {formatSettlement(settlement?.estimated_final_net_php)}
                  </Text>
                  <Text style={styles.metricLabel}>
                    Final Net
                  </Text>
                </View>
              </View>

              <Text style={styles.muted}>
                {settlement?.status === 'FINALIZED'
                  ? `Finalized QMP: ${settlement.qualified_monthly_points} · Settled users: ${report?.user_shares.length ?? 0} · Community allocations: ${report?.community_allocations.length ?? 0}`
                  : 'No finalized settlement. This is not a zero-revenue claim.'}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Financial entries for {periodKey}
              </Text>

              {report?.financial_entries?.length ? (
                report.financial_entries
                  .slice(0, 12)
                  .map((row) => (
                    <View
                      key={row.id}
                      style={styles.withdrawalCard}
                    >
                      <View style={styles.withdrawalHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.withdrawalName}>
                            {row.entry_type.replace(/_/g, ' ')}
                          </Text>
                          <Text style={styles.muted}>
                            {row.direction} · {row.reconciliation_state} · {row.source_system || 'No source'}
                          </Text>
                        </View>

                        <Text style={styles.withdrawalAmount}>
                          {formatPhp(row.amount_php)}
                        </Text>
                      </View>

                      {!!row.external_reference && (
                        <Text style={styles.muted}>
                          Ref: {row.external_reference}
                        </Text>
                      )}

                      {!!row.notes && (
                        <Text style={styles.muted}>
                          {row.notes}
                        </Text>
                      )}
                    </View>
                  ))
              ) : (
                <Text style={styles.muted}>
                  No canonical financial entries recorded for this month.
                </Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Withdrawal queue</Text>
              <Text style={styles.muted}>
                Payout destinations remain masked during review. An APPROVED request must enter PROCESSING before the full payout destination can be accessed.
              </Text>
              {queue?.rows.length ? queue.rows.map((row) => (
                <View key={row.id} style={styles.withdrawalCard}>
                  <View style={styles.withdrawalHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.withdrawalName}>{row.full_name}</Text>
                      <Text style={styles.muted}>{row.payout_method || 'Ã¢â‚¬â€'} Ã‚Â· {row.payout_destination_masked || 'No destination'} Ã‚Â· {row.status}</Text>
                    </View>
                    <Text style={styles.withdrawalAmount}>{formatPhp(row.requested_amount)}</Text>
                  </View>
                  {['REQUESTED', 'UNDER_REVIEW'].includes(row.status) && (
                    <View style={styles.actionWrap}>
                      <ActionButton title="APPROVE" icon="check" onPress={() => void run(`approve-${row.id}`, () => adminReviewBuklodR38Withdrawal(row.id, true, 'Approved from canonical BUKLOD Economy operations'), 'Withdrawal approved.')} disabled={!!busy} />
                      <ActionButton title="REJECT" icon="close" onPress={() => void run(`reject-${row.id}`, () => adminReviewBuklodR38Withdrawal(row.id, false, 'Rejected by System Admin'), 'Withdrawal rejected and reserved cash released.')} disabled={!!busy} danger />
                    </View>
                  )}
                  {row.status === 'APPROVED' && (
                    <ActionButton
                      title="START PROCESSING"
                      icon="progress-clock"
                      onPress={() =>
                        void run(
                          `processing-${row.id}`,
                          () => adminMarkBuklodPfWithdrawalProcessing(row.id),
                          'Withdrawal moved to PROCESSING.',
                        )
                      }
                      disabled={!!busy || !payoutEnabled}
                    />
                  )}

                  {row.status === 'PROCESSING' && (
                    <View style={styles.actionWrap}>
                      <ActionButton
                        title="ACCESS PAYOUT DESTINATION"
                        icon="eye-lock-outline"
                        onPress={() => revealPayout(row.id)}
                        disabled={!!busy || !payoutEnabled}
                      />

                      <ActionButton
                        title="MARK FAILED / RETURN FUNDS"
                        icon="cash-refund"
                        onPress={() =>
                          Alert.alert(
                            'Mark Payout Failed?',
                            'Use this only when the external transfer was not completed. The reserved finalized cash will be returned to the member Available balance.',
                            [
                              {
                                text: 'Cancel',
                                style: 'cancel',
                              },
                              {
                                text: 'Mark Failed',
                                style: 'destructive',
                                onPress: () =>
                                  void run(
                                    `failed-${row.id}`,
                                    () =>
                                      adminFailBuklodPfWithdrawal(
                                        row.id,
                                        'External payout was not completed.',
                                      ),
                                    'Payout marked FAILED and reserved cash returned.',
                                  ).then(() => {
                                    setSelectedPayout(null);
                                    setTransactionRef('');
                                  }),
                              },
                            ],
                          )
                        }
                        disabled={!!busy || !payoutEnabled}
                        danger
                      />
                    </View>
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
                    <Text style={styles.sensitiveValue}>{selectedPayout.payout_method} Ã‚Â· {selectedPayout.destination}</Text>
                    <Text style={styles.muted}>{formatPhp(selectedPayout.requested_amount)} Ã‚Â· {selectedPayout.status}</Text>
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
