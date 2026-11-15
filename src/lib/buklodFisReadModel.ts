import type { CanonicalAdminEconomySnapshot } from '@/lib/buklodCanonicalAdminEconomy';
import type { BuklodR38AdminWithdrawalQueue } from '@/lib/buklodR38AdminEconomy';
import { getBuklodFinanceMonthCloseBlockers } from '@/lib/buklodFinanceMonthCloseBlockers';

export type FisBreakdown = { name: string; credits: number; debits: number; count: number };
export type FisPayoutStatus = { status: string; count: number; amount: number };
export type FisReadModel = {
  period: string;
  finalized: boolean;
  journalReconciledCredits: number;
  journalReconciledDebits: number;
  journalPendingCount: number;
  journalPendingAmount: number;
  journalRows: number;
  byEntryType: FisBreakdown[];
  payouts: FisPayoutStatus[];
  payoutDataAvailable: boolean;
  blockers: string[];
  closeReady: boolean;
  settlementNet: number | null;
  retained: number | null;
  marginPct: number | null;
};

function finiteMoney(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function previousFisMonth(period: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Invalid FIS period');
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  return String(prevYear).padStart(4, '0') + '-' + String(prevMonth).padStart(2, '0');
}

export function formatFisMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function buildFisReadModel(
  snapshot: CanonicalAdminEconomySnapshot,
  queue: BuklodR38AdminWithdrawalQueue | null,
): FisReadModel {
  // This is a read model, not an alternate ledger. Server Finance V3 is authoritative.
  const groups = new Map<string, FisBreakdown>();
  let credits = 0;
  let debits = 0;
  let pendingCount = 0;
  let pendingAmount = 0;
  for (const entry of snapshot.finance.financial_entries) {
    const amount = finiteMoney(entry.amount_php);
    if (amount < 0) continue; // malformed negative input is never treated as earned money
    const reconciled = entry.reconciliation_state === 'RECONCILED';
    if (!reconciled) {
      pendingCount += 1;
      pendingAmount += amount;
      continue;
    }
    const name = entry.entry_type || 'OTHER';
    const group = groups.get(name) || { name, credits: 0, debits: 0, count: 0 };
    group.count += 1;
    if (entry.direction === 'CREDIT') {
      group.credits += amount;
      credits += amount;
    } else if (entry.direction === 'DEBIT') {
      group.debits += amount;
      debits += amount;
    }
    groups.set(name, group);
  }
  const payoutGroups = new Map<string, FisPayoutStatus>();
  if (queue) {
    for (const payout of queue.rows) {
      const status = String(payout.status || 'UNKNOWN').toUpperCase();
      const item = payoutGroups.get(status) || { status, count: 0, amount: 0 };
      item.count += 1;
      item.amount += finiteMoney(payout.requested_amount);
      payoutGroups.set(status, item);
    }
  }
  const settlement = snapshot.finance.settlement;
  const finalized = settlement?.status === 'FINALIZED';
  const net = finalized ? finiteMoney(settlement.estimated_final_net_php) : null;
  const revenue = finalized ? finiteMoney(settlement.normal_eligible_revenue_php) : 0;
  const blockers = getBuklodFinanceMonthCloseBlockers(snapshot.qmp, snapshot.finance.controls);
  return {
    period: snapshot.period_key,
    finalized,
    journalReconciledCredits: credits,
    journalReconciledDebits: debits,
    journalPendingCount: pendingCount,
    journalPendingAmount: pendingAmount,
    journalRows: snapshot.finance.financial_entries.length,
    byEntryType: [...groups.values()].sort((a, b) => b.credits + b.debits - a.credits - a.debits),
    payouts: [...payoutGroups.values()].sort((a, b) => a.status.localeCompare(b.status)),
    payoutDataAvailable: queue !== null,
    blockers: finalized ? [] : blockers,
    closeReady: !finalized && blockers.length === 0 && snapshot.qmp.ready_for_finalization === true,
    settlementNet: net,
    retained: finalized ? finiteMoney(settlement.buklod_retained_php) : null,
    marginPct: finalized && revenue > 0 && net !== null ? net / revenue * 100 : null,
  };
}

// Formula-injection-safe, non-PII export of already authorized read-only finance journal.
function csvCell(value: string | number): string {
  let s = String(value).replace(/[\r\n]+/g, ' ').trim();
  if (/^[=+\-@\t]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
export function createFisCsv(snapshot: CanonicalAdminEconomySnapshot): string {
  const rows: Array<Array<string | number>> = [
    ['BUKLOD FIS - canonical journal (read-only)', snapshot.period_key],
    ['Entry ID', 'Date', 'Type', 'Direction', 'Amount PHP', 'State', 'Source'],
  ];
  for (const entry of snapshot.finance.financial_entries.slice(0, 2000)) {
    rows.push([
      entry.id, entry.created_at, entry.entry_type, entry.direction,
      finiteMoney(entry.amount_php).toFixed(2), entry.reconciliation_state,
      entry.source_system || '',
    ]);
  }
  rows.push(['End of export', 'Rows', Math.min(snapshot.finance.financial_entries.length, 2000)]);
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
