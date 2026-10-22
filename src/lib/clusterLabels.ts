import { supabase } from '@/lib/supabase';

export type ClusterLabelMap =
  Record<string, string | null>;

/* PERF_EMERGENCY_R2_CLUSTER_LABEL_CACHE
 *
 * Cluster labels are read-only presentation data.
 * Cache them briefly in memory and dedupe identical in-flight reads so
 * Community / Prayer / Post Detail do not repeatedly call the same RPC.
 */
const CLUSTER_LABEL_TTL_MS =
  10 * 60 * 1000;

type ClusterLabelCacheEntry = {
  value: string | null;
  expiresAt: number;
};

const clusterLabelCache =
  new Map<string, ClusterLabelCacheEntry>();

const clusterLabelInflight =
  new Map<string, Promise<ClusterLabelMap>>();

async function fetchClusterLabels(
  ids: string[]
): Promise<ClusterLabelMap> {
  const key =
    [...ids].sort().join(',');

  const existing =
    clusterLabelInflight.get(key);

  if (existing) {
    return existing;
  }

  const request =
    (async () => {
      const { data, error } =
        await (supabase as any).rpc(
          'get_cluster_labels_for_users',
          {
            p_user_ids: ids,
          }
        );

      if (error) {
        throw error;
      }

      const map: ClusterLabelMap = {};

      for (const id of ids) {
        map[id] = null;
      }

      for (const row of data ?? []) {
        if (!row?.user_id) continue;

        map[String(row.user_id)] =
          row.cluster_name
            ? String(row.cluster_name)
            : null;
      }

      return map;
    })();

  clusterLabelInflight.set(
    key,
    request
  );

  try {
    return await request;
  } finally {
    if (
      clusterLabelInflight.get(key) ===
      request
    ) {
      clusterLabelInflight.delete(key);
    }
  }
}

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

  const now = Date.now();
  const result: ClusterLabelMap = {};
  const missing: string[] = [];

  for (const id of ids) {
    const cached =
      clusterLabelCache.get(id);

    if (
      cached &&
      cached.expiresAt > now
    ) {
      result[id] = cached.value;
    } else {
      if (cached) {
        clusterLabelCache.delete(id);
      }
      missing.push(id);
    }
  }

  if (!missing.length) {
    return result;
  }

  try {
    const fresh =
      await fetchClusterLabels(missing);

    const expiresAt =
      Date.now() +
      CLUSTER_LABEL_TTL_MS;

    for (const id of missing) {
      const value =
        Object.prototype.hasOwnProperty.call(
          fresh,
          id
        )
          ? fresh[id] ?? null
          : null;

      clusterLabelCache.set(
        id,
        {
          value,
          expiresAt,
        }
      );

      result[id] = value;
    }
  } catch (error: any) {
    console.warn(
      'Cluster labels unavailable:',
      error?.message ?? error
    );
  }

  return result;
}

export function clearClusterLabelCache(): void {
  clusterLabelCache.clear();
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