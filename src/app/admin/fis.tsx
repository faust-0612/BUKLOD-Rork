import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AdminGate } from '@/components/AdminGate';
import { loadCanonicalAdminEconomy, isEconomyMonth, manilaEconomyMonth, type CanonicalAdminEconomySnapshot } from '@/lib/buklodCanonicalAdminEconomy';
import { adminListBuklodR38Withdrawals, type BuklodR38AdminWithdrawalQueue } from '@/lib/buklodR38AdminEconomy';
import { buildFisReadModel, createFisCsv, formatFisMoney, previousFisMonth } from '@/lib/buklodFisReadModel';

type Section = 'overview' | 'journal' | 'funds' | 'payouts' | 'controls';
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
const GREEN = '#176B43';
const INK = '#172A25';
const MUTED = '#576D65';
const BG = '#F4F7F5';
const LINE = '#DFE9E2';
const SECTIONS: { key: Section; title: string; icon: IconName }[] = [
  { key: 'overview', title: 'Overview', icon: 'view-dashboard-outline' },
  { key: 'journal', title: 'Journal', icon: 'book-open-page-variant-outline' },
  { key: 'funds', title: 'Funds', icon: 'bank-outline' },
  { key: 'payouts', title: 'Payouts', icon: 'cash-check' },
  { key: 'controls', title: 'Controls', icon: 'shield-check-outline' },
];

function Metric({ label, value, note, wide }: { label: string; value: string; note?: string; wide?: boolean }) {
  return (
    <View style={[styles.metric, { minWidth: wide ? 220 : 165 }]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={2} adjustsFontSizeToFit>{value}</Text>
      {!!note && <Text style={styles.metricNote}>{note}</Text>}
    </View>
  );
}
function SectionTitle({ overline, title, subtitle }: { overline: string; title: string; subtitle?: string }) {
  return <View style={styles.heading}><Text style={styles.overline}>{overline}</Text><Text style={styles.headingTitle}>{title}</Text>{!!subtitle && <Text style={styles.note}>{subtitle}</Text>}</View>;
}
function NavLink({ label, detail, path, icon }: { label: string; detail: string; path: string; icon: IconName }) {
  return <Pressable accessibilityRole="button" onPress={() => router.push(path as any)} style={styles.navLink}>
    <MaterialCommunityIcons name={icon} size={21} color={GREEN} />
    <View style={{ flex: 1 }}><Text style={styles.navLinkTitle}>{label}</Text><Text style={styles.note}>{detail}</Text></View>
    <MaterialCommunityIcons name="chevron-right" size={20} color={MUTED} />
  </Pressable>;
}
function DataRow({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return <View style={styles.dataRow}><Text style={styles.rowLabel}>{label}</Text><Text style={[styles.rowValue, alert && { color: '#A44225' }]}>{value}</Text></View>;
}
function Status({ label, ok }: { label: string; ok: boolean }) {
  return <View style={[styles.status, ok ? styles.statusOk : styles.statusWarning]}>
    <MaterialCommunityIcons name={ok ? 'check-circle-outline' : 'alert-circle-outline'} size={16} color={ok ? GREEN : '#9A5B27'} />
    <Text style={[styles.statusText, { color: ok ? GREEN : '#874D23' }]}>{label}</Text>
  </View>;
}

export default function BuklodFisScreen() {
  const { width } = useWindowDimensions();
  const [section, setSection] = useState<Section>('overview');
  const [month, setMonth] = useState(manilaEconomyMonth);
  const [monthInput, setMonthInput] = useState(manilaEconomyMonth);
  const [snapshot, setSnapshot] = useState<CanonicalAdminEconomySnapshot | null>(null);
  const [previous, setPrevious] = useState<CanonicalAdminEconomySnapshot | null>(null);
  const [queue, setQueue] = useState<BuklodR38AdminWithdrawalQueue | null>(null);
  const [queueError, setQueueError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [journalFilter, setJournalFilter] = useState<'all' | 'reconciled' | 'unresolved'>('all');
  const requestRef = useRef(0);
  const compareRef = useRef(0);

  const load = useCallback(async (key: string, refresh = false) => {
    const request = ++requestRef.current;
    ++compareRef.current;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setSnapshot(null);
    setQueue(null);
    setPrevious(null);
    setComparisonLoading(false);
    setQueueError('');
    setError('');
    try {
      // Independent queue errors must not invalidate the canonical monthly report.
      const [financeResult, queueResult] = await Promise.allSettled([
        loadCanonicalAdminEconomy(key), adminListBuklodR38Withdrawals(),
      ]);
      if (request !== requestRef.current) return;
      if (financeResult.status !== 'fulfilled') throw financeResult.reason;
      setSnapshot(financeResult.value);
      if (queueResult.status === 'fulfilled') setQueue(queueResult.value);
      else setQueueError('Payout queue unavailable. No payout status is inferred.');
    } catch (cause: unknown) {
      if (request === requestRef.current) setError(cause instanceof Error ? cause.message : 'Finance data unavailable');
    } finally {
      if (request === requestRef.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);
  useEffect(() => { void load(month); return () => { ++requestRef.current; ++compareRef.current; }; }, [month, load]);
  const model = useMemo(() => snapshot ? buildFisReadModel(snapshot, queue) : null, [snapshot, queue]);
  const settlement = snapshot?.finance.settlement;
  const finalized = model?.finalized === true;
  const liveMoney = (value: number | null | undefined) => finalized ? formatFisMoney(value) : '—';
  const compact = width < 650;

  const selectMonth = () => {
    const next = monthInput.trim();
    if (!isEconomyMonth(next)) { setError('Month must use YYYY-MM, with a valid month.'); return; }
    if (next === month) void load(next, true);
    else setMonth(next);
  };
  const comparePrevious = async () => {
    if (!snapshot || comparisonLoading) return;
    const request = ++compareRef.current;
    const period = previousFisMonth(snapshot.period_key);
    setComparisonLoading(true);
    try {
      const next = await loadCanonicalAdminEconomy(period);
      if (request === compareRef.current) setPrevious(next);
    } catch {
      if (request === compareRef.current) setPrevious(null);
    } finally {
      if (request === compareRef.current) setComparisonLoading(false);
    }
  };
  const exportCsv = () => {
    if (!snapshot || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const csv = createFisCsv(snapshot);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'buklod-fis-journal-' + snapshot.period_key + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const journal = snapshot?.finance.financial_entries.filter(entry =>
    journalFilter === 'all' || (journalFilter === 'reconciled'
      ? entry.reconciliation_state === 'RECONCILED'
      : entry.reconciliation_state !== 'RECONCILED')
  ).slice(0, 100) || [];
  const payoutTotal = queue?.rows.length ?? 0;

  return (
    <AdminGate>
      <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { maxWidth: 1100, paddingHorizontal: compact ? 14 : 24 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(month, true)} />}>
        <Pressable onPress={() => router.back()} style={styles.back}><MaterialCommunityIcons name="arrow-left" size={19} color={GREEN} /><Text style={styles.backText}>ADMINISTRATION</Text></Pressable>
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>BUKLOD · FINANCIAL INFORMATION SYSTEM</Text>
            <Text style={[styles.heroTitle, compact && { fontSize: 27 }]}>Finance Command Center</Text>
            <Text style={styles.heroSubtitle}>Verified finances, reconciliations, scope allocations, audit journal and controlled payouts.</Text>
          </View>
          <MaterialCommunityIcons name="chart-areaspline" size={34} color="#BDEFC8" />
        </View>
        <View style={styles.notice}>
          <MaterialCommunityIcons name="shield-check-outline" size={20} color={GREEN} />
          <Text style={[styles.note, { flex: 1 }]}>Private System Admin workspace. Canonical Finance V3 is the only source of truth. Points and estimated AdMob earnings are not withdrawable cash.</Text>
        </View>
        <View style={styles.toolbar}>
          <TextInput accessibilityLabel="Finance month" style={styles.monthInput} value={monthInput} onChangeText={setMonthInput} placeholder="YYYY-MM" placeholderTextColor="#6B7A73" maxLength={7} autoCapitalize="none" />
          <Pressable onPress={selectMonth} style={styles.primaryButton}><Text style={styles.primaryLabel}>Load month</Text></Pressable>
          <Pressable onPress={() => void load(month, true)} style={styles.outlineButton}><MaterialCommunityIcons name="refresh" size={18} color={GREEN}/><Text style={styles.outlineLabel}>Refresh</Text></Pressable>
          {Platform.OS === 'web' && snapshot && <Pressable onPress={exportCsv} style={styles.outlineButton}><MaterialCommunityIcons name="download" size={17} color={GREEN}/><Text style={styles.outlineLabel}>CSV</Text></Pressable>}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={styles.tabContent}>
          {SECTIONS.map(item => <Pressable key={item.key} onPress={() => setSection(item.key)} style={[styles.tab, section === item.key && styles.tabSelected]}>
            <MaterialCommunityIcons name={item.icon} color={section === item.key ? '#FFFFFF' : GREEN} size={17}/>
            <Text style={[styles.tabLabel, section === item.key && { color: '#FFFFFF' }]}>{item.title}</Text>
          </Pressable>)}
        </ScrollView>

        {loading && <View style={styles.card}><ActivityIndicator color={GREEN}/><Text style={styles.note}>Reading protected Finance V3 snapshot…</Text></View>}
        {!!error && <View style={styles.warning}><Text style={styles.warningTitle}>Finance report unavailable</Text><Text style={styles.note}>{error}</Text><Pressable onPress={() => void load(month)} style={styles.outlineButton}><Text style={styles.outlineLabel}>Retry</Text></Pressable></View>}
        {!loading && snapshot && model && <>
          <View style={styles.meta}><Text style={styles.metaText}>MANILA MONTH  {snapshot.period_key}  ·  UPDATED  {new Date(snapshot.generated_at).toLocaleString('en-PH')}</Text><Status ok={finalized} label={finalized ? 'FINALIZED' : 'NOT FINALIZED'} /></View>
          {section === 'overview' && <>
            <SectionTitle overline="FINANCIAL POSITION" title="Monthly executive overview" subtitle="Provider and journal figures are distinct. An unfinished period never displays projected cash as finalized earnings." />
            <View style={styles.metrics}>
              <Metric label="AdMob · reconciled journal" value={formatFisMoney(snapshot.revenue_sources.admob_reconciled_finance_journal_php)} note="Eligible funding still requires server verification" wide/>
              <Metric label="AdMob · finalized provider" value={formatFisMoney(snapshot.revenue_sources.admob_finalized_provider_value_php)} note="Provider value; not automatically a payout" wide/>
              <Metric label="Other app income" value={formatFisMoney(snapshot.revenue_sources.other_app_reconciled_revenue_php)} note="Excluded from member pool" />
              <Metric label="Other app costs" value={formatFisMoney(snapshot.revenue_sources.other_app_reconciled_costs_php)} note="Reported separately" />
              <Metric label="BUKLOD retained · finalized" value={liveMoney(model.retained)} note="No value until month close" />
              <Metric label="Final net · finalized" value={liveMoney(model.settlementNet)} note="Source settlement calculation" />
            </View>
            <View style={styles.card}><SectionTitle overline="MARGIN MONITOR" title="Operating position" />
              <DataRow label="Finalized margin (net / eligible revenue)" value={model.marginPct === null ? 'Not available' : model.marginPct.toFixed(1) + '%'} />
              <DataRow label="Reconciled journal credits" value={formatFisMoney(model.journalReconciledCredits)} />
              <DataRow label="Reconciled journal debits" value={formatFisMoney(model.journalReconciledDebits)} />
              <DataRow label="Unreconciled / estimated entries" value={String(model.journalPendingCount)} alert={model.journalPendingCount > 0}/>
              <Text style={styles.note}>Journal totals are bookkeeping entries, not a substitute for the authoritative finalized settlement. No automatic recommendation changes pricing, allocations or payout permissions.</Text>
            </View>
            <View style={styles.card}><SectionTitle overline="MONTHLY CONTINUITY" title="Previous-month comparison" subtitle="Fetch on request to conserve database traffic." />
              {previous ? <>
                <DataRow label="Previous month" value={previous.period_key} />
                <DataRow label="Previous AdMob reconciled journal" value={formatFisMoney(previous.revenue_sources.admob_reconciled_finance_journal_php)} />
                <DataRow label="Previous net (finalized only)" value={previous.finance.settlement?.status === 'FINALIZED' ? formatFisMoney(previous.finance.settlement.estimated_final_net_php) : '—'} />
              </> : <Pressable onPress={() => void comparePrevious()} disabled={comparisonLoading} style={styles.outlineButton}>{comparisonLoading && <ActivityIndicator color={GREEN}/>}<Text style={styles.outlineLabel}>Load previous month</Text></Pressable>}
            </View>
            <NavLink label="Economy Operations" detail="Use existing verified server actions to record or reconcile a financial entry" path="/admin/economy-operations" icon="cash-sync"/>
          </>}
          {section === 'journal' && <>
            <SectionTitle overline="AUDITABLE ENTRIES" title="Canonical financial journal" subtitle="Reconciled and pending records remain separate. Showing at most 100 entries; CSV includes at most 2,000."/>
            <View style={styles.metrics}>
              <Metric label="Reconciled credits" value={formatFisMoney(model.journalReconciledCredits)} />
              <Metric label="Reconciled debits" value={formatFisMoney(model.journalReconciledDebits)} />
              <Metric label="Pending amount (not cash)" value={formatFisMoney(model.journalPendingAmount)} note={String(model.journalPendingCount) + ' unverified entries'} />
            </View>
            <View style={styles.filters}>{(['all', 'reconciled', 'unresolved'] as const).map(filter =>
              <Pressable key={filter} onPress={() => setJournalFilter(filter)} style={[styles.filter, journalFilter === filter && styles.filterActive]}><Text style={[styles.filterText, journalFilter === filter && { color: '#FFFFFF' }]}>{filter.toUpperCase()}</Text></Pressable>
            )}</View>
            <View style={styles.card}>{journal.length === 0 ? <Text style={styles.note}>No entries in this filter.</Text> : journal.map(entry => (
              <View key={entry.id} style={styles.ledgerRow}>
                <View style={{ flex: 1 }}><Text style={styles.rowTitle}>{entry.entry_type.replace(/_/g, ' ')}</Text>
                  <Text style={styles.note}>{entry.source_system || 'Unknown source'} · {entry.reconciliation_state} · {entry.created_at.slice(0, 10)}</Text></View>
                <Text style={[styles.amount, entry.direction === 'DEBIT' && { color: '#B1513F' }]}>{entry.direction === 'DEBIT' ? '− ' : '+ '}{formatFisMoney(entry.amount_php)}</Text>
              </View>
            ))}</View>
            <SectionTitle overline="RECONCILIATION BY CATEGORY" title="Verified ledger breakdown"/>
            <View style={styles.card}>{model.byEntryType.length === 0 ? <Text style={styles.note}>No reconciled entries.</Text> : model.byEntryType.map(item =>
              <View key={item.name} style={styles.ledgerRow}><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{item.name.replace(/_/g, ' ')}</Text><Text style={styles.note}>{item.count} entry/entries</Text></View>
                <Text style={styles.note}>+{formatFisMoney(item.credits)} / −{formatFisMoney(item.debits)}</Text></View>)}</View>
          </>}
          {section === 'funds' && <>
            <SectionTitle overline="FUNDS AND ALLOCATIONS" title="Verified distribution" subtitle="Community allocations are visible only after an authoritative finalized month. They are not proof of bank transfer."/>
            <View style={styles.metrics}>
              <Metric label="Eligible finalized revenue" value={liveMoney(settlement?.normal_eligible_revenue_php)}/>
              <Metric label="Member pool" value={liveMoney(settlement?.user_pool_php)} />
              <Metric label="First-line referral" value={liveMoney(settlement?.first_line_php)} />
              <Metric label="Community fund" value={liveMoney(settlement?.community_fund_php)} />
              <Metric label="Tax reserve" value={liveMoney(settlement?.tax_reserve_php)} />
              <Metric label="Operating cost" value={liveMoney(settlement?.operating_cost_php)} />
            </View>
            <View style={styles.card}><SectionTitle overline="CLUSTER AND ORGANIZATION" title="Scope allocation ledger"/>
              {!finalized ? <Text style={styles.note}>No finalized allocations for this month. Preview balances are not available.</Text> :
              snapshot.finance.community_allocations.length === 0 ? <Text style={styles.note}>No community allocations were returned.</Text> :
              snapshot.finance.community_allocations.slice(0, 100).map(item =>
                <View key={item.scope_id + item.tier} style={styles.ledgerRow}>
                  <View style={{ flex: 1 }}><Text style={styles.rowTitle}>{item.tier} · scope {item.scope_id.slice(0, 8)}</Text>
                    <Text style={styles.note}>{item.active_contributors} contributors · {item.allocation_pct}% allocation</Text></View>
                  <Text style={styles.amount}>{formatFisMoney(item.allocation_php)}</Text>
                </View>)}
            </View>
            <NavLink label="Cluster / Organization Fund" detail="Select the precise scope before viewing its separately held GCash collections and verified funds" path="/organizations" icon="account-group-outline"/>
            <NavLink label="Church Giving Accounts" detail="Manage verified church receiving account settings; do not confuse receipt records with Finance V3 allocation" path="/admin/giving" icon="hand-heart-outline"/>
            <NavLink label="Faith Payment Review" detail="Review pending faith-related transactions in the existing protected payment console" path="/admin/faith-payments" icon="receipt-text-check-outline"/>
            <NavLink label="Bayanihan & Shares" detail="View canonical contribution eligibility and monthly allocation policy" path="/admin/bayanihan" icon="chart-arc"/>
          </>}
          {section === 'payouts' && <>
            <SectionTitle overline="WITHDRAWAL OPERATIONS" title="Queue overview" subtitle="Masked status aggregates only. Actual release remains in the existing server-protected payment console." />
            <Status ok={snapshot.finance.controls.withdrawal_enabled && snapshot.finance.controls.payout_processing_enabled && queue?.withdrawal_enabled === true && queue?.payout_processing_enabled === true} label={snapshot.finance.controls.withdrawal_enabled && snapshot.finance.controls.payout_processing_enabled && queue?.withdrawal_enabled === true && queue?.payout_processing_enabled === true ? 'WITHDRAWAL AND PROCESSING ENABLED' : 'PAYOUT PROCESSING LOCKED'} />
            {!!queueError && <Text style={styles.warningTitle}>{queueError}</Text>}
            <View style={styles.metrics}><Metric label="Queue records" value={queue ? String(payoutTotal) : 'Unavailable'} /><Metric label="Minimum withdrawal" value={formatFisMoney(snapshot.finance.controls.minimum_withdrawal_php)}/></View>
            <View style={styles.card}>{!queue ? <Text style={styles.note}>Status not verified; do not authorize payment based on this screen.</Text> :
              model.payouts.length === 0 ? <Text style={styles.note}>No withdrawal requests in the current queue.</Text> :
              model.payouts.map(item => <DataRow key={item.status} label={item.status + ' · ' + item.count + ' requests'} value={formatFisMoney(item.amount)}/>)}</View>
            <NavLink label="Withdrawal Review & Payout Processing" detail="Secure actions, transaction references and server-side gate verification" path="/admin/economy-operations" icon="cash-check"/>
          </>}
          {section === 'controls' && <>
            <SectionTitle overline="FINANCE GOVERNANCE" title="Safety and month-close gates" subtitle="Read-only review. This workspace cannot change a monetary policy or unlock a payout." />
            <View style={styles.card}>
              <DataRow label="Finance economics" value={snapshot.finance.controls.economics_enabled ? 'ENABLED' : 'OFF'} />
              <DataRow label="Settlement" value={snapshot.finance.controls.settlement_enabled ? 'ENABLED' : 'OFF'} />
              <DataRow label="Withdrawals" value={snapshot.finance.controls.withdrawal_enabled ? 'ENABLED' : 'OFF'} />
              <DataRow label="Payout processing" value={snapshot.finance.controls.payout_processing_enabled ? 'ENABLED' : 'OFF'} />
              <DataRow label="Policy version" value={snapshot.finance.policy.version} />
              <DataRow label="Qualified contributors" value={snapshot.qmp.period_exists ? String(snapshot.qmp.qualified_users ?? '—') : 'No period'} />
              <DataRow label="Finance identities missing" value={snapshot.qmp.period_exists ? String(snapshot.qmp.unlinked_finance_identities ?? '—') : 'No period'} />
              <DataRow label="Period status" value={snapshot.qmp.qmp_period_status || 'Unavailable'} />
            </View>
            <View style={styles.card}><SectionTitle overline="MONTH END" title="Release readiness" />
              {finalized ? <Status ok label="Month already finalized" /> : model.closeReady ? <Status ok label="Server reports all month-close checks clear" /> : <Status label="Not ready for finalization" ok={false} />}
              {model.blockers.length ? model.blockers.map((text, index) =>
                <View key={String(index)} style={styles.blocker}><MaterialCommunityIcons name="alert-circle-outline" size={18} color="#9A5B27"/><Text style={[styles.note, { flex: 1 }]}>{text}</Text></View>
              ) : null}
              <Text style={styles.note}>Finalization must still be performed only through the canonical backend with its own independent authorization checks. Green indicators here never authorize a transfer.</Text>
            </View>
            <NavLink label="Economy Operations & Reconciliation" detail="Proceed only when authoritative server controls permit" path="/admin/economy-operations" icon="shield-check-outline"/>
            <NavLink label="Security Operations" detail="Risk alerts, freezes and recovery checks" path="/admin/security-operations" icon="shield-lock-outline"/>
            <NavLink label="Reports Center" detail="System-wide operational and non-cash activity reports" path="/admin/reports-center" icon="chart-box-outline"/>
          </>}
        </>}
      </ScrollView>
    </AdminGate>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  content: { paddingTop: 20, paddingBottom: 48, width: '100%', alignSelf: 'center', gap: 14 },
  back: { flexDirection: 'row', gap: 7, alignItems: 'center', paddingVertical: 5 },
  backText: { fontSize: 11, fontWeight: '800', color: GREEN, letterSpacing: 1.1 },
  hero: { borderRadius: 18, backgroundColor: '#10442E', padding: 22, flexDirection: 'row', gap: 16, alignItems: 'center' },
  heroEyebrow: { color: '#BDEFC8', letterSpacing: 1.5, fontWeight: '800', fontSize: 10 },
  heroTitle: { color: '#FFFFFF', fontSize: 32, fontWeight: '800', marginTop: 6 },
  heroSubtitle: { color: '#D3EADD', fontSize: 13, lineHeight: 20, marginTop: 7 },
  notice: { backgroundColor: '#E7F1EA', borderRadius: 12, padding: 13, flexDirection: 'row', gap: 10, alignItems: 'center' },
  note: { fontSize: 12, lineHeight: 18, color: MUTED, flexShrink: 1 },
  toolbar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  monthInput: { borderRadius: 10, borderColor: '#B9CFC1', borderWidth: 1, backgroundColor: '#FFFFFF', color: INK, height: 42, width: 112, paddingHorizontal: 12, fontSize: 14 },
  primaryButton: { backgroundColor: GREEN, borderRadius: 10, minHeight: 42, paddingHorizontal: 15, justifyContent: 'center', alignItems: 'center' },
  primaryLabel: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  outlineButton: { borderColor: '#B5D4C1', backgroundColor: '#FFFFFF', borderWidth: 1, borderRadius: 10, minHeight: 42, paddingHorizontal: 13, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 6, alignSelf: 'flex-start' },
  outlineLabel: { color: GREEN, fontSize: 12, fontWeight: '800' },
  tabs: { flexGrow: 0 },
  tabContent: { gap: 7, paddingVertical: 3 },
  tab: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#E7EFEA', flexDirection: 'row', gap: 7, alignItems: 'center' },
  tabSelected: { backgroundColor: GREEN },
  tabLabel: { color: GREEN, fontSize: 12, fontWeight: '700' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  metaText: { fontWeight: '700', color: MUTED, fontSize: 10, letterSpacing: 0.5 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9, alignSelf: 'flex-start' },
  statusOk: { backgroundColor: '#DDF3E4' },
  statusWarning: { backgroundColor: '#FFF0D8' },
  statusText: { fontWeight: '800', fontSize: 11 },
  heading: { gap: 5, paddingTop: 8 },
  overline: { color: GREEN, fontWeight: '800', fontSize: 10, letterSpacing: 1.2 },
  headingTitle: { color: INK, fontSize: 20, fontWeight: '800' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { flexGrow: 1, flexBasis: 205, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, padding: 15, borderRadius: 12, gap: 6 },
  metricLabel: { color: MUTED, fontSize: 11, fontWeight: '700' },
  metricValue: { color: INK, fontSize: 22, fontWeight: '800' },
  metricNote: { color: MUTED, fontSize: 11, lineHeight: 15 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 13, padding: 16, borderWidth: 1, borderColor: LINE, gap: 10 },
  warning: { backgroundColor: '#FFF4E6', borderRadius: 13, padding: 16, gap: 10 },
  warningTitle: { color: '#9B4A22', fontWeight: '800', fontSize: 14 },
  dataRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between', paddingVertical: 9, borderBottomColor: LINE, borderBottomWidth: 1, gap: 8 },
  rowLabel: { flex: 1, minWidth: 130, color: MUTED, fontSize: 12 },
  rowValue: { color: INK, fontSize: 13, fontWeight: '700' },
  navLink: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, borderRadius: 12, padding: 14 },
  navLinkTitle: { color: INK, fontSize: 13, fontWeight: '800', marginBottom: 3 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  filter: { borderRadius: 8, padding: 10, backgroundColor: '#E7EFEA' },
  filterActive: { backgroundColor: GREEN },
  filterText: { color: GREEN, fontWeight: '800', fontSize: 10 },
  ledgerRow: { flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomColor: LINE, borderBottomWidth: 1, paddingVertical: 10, flexWrap: 'wrap' },
  rowTitle: { fontSize: 12, color: INK, fontWeight: '700' },
  amount: { color: GREEN, fontSize: 13, fontWeight: '800' },
  blocker: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 5 },
});
