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
