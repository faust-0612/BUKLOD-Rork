import { supabase } from '@/lib/supabase';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';

export type BuklodPointsRedemptionStatus =
  | 'pending'
  | 'approved'
  | 'completed'
  | 'paid'
  | 'rejected'
  | 'cancelled';

export type BuklodPointsRedemptionRecord = {
  id: string;
  redemption_type: 'bayanihan' | 'cash_reward';
  points_spent: number;
  conversion_rate: number;
  destination_amount: number;
  destination_unit: 'BAYANIHAN_CREDIT' | 'PHP';
  status: BuklodPointsRedemptionStatus;
  payout_method: string | null;
  payout_account: string | null;
  admin_note: string | null;
  payout_reference: string | null;
  reviewed_at: string | null;
  fulfilled_at: string | null;
  created_at: string;
};

export type BuklodPointsRedemptionCenter = {
  lifetime_points: number;
  available_points: number;
  reserved_points: number;
  spendable_points: number;
  bayanihan: {
    enabled: boolean;
    units_per_point: number;
  };
  cash_reward: {
    enabled: boolean;
    php_per_point: number | null;
    min_points: number;
    max_points: number | null;
  };
  history: BuklodPointsRedemptionRecord[];
};

export type BuklodPointsRedemptionActionResult = {
  redemption_id: string;
  redemption_type?: 'bayanihan' | 'cash_reward';
  status: BuklodPointsRedemptionStatus;
  points_spent?: number;
  destination_amount?: number;
  destination_unit?: 'BAYANIHAN_CREDIT' | 'PHP';
  lifetime_points?: number;
  available_points: number;
  reserved_points?: number;
  payout_reference?: string | null;
  idempotent_replay?: boolean;
};

export type BuklodPointsRedemptionAdminConfig = {
  bayanihan_enabled: boolean;
  bayanihan_units_per_point: number;
  cash_reward_enabled: boolean;
  cash_php_per_point: number | null;
  cash_min_points: number;
  cash_max_points: number | null;
};

export type BuklodCashRewardAdminRequest = {
  id: string;
  user_id: string;
  full_name: string;
  points_spent: number;
  conversion_rate: number;
  destination_amount: number;
  status: BuklodPointsRedemptionStatus;
  payout_method: string | null;
  payout_account: string | null;
  admin_note: string | null;
  payout_reference: string | null;
  reviewed_at: string | null;
  fulfilled_at: string | null;
  created_at: string;
};

export type BuklodPointsRedemptionAdminCenter = {
  config: BuklodPointsRedemptionAdminConfig;
  requests: BuklodCashRewardAdminRequest[];
};

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNullableNumber(value: unknown) {
  if (value == null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function redemptionReadRpc(
  name: string,
  args?: Record<string, unknown>,
) {
  return withBuklodTimeout<any>(
    (supabase as any).rpc(name, args),
    8_000,
    `BUKLOD redemption ${name}`,
  );
}

function textOrNull(value: unknown) {
  if (value == null || value === '') {
    return null;
  }

  return String(value);
}

function normalizeRecord(
  value: Record<string, unknown>,
): BuklodPointsRedemptionRecord {
  return {
    id: String(value.id ?? ''),
    redemption_type:
      value.redemption_type === 'cash_reward'
        ? 'cash_reward'
        : 'bayanihan',
    points_spent: toNumber(value.points_spent),
    conversion_rate: toNumber(value.conversion_rate),
    destination_amount: toNumber(value.destination_amount),
    destination_unit:
      value.destination_unit === 'PHP'
        ? 'PHP'
        : 'BAYANIHAN_CREDIT',
    status: String(
      value.status ?? 'pending',
    ) as BuklodPointsRedemptionStatus,
    payout_method: textOrNull(value.payout_method),
    payout_account: textOrNull(value.payout_account),
    admin_note: textOrNull(value.admin_note),
    payout_reference: textOrNull(value.payout_reference),
    reviewed_at: textOrNull(value.reviewed_at),
    fulfilled_at: textOrNull(value.fulfilled_at),
    created_at: String(value.created_at ?? new Date(0).toISOString()),
  };
}

function normalizeAction(
  data: Record<string, unknown> | null | undefined,
): BuklodPointsRedemptionActionResult {
  return {
    redemption_id: String(data?.redemption_id ?? ''),
    redemption_type:
      data?.redemption_type === 'cash_reward'
        ? 'cash_reward'
        : data?.redemption_type === 'bayanihan'
          ? 'bayanihan'
          : undefined,
    status: String(
      data?.status ?? 'pending',
    ) as BuklodPointsRedemptionStatus,
    points_spent:
      data?.points_spent == null
        ? undefined
        : toNumber(data.points_spent),
    destination_amount:
      data?.destination_amount == null
        ? undefined
        : toNumber(data.destination_amount),
    destination_unit:
      data?.destination_unit === 'PHP'
        ? 'PHP'
        : data?.destination_unit === 'BAYANIHAN_CREDIT'
          ? 'BAYANIHAN_CREDIT'
          : undefined,
    lifetime_points:
      data?.lifetime_points == null
        ? undefined
        : toNumber(data.lifetime_points),
    available_points: toNumber(data?.available_points),
    reserved_points:
      data?.reserved_points == null
        ? undefined
        : toNumber(data.reserved_points),
    payout_reference: textOrNull(data?.payout_reference),
    idempotent_replay: Boolean(data?.idempotent_replay),
  };
}

export function createBuklodPointsRedemptionRequestKey(
  prefix: 'bayanihan' | 'cash_reward',
) {
  return [
    'buklod-points',
    prefix,
    Date.now().toString(36),
    Math.random().toString(36).slice(2, 10),
  ].join(':');
}

export async function loadBuklodPointsRedemptionCenter(): Promise<BuklodPointsRedemptionCenter> {
  const { data, error } = await redemptionReadRpc(
    'get_my_buklod_redemption_center_v1',
  );

  if (error) {
    throw error;
  }

  const row = (data ?? {}) as Record<string, unknown>;
  const bayanihan =
    row.bayanihan && typeof row.bayanihan === 'object'
      ? (row.bayanihan as Record<string, unknown>)
      : {};
  const cashReward =
    row.cash_reward && typeof row.cash_reward === 'object'
      ? (row.cash_reward as Record<string, unknown>)
      : {};
  const history = Array.isArray(row.history)
    ? row.history
        .filter(
          (item): item is Record<string, unknown> =>
            !!item && typeof item === 'object',
        )
        .map(normalizeRecord)
    : [];

  /* BUKLOD_BAYANIHAN_ACCOUNTING_VIEW_R4
   * User-visible balances fail closed and preserve the accounting invariant:
   * spendable <= available <= lifetime, reserved <= available.
   */
  const lifetimePoints = Math.max(0, toNumber(row.lifetime_points));
  const availablePoints = Math.max(
    0,
    Math.min(lifetimePoints, toNumber(row.available_points)),
  );
  const reservedPoints = Math.max(
    0,
    Math.min(availablePoints, toNumber(row.reserved_points)),
  );
  const spendablePoints = Math.max(
    0,
    Math.min(
      availablePoints,
      toNumber(row.spendable_points, availablePoints - reservedPoints),
    ),
  );

  return {
    lifetime_points: lifetimePoints,
    available_points: availablePoints,
    reserved_points: reservedPoints,
    spendable_points: spendablePoints,
    bayanihan: {
      enabled: Boolean(bayanihan.enabled),
      units_per_point: toNumber(bayanihan.units_per_point, 1),
    },
    cash_reward: {
      enabled: Boolean(cashReward.enabled),
      php_per_point: toNullableNumber(cashReward.php_per_point),
      min_points: toNumber(cashReward.min_points, 1),
      max_points: toNullableNumber(cashReward.max_points),
    },
    history,
  };
}

export async function convertBuklodPointsToBayanihan(
  points: number,
  requestKey: string,
) {
  const { data, error } = await (supabase as any).rpc(
    'convert_my_buklod_points_to_bayanihan_v1',
    {
      p_points: points,
      p_request_key: requestKey,
    },
  );

  if (error) {
    throw error;
  }

  return normalizeAction(
    (data ?? {}) as Record<string, unknown>,
  );
}

export async function requestBuklodCashReward(input: {
  points: number;
  payoutMethod: string;
  payoutAccount: string;
  requestKey: string;
}) {
  const { data, error } = await (supabase as any).rpc(
    'request_my_buklod_cash_reward_v1',
    {
      p_points: input.points,
      p_payout_method: input.payoutMethod,
      p_payout_account: input.payoutAccount,
      p_request_key: input.requestKey,
    },
  );

  if (error) {
    throw error;
  }

  return normalizeAction(
    (data ?? {}) as Record<string, unknown>,
  );
}

export async function cancelBuklodCashReward(
  redemptionId: string,
) {
  const { data, error } = await (supabase as any).rpc(
    'cancel_my_buklod_cash_reward_v1',
    {
      p_redemption_id: redemptionId,
    },
  );

  if (error) {
    throw error;
  }

  return normalizeAction(
    (data ?? {}) as Record<string, unknown>,
  );
}

function normalizeAdminCenter(
  data: Record<string, unknown> | null | undefined,
): BuklodPointsRedemptionAdminCenter {
  const config =
    data?.config && typeof data.config === 'object'
      ? (data.config as Record<string, unknown>)
      : {};
  const rawRequests = data?.requests;
  const requests = Array.isArray(rawRequests)
    ? rawRequests
        .filter(
          (item): item is Record<string, unknown> =>
            !!item && typeof item === 'object',
        )
        .map((row) => ({
          id: String(row.id ?? ''),
          user_id: String(row.user_id ?? ''),
          full_name: String(row.full_name ?? 'BUKLOD Member'),
          points_spent: toNumber(row.points_spent),
          conversion_rate: toNumber(row.conversion_rate),
          destination_amount: toNumber(row.destination_amount),
          status: String(
            row.status ?? 'pending',
          ) as BuklodPointsRedemptionStatus,
          payout_method: textOrNull(row.payout_method),
          payout_account: textOrNull(row.payout_account),
          admin_note: textOrNull(row.admin_note),
          payout_reference: textOrNull(row.payout_reference),
          reviewed_at: textOrNull(row.reviewed_at),
          fulfilled_at: textOrNull(row.fulfilled_at),
          created_at: String(
            row.created_at ?? new Date(0).toISOString(),
          ),
        }))
    : [];

  return {
    config: {
      bayanihan_enabled: Boolean(config.bayanihan_enabled),
      bayanihan_units_per_point: toNumber(
        config.bayanihan_units_per_point,
        1,
      ),
      cash_reward_enabled: Boolean(config.cash_reward_enabled),
      cash_php_per_point: toNullableNumber(
        config.cash_php_per_point,
      ),
      cash_min_points: toNumber(config.cash_min_points, 1),
      cash_max_points: toNullableNumber(config.cash_max_points),
    },
    requests,
  };
}

export async function adminLoadBuklodPointsRedemptionCenter(
  limit = 100,
) {
  const { data, error } = await (supabase as any).rpc(
    'admin_get_buklod_points_redemption_center_v1',
    {
      p_limit: limit,
    },
  );

  if (error) {
    throw error;
  }

  return normalizeAdminCenter(
    (data ?? {}) as Record<string, unknown>,
  );
}

export async function adminSaveBuklodPointsRedemptionConfig(
  config: BuklodPointsRedemptionAdminConfig,
) {
  const { data, error } = await (supabase as any).rpc(
    'admin_set_buklod_points_redemption_config_v1',
    {
      p_bayanihan_enabled: config.bayanihan_enabled,
      p_bayanihan_units_per_point:
        config.bayanihan_units_per_point,
      p_cash_reward_enabled: config.cash_reward_enabled,
      p_cash_php_per_point: config.cash_php_per_point,
      p_cash_min_points: config.cash_min_points,
      p_cash_max_points: config.cash_max_points,
    },
  );

  if (error) {
    throw error;
  }

  return normalizeAdminCenter(
    (data ?? {}) as Record<string, unknown>,
  );
}

export async function adminReviewBuklodCashReward(
  redemptionId: string,
  approve: boolean,
  note?: string,
) {
  const { data, error } = await (supabase as any).rpc(
    'admin_review_buklod_cash_reward_v1',
    {
      p_redemption_id: redemptionId,
      p_approve: approve,
      p_note: note ?? null,
    },
  );

  if (error) {
    throw error;
  }

  return normalizeAction(
    (data ?? {}) as Record<string, unknown>,
  );
}

export async function adminMarkBuklodCashRewardPaid(
  redemptionId: string,
  payoutReference: string,
  note?: string,
) {
  const { data, error } = await (supabase as any).rpc(
    'admin_mark_buklod_cash_reward_paid_v1',
    {
      p_redemption_id: redemptionId,
      p_payout_reference: payoutReference,
      p_note: note ?? null,
    },
  );

  if (error) {
    throw error;
  }

  return normalizeAction(
    (data ?? {}) as Record<string, unknown>,
  );
}
