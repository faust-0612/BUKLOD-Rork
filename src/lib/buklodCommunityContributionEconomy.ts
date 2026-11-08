import { supabase } from '@/lib/supabase';
import { parseCommunityQmpHistory, type CommunityQmpHistory } from '@/lib/buklodQmpHistory';

/* BUKLOD_COMMUNITY_QMP_ECONOMY_R1 */

export type CommunityReviewItem = {
  event_id: string;
  type: string;
  status: string;
  reason_category: string;
  review_eligible: boolean;
};

export type CommunityVideoQuota = {
  period_key: string;
  allowance_bytes: number;
  used_bytes: number;
  remaining_bytes: number;
  uploaded_videos: number;
  reset_at: string;
  requested_bytes?: number;
  allowed?: boolean;
  backend_unavailable?: boolean;
};

export type CommunityContributionDashboard = {
  period: { key: string; starts_at: string; ends_at: string; status: string };
  rule_version: string;
  this_month_qmp: number;
  held_qmp: number;
  total_qualified_qmp: number;
  share_weight: number;
  qualified_posts: number;
  qualified_videos: number;
  meaningful_replies: number;
  engagement_breakdown?: {
    validated_engagement_qmp: number;
    validated_engagement_events: number;
    reaction_bonus_qmp: number;
    internal_share_bonus_qmp: number;
    reply_engagement_bonus_qmp: number;
    useful_post_qmp: number;
    qualified_video_qmp: number;
    meaningful_reply_qmp: number;
    other_qmp: number;
  };
  share_weight_previous?: number;
  share_weight_delta?: number;
  contribution_level: string;
  next_level: { label: string; min_qmp: number; remaining_qmp: number } | null;
  estimated_share_minor: number | null;
  estimated_pool_minor: number;
  /** Fresh source-backed revenue preview only; absent on old server versions. */
  estimated_gross_revenue_minor?: number | null;
  /** Configured Community pool fraction in 1/100 of one percent. */
  estimated_pool_bps?: number | null;
  /** Revenue outside Community pool, including rounding cents; not net profit. */
  estimated_non_pool_revenue_minor?: number | null;
  /** Effective QMP participation fraction of gross estimated AdMob revenue. */
  estimated_share_of_total_revenue?: number | null;
  estimate_source_mode?: 'OFFICIAL_ADMOB_API' | 'ADMIN_ADMOB_REPORT' | null;
  estimate_label: string;
  estimate_status?: 'PROVISIONAL_ADMOB' | 'RECONCILED_OR_FINALIZED' | 'SOURCE_NOT_CONNECTED' | 'STALE';
  estimate_updated_at?: string | null;
  estimate_below_cent?: boolean;
  finalized_share: { amount_minor: number; status: string; finalized_at: string } | null;
  video_quota: CommunityVideoQuota;
  review_items: CommunityReviewItem[];
};

export type CommunityAdminEconomy = {
  period_key: string;
  settlement_status: string;
  video_wall: {
    revenue_minor: number;
    cost_minor: number;
    contribution_minor: number;
    margin: number | null;
    management_target: string;
    uploaded_bytes: number;
    creator_count: number;
    delivery_gb: number | null;
    watched_minutes: number | null;
    note: string;
  };
  community_contribution: {
    designated_revenue_minor: number;
    pool_percentage_bps: number;
    user_pool_minor: number;
    total_qualified_qmp: number;
    qualified_users: number;
    average_qmp: number;
    top_user_concentration: number;
    fraud_held_qmp: number;
    reversed_qmp: number;
    rounding_residue_minor: number;
    pool_status: string | null;
  };
};

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await (supabase as any).rpc(name, args);
  if (error) throw error;
  return data as T;
}

function rpcMissing(error: unknown) {
  const e = error as { code?: string; message?: string };
  return e?.code === 'PGRST202'
    || (e?.code === '42883' && /function|does not exist/i.test(e?.message || ''));
}

export async function loadMyCommunityContribution() {
  try {
    return await rpc<CommunityContributionDashboard>(
      'get_my_buklod_community_contribution_live_v1',
    );
  } catch (error) {
    if (!rpcMissing(error)) throw error;
  }
  try {
    return await rpc<CommunityContributionDashboard>(
      'get_my_buklod_community_contribution_v2',
    );
  } catch (error) {
    if (!rpcMissing(error)) throw error;
  }
  // Backward-compatible only when the additive RPCs are genuinely missing.
  return rpc<CommunityContributionDashboard>(
    'get_my_buklod_community_contribution_v1',
  );
}

/** Read-only historical QMP, separate from the finalized revenue/payout ledger. */
export async function loadMyCommunityQmpHistory(): Promise<CommunityQmpHistory> {
  const raw = await rpc<unknown>('get_my_buklod_community_qmp_history_v1');
  const parsed = parseCommunityQmpHistory(raw);
  if (!parsed) throw new Error('QMP history is unavailable or malformed');
  return parsed;
}

export async function loadMyCommunityVideoQuota() {
  return rpc<CommunityVideoQuota>('get_my_buklod_community_video_quota_v1');
}

export async function assertCommunityVideoQuotaAvailable(sizeBytes: number | null | undefined) {
  if (!Number.isFinite(Number(sizeBytes)) || Number(sizeBytes) <= 0) {
    return { allowed: true } as CommunityVideoQuota;
  }
  try {
    return await rpc<CommunityVideoQuota>('assert_my_buklod_community_video_quota_v1', {
      p_size_bytes: Math.floor(Number(sizeBytes)),
    });
  } catch {
    // Backward-compatible rollout: existing Wall video remains usable if the
    // additive backend migration has not reached the environment yet.
    return { allowed: true, backend_unavailable: true } as CommunityVideoQuota;
  }
}

export async function requestCommunityContributionReview(eventId: string, note?: string) {
  return rpc<{ id: string; status: string }>('request_my_buklod_community_qmp_review_v1', {
    p_event_id: eventId,
    p_note: note?.trim() || null,
  });
}

export async function recordCommunityEconomyAnalytics(
  eventName:
    | 'contribution_card_viewed'
    | 'increase_share_opened'
    | 'qualification_completed'
    | 'mission_completed'
    | 'level_changed'
    | 'estimated_share_viewed'
    | 'settlement_finalized'
    | 'boost_created'
    | 'premium_creator_started'
    | 'quota_reached',
  metadata: Record<string, unknown> = {},
) {
  try {
    await rpc<void>('record_buklod_community_economy_analytics_v1', {
      p_event_name: eventName,
      p_metadata: metadata,
    });
  } catch {
    // Analytics is never a Community Wall runtime dependency.
  }
}

export async function loadAdminCommunityEconomy(periodKey?: string) {
  return rpc<CommunityAdminEconomy>('admin_get_buklod_community_economy_v1', {
    p_period_key: periodKey?.trim() || null,
  });
}

export async function adminRecordCommunityWallFinancialEntry(input: {
  periodKey: string;
  direction: 'revenue' | 'cost';
  amount: number;
  category: string;
  sourceSystem: string;
  externalReference?: string;
  reconciliationState: 'ESTIMATED' | 'RECONCILED';
  userPoolDesignated: boolean;
}) {
  return rpc<Record<string, unknown>>('admin_record_buklod_community_wall_financial_entry_v1', {
    p_period_key: input.periodKey.trim(),
    p_direction: input.direction,
    p_amount: input.amount,
    p_category: input.category,
    p_source_system: input.sourceSystem.trim() || 'community_wall',
    p_external_reference: input.externalReference?.trim() || null,
    p_reconciliation_state: input.reconciliationState,
    p_user_pool_designated: input.direction === 'revenue' ? input.userPoolDesignated : false,
    p_idempotency_key: null,
  });
}

export type AdminCommunityAdmobEstimate = {
  period_key: string;
  amount_minor: number;
  source_mode: 'ADMIN_ADMOB_REPORT' | 'OFFICIAL_ADMOB_API';
  source_reference: string;
  observed_at: string;
  updated_at: string;
};

export async function adminGetCommunityAdmobEstimate(periodKey: string) {
  return rpc<AdminCommunityAdmobEstimate | null>(
    'admin_get_buklod_community_admob_estimate_v1',
    { p_period_key: periodKey.trim() },
  );
}

/** A provisional report only. Never calls cash-finalization or payout RPCs. */
export async function adminSetCommunityAdmobEstimate(input: {
  periodKey: string;
  amountPhp: number;
  sourceReference: string;
}) {
  return rpc<Record<string, unknown>>(
    'admin_set_buklod_community_admob_estimate_v1',
    {
      p_period_key: input.periodKey.trim(),
      p_amount_php: input.amountPhp,
      p_source_reference: input.sourceReference.trim(),
      p_source_mode: 'ADMIN_ADMOB_REPORT',
      p_observed_at: new Date().toISOString(),
    },
  );
}

export async function adminFinalizeCommunityUserPool(periodKey: string, reason?: string) {
  return rpc<Record<string, unknown>>('admin_finalize_buklod_community_user_pool_v1', {
    p_period_key: periodKey.trim(),
    p_reason: reason?.trim() || null,
  });
}

/** A display-only view over the server's private, source-backed QMP calculation.
 * Do not derive gross revenue by dividing a rounded Community pool by 30%.
 * When source data is stale or incomplete, hide the financial breakdown.
 */
export function getCommunityRevenueBreakdown(data: CommunityContributionDashboard) {
  if (data.estimate_status !== 'PROVISIONAL_ADMOB') return null;
  const gross = data.estimated_gross_revenue_minor;
  const pool = data.estimated_pool_minor;
  const remainder = data.estimated_non_pool_revenue_minor;
  const bps = data.estimated_pool_bps;
  if (gross == null || remainder == null || bps == null ||
      ![gross, pool, remainder, bps].every(Number.isSafeInteger) ||
      gross < 0 || pool < 0 || remainder < 0 || bps < 0 || bps > 10000 ||
      Math.floor(gross * bps / 10000) !== pool || gross - pool !== remainder) {
    return null;
  }
  const effective = data.estimated_share_of_total_revenue;
  const poolWeight = Number(data.share_weight);
  const memberRatio = data.total_qualified_qmp > 0 && Number.isFinite(poolWeight)
    ? Math.max(0, Math.min(1, poolWeight)) : null;
  if (effective != null && (!Number.isFinite(effective) || effective < 0 ||
      effective > bps / 10000 + 1e-9)) return null;
  return {
    grossMinor: gross,
    poolMinor: pool,
    remainderMinor: remainder,
    poolBps: bps,
    remainderBps: 10000 - bps,
    memberPoolFraction: memberRatio,
    memberGrossFraction: effective == null ? null : Number(effective),
    isOfficial: data.estimate_source_mode === 'OFFICIAL_ADMOB_API',
    sourceMode: data.estimate_source_mode || 'UNVERIFIED',
  };
}

export function formatCommunitySharePercent(fraction: number | null | undefined) {
  if (fraction == null || !Number.isFinite(fraction)) return '—';
  const value = Math.max(0, fraction) * 100;
  if (value > 0 && value < 0.0001) return '<0.0001%';
  return `${value.toFixed(value > 0 && value < 0.01 ? 4 : 2)}%`;
}

export function formatCommunityPoolPercent(bps: number) {
  return `${(bps / 100).toLocaleString('en-PH', { maximumFractionDigits: 2 })}%`;
}

export function formatMinorPhp(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) / 100);
}

export function formatQuotaBytes(value: number | null | undefined) {
  const n = Math.max(0, Number(value || 0));
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(0)} MB`;
  return `${Math.round(n / 1024)} KB`;
}
