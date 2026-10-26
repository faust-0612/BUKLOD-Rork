import { supabase } from '@/lib/supabase';

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
  estimate_label: string;
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

export async function loadMyCommunityContribution() {
  try {
    return await rpc<CommunityContributionDashboard>(
      'get_my_buklod_community_contribution_v2',
    );
  } catch (error) {
    // Only fall back when v2 is missing during a staged database rollout.
    // Retrying with v1 after a timeout or connection-pool failure amplifies
    // database pressure and hides the original infrastructure error.
    const code = String((error as { code?: unknown } | null)?.code ?? '');
    if (code !== '42883' && code !== 'PGRST202') throw error;
    return rpc<CommunityContributionDashboard>(
      'get_my_buklod_community_contribution_v1',
    );
  }
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

export async function adminFinalizeCommunityUserPool(periodKey: string, reason?: string) {
  return rpc<Record<string, unknown>>('admin_finalize_buklod_community_user_pool_v1', {
    p_period_key: periodKey.trim(),
    p_reason: reason?.trim() || null,
  });
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
