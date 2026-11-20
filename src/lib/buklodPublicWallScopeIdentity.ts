import { supabase } from '@/lib/supabase';
import {
  isSubOrganizationScope,
  type BuklodScope,
} from '@/lib/buklodScope';

/**
 * Public Wall identity is explicit, separate from the exclusive Scope Wall.
 * Selecting a scope never moves, mirrors or widens an existing scope post.
 */
export type BuklodPublicWallScopeIdentity = {
  post_id: string;
  scope_id: string;
  scope_name: string;
  scope_type: string;
  scope_logo_url?: string | null;
  scope_geo_level?: string | null;
  parent_scope_id?: string | null;
  safe_location_label?: string | null;
};

export function eligiblePublicWallPostScopes(scopes: readonly BuklodScope[]):
  BuklodScope[] {
  return scopes
    .filter(scope =>
      Boolean(scope.scope_id) &&
      Boolean(scope.name?.trim()) &&
      ['LOCAL', 'CLUSTER', 'ORGANIZATION'].includes(scope.scope_type) &&
      scope.membership_status === 'ACTIVE' &&
      (!scope.scope_status || scope.scope_status === 'ACTIVE')
    )
    .sort((a, b) => {
      const order: Record<string, number> = { LOCAL: 0, CLUSTER: 1, ORGANIZATION: 2 };
      return (order[a.scope_type] ?? 9) - (order[b.scope_type] ?? 9) ||
        a.name.localeCompare(b.name);
    });
}

export function publicWallScopeTypeLabel(
  scope: Pick<BuklodScope, 'scope_type' | 'parent_scope_id' | 'geo_level'>
): string {
  if (scope.scope_type === 'CLUSTER') return 'Cluster';
  if (scope.scope_type === 'LOCAL') return 'Location';
  if (isSubOrganizationScope(scope)) return 'Sub-organization';
  return 'Organization';
}

export async function loadPublicWallScopeIdentities(
  postIds: readonly string[]
): Promise<Record<string, BuklodPublicWallScopeIdentity>> {
  const ids = [...new Set(postIds.map(id => String(id ?? '').trim()).filter(Boolean))].slice(0, 100);
  if (!ids.length) return {};

  const { data, error } = await (supabase as any).rpc(
    'get_buklod_public_wall_scope_identities_v1',
    { p_post_ids: ids }
  );
  if (error) throw error;

  const result: Record<string, BuklodPublicWallScopeIdentity> = {};
  for (const row of Array.isArray(data) ? data : []) {
    const postId = String(row?.post_id ?? '');
    const name = String(row?.scope_name ?? '').trim();
    if (!postId || !name || !ids.includes(postId)) continue;
    result[postId] = {
      post_id: postId,
      scope_id: String(row.scope_id ?? ''),
      scope_name: name,
      scope_type: String(row.scope_type ?? ''),
      scope_logo_url: row.scope_logo_url ?? null,
      scope_geo_level: row.scope_geo_level ?? null,
      parent_scope_id: row.parent_scope_id ?? null,
      safe_location_label: row.safe_location_label ?? null,
    };
  }
  return result;
}
