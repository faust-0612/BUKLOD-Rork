import { supabase } from '@/lib/supabase';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import type { CommunityContributionDashboard } from '@/lib/buklodCommunityContributionEconomy';

/** Own-account finalized cash history. Does not settle or create cash. */
export type BuklodMonthlyEarnings = {
  identity_ready: boolean;
  current_month_key: string;
  previous_month_key: string;
  last_month: {
    status: 'FINALIZED' | 'AWAITING_FINALIZATION';
    finalized_share_minor: number | null;
  };
  historical_months: Array<{
    month: string;
    share_minor: number;
    status: 'FINALIZED';
  }>;
  lifetime_finalized_user_pool_minor: number;
  lifetime_other_funded_minor: number;
  available_finalized_minor: number;
  reserved_for_payout_minor: number;
  already_paid_minor: number;
  minimum_withdrawal_minor: number;
  withdrawal_enabled: boolean;
  meets_amount_threshold: boolean;
};

export async function loadMyBuklodMonthlyEarnings(): Promise<BuklodMonthlyEarnings> {
  const result = await withBuklodTimeout<{ data: unknown; error: any }>(
    (supabase as any).rpc('get_my_buklod_monthly_earnings_v1'),
    7000, 'BUKLOD Monthly Earnings',
  );
  if (result.error) {
    throw new Error(String(result.error?.message ?? 'Monthly earnings unavailable.'));
  }
  const value = result.data as BuklodMonthlyEarnings | null;
  if (!value || value.identity_ready !== true
    || !/^\d{4}-\d{2}$/.test(value.current_month_key)
    || !Number.isSafeInteger(value.available_finalized_minor)
    || value.available_finalized_minor < 0
    || !Number.isSafeInteger(value.minimum_withdrawal_minor)
    || value.minimum_withdrawal_minor < 0) {
    throw new Error('Monthly earnings are not verified for this account.');
  }
  return value;
}

/** Current-month estimates can change. Never use this function for withdrawal. */
export function composeCurrentMonthProjectedBalance(
  monthly: BuklodMonthlyEarnings | null,
  contribution: CommunityContributionDashboard | null,
): { currentEstimateMinor: number; projectedTotalMinor: number } | null {
  if (!monthly || !contribution
    || contribution.period.key !== monthly.current_month_key
    || contribution.estimate_status !== 'PROVISIONAL_ADMOB'
    || contribution.estimated_share_minor === null
    || !Number.isSafeInteger(contribution.estimated_share_minor)
    || contribution.estimated_share_minor < 0
    || !Number.isSafeInteger(monthly.available_finalized_minor)
    || monthly.available_finalized_minor < 0
    || !Number.isSafeInteger(monthly.available_finalized_minor + contribution.estimated_share_minor)) {
    return null;
  }
  return {
    currentEstimateMinor: contribution.estimated_share_minor,
    projectedTotalMinor: monthly.available_finalized_minor + contribution.estimated_share_minor,
  };
}
