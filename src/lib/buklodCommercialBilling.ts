/**
 * LOCKED FUTURE FOUNDATION — scope-based commercial billing types & read helpers.
 * Checkout, pricing, and live Xendit flows are NOT implemented here.
 * Provider confirmation mirrors giving-payment-webhook (server-only, idempotent).
 */

import { supabase } from '@/lib/supabase';

export type CommercialStatus =
  | 'NONE'
  | 'FREE'
  | 'ACTIVE'
  | 'GRACE_PERIOD'
  | 'PAST_DUE'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'MZB_EXEMPT';

export type BillingTransactionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'EXPIRED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'CANCELLED';

export type PaymentKind =
  | 'ONE_TIME'
  | 'SUBSCRIPTION_CYCLE'
  | 'SETUP_FEE'
  | 'ADD_ON';

export type EntitlementSource =
  | 'MZB_EXEMPTION'
  | 'SUBSCRIPTION'
  | 'ONE_TIME_PURCHASE'
  | 'TRIAL'
  | 'SYSTEM_GRANT';

export type ScopeEntitlementsSnapshot = {
  scope_id: string | null;
  user_id: string | null;
  commercial_root_scope_id: string | null;
  commercial_status: CommercialStatus;
  commercial_tier: string;
  is_mzb_exempt: boolean;
  paid_features_exempt: boolean;
  exemption_source: string | null;
  plan: { code: string; title: string | null } | null;
  subscription_status: string | null;
  enabled_features: string[];
  limits: Record<string, unknown>;
  valid_until: string | null;
  next_billing_at: string | null;
  billing_account_id: string | null;
  evaluation_basis: 'SCOPE';
};

export type BillingTransactionRow = {
  id: string;
  scope_id: string;
  payment_kind: PaymentKind;
  amount: number | null;
  currency: string;
  status: BillingTransactionStatus;
  provider: string;
  provider_reference_id: string | null;
  paid_at: string | null;
  failed_at: string | null;
  refunded_at: string | null;
  created_at: string;
};

export function readScopeEntitlementsSnapshot(
  data: unknown
): ScopeEntitlementsSnapshot {
  const raw =
    data && typeof data === 'object'
      ? (data as Record<string, unknown>)
      : {};

  const planRaw = raw.plan;
  const plan =
    planRaw && typeof planRaw === 'object'
      ? {
          code: String((planRaw as Record<string, unknown>).code ?? ''),
          title: (planRaw as Record<string, unknown>).title
            ? String((planRaw as Record<string, unknown>).title)
            : null,
        }
      : null;

  const features = Array.isArray(raw.enabled_features)
    ? raw.enabled_features.map((f) => String(f))
    : [];

  const limits =
    raw.limits && typeof raw.limits === 'object'
      ? (raw.limits as Record<string, unknown>)
      : {};

  return {
    scope_id: raw.scope_id ? String(raw.scope_id) : null,
    user_id: raw.user_id ? String(raw.user_id) : null,
    commercial_root_scope_id: raw.commercial_root_scope_id
      ? String(raw.commercial_root_scope_id)
      : null,
    commercial_status: String(
      raw.commercial_status ?? 'NONE'
    ) as CommercialStatus,
    commercial_tier: String(raw.commercial_tier ?? 'STANDARD'),
    is_mzb_exempt: Boolean(raw.is_mzb_exempt),
    paid_features_exempt: Boolean(
      raw.paid_features_exempt ?? raw.is_mzb_exempt
    ),
    exemption_source: raw.exemption_source
      ? String(raw.exemption_source)
      : null,
    plan: plan?.code ? plan : null,
    subscription_status: raw.subscription_status
      ? String(raw.subscription_status)
      : null,
    enabled_features: features,
    limits,
    valid_until: raw.valid_until
      ? String(raw.valid_until)
      : null,
    next_billing_at: raw.next_billing_at
      ? String(raw.next_billing_at)
      : null,
    billing_account_id: raw.billing_account_id
      ? String(raw.billing_account_id)
      : null,
    evaluation_basis: 'SCOPE',
  };
}

let entitlementsCache = new Map<string, ScopeEntitlementsSnapshot>();

export async function fetchScopeEntitlements(
  scopeId: string,
  forceRefresh = false
): Promise<ScopeEntitlementsSnapshot> {
  const id = String(scopeId ?? '').trim();

  if (!id) {
    return readScopeEntitlementsSnapshot(null);
  }

  if (!forceRefresh && entitlementsCache.has(id)) {
    return entitlementsCache.get(id)!;
  }

  const { data, error } = await (supabase as any).rpc(
    'buklod_scope_entitlements_v1',
    { p_scope_id: id }
  );

  if (error) {
    throw error;
  }

  const snapshot = readScopeEntitlementsSnapshot(data);
  entitlementsCache.set(id, snapshot);
  return snapshot;
}

export function clearScopeEntitlementsCache(scopeId?: string) {
  if (!scopeId) {
    entitlementsCache.clear();
    return;
  }

  entitlementsCache.delete(String(scopeId).trim());
}

export async function fetchBillingTransactions(
  scopeId: string,
  limit = 25,
  offset = 0
): Promise<{ rows: BillingTransactionRow[]; total: number }> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_billing_transactions_list_v1',
    {
      p_scope_id: scopeId,
      p_limit: limit,
      p_offset: offset,
    }
  );

  if (error) {
    throw error;
  }

  const raw =
    data && typeof data === 'object'
      ? (data as Record<string, unknown>)
      : {};

  const rows = Array.isArray(raw.rows)
    ? raw.rows.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          id: String(r.id),
          scope_id: String(r.scope_id),
          payment_kind: String(r.payment_kind) as PaymentKind,
          amount:
            r.amount === null || r.amount === undefined
              ? null
              : Number(r.amount),
          currency: String(r.currency ?? 'PHP'),
          status: String(r.status) as BillingTransactionStatus,
          provider: String(r.provider ?? 'XENDIT'),
          provider_reference_id: r.provider_reference_id
            ? String(r.provider_reference_id)
            : null,
          paid_at: r.paid_at ? String(r.paid_at) : null,
          failed_at: r.failed_at ? String(r.failed_at) : null,
          refunded_at: r.refunded_at ? String(r.refunded_at) : null,
          created_at: String(r.created_at),
        };
      })
    : [];

  return {
    rows,
    total: Number(raw.total ?? 0),
  };
}

export async function isBillingManager(scopeId: string): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_scope_is_billing_manager_v1',
    { p_scope_id: scopeId }
  );

  if (error) {
    throw error;
  }

  return Boolean(data);
}

/**
 * Checkout return routes must show PROCESSING — never treat as PAID.
 * Authoritative state comes from provider webhook + service_role RPCs.
 */
export const COMMERCIAL_PAYMENT_PENDING_MESSAGE =
  'Processing payment. Your plan activates after secure provider confirmation.';
