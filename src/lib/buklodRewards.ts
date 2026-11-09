import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { supabase } from '@/lib/supabase';
import { cachedQuery, invalidateCache } from '@/lib/performance';
import { ensureBuklodProfitFirstIdentity, attachBuklodReferral, captureBuklodReferralCode } from '@/lib/buklodReferralV2';

export type BuklodPointsDashboard = {
  total_points: number;
  lifetime_points: number;
  available_points: number;
  pending_claimable_points: number;
  weekly_points: number;
  monthly_points: number;
  weekly_rank: number | null;
  monthly_rank: number | null;
  all_time_rank: number | null;
};

export type BuklodRewardEvent = {
  id: string;
  event_type: 'points' | 'rank_up' | 'achievement';
  points: number | null;
  activity_type: string | null;
  rank_code: string | null;
  rank_name: string | null;
  title: string;
  message: string | null;
  spoken_message: string | null;
  created_at: string;
};

export type BuklodClaimResult = {
  claimed_points: number;
  lifetime_points: number;
  available_points: number;
  rank_up: boolean;
  rank_name: string | null;
  ack_only?: boolean;
};

export type BuklodClaimGroup = {
  group_key: string;
  group_label: string;
  event_count: number;
  total_points: number;
};

export type BuklodClaimGroupResult = {
  group_key: string;
  claimed_count: number;
  claimed_points: number;
  lifetime_points: number;
  available_points: number;
  rank_up: boolean;
  rank_name: string | null;
  remaining_count: number;
};

const POINTS_CACHE_PREFIX = 'buklod:points:';
const CLAIM_ALL_COMPAT_EVENT_ID = '__buklod_claim_all_eligible__';

async function getAuthScopedPointsCacheKey(suffix: string) {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id ?? 'anonymous';
  return `${POINTS_CACHE_PREFIX}${userId}:${suffix}`;
}

async function invalidateMyPointsCache() {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (userId) {
    invalidateCache(`${POINTS_CACHE_PREFIX}${userId}:`);
  }
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizePointsDashboard(
  data: Record<string, unknown> | null | undefined,
): BuklodPointsDashboard {
  const lifetime = toNumber(
    data?.lifetime_points ?? data?.total_points,
  );

  return {
    total_points: lifetime,
    lifetime_points: lifetime,
    available_points: toNumber(data?.available_points, lifetime),
    pending_claimable_points: toNumber(data?.pending_claimable_points),
    weekly_points: toNumber(data?.weekly_points),
    monthly_points: toNumber(data?.monthly_points),
    weekly_rank:
      data?.weekly_rank == null
        ? null
        : toNumber(data.weekly_rank),
    monthly_rank:
      data?.monthly_rank == null
        ? null
        : toNumber(data.monthly_rank),
    all_time_rank:
      data?.all_time_rank == null
        ? null
        : toNumber(data.all_time_rank),
  };
}

export async function loadBuklodPointsDashboard(): Promise<BuklodPointsDashboard | null> {
  const cacheKey = await getAuthScopedPointsCacheKey('dashboard');

  return cachedQuery(
    cacheKey,
    async () => {
      const { data, error } = await (supabase as any).rpc(
        'get_my_buklod_points_dashboard',
      );

      if (error) {
        throw error;
      }

      if (!data || typeof data !== 'object') {
        return null;
      }

      return normalizePointsDashboard(data as Record<string, unknown>);
    },
    { ttlMs: 60_000, staleMs: 120_000 },
  );
}

export async function loadBuklodClaimGroups(): Promise<BuklodClaimGroup[]> {
  const cacheKey = await getAuthScopedPointsCacheKey('claim-groups');

  return cachedQuery(
    cacheKey,
    async () => {
      const { data, error } = await (supabase as any).rpc(
        'get_my_buklod_claim_groups_v1',
      );

      if (error) {
        throw error;
      }

      if (!Array.isArray(data)) {
        return [];
      }

      return data
        .map((raw: Record<string, unknown>) => ({
          group_key: String(raw.group_key ?? ''),
          group_label: String(raw.group_label ?? 'Other'),
          event_count: toNumber(raw.event_count),
          total_points: toNumber(raw.total_points),
        }))
        .filter(
          (group: BuklodClaimGroup) =>
            Boolean(group.group_key) &&
            group.event_count > 0 &&
            group.total_points > 0,
        );
    },
    { ttlMs: 5_000, staleMs: 12_000 },
  );
}

/**
 * Compatibility loader for screens that still render one reward card.
 *
 * When there are pending point-ledger rows, expose ONE synthetic Claim All
 * card representing only eligible completed activities. Its claim handler
 * below routes to the atomic server-side Claim All RPC. Rank/achievement
 * acknowledgement cards continue to use the legacy event endpoint after the
 * pending points are exhausted.
 */
export async function loadPendingBuklodRewardEvent(): Promise<BuklodRewardEvent | null> {
  const cacheKey = await getAuthScopedPointsCacheKey('pending-reward');

  return cachedQuery(
    cacheKey,
    async () => {
      const groups = await loadBuklodClaimGroups();

      if (groups.length > 0) {
        const totalPoints = groups.reduce(
          (sum, group) => sum + group.total_points,
          0,
        );
        const totalEvents = groups.reduce(
          (sum, group) => sum + group.event_count,
          0,
        );

        return {
          id: CLAIM_ALL_COMPAT_EVENT_ID,
          event_type: 'points',
          points: totalPoints,
          activity_type: 'claim_all',
          rank_code: null,
          rank_name: null,
          title: 'BUKLOD Points Ready',
          message:
            `${totalEvents.toLocaleString('en-PH')} completed ${
              totalEvents === 1 ? 'activity is' : 'activities are'
            } ready to claim.`,
          spoken_message: null,
          created_at: new Date().toISOString(),
        } satisfies BuklodRewardEvent;
      }

      const { data, error } = await supabase.rpc(
        'get_my_pending_buklod_reward_event',
      );

      if (error) {
        throw error;
      }

      return (data ?? null) as BuklodRewardEvent | null;
    },
    { ttlMs: 5_000, staleMs: 12_000 },
  );
}

export async function claimBuklodRewardEvent(
  eventId: string,
): Promise<BuklodClaimResult> {
  const rpcName =
    eventId === CLAIM_ALL_COMPAT_EVENT_ID
      ? 'claim_all_my_buklod_reward_events_v1'
      : 'claim_my_buklod_reward_event';

  const args =
    eventId === CLAIM_ALL_COMPAT_EVENT_ID
      ? undefined
      : { p_event_id: eventId };

  const { data, error } = await (supabase as any).rpc(
    rpcName,
    args,
  );

  if (error) {
    throw error;
  }

  await invalidateMyPointsCache();

  const row = (data ?? {}) as Record<string, unknown>;

  return {
    claimed_points: toNumber(row.claimed_points),
    lifetime_points: toNumber(row.lifetime_points),
    available_points: toNumber(row.available_points),
    rank_up: Boolean(row.rank_up),
    rank_name: row.rank_name ? String(row.rank_name) : null,
    ack_only: Boolean(row.ack_only),
  };
}

export async function claimBuklodRewardGroup(
  groupKey: string,
): Promise<BuklodClaimGroupResult> {
  const { data, error } = await (supabase as any).rpc(
    'claim_my_buklod_reward_group_v1',
    { p_group_key: groupKey.trim().toLowerCase() },
  );

  if (error) {
    throw error;
  }

  await invalidateMyPointsCache();

  const row = (data ?? {}) as Record<string, unknown>;

  return {
    group_key: String(row.group_key ?? groupKey),
    claimed_count: toNumber(row.claimed_count),
    claimed_points: toNumber(row.claimed_points),
    lifetime_points: toNumber(row.lifetime_points),
    available_points: toNumber(row.available_points),
    rank_up: Boolean(row.rank_up),
    rank_name: row.rank_name ? String(row.rank_name) : null,
    remaining_count: toNumber(row.remaining_count),
  };
}

export async function loadUnclaimedBuklodRewardCount(): Promise<number> {
  const cacheKey = await getAuthScopedPointsCacheKey('unclaimed-count');

  return cachedQuery(
    cacheKey,
    async () => {
      const { data, error } = await supabase.rpc(
        'get_my_unclaimed_buklod_reward_count',
      );

      if (error) {
        throw error;
      }

      return toNumber(data);
    },
    { ttlMs: 8_000, staleMs: 20_000 },
  );
}

export type BuklodRedeemCatalogItem = {
  id: string;
  title: string;
  description: string | null;
  cost_points: number;
  category: string;
  sort_order: number;
};

export type BuklodRedeemResult = {
  catalog_id: string;
  title: string;
  redeemed_points: number;
  lifetime_points: number;
  available_points: number;
};

export async function loadRedeemCatalog(): Promise<BuklodRedeemCatalogItem[]> {
  const { data, error } = await (supabase as any).rpc(
    'get_buklod_redeem_catalog_v1',
  );

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data.map((row: Record<string, unknown>) => ({
    id: String(row.id ?? ''),
    title: String(row.title ?? ''),
    description: row.description ? String(row.description) : null,
    cost_points: toNumber(row.cost_points),
    category: String(row.category ?? 'general'),
    sort_order: toNumber(row.sort_order),
  }));
}

export async function redeemCatalogItem(
  catalogId: string,
): Promise<BuklodRedeemResult> {
  const { data, error } = await (supabase as any).rpc(
    'redeem_buklod_catalog_item_v1',
    { p_catalog_id: catalogId },
  );

  if (error) {
    throw error;
  }

  await invalidateMyPointsCache();

  const row = (data ?? {}) as Record<string, unknown>;

  return {
    catalog_id: String(row.catalog_id ?? catalogId),
    title: String(row.title ?? ''),
    redeemed_points: toNumber(row.redeemed_points),
    lifetime_points: toNumber(row.lifetime_points),
    available_points: toNumber(row.available_points),
  };
}

export type RevenueSplitConfig = {
  creator_pool_pct: number;
  referral_pool_pct: number;
  points_budget_pct: number;
  operations_pct: number;
};

export async function loadRevenueSplitConfig(): Promise<RevenueSplitConfig | null> {
  const { data, error } = await (supabase as any).rpc(
    'get_buklod_revenue_split_config_v1',
  );

  if (error || !data || typeof data !== 'object') {
    return null;
  }

  const row = data as Record<string, unknown>;

  return {
    creator_pool_pct: toNumber(row.creator_pool_pct, 40),
    referral_pool_pct: toNumber(row.referral_pool_pct, 5),
    points_budget_pct: toNumber(row.points_budget_pct, 10),
    operations_pct: toNumber(row.operations_pct, 45),
  };
}

export async function saveRevenueSplitConfig(input: RevenueSplitConfig) {
  const { error } = await (supabase as any).rpc(
    'admin_set_buklod_revenue_split_config_v1',
    {
      p_creator_pool_pct: input.creator_pool_pct,
      p_referral_pool_pct: input.referral_pool_pct,
      p_points_budget_pct: input.points_budget_pct,
      p_operations_pct: input.operations_pct,
    },
  );

  if (error) {
    throw error;
  }
}

export type ReferralSummary = {
  referral_code: string;
  invited_count: number;
  qualified_count: number;
  was_referred: boolean;
  legacy_code?: string;
  legacy_invited_count?: number;
  legacy_unreconciled_count?: number;
  financial_invited_count?: number;
  reconciled?: boolean;
};

export type ReferralSuggestItem = {
  username: string | null;
  label: string;
  referral_code: string;
  match_kind: string;
};

export type ReferralResolveResult = {
  found: boolean;
  username?: string | null;
  label?: string;
  referral_code?: string;
  canonical_referral_code?: string;
  message?: string;
};

export async function loadReferralSummary(): Promise<ReferralSummary | null> {
  // The canonical code is the SAME one used by Economy and the Life share link.
  // Historical invitations remain visible; they cannot create cash earnings.
  await ensureBuklodProfitFirstIdentity();
  const { data, error } = await (supabase as any).rpc('get_my_buklod_referral_reconciliation_v1');
  if (!error && data?.identity_ready === true && data.referral_code) {
    const row = data as Record<string, unknown>;
    return {
      referral_code: String(row.referral_code),
      invited_count: toNumber(row.invited_count),
      qualified_count: toNumber(row.financial_qualified_count),
      legacy_code: String(row.legacy_code ?? ''),
      legacy_invited_count: toNumber(row.legacy_invited_count),
      legacy_unreconciled_count: toNumber(row.legacy_unreconciled_count),
      financial_invited_count: toNumber(row.financial_invited_count),
      was_referred: row.was_referred === true,
      reconciled: true,
    };
  }
  // Fail closed rather than silently offering an obsolete alias that the
  // canonical registration flow may no longer accept.
  if (error) throw new Error(String(error.message ?? 'Could not load canonical invite details.'));
  return null;
}

export async function suggestReferralTargets(
  query: string,
  limit = 8,
): Promise<ReferralSuggestItem[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const { data, error } = await withBuklodTimeout<{ data: any; error: any }>((supabase as any).rpc(
    'suggest_buklod_referral_targets_v1',
    {
      p_query: trimmed,
      p_limit: limit,
    },
  ), 5000, 'Referral lookup');

  if (error) throw error;
  if (!data || typeof data !== 'object' || !Array.isArray(data.items)) {
    throw new Error('Could not check this referral right now. Try again.');
  }

  const items = Array.isArray((data as any).items)
    ? ((data as any).items as unknown[])
    : [];

  return items
    .map((row) => {
      const item = row as Record<string, unknown>;
      const code = String(item.referral_code ?? '').trim();
      const label = String(item.label ?? item.username ?? '').trim();
      if (!code || !label) return null;
      return {
        username: item.username ? String(item.username) : null,
        label,
        referral_code: code,
        match_kind: String(item.match_kind ?? ''),
      } satisfies ReferralSuggestItem;
    })
    .filter(Boolean) as ReferralSuggestItem[];
}

export async function resolveReferralTarget(
  query: string,
): Promise<ReferralResolveResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      found: false,
      message: 'Enter a BUKLOD account name or invite code.',
    };
  }

  const { data, error } = await withBuklodTimeout<{ data: any; error: any }>((supabase as any).rpc(
    'resolve_buklod_referral_target_v1',
    { p_query: trimmed },
  ), 5000, 'Referral lookup');

  if (error) throw error;
  if (!data || typeof data !== 'object' || typeof data.found !== 'boolean') {
    throw new Error('Could not check this referral right now. Try again.');
  }

  const row = data as Record<string, unknown>;
  if (!Boolean(row.found)) {
    return {
      found: false,
      message: String(
        row.message ??
          'No matching BUKLOD account was found. Try the account name or invite code.',
      ),
    };
  }

  return {
    found: true,
    username: row.username ? String(row.username) : null,
    label: String(row.label ?? 'BUKLOD member'),
    referral_code: String(row.referral_code ?? ''),
    canonical_referral_code: String(row.canonical_referral_code ?? ''),
  };
}

export async function recordReferral(
  referrerCode: string,
  _options: { alreadyResolved?: boolean } = {},
) {
  const value = referrerCode.trim();
  if (!value) throw new Error('Referral code required');
  // Resolve even if the user selected a suggestion: that suggestion may carry
  // an historical alias while their published Economy code is canonical.
  const resolved = await resolveReferralTarget(value);
  if (!resolved.found) throw new Error(resolved.message || 'Referral not found.');
  const legacyCode = String(resolved.referral_code ?? '').trim();
  const canonicalCode = String(resolved.canonical_referral_code ?? '').trim();
  if (!legacyCode) throw new Error('Referral identity unavailable.');
  const { error } = await (supabase as any).rpc(
    'buklod_record_referral_v1', { p_referrer_code: legacyCode },
  );
  if (error && !/already recorded/i.test(String(error.message ?? ''))) throw error;

  if (canonicalCode) {
    // Durable pending attribution: if the edge function or network fails,
    // bootstrap can retry safely on the next authenticated session.
    await captureBuklodReferralCode(canonicalCode, 'SIGNUP_FORM');
    try {
      await attachBuklodReferral(canonicalCode);
    } catch (attachError) {
      throw new Error('Invitation recorded. Financial referral linking is pending; it will retry after sign-in.');
    }
  }
}
