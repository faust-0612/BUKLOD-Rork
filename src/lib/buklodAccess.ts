import { supabase } from '@/lib/supabase';
import type { BuklodScope } from '@/lib/buklodScope';
import type { ScopeCommercialEntitlements } from '@/lib/buklodScopeEntitlements';

export type BuklodEntitlement =
  | 'bayanihan'
  | 'tithes'
  | 'learn_paid'
  | 'financial_admin';

const FEATURE_ALIASES: Record<BuklodEntitlement, string[]> = {
  bayanihan: [
    'restricted.bayanihan',
    'bayanihan',
    'feature.bayanihan',
  ],
  tithes: [
    'restricted.tithes',
    'tithes',
    'giving',
    'feature.tithes',
  ],
  learn_paid: [
    'restricted.learn',
    'restricted.learn_paid',
    'learn_paid',
    'paid_learning',
  ],
  financial_admin: [
    'restricted.financial_admin',
    'financial_admin',
    'finance.admin',
  ],
};

function normalize(value: string) {
  return value.trim().toLowerCase().replaceAll('-', '_');
}

export function normalizedScopeRoles(scope: BuklodScope | null) {
  return (scope?.role_keys ?? []).map(normalize);
}

export function scopeHasRole(
  scope: BuklodScope | null,
  role: string
) {
  return normalizedScopeRoles(scope).includes(normalize(role));
}

/**
 * Exact-scope administrator roles.
 * These never imply System Admin. Parent Organization
 * admin is not inherited here; the active/exact scope
 * must carry the role itself.
 *
 * `church_admin` remains a legacy alias only.
 */
export const EXACT_SCOPE_ADMIN_ROLES = [
  'admin',
  'cluster_admin',
  'church_admin',
  'org_admin',
  'organization_admin',
  'sub_org_admin',
  'suborganization_admin',
  'faculty_admin',
  'school_admin',
  'attendance_admin',
  'giving_admin',
  'business_admin',
  'government_admin',
  'barangay_admin',
] as const;

export function isExactScopeAdmin(scope: BuklodScope | null) {
  if (!scope) return false;
  if (scope.is_admin) return true;

  const roles = normalizedScopeRoles(scope);

  return EXACT_SCOPE_ADMIN_ROLES.some((role) =>
    roles.includes(role)
  );
}

export function isScopeAdmin(scope: BuklodScope | null) {
  if (!scope) return false;

  return (
    isExactScopeAdmin(scope) ||
    scopeHasRole(scope, 'system_admin')
  );
}

export function scopeHasEntitlement(
  scope: BuklodScope | null,
  entitlement: BuklodEntitlement,
  commercial?: ScopeCommercialEntitlements | null
) {
  if (!scope) return false;

  if (commercial?.paid_features_exempt) {
    return true;
  }

  const available = new Set(
    (scope.feature_keys ?? []).map(normalize)
  );

  return FEATURE_ALIASES[entitlement].some(
    (key) => available.has(normalize(key))
  );
}

function rpcResultToBoolean(data: any) {
  if (typeof data === 'boolean') return data;

  if (Array.isArray(data)) {
    return rpcResultToBoolean(data[0]);
  }

  if (data && typeof data === 'object') {
    const value =
      data.allowed ??
      data.can_access ??
      data.has_access ??
      data.enabled ??
      data.result;

    if (typeof value === 'boolean') {
      return value;
    }
  }

  return Boolean(data);
}

export async function verifyScopeEntitlement(
  scope: BuklodScope | null,
  entitlement: BuklodEntitlement,
  commercial?: ScopeCommercialEntitlements | null
): Promise<boolean> {
  if (!scope) return false;

  if (commercial?.paid_features_exempt) {
    return true;
  }

  const featureKey =
    FEATURE_ALIASES[entitlement][0];

  const candidates = [
    {
      p_scope_id: scope.scope_id,
      p_feature_key: featureKey,
    },
    {
      _scope_id: scope.scope_id,
      _feature_key: featureKey,
    },
    {
      scope_id: scope.scope_id,
      feature_key: featureKey,
    },
  ];

  let lastError: any = null;

  for (const args of candidates) {
    const { data, error } =
      await (supabase as any).rpc(
        'buklod_can_access_feature',
        args
      );

    if (!error) {
      return rpcResultToBoolean(data);
    }

    lastError = error;

    const message =
      String(error?.message ?? '').toLowerCase();

    const signatureProblem =
      message.includes('schema cache') ||
      message.includes('could not find the function') ||
      message.includes('pgrst202') ||
      message.includes('pgrst203');

    if (!signatureProblem) break;
  }

  console.warn(
    'BUKLOD entitlement verification:',
    lastError
  );

  return false;
}
