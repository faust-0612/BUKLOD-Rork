/**
 * PATCH_191H_ACTIVE_CLUSTER_TRUTH
 *
 * Account-wide source of truth for the signed-in user's ACTIVE Cluster.
 * Primary path: canonical buklod_my_clusters RPC.
 * Fallback path: direct ACTIVE membership + CLUSTER scope lookup.
 *
 * This helper does NOT unlock paid products.
 * Entitlements remain authoritative in buklod_scope_faith_access_status_v1.
 */

import { supabase } from '@/lib/supabase';

export type BuklodActiveClusterTruth = {
  scope_id: string;
  name: string;
  organization_id: string | null;
  membership_status: 'ACTIVE';
  scope_status: string;
  is_admin: boolean;
  joined_at: string | null;
};

function rows(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') return [raw];
  return [];
}

function isLifecycleUsable(value: unknown): boolean {
  const status = String(value ?? 'ACTIVE').trim().toUpperCase();

  return ![
    'SUSPENDED',
    'ARCHIVED',
    'DELETED',
    'INACTIVE',
    'DISABLED',
  ].includes(status);
}

function normalizeRpcCluster(row: any): BuklodActiveClusterTruth | null {
  const scopeId = String(
    row?.scope_id ??
      row?.cluster_id ??
      row?.id ??
      '',
  ).trim();

  if (!scopeId) return null;

  const membership = String(
    row?.membership_status ?? '',
  ).trim().toUpperCase();

  if (membership !== 'ACTIVE') return null;

  const scopeStatus = String(
    row?.scope_status ??
      row?.cluster_status ??
      row?.status ??
      'ACTIVE',
  ).trim().toUpperCase();

  if (!isLifecycleUsable(scopeStatus)) return null;

  return {
    scope_id: scopeId,
    name: String(
      row?.name ??
        row?.cluster_name ??
        'Cluster',
    ),
    organization_id: row?.organization_id
      ? String(row.organization_id)
      : null,
    membership_status: 'ACTIVE',
    scope_status: scopeStatus || 'ACTIVE',
    is_admin: row?.is_admin === true,
    joined_at: row?.joined_at
      ? String(row.joined_at)
      : null,
  };
}

export async function resolveBuklodActiveClusterTruth():
  Promise<BuklodActiveClusterTruth | null> {
  try {
    const rpcResult = await (supabase as any).rpc(
      'buklod_my_clusters',
    );

    if (!rpcResult?.error) {
      for (const item of rows(rpcResult?.data)) {
        const normalized =
          normalizeRpcCluster(item);

        if (normalized) {
          return normalized;
        }
      }
    }
  } catch (error) {
    console.warn(
      '191H buklod_my_clusters fallback:',
      error,
    );
  }

  // Governance backend already has an authoritative helper whose only job
  // is to resolve the signed-in user's real ACTIVE Cluster.
  try {
    const requiredCluster =
      await (supabase as any).rpc(
        'buklod_require_active_cluster_membership',
      );

    const requiredClusterId =
      String(
        requiredCluster?.data ?? '',
      ).trim();

    if (
      !requiredCluster?.error &&
      requiredClusterId
    ) {
      let name = 'Cluster';
      let organizationId: string | null =
        null;
      let scopeStatus = 'ACTIVE';

      try {
        const scopeResult =
          await (supabase as any)
            .from('buklod_scopes')
            .select(
              'id,name,status,organization_id,parent_scope_id',
            )
            .eq('id', requiredClusterId)
            .maybeSingle();

        if (!scopeResult?.error) {
          name = String(
            scopeResult?.data?.name ??
              name,
          );
          organizationId =
            scopeResult?.data?.organization_id
              ? String(
                  scopeResult.data
                    .organization_id,
                )
              : scopeResult?.data
                    ?.parent_scope_id
                ? String(
                    scopeResult.data
                      .parent_scope_id,
                  )
                : null;
          scopeStatus = String(
            scopeResult?.data?.status ??
              scopeStatus,
          ).toUpperCase();
        }
      } catch {
        // The authoritative UUID is enough for entitlement recovery.
      }

      return {
        scope_id: requiredClusterId,
        name,
        organization_id:
          organizationId,
        membership_status: 'ACTIVE',
        scope_status:
          scopeStatus || 'ACTIVE',
        is_admin: false,
        joined_at: null,
      };
    }
  } catch (error) {
    console.warn(
      '191H require ACTIVE Cluster fallback:',
      error,
    );
  }

  try {
    const authResult =
      await (supabase as any).auth.getUser();

    const userId = String(
      authResult?.data?.user?.id ?? '',
    ).trim();

    if (!userId) {
      return null;
    }

    const memberships =
      await (supabase as any)
        .from('buklod_scope_memberships')
        .select(
          'scope_id,joined_at,membership_status',
        )
        .eq('user_id', userId)
        .eq('membership_status', 'ACTIVE')
        .order('joined_at', {
          ascending: false,
        })
        .limit(30);

    if (memberships?.error) {
      console.warn(
        '191H ACTIVE membership lookup:',
        memberships.error,
      );
      return null;
    }

    const membershipRows = rows(
      memberships?.data,
    );

    const scopeIds = membershipRows
      .map((row) =>
        String(row?.scope_id ?? '').trim(),
      )
      .filter(Boolean);

    if (scopeIds.length === 0) {
      return null;
    }

    const scopes =
      await (supabase as any)
        .from('buklod_scopes')
        .select(
          'id,name,scope_type,status,organization_id,parent_scope_id',
        )
        .in('id', scopeIds)
        .eq('scope_type', 'CLUSTER');

    if (scopes?.error) {
      console.warn(
        '191H CLUSTER scope lookup:',
        scopes.error,
      );
      return null;
    }

    const scopeRows = rows(scopes?.data);

    for (const membership of membershipRows) {
      const id = String(
        membership?.scope_id ?? '',
      ).trim();

      const scope = scopeRows.find(
        (row) =>
          String(row?.id ?? '').trim() === id,
      );

      if (
        !scope ||
        !isLifecycleUsable(scope?.status)
      ) {
        continue;
      }

      return {
        scope_id: id,
        name: String(
          scope?.name ?? 'Cluster',
        ),
        organization_id:
          scope?.organization_id
            ? String(scope.organization_id)
            : scope?.parent_scope_id
              ? String(scope.parent_scope_id)
              : null,
        membership_status: 'ACTIVE',
        scope_status: String(
          scope?.status ?? 'ACTIVE',
        ).toUpperCase(),
        is_admin: false,
        joined_at: membership?.joined_at
          ? String(membership.joined_at)
          : null,
      };
    }
  } catch (error) {
    console.warn(
      '191H direct Cluster truth fallback:',
      error,
    );
  }

  return null;
}