import { supabase } from '@/lib/supabase';
import {
  BUKLOD_COMMERCIAL_PRODUCTS,
  BUKLOD_PAID_FEATURES_ENABLED,
  type BuklodCommercialProductCode,
} from '@/lib/buklodCommercialCatalog';

export type BuklodProductEntitlementStatus =
  | 'NOT_PURCHASED'
  | 'PENDING'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'REJECTED';

export type BuklodScopeProductAccess = {
  product_code: BuklodCommercialProductCode;
  display_name: string;
  amount_php: number;
  billing_kind: 'ONE_TIME' | 'ANNUAL' | 'MONTHLY';
  status: BuklodProductEntitlementStatus;
  activated_at: string | null;
  expires_at: string | null;
  pending_payment_id: string | null;
  can_purchase: boolean;
  organization_id: string | null;
  needs_organization_link: boolean;
};

export type BuklodScopeCommercialSnapshot = {
  scope_id: string;
  scope_type: string;
  organization_id: string | null;
  needs_organization_link: boolean;
  is_billing_manager: boolean;
  is_member: boolean;
  gcash_number: string;
  products: BuklodScopeProductAccess[];
};

export type BuklodProductPaymentRow = {
  id: string;
  scope_id: string;
  scope_name: string | null;
  product_code: string;
  submitted_by: string;
  submitter_name: string;
  gcash_reference: string;
  amount_php: number;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  admin_note: string | null;
};

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function parseProduct(
  raw: unknown,
): BuklodScopeProductAccess | null {
  const row = asRecord(raw);
  if (!row) return null;

  const code = String(row.product_code ?? '').trim() as BuklodCommercialProductCode;
  const catalog = BUKLOD_COMMERCIAL_PRODUCTS[code];
  if (!catalog) return null;

  const statusRaw = String(row.status ?? 'NOT_PURCHASED')
    .trim()
    .toUpperCase();
  const status: BuklodProductEntitlementStatus =
    statusRaw === 'ACTIVE' ||
    statusRaw === 'PENDING' ||
    statusRaw === 'EXPIRED' ||
    statusRaw === 'REJECTED' ||
    statusRaw === 'NOT_PURCHASED'
      ? statusRaw
      : 'NOT_PURCHASED';

  return {
    product_code: code,
    display_name: String(row.display_name ?? catalog.displayName),
    amount_php: toNumber(row.amount_php, catalog.amountPhp),
    billing_kind:
      row.billing_kind === 'MONTHLY' ||
      row.billing_kind === 'ANNUAL' ||
      row.billing_kind === 'ONE_TIME'
        ? row.billing_kind
        : catalog.billingKind,
    status,
    activated_at: row.activated_at ? String(row.activated_at) : null,
    expires_at: row.expires_at ? String(row.expires_at) : null,
    pending_payment_id: row.pending_payment_id
      ? String(row.pending_payment_id)
      : null,
    can_purchase: row.can_purchase === true,
    organization_id: row.organization_id ? String(row.organization_id) : null,
    needs_organization_link: row.needs_organization_link === true,
  };
}

function parseSnapshot(raw: unknown): BuklodScopeCommercialSnapshot | null {
  const row = asRecord(raw);
  if (!row) return null;

  const scopeId = String(row.scope_id ?? '').trim();
  if (!scopeId) return null;

  const products = Array.isArray(row.products)
    ? row.products.map(parseProduct).filter(Boolean) as BuklodScopeProductAccess[]
    : [];

  return {
    scope_id: scopeId,
    scope_type: String(row.scope_type ?? ''),
    organization_id: row.organization_id ? String(row.organization_id) : null,
    needs_organization_link: row.needs_organization_link === true,
    is_billing_manager: row.is_billing_manager === true,
    is_member: row.is_member === true,
    gcash_number: String(row.gcash_number ?? '09811646218'),
    products,
  };
}

export function emptyClusterCommercialSnapshot(
  scopeId: string,
): BuklodScopeCommercialSnapshot {
  return {
    scope_id: scopeId,
    scope_type: 'CLUSTER',
    organization_id: null,
    needs_organization_link: false,
    is_billing_manager: false,
    is_member: true,
    gcash_number: '09811646218',
    products: [
      'cluster_premium',
      'cluster_lessons_ccp',
      'cluster_lessons_discipleship',
      'cluster_lessons_mentoring',
    ].map((code) => {
      const product = BUKLOD_COMMERCIAL_PRODUCTS[code as BuklodCommercialProductCode];
      return {
        product_code: product.code,
        display_name: product.displayName,
        amount_php: product.amountPhp,
        billing_kind: product.billingKind,
        status: 'NOT_PURCHASED' as const,
        activated_at: null,
        expires_at: null,
        pending_payment_id: null,
        can_purchase: false,
        organization_id: null,
        needs_organization_link: false,
      };
    }),
  };
}

export function emptyOrganizationCommercialSnapshot(
  scopeId: string,
): BuklodScopeCommercialSnapshot {
  const products = [
    BUKLOD_COMMERCIAL_PRODUCTS.organization_focus_apps_monthly,
    BUKLOD_COMMERCIAL_PRODUCTS.organization_focus_apps_annual,
  ];
  return {
    scope_id: scopeId,
    scope_type: 'ORGANIZATION',
    organization_id: scopeId,
    needs_organization_link: false,
    is_billing_manager: false,
    is_member: true,
    gcash_number: '09811646218',
    products: products.map((product) => ({
      product_code: product.code,
      display_name: product.displayName,
      amount_php: product.amountPhp,
      billing_kind: product.billingKind,
      status: 'NOT_PURCHASED' as const,
      activated_at: null,
      expires_at: null,
      pending_payment_id: null,
      can_purchase: false,
      organization_id: scopeId,
      needs_organization_link: false,
    })),
  };
}

export async function fetchScopeCommercialSnapshot(
  scopeId: string,
): Promise<BuklodScopeCommercialSnapshot | null> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_scope_product_access_v1',
    { p_scope_id: scopeId },
  );

  if (error) {
    throw error;
  }

  return parseSnapshot(data);
}

export async function fetchScopeCommercialSnapshotResilient(
  scopeId: string,
): Promise<BuklodScopeCommercialSnapshot> {
  try {
    const snapshot = await fetchScopeCommercialSnapshot(scopeId);
    if (snapshot) return snapshot;
  } catch (error) {
    console.warn('Scope commercial snapshot fallback:', error);
  }

  return emptyClusterCommercialSnapshot(scopeId);
}

export async function submitScopeProductPayment(input: {
  scopeId: string;
  productCode: BuklodCommercialProductCode;
  gcashReference: string;
}) {
  if (!BUKLOD_PAID_FEATURES_ENABLED) throw new Error('Paid features are paused pending final approval.');
  const { data, error } = await (supabase as any).rpc(
    'buklod_submit_scope_product_payment_v1',
    {
      p_scope_id: input.scopeId,
      p_product_code: input.productCode,
      p_gcash_reference: input.gcashReference.trim(),
    },
  );

  if (error) {
    throw error;
  }

  return data;
}

export async function listScopeProductPayments(
  status = 'pending_admin',
  limit = 50,
): Promise<BuklodProductPaymentRow[]> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_admin_list_scope_product_payments_v1',
    {
      p_status: status,
      p_limit: limit,
    },
  );

  if (error) {
    throw error;
  }

  const container = asRecord(data);
  const rows = Array.isArray(container?.requests)
    ? container.requests
    : Array.isArray(data)
      ? data
      : [];

  return rows
    .map((item: unknown) => {
      const row = asRecord(item);
      if (!row) return null;
      const id = String(row.id ?? '').trim();
      if (!id) return null;
      return {
        id,
        scope_id: String(row.scope_id ?? ''),
        scope_name: row.scope_name ? String(row.scope_name) : null,
        product_code: String(row.product_code ?? ''),
        submitted_by: String(row.submitted_by ?? ''),
        submitter_name: String(row.submitter_name ?? 'Member'),
        gcash_reference: String(row.gcash_reference ?? ''),
        amount_php: toNumber(row.amount_php),
        status: String(row.status ?? ''),
        created_at: String(row.created_at ?? ''),
        reviewed_at: row.reviewed_at ? String(row.reviewed_at) : null,
        admin_note: row.admin_note ? String(row.admin_note) : null,
      } satisfies BuklodProductPaymentRow;
    })
    .filter(Boolean) as BuklodProductPaymentRow[];
}

export async function reviewScopeProductPayment(
  requestId: string,
  approve: boolean,
  adminNote?: string,
) {
  const { data, error } = await (supabase as any).rpc(
    'buklod_admin_review_scope_product_payment_v1',
    {
      p_request_id: requestId,
      p_approve: approve,
      p_admin_note: adminNote ?? null,
    },
  );

  if (error) {
    throw error;
  }

  return data;
}

export async function linkClusterToOrganization(input: {
  clusterId: string;
  organizationId: string;
}) {
  const { data, error } = await (supabase as any).rpc(
    'buklod_link_cluster_organization_v1',
    {
      p_cluster_id: input.clusterId,
      p_organization_id: input.organizationId,
    },
  );

  if (error) {
    throw error;
  }

  return data;
}

export function productStatusLabel(status: BuklodProductEntitlementStatus) {
  if (status === 'ACTIVE') return 'Active / Purchased';
  if (status === 'PENDING') return 'Pending';
  if (status === 'EXPIRED') return 'Expired';
  if (status === 'REJECTED') return 'Rejected';
  return 'Not Purchased';
}

export function formatEntitlementDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
