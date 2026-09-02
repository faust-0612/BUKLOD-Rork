/**
 * Canonical Cluster route helpers.
 *
 * Screens historically used mixed param names
 * (`cluster`, `scopeId`, `clusterId`, `id`).
 * Read and write every alias so exact-scope admin routes
 * stay on the same Cluster.
 */

import {
  getClusterDetails,
  getMyClusters,
  type ClusterDetails,
  type ClusterSummary,
} from '@/lib/buklodClusters';
import { supabase } from '@/lib/supabase';

export function firstRouteParam(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0].trim();
  }

  return '';
}

const CLUSTER_SCOPE_PARAM_KEYS = [
  'cluster',
  'clusterId',
  'cluster_id',
  'scopeId',
  'scope_id',
  'id',
] as const;

export function readClusterScopeId(
  params: Record<string, unknown> | null | undefined
): string {
  if (!params) return '';

  for (const key of CLUSTER_SCOPE_PARAM_KEYS) {
    const value = firstRouteParam(params[key]);
    if (value) return value;
  }

  return '';
}

export function clusterScopeParams(
  scopeId: string,
  extra: Record<string, string> = {}
): Record<string, string> {
  return {
    cluster: scopeId,
    clusterId: scopeId,
    cluster_id: scopeId,
    scopeId: scopeId,
    scope_id: scopeId,
    id: scopeId,
    ...extra,
  };
}

export function canManageExactCluster(
  scopeId: string,
  manageableIds: Iterable<string>
): boolean {
  const id = String(scopeId ?? '').trim();
  if (!id) return false;

  for (const candidate of manageableIds) {
    if (String(candidate ?? '').trim() === id) {
      return true;
    }
  }

  return false;
}

/** Clusters where the signed-in user has scoped admin authority. */
export async function getMyManageableClusters() {
  try {
    const { data, error } = await (supabase as any).rpc(
      'buklod_my_manageable_clusters'
    );

    if (!error && Array.isArray(data)) {
      if (data.length === 0) {
        return [];
      }

      return data.map((row: Record<string, unknown>) => ({
        scope_id: String(row.scope_id ?? row.id ?? ''),
        name: String(row.name ?? ''),
        description: row.description ? String(row.description) : null,
        category: row.category ? String(row.category) : null,
        visibility: (row.visibility as ClusterSummary['visibility']) ?? 'PRIVATE',
        scope_status: String(row.scope_status ?? row.status ?? 'ACTIVE'),
        membership_status: null,
        is_admin: true,
        member_count: Number(row.member_count ?? 0),
      })) as ClusterSummary[];
    }
  } catch {
    // fallback below
  }

  const clusters = await getMyClusters();
  return clusters.filter((row) => row.is_admin);
}

/**
 * Backend-scoped admin check for Manage routes.
 * Uses buklod_cluster_details — not client role simulation.
 */
export async function verifyClusterManageAccess(
  scopeId: string
): Promise<{
  allowed: boolean;
  cluster: ClusterDetails | null;
}> {
  const id = String(scopeId ?? '').trim();
  if (!id) {
    return { allowed: false, cluster: null };
  }

  const cluster = await getClusterDetails(id);
  return {
    allowed: cluster?.is_admin === true,
    cluster,
  };
}

export function clusterScopeManageRoute(
  scopeId: string,
  clusterName?: string
) {
  return {
    pathname: '/clusters/scope-manage' as const,
    params: clusterScopeParams(scopeId, {
      clusterName: clusterName ?? '',
    }),
  };
}
