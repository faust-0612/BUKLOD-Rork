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

export async function loadBuklodClaimCards(offset = 0): Promise<BuklodClaimCard[]> {
  const { data, error } = await (supabase as any).rpc(
    'get_my_buklod_pending_claim_cards_v1', { p_limit: 100, p_offset: offset },
  );
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('Claim list unavailable');
  return data.map((r: Record<string, unknown>) => ({
    ledger_id: String(r.ledger_id ?? ''),
    event_id: String(r.event_id ?? ''),
    points: Number(r.points ?? 0),
    activity_type: String(r.activity_type ?? 'other'),
    description: r.description ? String(r.description) : null,
    created_at: String(r.created_at ?? ''),
  })).filter((r: BuklodClaimCard) => r.ledger_id && r.event_id && r.points > 0);
}

export async function loadBuklodAdBonusStatus(): Promise<BuklodAdBonusStatus> {
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
  const { data, error } = await (supabase as any).rpc(
    'prepare_my_buklod_ad_points_bonus_v1', { p_source_point_id: ledgerId },
  );
  if (error) throw error;
  if (!data?.nonce) throw new Error('Reward session unavailable');
  return { nonce: String(data.nonce), points: Number(data.points ?? 5) };
}

export async function waitForBuklodAdBonus(nonce: string): Promise<boolean> {
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
