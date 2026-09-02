import { supabase } from '@/lib/supabase';
import type { BuklodIntegrationAppId } from '@/lib/buklodFocusAppIntegration';
import type { BuklodFocusApp } from '@/lib/buklodFoundation';

export type FocusAppSubscriptionCode =
  | BuklodIntegrationAppId
  | 'attendance'
  | 'giving';

export type FocusAppAccessStatus = {
  scope_id: string;
  focus_app_code: string;
  display_name: string;
  annual_amount_php: number;
  currency: string;
  gcash_number: string;
  billing_interval: string;
  is_system_admin: boolean;
  is_mzb_exempt: boolean;
  is_scope_admin: boolean;
  subscription_active: boolean;
  valid_until: string | null;
  is_focus_app_admin: boolean;
  can_access: boolean;
  pending_payment: {
    id: string;
    status: string;
    gcash_reference: string;
    submitted_at: string;
  } | null;
};

export type FocusAppPaymentRequestRow = {
  id: string;
  scope_id: string;
  scope_name: string;
  focus_app_code: string;
  display_name: string;
  submitted_by: string;
  submitter_name: string;
  gcash_reference: string;
  amount_php: number;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  admin_note: string | null;
};

const FOUNDATION_TO_SUBSCRIPTION: Partial<
  Record<BuklodFocusApp, FocusAppSubscriptionCode>
> = {
  faculty: 'faculty',
  business: 'commercial',
  government: 'local',
  family: 'family',
  health: 'health',
  market: 'palengke',
  attendance: 'attendance',
  giving: 'giving',
};

export function resolveFocusAppSubscriptionCode(
  input:
    | FocusAppSubscriptionCode
    | BuklodIntegrationAppId
    | BuklodFocusApp
): FocusAppSubscriptionCode {
  const normalized = String(input).trim().toLowerCase();

  if (
    normalized === 'report' ||
    normalized === 'faculty' ||
    normalized === 'local' ||
    normalized === 'family' ||
    normalized === 'palengke' ||
    normalized === 'health' ||
    normalized === 'commercial' ||
    normalized === 'attendance' ||
    normalized === 'giving'
  ) {
    return normalized;
  }

  const mapped =
    FOUNDATION_TO_SUBSCRIPTION[normalized as BuklodFocusApp];

  return mapped ?? 'commercial';
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseAccessStatus(raw: unknown): FocusAppAccessStatus | null {
  if (!raw || typeof raw !== 'object') return null;

  const row = raw as Record<string, unknown>;
  const pendingRaw = row.pending_payment;

  let pending: FocusAppAccessStatus['pending_payment'] = null;

  if (pendingRaw && typeof pendingRaw === 'object') {
    const pendingRow = pendingRaw as Record<string, unknown>;
    const id = String(pendingRow.id ?? '').trim();

    if (id) {
      pending = {
        id,
        status: String(pendingRow.status ?? 'pending_admin'),
        gcash_reference: String(pendingRow.gcash_reference ?? ''),
        submitted_at: String(pendingRow.submitted_at ?? ''),
      };
    }
  }

  const scopeId = String(row.scope_id ?? '').trim();
  const code = String(row.focus_app_code ?? '').trim();

  if (!scopeId || !code) return null;

  return {
    scope_id: scopeId,
    focus_app_code: code,
    display_name: String(row.display_name ?? 'Focus App'),
    annual_amount_php: toNumber(row.annual_amount_php, 499),
    currency: String(row.currency ?? 'PHP'),
    gcash_number: String(row.gcash_number ?? '09811646218'),
    billing_interval: String(row.billing_interval ?? 'YEARLY'),
    is_system_admin: row.is_system_admin === true,
    is_mzb_exempt: row.is_mzb_exempt === true,
    is_scope_admin: row.is_scope_admin === true,
    subscription_active: row.subscription_active === true,
    valid_until: row.valid_until ? String(row.valid_until) : null,
    is_focus_app_admin: row.is_focus_app_admin === true,
    can_access: row.can_access === true,
    pending_payment: pending,
  };
}

function parsePaymentRows(raw: unknown): FocusAppPaymentRequestRow[] {
  if (!raw || typeof raw !== 'object') return [];

  const container = raw as Record<string, unknown>;
  const rows = container.requests;

  if (!Array.isArray(rows)) return [];

  return rows
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const id = String(row.id ?? '').trim();

      if (!id) return null;

      return {
        id,
        scope_id: String(row.scope_id ?? ''),
        scope_name: String(row.scope_name ?? 'Scope'),
        focus_app_code: String(row.focus_app_code ?? ''),
        display_name: String(row.display_name ?? ''),
        submitted_by: String(row.submitted_by ?? ''),
        submitter_name: String(row.submitter_name ?? 'Member'),
        gcash_reference: String(row.gcash_reference ?? ''),
        amount_php: toNumber(row.amount_php, 499),
        status: String(row.status ?? ''),
        created_at: String(row.created_at ?? ''),
        reviewed_at: row.reviewed_at ? String(row.reviewed_at) : null,
        admin_note: row.admin_note ? String(row.admin_note) : null,
      };
    })
    .filter(Boolean) as FocusAppPaymentRequestRow[];
}

export async function fetchFocusAppAccessStatus(
  scopeId: string,
  focusAppCode: FocusAppSubscriptionCode | BuklodIntegrationAppId | BuklodFocusApp
): Promise<FocusAppAccessStatus | null> {
  const code = resolveFocusAppSubscriptionCode(focusAppCode);

  const { data, error } = await supabase.rpc(
    'buklod_focus_app_access_status_v1',
    {
      p_scope_id: scopeId,
      p_focus_app_code: code,
    }
  );

  if (error) {
    throw error;
  }

  return parseAccessStatus(data);
}

export async function submitFocusAppPayment(
  scopeId: string,
  focusAppCode: FocusAppSubscriptionCode | BuklodIntegrationAppId | BuklodFocusApp,
  gcashReference: string
) {
  const code = resolveFocusAppSubscriptionCode(focusAppCode);

  const { data, error } = await supabase.rpc(
    'buklod_focus_app_submit_payment_v1',
    {
      p_scope_id: scopeId,
      p_focus_app_code: code,
      p_gcash_reference: gcashReference.trim(),
    }
  );

  if (error) {
    throw error;
  }

  return data;
}

export async function listFocusAppPaymentRequests(
  status = 'pending_admin',
  limit = 50
): Promise<FocusAppPaymentRequestRow[]> {
  const { data, error } = await supabase.rpc(
    'buklod_admin_list_focus_app_payments_v1',
    {
      p_status: status,
      p_limit: limit,
    }
  );

  if (error) {
    throw error;
  }

  return parsePaymentRows(data);
}

export async function reviewFocusAppPayment(
  requestId: string,
  approve: boolean,
  adminNote?: string
) {
  const { data, error } = await supabase.rpc(
    'buklod_admin_review_focus_app_payment_v1',
    {
      p_request_id: requestId,
      p_approve: approve,
      p_admin_note: adminNote ?? null,
    }
  );

  if (error) {
    throw error;
  }

  return data;
}

export function formatFocusAppValidUntil(validUntil: string | null) {
  if (!validUntil) return 'Not active';

  const date = new Date(validUntil);

  if (Number.isNaN(date.getTime())) {
    return 'Not active';
  }

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
