/* BUKLOD_ROOT_PERFORMANCE_R4
 * Targeted second-stage request shield for the heaviest Home/Cluster reads.
 *
 * Safety rules:
 * - only known safe reads are cached/coalesced
 * - writes are never cached
 * - successful writes invalidate affected table caches immediately
 * - authorization remains enforced by Supabase/RLS
 */

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

type Snapshot = {
  body: string;
  status: number;
  statusText: string;
  headers: Array<[string, string]>;
};

type CacheEntry = {
  expiresAt: number;
  snapshot: Snapshot;
};

type ShieldState = {
  cache: Map<string, CacheEntry>;
  inFlight: Map<string, Promise<Snapshot>>;
  // Only operation names + aggregate counters. Never store URLs, users,
  // tokens, query bodies, content, or per-request diagnostics.
  stats?: Map<string, ShieldCounters>;
};

type ShieldCounters = {
  eligible: number;
  upstream: number;
  cacheHits: number;
  inFlightShares: number;
};

const GLOBAL_KEY = '__BUKLOD_R4_REQUEST_SHIELD__';
const MAX_ENTRIES = 300;
const MAX_METRIC_OPERATIONS = 80;

const tableTtlMs: Record<string, number> = {
  /*
   * PERF R1 PROFILE/AVATAR SHIELD
   *
   * Profile display/avatar lookups are a very hot read path. Keep this TTL
   * short enough for UI freshness while collapsing repeated remount/list
   * reads. Any successful profile write invalidates all cached profile reads
   * through invalidatedTables below.
   */
  profiles: 60_000,
  mission_bulletins: 10_000,
  devotional_completions: 10_000,
  buklod_scopes: 10_000,
  buklod_cluster_home_notices: 10_000,
  buklod_cluster_events: 10_000,
  buklod_cluster_event_rsvps: 5_000,
  buklod_cluster_tasks: 10_000,
  buklod_cluster_polls: 10_000,
  buklod_cluster_poll_options: 10_000,
  buklod_cluster_poll_votes: 5_000,
  buklod_cluster_resources: 30_000,
  buklod_cluster_recognitions: 20_000,
  buklod_cluster_home_settings: 30_000,
  buklod_cluster_attendance: 5_000,
};

/*
 * PERF R1 HOT RPC SHIELD
 *
 * These are read-only RPCs that are repeatedly requested by Home / scope
 * remounts. The request key already includes Authorization + request body,
 * so user-scoped results cannot be shared across accounts.
 *
 * Keep TTLs intentionally short. This layer is for burst collapse and quick
 * remounts, not long-lived application state.
 */
const rpcTtlMs: Record<string, number> = {
  buklod_my_scopes: 30_000,
  // Cluster reads: collapse remount bursts without caching membership mutations.
  buklod_my_clusters: 10_000,
  // Burst-only coalescing for read-only Connect unread badge RPC.
  buklod_connect_unread_count: 2_500,
  buklod_discover_clusters: 10_000,
  get_member_circle_ranks_v1: 60_000,
  get_automatic_bible_today: 60_000,
  get_buklod_points_leaderboard: 30_000,
  get_my_daily_devotional: 60_000,

  /* BUKLOD_MASS_CONCURRENCY_R32
   * Measured hot read RPCs. Keep windows short enough for UI freshness while
   * collapsing rapid remount/focus/reconnect bursts from the same session.
   * These are read-only presentation/query paths; protected mutations remain
   * authoritative on Supabase through RLS/RPC rules.
   */
  buklod_my_permission_snapshot_v1: 30_000,
  get_my_buklod_points_dashboard: 30_000,
  get_buklod_public_community_feed_v7_page: 5_000,
  get_buklod_post_media_v1: 3_000,
  // The Wall actually uses v2. Its per-photo reactions are mutable, so keep
  // this a burst-only window, isolated by bearer token and exact post IDs.
  get_buklod_post_media_v2: 2_500,
  // Scrolling/remounting posts caused >56k share-count reads in query stats.
  // Counts are presentation-only. Mutations invalidate before returning.
  buklod_internal_share_count_v2: 20_000,
  get_buklod_post_comment_previews_v1: 3_000,
  buklod_scope_entitlements_v1: 30_000,
  buklod_scope_home_summary_v1: 20_000,
  buklod_scope_faith_access_status_v1: 30_000,

  // Connect inbox summaries are realtime-first and already have a bounded
  // fallback refresh. A 10s shield only collapses remount/burst duplicates;
  // Authorization remains part of the request key and no writes are cached.
  buklod_connect_personal_threads: 10_000,
  buklod_connect_community_rooms: 10_000,
  // Suggested contacts is a read-only, user-scoped Connect discovery query.
  // Keep it short so membership/note changes surface quickly while remount
  // bursts share one request instead of recomputing the same peer graph.
  buklod_connect_suggested_contacts_v1: 10_000,
  // Runtime config controls maintenance/update/pilot gates, so keep this very
  // short: enough to collapse bootstrap/remount bursts without masking a new
  // server-side gate for more than a few seconds on an already-open client.
  get_client_runtime_config: 10_000,
  // Connect/status surfaces can remount repeatedly. Keep this especially short
  // because viewer_count and expiry are live-ish UI details, while still
  // collapsing duplicate bursts from the same signed-in user.
  get_buklod_messages_status_note_v1: 10_000,
};

/*
 * PERF R1 STORAGE SIGNED URL SHIELD
 *
 * createSignedUrl() mints a short-lived read credential but does not mutate
 * the stored object. Cache only this exact Storage endpoint for a very short
 * window so parallel/remount callers share one minting request.
 *
 * Upload, update, move, copy, remove, bucket, and normal object requests stay
 * uncached. The request key includes Authorization + full URL + request body,
 * so bucket/path/expiry/user differences remain isolated.
 */
const STORAGE_SIGNED_URL_TTL_MS = 30_000;

const invalidatedTables = new Set(Object.keys(tableTtlMs));

function state(): ShieldState {
  const root = globalThis as any;
  const existing = root[GLOBAL_KEY] as ShieldState | undefined;
  if (existing?.cache && existing?.inFlight) {
    existing.stats ??= new Map<string, ShieldCounters>();
    return existing;
  }

  const created: ShieldState = {
    cache: new Map<string, CacheEntry>(),
    inFlight: new Map<string, Promise<Snapshot>>(),
    stats: new Map<string, ShieldCounters>(),
  };
  root[GLOBAL_KEY] = created;
  return created;
}

const shield = state();

function rawUrlOf(input: FetchInput): string {
  if (typeof input === 'string') return input;
  try {
    if (typeof URL !== 'undefined' && input instanceof URL) {
      return input.toString();
    }
  } catch {}
  return String((input as any)?.url ?? input);
}

function methodOf(input: FetchInput, init?: FetchInit): string {
  return String(
    (init as any)?.method ??
      (input as any)?.method ??
      'GET'
  ).toUpperCase();
}

function tableFromUrl(rawUrl: string): string | null {
  const match = rawUrl.match(/\/rest\/v1\/([^?/#]+)/i);
  if (!match?.[1] || match[1].toLowerCase() === 'rpc') return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function rpcFromUrl(rawUrl: string): string | null {
  const match = rawUrl.match(/\/rest\/v1\/rpc\/([^?/#]+)/i);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function recordShieldMetric(
  rawUrl: string,
  field: keyof ShieldCounters,
) {
  const stats = shield.stats;
  if (!stats) return;

  // Only allowlisted operation names, not full URL/query/auth data.
  const operation =
    rpcFromUrl(rawUrl) ||
    tableFromUrl(rawUrl) ||
    (rawUrl.includes('/storage/v1/object/sign/') ? 'storage-sign' : 'other');
  const key = stats.has(operation) || stats.size < MAX_METRIC_OPERATIONS
    ? operation
    : 'other';
  const current = stats.get(key) ?? {
    eligible: 0,
    upstream: 0,
    cacheHits: 0,
    inFlightShares: 0,
  };
  current[field] += 1;
  stats.set(key, current);
}

/** Passive, device-local request reduction accounting. No database writes. */
export function getBuklodR4RequestShieldStats() {
  const operations = [...(shield.stats ?? new Map<string, ShieldCounters>()).entries()]
    .map(([operation, counters]) => ({ operation, ...counters }))
    .sort((a, b) => b.eligible - a.eligible);
  const totals = operations.reduce(
    (sum, entry) => ({
      eligible: sum.eligible + entry.eligible,
      upstream: sum.upstream + entry.upstream,
      cacheHits: sum.cacheHits + entry.cacheHits,
      inFlightShares: sum.inFlightShares + entry.inFlightShares,
    }),
    { eligible: 0, upstream: 0, cacheHits: 0, inFlightShares: 0 },
  );
  return {
    ...totals,
    savedUpstreamRequests: totals.cacheHits + totals.inFlightShares,
    savingsPercent: totals.eligible > 0
      ? Math.round(1000 * (totals.cacheHits + totals.inFlightShares) / totals.eligible) / 10
      : 0,
    operations,
  };
}

function isStorageSignedUrlRequest(rawUrl: string, method: string): boolean {
  return (
    method === 'POST' &&
    /\/storage\/v1\/object\/sign\//i.test(rawUrl)
  );
}

function ttlFor(rawUrl: string, method: string): number {
  if (isStorageSignedUrlRequest(rawUrl, method)) {
    return STORAGE_SIGNED_URL_TTL_MS;
  }

  const rpc = rpcFromUrl(rawUrl);

  if (method === 'POST' && rpc) {
    if (rpc === 'buklod_scope_social_feed_v1') {
      return 2_500;
    }

    return rpcTtlMs[rpc] ?? 0;
  }

  if (method !== 'GET' && method !== 'HEAD') return 0;
  const table = tableFromUrl(rawUrl);
  return table ? tableTtlMs[table] ?? 0 : 0;
}

function headerKey(input: FetchInput, init?: FetchInit): string {
  try {
    const headers = new Headers(
      (init as any)?.headers ??
        (input as any)?.headers ??
        undefined
    );
    return [
      headers.get('authorization') ?? '',
      headers.get('range') ?? '',
      headers.get('prefer') ?? '',
      headers.get('accept-profile') ?? '',
      headers.get('content-profile') ?? '',
    ].join('|');
  } catch {
    return '';
  }
}

async function bodyKey(input: FetchInput, init?: FetchInit): Promise<string> {
  const body = (init as any)?.body;
  if (body != null) return typeof body === 'string' ? body : String(body);

  try {
    const request = input as any;
    if (request?.clone && request?.text) {
      return await request.clone().text();
    }
  } catch {}

  return '';
}

async function requestKey(
  rawUrl: string,
  method: string,
  input: FetchInput,
  init?: FetchInit
): Promise<string> {
  return [method, rawUrl, headerKey(input, init), await bodyKey(input, init)].join('::');
}

async function snapshotOf(response: Response): Promise<Snapshot> {
  const headers: Array<[string, string]> = [];
  response.headers.forEach((value, key) => headers.push([key, value]));
  return {
    body: await response.text(),
    status: response.status,
    statusText: response.statusText,
    headers,
  };
}

function responseFrom(snapshot: Snapshot): Response {
  const bodyAllowed = ![204, 205, 304].includes(snapshot.status);
  return new Response(bodyAllowed ? snapshot.body : null, {
    status: snapshot.status,
    statusText: snapshot.statusText,
    headers: snapshot.headers,
  });
}

function prune(now: number) {
  for (const [key, entry] of shield.cache) {
    if (entry.expiresAt <= now) shield.cache.delete(key);
  }
  if (shield.cache.size <= MAX_ENTRIES) return;
  const overflow = shield.cache.size - MAX_ENTRIES;
  const oldest = [...shield.cache.entries()]
    .sort((a, b) => a[1].expiresAt - b[1].expiresAt)
    .slice(0, overflow);
  for (const [key] of oldest) shield.cache.delete(key);
}

function invalidateMatching(needle: string) {
  for (const key of shield.cache.keys()) {
    if (key.includes(needle)) shield.cache.delete(key);
  }
  // A read started before a successful mutation must not repopulate the
  // cache with an outdated snapshot when it eventually resolves.
  for (const key of shield.inFlight.keys()) {
    if (key.includes(needle)) shield.inFlight.delete(key);
  }
}

function invalidateTable(table: string) {
  invalidateMatching(`/rest/v1/${table}`);
}

function invalidateAfterMutation(rawUrl: string, method: string) {
  if (method === 'GET' || method === 'HEAD') return;
  const table = tableFromUrl(rawUrl);
  if (table && invalidatedTables.has(table)) invalidateTable(table);
  if (table === 'community_photo_reactions' || table === 'community_post_media') {
    invalidateMatching('/rpc/get_buklod_post_media_v2');
  }
  // Cluster mutations are POST RPCs; never cache them. After a confirmed
  // mutation, invalidate user-scoped list/discovery reads across the shield.
  const rpc = rpcFromUrl(rawUrl);
  if (rpc === 'buklod_internal_share_post_v2') {
    invalidateMatching('/rpc/buklod_internal_share_count_v2');
  }
  if (rpc && /^set_buklod_post_media_v[1-5]$/.test(rpc)) {
    invalidateMatching('/rpc/get_buklod_post_media_v2');
  }
  if (rpc && /^buklod_(create_cluster|join_cluster|respond_cluster_invite|leave_cluster|invite_cluster_member|update_cluster|remove_cluster_member|transfer_cluster_admin|archive_cluster|restore_cluster|review_cluster_request)/.test(rpc)) {
    invalidateMatching('/rpc/buklod_my_clusters');
    invalidateMatching('/rpc/buklod_discover_clusters');
  }
}

export function createBuklodR4RequestShield(baseFetch: typeof fetch): typeof fetch {
  const wrapped = async (
    input: FetchInput,
    init?: FetchInit
  ): Promise<Response> => {
    const rawUrl = rawUrlOf(input);
    const method = methodOf(input, init);
    const ttlMs = ttlFor(rawUrl, method);

    if (ttlMs <= 0) {
      const response = await baseFetch(input, init);
      if (response.ok) invalidateAfterMutation(rawUrl, method);
      return response;
    }

    const key = await requestKey(rawUrl, method, input, init);
    recordShieldMetric(rawUrl, 'eligible');
    const now = Date.now();
    prune(now);

    const cached = shield.cache.get(key);
    if (cached && cached.expiresAt > now) {
      recordShieldMetric(rawUrl, 'cacheHits');
      return responseFrom(cached.snapshot);
    }

    const pending = shield.inFlight.get(key);
    if (pending) {
      recordShieldMetric(rawUrl, 'inFlightShares');
      return responseFrom(await pending);
    }

    // Assigned before any awaited fetch resolves; declared separately so
    // TypeScript can type-check the identity guard on the in-flight promise.
    let task: Promise<Snapshot> | null = null;
    recordShieldMetric(rawUrl, 'upstream');
    task = (async () => {
      const response = await baseFetch(input, init);
      const snapshot = await snapshotOf(response);
      if (response.ok && shield.inFlight.get(key) === task) {
        shield.cache.set(key, {
          expiresAt: Date.now() + ttlMs,
          snapshot,
        });
      }
      return snapshot;
    })();

    shield.inFlight.set(key, task);
    try {
      return responseFrom(await task);
    } finally {
      if (shield.inFlight.get(key) === task) shield.inFlight.delete(key);
    }
  };

  return wrapped as typeof fetch;
}

