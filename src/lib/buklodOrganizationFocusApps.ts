import { supabase } from '@/lib/supabase';
import {
  BUKLOD_PRODUCT_ORG_FOCUS_APPS_ANNUAL,
  BUKLOD_PRODUCT_ORG_FOCUS_APPS_MONTHLY,
  isOrgSubscriptionGatedFocusApp,
} from '@/lib/buklodCommercialCatalog';
import {
  fetchScopeCommercialSnapshotResilient,
  type BuklodProductEntitlementStatus,
} from '@/lib/buklodScopeProductAccess';

export type OrganizationFocusAppAccess = {
  organizationId: string | null;
  app: string;
  gated: boolean;
  canUse: boolean;
  subscriptionActive: boolean;
  status: BuklodProductEntitlementStatus;
  activatedAt: string | null;
  expiresAt: string | null;
  isSystemAdmin: boolean;
  isMzbExempt: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function resolveOrganizationIdFromScope(scope: {
  scope_id?: string | null;
  scope_type?: string | null;
  parent_scope_id?: string | null;
  organization_id?: string | null;
  metadata?: Record<string, unknown> | null;
} | null | undefined): string | null {
  if (!scope) return null;

  const direct = String(
    scope.organization_id ??
      scope.metadata?.organization_id ??
      '',
  ).trim();
  if (direct) return direct;

  const type = String(scope.scope_type ?? '').trim().toUpperCase();
  if (type === 'ORGANIZATION') {
    return String(scope.scope_id ?? '').trim() || null;
  }

  if (type === 'CLUSTER') {
    return String(scope.parent_scope_id ?? '').trim() || null;
  }

  return null;
}

export async function fetchOrganizationFocusAppAccess(
  organizationId: string,
  app: string,
): Promise<OrganizationFocusAppAccess | null> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_can_use_organization_focus_app_v1',
    {
      p_organization_id: organizationId,
      p_app: app,
    },
  );

  if (error) {
    throw error;
  }

  const row = asRecord(data);
  if (!row) return null;

  const statusRaw = String(row.status ?? 'NOT_PURCHASED').toUpperCase();
  const status: BuklodProductEntitlementStatus =
    statusRaw === 'ACTIVE' ||
    statusRaw === 'PENDING' ||
    statusRaw === 'EXPIRED' ||
    statusRaw === 'REJECTED' ||
    statusRaw === 'NOT_PURCHASED'
      ? statusRaw
      : 'NOT_PURCHASED';

  return {
    organizationId,
    app,
    gated: row.gated !== false,
    canUse: row.can_use === true,
    subscriptionActive: row.subscription_active === true,
    status,
    activatedAt: row.activated_at ? String(row.activated_at) : null,
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    isSystemAdmin: row.is_system_admin === true,
    isMzbExempt: row.is_mzb_exempt === true,
  };
}

/**
 * Central helper for Organization-level Focus App portals.
 * Backend RPC is authoritative; this client helper never grants access locally.
 */
export async function canUseOrganizationFocusApp(
  organizationId: string | null | undefined,
  app: string,
): Promise<boolean> {
  const orgId = String(organizationId ?? '').trim();
  const appKey = String(app ?? '').trim().toLowerCase();

  if (!isOrgSubscriptionGatedFocusApp(appKey)) {
    return true;
  }

  if (!orgId) {
    return false;
  }

  try {
    const access = await fetchOrganizationFocusAppAccess(orgId, appKey);
    if (access) {
      return access.canUse;
    }
  } catch (error) {
    console.warn('Organization Focus App entitlement check failed:', error);
  }

  try {
    const snapshot = await fetchScopeCommercialSnapshotResilient(orgId);
    const product = snapshot.products.find(
      (row) =>
        row.product_code === BUKLOD_PRODUCT_ORG_FOCUS_APPS_ANNUAL ||
        row.product_code === BUKLOD_PRODUCT_ORG_FOCUS_APPS_MONTHLY,
    );
    return product?.status === 'ACTIVE';
  } catch {
    return false;
  }
}
