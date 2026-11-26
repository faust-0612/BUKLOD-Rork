import { supabase } from '@/lib/supabase';

export type BuklodClaimCard = {
  ledger_id: string;
  event_id: string;
  points: number;
  activity_type: string;
  description: string | null;
  created_at: string;
};
export type BuklodAdBonusStatus = {
  enabled: boolean;
  points: number;
  daily_limit: number;
  earned_today: number;
  remaining: number;
};

/**
 * Staging-safe manual claims: existing MAIN RLS-readable tables ONLY.
 * This path needs no migration, new RPC or changes to live Supabase.
 * The existing single-event claim RPC remains the only mutation.
 */
export async function loadBuklodClaimCards(
  offset = 0, accountId?: string,
): Promise<BuklodClaimCard[]> {
  const { data: auth, error: authError } = await supabase.auth.getSession();
  const viewerId = auth.session?.user?.id;
  if (authError || !viewerId || (accountId && viewerId !== accountId)) {
    throw new Error('Sign in again before viewing claimable rewards.');
  }

  const safeOffset = Math.max(0, Math.min(100_000, Math.trunc(offset)));
  const { data: ledgers, error: ledgerError } = await supabase
    .from('buklod_points_ledger')
    .select('id,points,activity_type,description,created_at')
    .eq('user_id', viewerId)
    .eq('direction', 'credit')
    .eq('claim_state', 'pending')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(safeOffset, safeOffset + 99);
  if (ledgerError) throw ledgerError;
  if (!ledgers?.length) return [];

  const ids = ledgers.map(entry => entry.id);
  const { data: events, error: eventError } = await supabase
    .from('buklod_reward_events')
    .select('id,source_point_id')
    .eq('user_id', viewerId)
    .eq('event_type', 'points')
    .is('claimed_at', null)
    .in('source_point_id', ids);
  if (eventError) throw eventError;

  const byLedger = new Map<string, string>();
  for (const event of events ?? []) {
    if (event.source_point_id && !byLedger.has(event.source_point_id)) {
      byLedger.set(event.source_point_id, event.id);
    }
  }
  if (byLedger.size !== ledgers.length) {
    // Fail closed instead of silently omitting earned Points that lack a
    // corresponding server claim event. This protects ledger reconciliation.
    throw new Error('Reward records are still syncing. Refresh to try again.');
  }
  return ledgers.map(entry => ({
    ledger_id: entry.id,
    event_id: byLedger.get(entry.id)!,
    points: Number(entry.points ?? 0),
    activity_type: String(entry.activity_type ?? 'other'),
    description: entry.description ? String(entry.description) : null,
    created_at: String(entry.created_at ?? ''),
  }));
}

// Staging may share MAIN's backend in the existing installation. Never
// initiate a new rewarded-credit write from staging, even if a preview env
// accidentally inherits a production flag.
const isVerifiedRewardBackendEnabled =
  process.env.EXPO_PUBLIC_APP_ENV === 'production' &&
  process.env.EXPO_PUBLIC_POINTS_REWARDED_BONUS_ENABLED === 'true';

export async function loadBuklodAdBonusStatus(): Promise<BuklodAdBonusStatus> {
  if (!isVerifiedRewardBackendEnabled) {
    return { enabled: false, points: 5, daily_limit: 20, earned_today: 0, remaining: 0 };
  }
  const { data, error } = await (supabase as any).rpc('get_my_buklod_ad_points_status_v1');
  if (error) throw error;
  return {
    enabled: data?.enabled === true,
    points: Number(data?.points ?? 5),
    daily_limit: Number(data?.daily_limit ?? 20),
    earned_today: Number(data?.earned_today ?? 0),
    remaining: Number(data?.remaining ?? 0),
  };
}

export async function prepareBuklodAdBonus(ledgerId: string): Promise<{
  nonce: string;
  points: number;
}> {
  if (!isVerifiedRewardBackendEnabled) throw new Error('Ad bonus is not active.');
  const { data, error } = await (supabase as any).rpc(
    'prepare_my_buklod_ad_points_bonus_v1', { p_source_point_id: ledgerId },
  );
  if (error) throw error;
  if (!data?.nonce) throw new Error('Reward session unavailable');
  return { nonce: String(data.nonce), points: Number(data.points ?? 5) };
}

export async function waitForBuklodAdBonus(nonce: string): Promise<boolean> {
  if (!isVerifiedRewardBackendEnabled) return false;
  // Only Google's signed SSV is allowed to credit Points. Polling is read-only.
  for (let attempt = 0; attempt < 9; attempt++) {
    const { data, error } = await (supabase as any).rpc(
      'get_my_buklod_ad_points_receipt_v1', { p_nonce: nonce },
    );
    if (!error && data?.credited === true) return true;
    if (!error && data?.found === false) return false;
    if (attempt < 8) await new Promise<void>(resolve => setTimeout(resolve, 1500));
  }
  return false;
}

/** Abandon a non-earned ad session. Safe to call more than once. */
export async function cancelBuklodAdBonus(nonce: string): Promise<void> {
  if (!isVerifiedRewardBackendEnabled) return;
  await (supabase as any).rpc(
    'cancel_my_buklod_ad_points_bonus_v1', { p_nonce: nonce },
  );
}
