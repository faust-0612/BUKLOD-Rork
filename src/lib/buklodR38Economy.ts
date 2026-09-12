import { supabase } from '@/lib/supabase';

export type BuklodR38MoneySummary = {
  bayanihan: number;
  direct_referral: number;
  total: number;
};

export type BuklodR38EconomyPolicy = {
  policy_version: string;
  referral: {
    direct_only: boolean;
    qualification_active_days: number;
    qualification_activities: number;
    earning_window_months: number;
    rcu_percent_of_qualified_bcu: number;
    qualification_activity_types: string[];
    organization_required: boolean;
    attendance_required: boolean;
    reports_required: boolean;
    classroom_required: boolean;
    purchase_required: boolean;
    ad_view_required: boolean;
  };
  withdrawal: {
    currency: string;
    minimum_amount: number;
    full_balance_only: boolean;
    partial_enabled: boolean;
    manual_processing_phase_1: boolean;
  };
  allocation_percent: {
    bayanihan?: number;
    active_direct_referral?: number;
    founder?: number;
    growth?: number;
    reserve?: number;
  };
  activation: Record<string, boolean>;
  invariants: Record<string, boolean | string>;
};

export type BuklodR38PayoutProfile = {
  id: string;
  payout_method: 'GCASH' | string;
  account_name: string;
  destination_masked: string;
  status: 'ACTIVE' | 'DISABLED' | string;
  updated_at: string;
};

export type BuklodR38Withdrawal = {
  id: string;
  user_id: string;
  requested_amount: number;
  currency: string;
  status: string;
  payout_method: string | null;
  payout_profile_ref: string | null;
  payout_destination_masked: string | null;
  requested_at: string;
  paid_at?: string | null;
  payout_transaction_ref?: string | null;
};

export type BuklodR38UserEconomyReport = {
  progress: {
    lifetime_points: number;
    available_points: number;
    pending_points: number;
    circle_rank: Record<string, unknown>;
    character: string | null;
    collectibles: number;
  };
  economic_contribution: {
    qualified_bcu: number;
    current_period_bcu: number;
    current_period: {
      period_key: string;
      status: string;
      start: string;
      end: string;
    } | null;
  };
  app_sharing: {
    qualified_direct_referrals: number;
    qualified_rcu: number;
    current_period_rcu: number;
    referral_statuses: Record<string, number>;
    direct_only: boolean;
  };
  actual_earnings: {
    estimated_share: (BuklodR38MoneySummary & {
      label: string;
      withdrawable: boolean;
    }) | null;
    finalized_share: BuklodR38MoneySummary;
    available_cash: BuklodR38MoneySummary;
    reserved_for_withdrawal: number;
    paid_earnings: BuklodR38MoneySummary;
    referral_withdrawal_enabled: boolean;
    currency: 'PHP' | string;
  };
  economic_invariants: {
    points_are_money: boolean;
    fixed_php_per_point: boolean;
    fixed_php_per_bcu: boolean;
    fixed_php_per_rcu: boolean;
    cash_source: string;
    rcu_is_weight_only: boolean;
    bcu_is_weight_only: boolean;
  };
};

export type BuklodR38AdminEconomyReport = {
  period: Record<string, unknown> | null;
  revenue_chain: {
    actual_reconciled_revenue: number;
    actual_reconciled_costs: number;
    distributable_base: number;
    bayanihan_pool: number;
    referral_pool: number;
    founder: number;
    growth: number;
    reserve: number;
  } | null;
  financial_entry_breakdown: Array<{
    entry_kind: string;
    direction: string;
    reconciliation_state: string;
    amount: number;
  }>;
  qualified_units: {
    bcu: number | null;
    rcu: number | null;
  } | null;
  user_shares: Array<{
    user_id: string;
    full_name: string;
    pool_key: 'BAYANIHAN' | 'DIRECT_REFERRAL' | string;
    qualified_units: number;
    total_qualified_units: number;
    share_ratio: number;
    funded_pool_amount: number;
    finalized_share_amount: number;
    effective_php_per_unit_analytics_only: number | null;
  }>;
  distributed: {
    bayanihan: number;
    direct_referral: number;
  };
  effective_rates_analytics_only: {
    php_per_bcu: number | null;
    php_per_rcu: number | null;
    not_future_conversion_rate: boolean;
  };
  cash_ledger: {
    available: number;
    reserved: number;
    paid: number;
    currency: string;
  };
  referral_states: Record<string, number>;
  withdrawals: Record<string, number>;
  activation: Record<string, boolean>;
  invariant_checks: Record<string, boolean | string>;
};

function messageFrom(error: unknown, fallback: string) {
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

function requestKey(prefix: string) {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

export function asMoney(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export function formatPhp(value: unknown) {
  return asMoney(value).toLocaleString('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export async function loadMyBuklodR38EconomyReport() {
  const { data, error } = await (supabase as any).rpc(
    'get_my_buklod_r38_economy_report_v1',
  );

  if (error) {
    throw new Error(messageFrom(error, 'Could not load your BUKLOD economy report.'));
  }

  return data as BuklodR38UserEconomyReport;
}

export async function loadBuklodR38EconomyPolicy() {
  const { data, error } = await (supabase as any).rpc(
    'get_buklod_r38_economy_policy_v1',
  );

  if (error) {
    throw new Error(messageFrom(error, 'Could not load the R38 economy policy.'));
  }

  return data as BuklodR38EconomyPolicy;
}

export async function loadMyBuklodR38PayoutProfile() {
  const { data, error } = await (supabase as any).rpc(
    'get_my_buklod_r38_payout_profile_v1',
  );

  if (error) {
    throw new Error(messageFrom(error, 'Could not load your payout profile.'));
  }

  return (data ?? null) as BuklodR38PayoutProfile | null;
}

export async function saveMyBuklodR38PayoutProfile(input: {
  accountName: string;
  gcashMobile: string;
}) {
  const { data, error } = await (supabase as any).rpc(
    'set_my_buklod_r38_payout_profile_v1',
    {
      p_payout_method: 'GCASH',
      p_account_name: input.accountName.trim(),
      p_destination: input.gcashMobile.trim(),
    },
  );

  if (error) {
    throw new Error(messageFrom(error, 'Could not save your payout profile.'));
  }

  return data as BuklodR38PayoutProfile;
}

export async function requestMyBuklodR38ReferralWithdrawal(
  profile: BuklodR38PayoutProfile,
  idempotencyKey?: string,
) {
  const { data, error } = await (supabase as any).rpc(
    'request_my_buklod_r38_referral_withdrawal_v1',
    {
      p_payout_method: profile.payout_method,
      p_payout_profile_ref: profile.id,
      p_destination_masked: profile.destination_masked,
      p_request_key: idempotencyKey || requestKey('r38-withdrawal'),
    },
  );

  if (error) {
    throw new Error(messageFrom(error, 'Could not request withdrawal.'));
  }

  return data as {
    idempotent_replay: boolean;
    withdrawal: BuklodR38Withdrawal;
    remaining_available_referral_cash: number;
  };
}

export async function cancelMyBuklodR38ReferralWithdrawal(withdrawalId: string) {
  const { data, error } = await (supabase as any).rpc(
    'cancel_my_buklod_r38_referral_withdrawal_v1',
    { p_withdrawal_id: withdrawalId },
  );

  if (error) {
    throw new Error(messageFrom(error, 'Could not cancel the withdrawal request.'));
  }

  return data as BuklodR38Withdrawal;
}

export async function loadAdminBuklodR38EconomyReport(periodKey?: string | null) {
  const { data, error } = await (supabase as any).rpc(
    'admin_get_buklod_r38_economy_report_v1',
    { p_period_key: periodKey?.trim() || null },
  );

  if (error) {
    throw new Error(messageFrom(error, 'Could not load the R38 economy report.'));
  }

  return data as BuklodR38AdminEconomyReport;
}
