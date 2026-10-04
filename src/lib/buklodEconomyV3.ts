import { supabase } from '@/lib/supabase';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { ensureBuklodProfitFirstIdentity } from '@/lib/buklodReferralV2';

export type BuklodEconomyReferralItemV3 = {
  referral_id: string;
  status: string;
  pending_reward_php: number;
  reward_withdrawable_php: number;
  qualification_value_php: number;
  qualification_threshold_php: number;
  qualification_pct: number;
  share_started_at: string | null;
  share_ends_at: string | null;
  referred_label: string;
};

export type BuklodFinancialSummaryV3 = {
  identity_ready: boolean;
  policy_version?: string;
  progress?: {
    lifetime_points?: number;
    qualified_monthly_points?: number;
    total_qualified_monthly_points?: number;
  };
  earnings?: {
    estimated_pool_share_pct?: number;
    estimated_user_pool_php?: number;
    estimated_earnings_php?: number;
    latest_finalized_user_share_php?: number;
    withdrawable_php?: number;
    reserved_php?: number;
    paid_php?: number;
    user_pool_eligibility_active?: boolean;
  };
  referral?: {
    referral_code?: string;
    share_url?: string;
    one_time_reward_php?: number;
    referred_qualification_php?: number;
    no_referrer_qualification_php?: number;
    first_line_pct?: number;
    referral_months?: number;
    was_referred?: boolean;
    invited_count?: number;
    qualified_count?: number;
    items?: BuklodEconomyReferralItemV3[];
  };
  community?: {
    selected?: boolean;
    scope_id?: string;
    scope_name?: string;
    tier?: 'CLUSTER' | 'ORGANIZATION' | string;
    allocation_pct?: number;
    active_contributors?: number;
    organization_threshold?: number;
    locked_until?: string | null;
    available_fund_php?: number;
    reserved_fund_php?: number;
    spent_fund_php?: number;
  };
};

function numberValue(value: unknown) {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}

export async function loadMyBuklodFinancialSummaryV3(): Promise<BuklodFinancialSummaryV3> {
  await ensureBuklodProfitFirstIdentity();

  const result = await withBuklodTimeout<{ data: any; error: any }>(
    (supabase as any).rpc('get_my_buklod_financial_summary_v3'),
    7000,
    'BUKLOD Economy',
  );

  if (result.error) {
    throw new Error(
      String(
        result.error?.message ??
          'Could not load your BUKLOD Economy summary.',
      ),
    );
  }

  const raw = (result.data ?? {}) as BuklodFinancialSummaryV3;

  return {
    ...raw,
    identity_ready: raw.identity_ready === true,
    progress: {
      lifetime_points: numberValue(raw.progress?.lifetime_points),
      qualified_monthly_points: numberValue(
        raw.progress?.qualified_monthly_points,
      ),
      total_qualified_monthly_points: numberValue(
        raw.progress?.total_qualified_monthly_points,
      ),
    },
    earnings: {
      estimated_pool_share_pct: numberValue(
        raw.earnings?.estimated_pool_share_pct,
      ),
      estimated_user_pool_php: numberValue(
        raw.earnings?.estimated_user_pool_php,
      ),
      estimated_earnings_php: numberValue(
        raw.earnings?.estimated_earnings_php,
      ),
      latest_finalized_user_share_php: numberValue(
        raw.earnings?.latest_finalized_user_share_php,
      ),
      withdrawable_php: numberValue(raw.earnings?.withdrawable_php),
      reserved_php: numberValue(raw.earnings?.reserved_php),
      paid_php: numberValue(raw.earnings?.paid_php),
      user_pool_eligibility_active:
        raw.earnings?.user_pool_eligibility_active === true,
    },
    referral: {
      ...raw.referral,
      one_time_reward_php: numberValue(raw.referral?.one_time_reward_php),
      referred_qualification_php: numberValue(
        raw.referral?.referred_qualification_php,
      ),
      no_referrer_qualification_php: numberValue(
        raw.referral?.no_referrer_qualification_php,
      ),
      first_line_pct: numberValue(raw.referral?.first_line_pct),
      referral_months: numberValue(raw.referral?.referral_months),
      invited_count: numberValue(raw.referral?.invited_count),
      qualified_count: numberValue(raw.referral?.qualified_count),
      items: Array.isArray(raw.referral?.items)
        ? raw.referral?.items
        : [],
    },
    community: {
      ...raw.community,
      allocation_pct: numberValue(raw.community?.allocation_pct),
      active_contributors: numberValue(
        raw.community?.active_contributors,
      ),
      organization_threshold: numberValue(
        raw.community?.organization_threshold,
      ),
      available_fund_php: numberValue(raw.community?.available_fund_php),
      reserved_fund_php: numberValue(raw.community?.reserved_fund_php),
      spent_fund_php: numberValue(raw.community?.spent_fund_php),
    },
  };
}

// BUKLOD_CANONICAL_WITHDRAWAL_V3
export type BuklodPayoutProfileV3 = {
  id: string;
  payout_method: string;
  account_name: string;
  destination_masked: string;
  status: string;
  updated_at: string;
};

export type BuklodWithdrawalV3 = {
  id: string;
  user_id?: string;
  requested_amount: number;
  currency: string;
  status: string;
  payout_method: string | null;
  payout_destination_masked: string | null;
  requested_at: string;
  reviewed_at?: string | null;
  approved_at?: string | null;
  processing_at?: string | null;
  paid_at?: string | null;
  payout_transaction_ref?: string | null;
  rejection_reason?: string | null;
  failure_reason?: string | null;
};

export type BuklodWithdrawalHistoryV3 = {
  rows: BuklodWithdrawalV3[];
  withdrawal_enabled: boolean;
  payout_processing_enabled: boolean;
  minimum_withdrawal_php: number;
  full_balance_only: boolean;
};

function economyV3Message(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;

  if (error && typeof error === 'object') {
    const row = error as Record<string, unknown>;

    for (const key of ['message', 'details', 'hint', 'code']) {
      const value = row[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }

  return fallback;
}

async function economyV3Rpc<T>(
  name: string,
  args: Record<string, unknown> | undefined,
  fallback: string,
): Promise<T> {
  const { data, error } = await (supabase as any).rpc(name, args);

  if (error) {
    throw new Error(economyV3Message(error, fallback));
  }

  return data as T;
}

function withdrawalRequestKey() {
  return `pf-withdrawal:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

export async function loadMyBuklodPayoutProfileV3() {
  await ensureBuklodProfitFirstIdentity();

  return economyV3Rpc<BuklodPayoutProfileV3 | null>(
    'get_my_buklod_pf_payout_profile_v2',
    undefined,
    'Could not load your payout profile.',
  );
}

export async function saveMyBuklodPayoutProfileV3(input: {
  accountName: string;
  gcashMobile: string;
}) {
  await ensureBuklodProfitFirstIdentity();

  return economyV3Rpc<BuklodPayoutProfileV3>(
    'set_my_buklod_pf_payout_profile_v2',
    {
      p_payout_method: 'GCASH',
      p_account_name: input.accountName.trim(),
      p_destination: input.gcashMobile.trim(),
    },
    'Could not save your payout profile.',
  );
}

export async function loadMyBuklodWithdrawalsV3(limit = 50) {
  await ensureBuklodProfitFirstIdentity();

  const raw = await economyV3Rpc<BuklodWithdrawalHistoryV3>(
    'get_my_buklod_pf_withdrawals_v2',
    { p_limit: limit },
    'Could not load your withdrawal history.',
  );

  return {
    ...raw,
    rows: Array.isArray(raw?.rows) ? raw.rows : [],
    withdrawal_enabled: raw?.withdrawal_enabled === true,
    payout_processing_enabled: raw?.payout_processing_enabled === true,
    minimum_withdrawal_php: numberValue(raw?.minimum_withdrawal_php),
    full_balance_only: raw?.full_balance_only !== false,
  };
}

export async function requestMyBuklodWithdrawalV3(
  profile: BuklodPayoutProfileV3,
  requestKey?: string,
) {
  await ensureBuklodProfitFirstIdentity();

  return economyV3Rpc<{
    idempotent_replay: boolean;
    withdrawal: BuklodWithdrawalV3;
    remaining_available_cash: number;
  }>(
    'request_my_buklod_pf_withdrawal_v2',
    {
      p_payout_method: profile.payout_method,
      p_payout_profile_ref: profile.id,
      p_destination_masked: profile.destination_masked,
      p_request_key: requestKey || withdrawalRequestKey(),
    },
    'Could not request withdrawal.',
  );
}

export async function cancelMyBuklodWithdrawalV3(
  withdrawalId: string,
) {
  await ensureBuklodProfitFirstIdentity();

  return economyV3Rpc<BuklodWithdrawalV3>(
    'cancel_my_buklod_pf_withdrawal_v2',
    { p_withdrawal_id: withdrawalId },
    'Could not cancel the withdrawal request.',
  );
}
