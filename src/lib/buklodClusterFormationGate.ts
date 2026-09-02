import { resolveBuklodActiveClusterTruth } from '@/lib/buklodActiveClusterTruth';
import { supabase } from '@/lib/supabase';

export type FormationClusterRow = {
  cluster_id: string;
  cluster_name: string;
  organization_id: string | null;
  organization_name: string | null;
  membership_status: string;
  cluster_status?: string;
  role_keys: string[];
  is_admin: boolean;
  joined_at: string | null;
};

export type FormationContext = {
  organization_id: string | null;
  has_active_cluster: boolean;
  primary_cluster: FormationClusterRow | null;
  clusters: FormationClusterRow[];
  pending_clusters: Array<{
    cluster_id: string;
    cluster_name: string;
    membership_status: string;
  }>;
  join_path: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function parseCluster(raw: unknown): FormationClusterRow | null {
  const row = asRecord(raw);
  if (!row) return null;
  const clusterId = String(row.cluster_id ?? '').trim();
  if (!clusterId) return null;
  const roles = Array.isArray(row.role_keys)
    ? row.role_keys.map((item) => String(item).toUpperCase())
    : [];
  return {
    cluster_id: clusterId,
    cluster_name: String(row.cluster_name ?? 'Cluster'),
    organization_id: row.organization_id ? String(row.organization_id) : null,
    organization_name: row.organization_name
      ? String(row.organization_name)
      : null,
    membership_status: String(row.membership_status ?? ''),
    cluster_status: row.cluster_status ? String(row.cluster_status) : 'ACTIVE',
    role_keys: roles,
    is_admin: row.is_admin === true,
    joined_at: row.joined_at ? String(row.joined_at) : null,
  };
}

function parseContext(raw: unknown): FormationContext {
  const row = asRecord(raw);
  const clusters = Array.isArray(row?.clusters)
    ? row.clusters.map(parseCluster).filter(Boolean) as FormationClusterRow[]
    : [];
  const pending = Array.isArray(row?.pending_clusters)
    ? row.pending_clusters
        .map((item) => {
          const pendingRow = asRecord(item);
          if (!pendingRow?.cluster_id) return null;
          return {
            cluster_id: String(pendingRow.cluster_id),
            cluster_name: String(pendingRow.cluster_name ?? 'Cluster'),
            membership_status: String(pendingRow.membership_status ?? 'PENDING'),
          };
        })
        .filter(Boolean) as FormationContext['pending_clusters']
    : [];

  return {
    organization_id: row?.organization_id ? String(row.organization_id) : null,
    has_active_cluster: row?.has_active_cluster === true,
    primary_cluster: parseCluster(row?.primary_cluster) ?? clusters[0] ?? null,
    clusters,
    pending_clusters: pending,
    join_path: String(row?.join_path ?? '/clusters'),
  };
}

export async function fetchFormationContext(
  organizationId?: string | null,
): Promise<FormationContext> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_user_formation_context_v1',
    {
      p_organization_id: organizationId ?? null,
    },
  );

  if (error) {
    throw error;
  }

  return parseContext(data);
}

function formationContextFromClusterTruth(
  truth: Awaited<ReturnType<typeof resolveBuklodActiveClusterTruth>>,
  organizationId?: string | null,
): FormationContext | null {
  if (!truth) return null;

  const cluster: FormationClusterRow = {
    cluster_id: truth.scope_id,
    cluster_name: truth.name,
    organization_id:
      truth.organization_id ??
      organizationId ??
      null,
    organization_name: null,
    membership_status: 'ACTIVE',
    cluster_status:
      truth.scope_status || 'ACTIVE',
    role_keys: [],
    is_admin: truth.is_admin,
    joined_at: truth.joined_at,
  };

  return {
    organization_id:
      truth.organization_id ??
      organizationId ??
      null,
    has_active_cluster: true,
    primary_cluster: cluster,
    clusters: [cluster],
    pending_clusters: [],
    join_path: '/clusters',
  };
}

export async function fetchFormationContextResilient(
  organizationId?: string | null,
): Promise<FormationContext> {
  let canonical: FormationContext | null = null;

  try {
    canonical =
      await fetchFormationContext(
        organizationId,
      );

    if (canonical.has_active_cluster) {
      return canonical;
    }
  } catch (error) {
    console.warn(
      'Formation cluster context fallback:',
      error,
    );
  }

  try {
    const truth =
      await resolveBuklodActiveClusterTruth();

    const recovered =
      formationContextFromClusterTruth(
        truth,
        organizationId,
      );

    if (recovered) {
      return recovered;
    }
  } catch (error) {
    console.warn(
      '191H Formation ACTIVE Cluster truth:',
      error,
    );
  }

  if (canonical) {
    return canonical;
  }

  return {
    organization_id:
      organizationId ?? null,
    has_active_cluster: false,
    primary_cluster: null,
    clusters: [],
    pending_clusters: [],
    join_path: '/clusters',
  };
}
export function clusterRoleLabel(roleKeys: string[] | null | undefined) {
  const keys = (roleKeys ?? []).map((key) => String(key).toUpperCase());
  if (keys.includes('CLUSTER_HEAD')) return 'Cluster Head';
  if (keys.includes('CLUSTER_ADMIN') || keys.includes('ADMIN')) {
    return 'Cluster Admin';
  }
  if (keys.includes('PASTOR')) return 'Cluster Pastor';
  if (keys.includes('MENTOR')) return 'Cluster Mentor';
  return 'Member';
}
