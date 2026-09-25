import { supabase } from '@/lib/supabase';\nimport { ensureBuklodCanonicalFinanceIdentity } from '@/lib/buklodCanonicalFinanceIdentity';

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
  user_id?: string;
  requested_amount: number;
  currency: string;
  status: string;
  payout_method: string | null;
  payout_profile_ref?: string | null;
  payout_destination_masked: string | null;
  requested_at: string;
  reviewed_at?: string | null;
  approved_at?: string | null;
  paid_at?: string | null;
  payout_transaction_ref?: string | null;
  rejection_reason?: string | null;
  failure_reason?: string | null;
};

export type BuklodR38WithdrawalHistory = {
  rows: BuklodR38Withdrawal[];
  referral_withdrawal_enabled: boolean;
  payout_processing_enabled: boolean;
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
  canonical_finance: {
    policy_version: string;
    qualified_monthly_points: number;
    total_qualified_monthly_points: number;
    estimated_pool_share_pct: number;
    estimated_user_pool_php: number;
    estimated_earnings_php: number;
    latest_finalized_user_share_php: number;
    withdrawable_php: number;
    reserved_php: number;
    paid_php: number;
    user_pool_eligibility_active: boolean;
    economics_enabled: boolean;
    withdrawal_enabled: boolean;
    referral_code: string;
    invited_count: number;
    qualified_count: number;
    one_time_reward_php: number;
    qualification_value_php: number;
    qualification_threshold_php: number;
    qualification_pct: number;
    first_line_share_pct: number;
    referral_months: number;
    referrals: Array<Record<string, unknown>>;
    community: Record<string, unknown>;
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

async function loadCanonicalFinanceSummaryWithIdentity() {
  let result = await (supabase as any).rpc(
    'get_my_buklod_financial_summary_v3',
  );

  if (
    !result.error &&
    result.data &&
    typeof result.data === 'object' &&
    (result.data as Record<string, unknown>).identity_ready === false
  ) {
    await ensureBuklodCanonicalFinanceIdentity();
    result = await (supabase as any).rpc(
      'get_my_buklod_financial_summary_v3',
    );
  }

  if (result.error) {
    throw new Error(
      messageFrom(result.error, 'Could not load the canonical BUKLOD financial summary.'),
    );
  }

  if (
    !result.data ||
    typeof result.data !== 'object' ||
    (result.data as Record<string, unknown>).identity_ready === false
  ) {
    throw new Error('Your BUKLOD financial identity is still being initialized. Please refresh.');
  }

  return result.data as Record<string, any>;
}

export async function loadMyBuklodR38EconomyReport() {
  const finance = await loadCanonicalFinanceSummaryWithIdentity();

  const [pointsResult, legacyProgressResult, referralResult] = await Promise.all([
    (supabase as any).rpc('get_my_buklod_points_dashboard'),
    (supabase as any).rpc('get_my_buklod_r38_economy_report_v1'),
    (supabase as any).rpc('get_my_buklod_referral_summary_v2'),
  ]);

  const points =
    !pointsResult.error && pointsResult.data && typeof pointsResult.data === 'object'
      ? pointsResult.data as Record<string, any>
      : {};
  const legacy =
    !legacyProgressResult.error &&
    legacyProgressResult.data &&
    typeof legacyProgressResult.data === 'object'
      ? legacyProgressResult.data as Record<string, any>
      : {};
  const referral =
    !referralResult.error && referralResult.data && typeof referralResult.data === 'object'
      ? referralResult.data as Record<string, any>
      : {};

  const progress = (finance.progress ?? {}) as Record<string, any>;
  const earnings = (finance.earnings ?? {}) as Record<string, any>;
  const referralCore = (finance.referral ?? {}) as Record<string, any>;
  const community = (finance.community ?? {}) as Record<string, any>;
  const referralItems = Array.isArray(referralCore.items) ? referralCore.items : [];

  const referralStatuses: Record<string, number> = {};
  for (const item of referralItems) {
    const status = String((item as Record<string, unknown>)?.status ?? 'UNKNOWN');
    referralStatuses[status] = (referralStatuses[status] ?? 0) + 1;
  }

  const qualifiedMonthlyPoints = asMoney(progress.qualified_monthly_points);
  const totalQualifiedMonthlyPoints = asMoney(progress.total_qualified_monthly_points);
  const estimatedEarnings = asMoney(earnings.estimated_earnings_php);
  const latestFinalizedUserShare = asMoney(earnings.latest_finalized_user_share_php);
  const availableCash = asMoney(earnings.withdrawable_php);
  const reservedCash = asMoney(earnings.reserved_php);
  const paidCash = asMoney(earnings.paid_php);

  return {
    progress: {
      lifetime_points: asMoney(progress.lifetime_points ?? points.lifetime_points ?? points.total_points),
      available_points: asMoney(points.available_points),
      pending_points: asMoney(points.pending_claimable_points),
      circle_rank: legacy?.progress?.circle_rank ?? {},
      character: legacy?.progress?.character ?? null,
      collectibles: asMoney(legacy?.progress?.collectibles),
    },
    economic_contribution: {
      qualified_bcu: qualifiedMonthlyPoints,
      current_period_bcu: totalQualifiedMonthlyPoints,
      current_period: null,
    },
    app_sharing: {
      qualified_direct_referrals: asMoney(referralCore.qualified_count),
      qualified_rcu: asMoney(referralCore.invited_count),
      current_period_rcu: asMoney(referralCore.first_line_pct),
      referral_statuses: referralStatuses,
      direct_only: true,
    },
    actual_earnings: {
      estimated_share: {
        bayanihan: estimatedEarnings,
        direct_referral: 0,
        total: estimatedEarnings,
        label: 'ESTIMATED — SUBJECT TO MONTHLY FINALIZATION',
        withdrawable: false,
      },
      finalized_share: {
        bayanihan: latestFinalizedUserShare,
        direct_referral: 0,
        total: latestFinalizedUserShare,
      },
      available_cash: {
        bayanihan: availableCash,
        direct_referral: 0,
        total: availableCash,
      },
      reserved_for_withdrawal: reservedCash,
      paid_earnings: {
        bayanihan: paidCash,
        direct_referral: 0,
        total: paidCash,
      },
      referral_withdrawal_enabled: referral.withdrawal_enabled === true,
      currency: 'PHP',
    },
    economic_invariants: {
      points_are_money: false,
      fixed_php_per_point: false,
      fixed_php_per_bcu: false,
      fixed_php_per_rcu: false,
      cash_source: 'FINALIZED_PLATFORM_VALUE_AND_MONTHLY_CANONICAL_SETTLEMENT',
      rcu_is_weight_only: true,
      bcu_is_weight_only: true,
    },
    canonical_finance: {
      policy_version: String(finance.policy_version ?? referral.policy_version ?? 'canonical_finance_v3'),
      qualified_monthly_points: qualifiedMonthlyPoints,
      total_qualified_monthly_points: totalQualifiedMonthlyPoints,
      estimated_pool_share_pct: asMoney(earnings.estimated_pool_share_pct),
      estimated_user_pool_php: asMoney(earnings.estimated_user_pool_php),
      estimated_earnings_php: estimatedEarnings,
      latest_finalized_user_share_php: latestFinalizedUserShare,
      withdrawable_php: availableCash,
      reserved_php: reservedCash,
      paid_php: paidCash,
      user_pool_eligibility_active: earnings.user_pool_eligibility_active === true,
      economics_enabled: referral.economics_enabled === true,
      withdrawal_enabled: referral.withdrawal_enabled === true,
      referral_code: String(referralCore.referral_code ?? referral.referral_code ?? ''),
      invited_count: asMoney(referralCore.invited_count ?? referral.invited_count),
      qualified_count: asMoney(referralCore.qualified_count ?? referral.qualified_count),
      one_time_reward_php: asMoney(referralCore.one_time_reward_php ?? referral.one_time_reward_php),
      qualification_value_php: asMoney(referral.my_qualification_value_php),
      qualification_threshold_php: asMoney(referral.my_qualification_threshold_php),
      qualification_pct: asMoney(referral.my_qualification_pct),
      first_line_share_pct: asMoney(referralCore.first_line_pct ?? referral.first_line_share_pct),
      referral_months: asMoney(referralCore.referral_months ?? referral.referral_months),
      referrals: referralItems,
      community,
    },
  } satisfies BuklodR38UserEconomyReport;
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

export async function loadMyBuklodR38WithdrawalHistory(limit = 50) {
  const { data, error } = await (supabase as any).rpc(
    'get_my_buklod_pf_withdrawals_v2',
    { p_limit: limit },
  );

  if (error) {
    throw new Error(messageFrom(error, 'Could not load your withdrawal history.'));
  }

  return data as BuklodR38WithdrawalHistory;
}

export async function requestMyBuklodR38ReferralWithdrawal(
  profile: BuklodR38PayoutProfile,
  idempotencyKey?: string,
) {
  const { data, error } = await (supabase as any).rpc(
    'request_my_buklod_pf_withdrawal_v2',
    {
      p_payout_method: profile.payout_method,
      p_payout_profile_ref: profile.id,
      p_destination_masked: profile.destination_masked,
      p_request_key: idempotencyKey || requestKey('pf-v3-withdrawal'),
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
    'cancel_my_buklod_pf_withdrawal_v2',
    { p_withdrawal_id: withdrawalId },
  );

  if (error) {
    throw new Error(messageFrom(error, 'Could not cancel the withdrawal request.'));
  }

  return data as BuklodR38Withdrawal;
}

export async function loadAdminBuklodR38EconomyReport(periodKey?: string | null) {
  const { data, error } = await (supabase as any).rpc(
    'admin_get_buklod_pf_financial_report_v3',
    { p_period_key: periodKey?.trim() || null },
  );

  if (error) {
    throw new Error(messageFrom(error, 'Could not load the canonical finance report.'));
  }

  const row = (data ?? {}) as Record<string, any>;
  const settlement = (row.settlement ?? null) as Record<string, any> | null;
  const shares = Array.isArray(row.user_shares) ? row.user_shares : [];

  const userPool = asMoney(settlement?.user_pool_php);
  const firstLine = asMoney(settlement?.first_line_php);
  const normalRevenue = asMoney(settlement?.normal_eligible_revenue_php);
  const prequalificationRevenue = asMoney(settlement?.prequalification_revenue_php);
  const operatingCost = asMoney(settlement?.operating_cost_php);
  const taxReserve = asMoney(settlement?.tax_reserve_php);
  const totalQualifiedPoints = asMoney(settlement?.qualified_monthly_points);

  return {
    period: settlement,
    revenue_chain: settlement
      ? {
          actual_reconciled_revenue: normalRevenue + prequalificationRevenue,
          actual_reconciled_costs: operatingCost + taxReserve,
          distributable_base: normalRevenue,
          bayanihan_pool: userPool,
          referral_pool: firstLine,
          founder: 0,
          growth: 0,
          reserve: asMoney(settlement?.qualification_reserve_closing_php),
        }
      : null,
    financial_entry_breakdown: [],
    qualified_units: settlement
      ? { bcu: totalQualifiedPoints, rcu: null }
      : null,
    user_shares: shares.map((share: Record<string, any>) => ({
      user_id: String(share.person_id ?? ''),
      full_name: 'Canonical BUKLOD member',
      pool_key: 'USER_POOL',
      qualified_units: asMoney(share.qualified_monthly_points),
      total_qualified_units: totalQualifiedPoints,
      share_ratio:
        totalQualifiedPoints > 0
          ? asMoney(share.qualified_monthly_points) / totalQualifiedPoints
          : 0,
      funded_pool_amount: userPool,
      finalized_share_amount: asMoney(share.share_php),
      effective_php_per_unit_analytics_only:
        totalQualifiedPoints > 0 ? userPool / totalQualifiedPoints : null,
    })),
    distributed: {
      bayanihan: asMoney(settlement?.user_pool_distributed_php),
      direct_referral: firstLine,
    },
    effective_rates_analytics_only: {
      php_per_bcu:
        totalQualifiedPoints > 0 ? userPool / totalQualifiedPoints : null,
      php_per_rcu: null,
      not_future_conversion_rate: true,
    },
    cash_ledger: {
      available: 0,
      reserved: 0,
      paid: 0,
      currency: 'PHP',
    },
    referral_states: {},
    withdrawals: {},
    activation: {},
    invariant_checks: {
      canonical_finance_v3: true,
      points_used_for_cash: false,
      profit_guard_passed: settlement?.status === 'FINALIZED',
    },
  } satisfies BuklodR38AdminEconomyReport;
}
