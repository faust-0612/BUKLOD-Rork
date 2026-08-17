import { supabase } from '@/lib/supabase';

export type ClusterLabelMap =
  Record<string, string | null>;

export async function getClusterLabels(
  userIds: Array<string | null | undefined>
): Promise<ClusterLabelMap> {
  const ids = Array.from(
    new Set(
      userIds.filter(
        (id): id is string =>
          typeof id === 'string' &&
          id.length > 0
      )
    )
  );

  if (!ids.length) {
    return {};
  }

  const { data, error } =
    await (supabase as any).rpc(
      'get_cluster_labels_for_users',
      {
        p_user_ids: ids,
      }
    );

  // Graceful until the local migration is pushed.
  if (error) {
    console.warn(
      'Cluster labels unavailable:',
      error.message
    );
    return {};
  }

  const map: ClusterLabelMap = {};

  for (const row of data ?? []) {
    if (!row?.user_id) continue;

    map[String(row.user_id)] =
      row.cluster_name
        ? String(row.cluster_name)
        : null;
  }

  return map;
}

export function formatClusterName(
  value?: string | null
): string {
  const name = String(value ?? '').trim();

  if (!name) {
    return 'No Cluster';
  }

  if (/^cluster\b/i.test(name)) {
    return name;
  }

  return `Cluster ${name}`;
}