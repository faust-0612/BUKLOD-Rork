/**
 * Unified exact-scope manage routes for Organization, Sub-organization, and Cluster.
 */

import type { BuklodScope } from '@/lib/buklodScope';
import { clusterScopeManageRoute, verifyClusterManageAccess } from '@/lib/buklodCluster';
import {
  canManageExactScope,
  organizationScopeManageRoute,
  verifyOrganizationManageAccess,
} from '@/lib/buklodOrganization';
import { supabase } from '@/lib/supabase';

export function firstScopeRouteParam(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0].trim();
  }

  return '';
}

const SCOPE_PARAM_KEYS = [
  'scopeId',
  'scope_id',
  'organization',
  'organizationId',
  'cluster',
  'clusterId',
  'id',
] as const;

export function readScopeIdFromParams(
  params: Record<string, unknown> | null | undefined
): string {
  if (!params) return '';

  for (const key of SCOPE_PARAM_KEYS) {
    const value = firstScopeRouteParam(params[key]);
    if (value) return value;
  }

  return '';
}

export function scopeRouteParams(
  scopeId: string,
  extra: Record<string, string> = {}
): Record<string, string> {
  return {
    scopeId,
    scope_id: scopeId,
    organization: scopeId,
    organizationId: scopeId,
    cluster: scopeId,
    clusterId: scopeId,
    id: scopeId,
    ...extra,
  };
}

export function scopeManageRoute(
  scope: Pick<BuklodScope, 'scope_id' | 'name' | 'scope_type'>
) {
  const type = String(scope.scope_type ?? '').trim().toUpperCase();

  if (type === 'CLUSTER') {
    return clusterScopeManageRoute(scope.scope_id, scope.name);
  }

  if (type === 'ORGANIZATION') {
    return organizationScopeManageRoute(scope.scope_id, scope.name);
  }

  return {
    pathname: '/scope/manage' as const,
    params: scopeRouteParams(scope.scope_id, {
      scopeName: scope.name ?? '',
      scopeType: scope.scope_type ?? '',
    }),
  };
}

export function scopeMembersRoute(
  scopeId: string,
  extra: Record<string, string> = {}
) {
  return {
    pathname: '/scope/manage/members' as const,
    params: scopeRouteParams(scopeId, extra),
  };
}

export function scopeFunctionalRolesRoute(
  scopeId: string,
  extra: Record<string, string> = {}
) {
  return {
    pathname: '/scope/manage/functional-roles' as const,
    params: scopeRouteParams(scopeId, extra),
  };
}

export function scopeAttendanceRoute(
  scopeId: string,
  extra: Record<string, string> = {}
) {
  return {
    pathname: '/scope/attendance' as const,
    params: scopeRouteParams(scopeId, extra),
  };
}

export function scopeAttendanceReportRoute(
  scopeId: string,
  extra: Record<string, string> = {}
) {
  return {
    pathname: '/scope/attendance/report' as const,
    params: scopeRouteParams(scopeId, extra),
  };
}

export function isAttendanceWorkspaceScopeType(
  scopeType?: string | null
) {
  const type = String(scopeType ?? '')
    .trim()
    .toUpperCase();
  return type === 'ORGANIZATION' || type === 'CLUSTER';
}

export function pickAttendanceWorkspaceScopeId(
  scopes: Array<
    Pick<BuklodScope, 'scope_id' | 'scope_type'> & {
      is_active_scope?: boolean;
    }
  >,
  preferred?: {
    scopeId?: string | null;
    activeScope?: Pick<BuklodScope, 'scope_id' | 'scope_type'> | null;
  }
): string {
  const preferredId = String(preferred?.scopeId ?? '').trim();
  if (
    preferredId &&
    scopes.some(
      (scope) =>
        scope.scope_id === preferredId &&
        isAttendanceWorkspaceScopeType(scope.scope_type)
    )
  ) {
    return preferredId;
  }

  const active = preferred?.activeScope;
  if (
    active?.scope_id &&
    isAttendanceWorkspaceScopeType(active.scope_type)
  ) {
    return String(active.scope_id).trim();
  }

  const flagged = scopes.find(
    (scope) =>
      scope.is_active_scope &&
      isAttendanceWorkspaceScopeType(scope.scope_type)
  );
  if (flagged?.scope_id) {
    return flagged.scope_id;
  }

  const organization = scopes.find(
    (scope) =>
      String(scope.scope_type ?? '').toUpperCase() === 'ORGANIZATION'
  );
  if (organization?.scope_id) {
    return organization.scope_id;
  }

  const cluster = scopes.find(
    (scope) =>
      String(scope.scope_type ?? '').toUpperCase() === 'CLUSTER'
  );
  return String(cluster?.scope_id ?? '').trim();
}

export async function openAttendanceWorkspaceForAccount(
  selectScope: (scopeId: string) => Promise<void>,
  scopes: BuklodScope[],
  preferred?: {
    scopeId?: string | null;
    activeScope?: BuklodScope | null;
  }
) {
  const scopeId = pickAttendanceWorkspaceScopeId(scopes, preferred);
  if (!scopeId) {
    throw new Error(
      'Open an Organization or Cluster first so attendance events can load.'
    );
  }

  await openScopedAttendance(selectScope, scopeId);
}

export async function openScopedAttendance(
  selectScope: (scopeId: string) => Promise<void>,
  scopeId: string,
  extra: Record<string, string> = {}
) {
  const id = String(scopeId ?? '').trim();

  if (!id) {
    throw new Error('Workspace scope is missing.');
  }

  await selectScope(id);

  const { router } = await import('expo-router');

  router.push(scopeAttendanceRoute(id, extra) as any);
}

export async function openScopedAttendanceReport(
  selectScope: (scopeId: string) => Promise<void>,
  scopeId: string,
  extra: Record<string, string> = {}
) {
  const id = String(scopeId ?? '').trim();

  if (!id) {
    throw new Error('Workspace scope is missing.');
  }

  await selectScope(id);

  const { router } = await import('expo-router');

  router.push(scopeAttendanceReportRoute(id, extra) as any);
}

/**
 * Backend-scoped manage gate for unified Manage screens.
 */
export async function verifyScopeManageAccess(
  scopeId: string,
  scopeType?: string | null
): Promise<{ allowed: boolean; scopeName: string | null }> {
  const id = String(scopeId ?? '').trim();
  if (!id) {
    return { allowed: false, scopeName: null };
  }

  const type = String(scopeType ?? '').trim().toUpperCase();

  try {
    if (type === 'CHURCH') {
      const [{ data, error }, { data: scopeRow }] = await Promise.all([
        (supabase as any).rpc('buklod_is_exact_scope_admin_v1', {
          p_scope_id: id,
        }),
        (supabase as any)
          .from('buklod_scopes')
          .select('name')
          .eq('id', id)
          .maybeSingle(),
      ]);

      if (!error && data === true) {
        return { allowed: true, scopeName: scopeRow?.name ?? null };
      }

      const { churchDetails } = await import('@/lib/buklodChurches');
      const church = await churchDetails(id);
      if (church?.is_admin) {
        return { allowed: true, scopeName: church.name };
      }

      return { allowed: false, scopeName: scopeRow?.name ?? church?.name ?? null };
    }

    if (type === 'CLUSTER') {
      const result = await verifyClusterManageAccess(id);
      return {
        allowed: result.allowed,
        scopeName: result.cluster?.name ?? null,
      };
    }

    if (type === 'ORGANIZATION') {
      return await verifyOrganizationManageAccess(id);
    }

    const [{ data: manageable, error: manageError }, { data: scopeRow }] =
      await Promise.all([
        (supabase as any).rpc('buklod_my_manageable_organizations_v2'),
        (supabase as any)
          .from('buklod_scopes')
          .select('name, scope_type')
          .eq('id', id)
          .maybeSingle(),
      ]);

    if (manageError) {
      throw manageError;
    }

    const ids = (manageable ?? []).map((row: { scope_id?: string; id?: string }) =>
      String(row.scope_id ?? row.id ?? '').trim()
    );

    const allowed = canManageExactScope(id, ids);

    return {
      allowed,
      scopeName: scopeRow?.name ?? null,
    };
  } catch {
    try {
      const { data, error } = await (supabase as any).rpc(
        'buklod_is_exact_scope_admin_v1',
        { p_scope_id: id }
      );

      if (!error && data === true) {
        const { data: scopeRow } = await (supabase as any)
          .from('buklod_scopes')
          .select('name')
          .eq('id', id)
          .maybeSingle();

        return { allowed: true, scopeName: scopeRow?.name ?? null };
      }
    } catch {
      // fall through
    }

    return { allowed: false, scopeName: null };
  }
}
