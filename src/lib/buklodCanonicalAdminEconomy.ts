import { supabase } from '@/lib/supabase';
import type { BuklodPfFinanceConsoleV3, BuklodPfQmpReadiness } from '@/lib/buklodR38AdminEconomy';
import type { AdminCommunityAdmobEstimate } from '@/lib/buklodCommunityContributionEconomy';

// Manila uses UTC+08:00 without daylight-saving time. Never use device local month.
export function manilaEconomyMonth(date = new Date()): string {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

export function isEconomyMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export type CanonicalAdminEconomySnapshot = {
  period_key: string;
  generated_at: string;
  source: 'CANONICAL_FINANCE_V3';
  finance: BuklodPfFinanceConsoleV3;
  qmp: BuklodPfQmpReadiness;
  admob_provisional: AdminCommunityAdmobEstimate | null;
};

export function validateCanonicalAdminEconomySnapshot(
  raw: unknown,
  expectedMonth: string,
): CanonicalAdminEconomySnapshot {
  if (!isEconomyMonth(expectedMonth)) throw new Error('Invalid Manila finance month.');
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Canonical economy report unavailable; no amounts can be displayed.');
  }
  const snapshot = raw as Partial<CanonicalAdminEconomySnapshot>;
  if (snapshot.source !== 'CANONICAL_FINANCE_V3' ||
      snapshot.period_key !== expectedMonth ||
      !snapshot.finance || typeof snapshot.finance !== 'object' ||
      snapshot.finance.period_key !== expectedMonth ||
      !snapshot.finance.policy || !snapshot.finance.controls ||
      !Array.isArray(snapshot.finance.financial_entries) ||
      !Array.isArray(snapshot.finance.user_shares) ||
      !Array.isArray(snapshot.finance.community_allocations) ||
      !snapshot.qmp || snapshot.qmp.period_key !== expectedMonth ||
      (snapshot.admob_provisional !== null && snapshot.admob_provisional !== undefined &&
        snapshot.admob_provisional.period_key !== expectedMonth)) {
    throw new Error('Canonical economy sources disagree or report is incomplete. Refresh before any financial action.');
  }
  if (snapshot.finance.settlement &&
      snapshot.finance.settlement.period_key !== expectedMonth) {
    throw new Error('Finance settlement belongs to a different month.');
  }
  if (!snapshot.generated_at || !Number.isFinite(Date.parse(snapshot.generated_at))) {
    throw new Error('Canonical economy report timestamp unavailable.');
  }
  return snapshot as CanonicalAdminEconomySnapshot;
}

export async function loadCanonicalAdminEconomy(month: string) {
  const key = month.trim();
  if (!isEconomyMonth(key)) throw new Error('Enter a valid finance month in YYYY-MM format.');
  const { data, error } = await (supabase as any).rpc(
    'admin_get_buklod_canonical_economy_snapshot_v1',
    { p_period_key: key },
  );
  if (error) throw new Error(error.message || 'Could not synchronize canonical Economy reporting.');
  return validateCanonicalAdminEconomySnapshot(data, key);
}

export function hasFinalizedFinanceMonth(
  snapshot: CanonicalAdminEconomySnapshot | null,
): boolean {
  return snapshot?.finance.settlement?.status === 'FINALIZED';
}

export function financeMoneyOrUnavailable(value: unknown, finalized: boolean): string {
  if (!finalized || typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-PH', {
    style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}
