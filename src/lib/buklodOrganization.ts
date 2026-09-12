/**
 * Canonical Organization / Sub-organization route helpers.
 *
 * Screens historically used mixed param names
 * (`organization`, `scopeId`, `organizationId`, `id`).
 * Read and write every alias so exact-scope admin routes
 * stay on the same Organization or Sub-organization.
 */

import { supabase } from '@/lib/supabase';

export function firstRouteParam(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0].trim();
  return '';
}

const ORGANIZATION_SCOPE_PARAM_KEYS = [
  'organization',
  'organizationId',
  'organization_id',
  'scopeId',
  'scope_id',
  'id',
] as const;

export function readOrganizationScopeId(params: Record<string, unknown> | null | undefined): string {
  if (!params) return '';
  for (const key of ORGANIZATION_SCOPE_PARAM_KEYS) {
    const value = firstRouteParam(params[key]);
    if (value) return value;
  }
  return '';
}

export function organizationScopeParams(scopeId: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    organization: scopeId,
    organizationId: scopeId,
    organization_id: scopeId,
    scopeId,
    scope_id: scopeId,
    id: scopeId,
    ...extra,
  };
}

export function normalizeMembershipStatus(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

export function isActiveMembershipStatus(value: unknown): boolean {
  return normalizeMembershipStatus(value) === 'ACTIVE';
}

export function isPendingMembershipStatus(value: unknown): boolean {
  const status = normalizeMembershipStatus(value);
  return status === 'PENDING' || status === 'REQUESTED';
}

export function membershipStatusFromRow(row: Record<string, unknown> | null | undefined): string {
  if (!row) return '';
  return normalizeMembershipStatus(row.membership_status ?? row.status ?? '');
}

export function canManageExactScope(scopeId: string, manageableIds: Iterable<string>): boolean {
  const id = String(scopeId ?? '').trim();
  if (!id) return false;
  for (const candidate of manageableIds) {
    if (String(candidate ?? '').trim() === id) return true;
  }
  return false;
}

export function organizationScopeManageRoute(scopeId: string, organizationName?: string) {
  return {
    pathname: '/organizations/scope-manage' as const,
    params: organizationScopeParams(scopeId, { organizationName: organizationName ?? '' }),
  };
}

async function verifyExactScopeAdmin(
  scopeId: string,
  scopeName: string | null
): Promise<{ allowed: boolean; scopeName: string | null }> {
  try {
    const { data, error } = await (supabase as any).rpc('buklod_is_exact_scope_admin_v1', {
      p_scope_id: scopeId,
    });
    if (!error && data === true) return { allowed: true, scopeName };
  } catch {
    // Caller receives the safe false result below.
  }
  return { allowed: false, scopeName };
}

/**
 * Backend-scoped admin check for Organization / Sub-organization Manage routes.
 * The canonical exact-scope check is also used as a safe fallback for Cluster
 * admin callers such as BUKLOD Report. It does not grant anything beyond the
 * backend's ADMIN / ORG_ADMIN / CLUSTER_ADMIN contract.
 */
export async function verifyOrganizationManageAccess(
  scopeId: string
): Promise<{ allowed: boolean; scopeName: string | null }> {
  const id = String(scopeId ?? '').trim();
  if (!id) return { allowed: false, scopeName: null };

  let scopeName: string | null = null;
  try {
    const [{ data: manageable, error: manageError }, { data: scopeRow }] = await Promise.all([
      (supabase as any).rpc('buklod_my_manageable_organizations_v2'),
      (supabase as any).from('buklod_scopes').select('name').eq('id', id).maybeSingle(),
    ]);
    scopeName = scopeRow?.name ?? null;
    if (!manageError) {
      const ids = (manageable ?? []).map((row: { scope_id?: string; id?: string }) =>
        String(row.scope_id ?? row.id ?? '').trim()
      );
      if (canManageExactScope(id, ids)) return { allowed: true, scopeName };
    }
  } catch {
    // Fall through to canonical exact-scope check.
  }

  return verifyExactScopeAdmin(id, scopeName);
}
