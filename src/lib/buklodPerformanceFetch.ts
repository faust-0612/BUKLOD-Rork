/* BUKLOD_ROOT_PERFORMANCE_R3
 * BUKLOD_ROOT_PERFORMANCE_R3_6
 * BUKLOD_AUTH_INFLIGHT_SHIELD_R1
 *
 * R3.6 targets the remaining request amplification seen after R3.5:
 * - safe read RPCs that were not yet allowlisted
 * - near-identical time-window reads whose starts_at filter differs by milliseconds
 * - repeated safe-read 400/404/405 probes
 * - short backoff for transient upstream 5xx/52x failures on safe reads
 * - repeated stable table reads such as profile note / music library
 *
 * Auth requests are never cached. The narrow auth shield below only coalesces
 * simultaneous identical GET /auth/v1/user checks and refresh-token requests
 * inside the same runtime. Password logins, signups, user mutations, uploads,
 * and unknown RPCs still bypass the cache and are never automatically retried.
 * Authorization remains server-side through Supabase RLS/RPC rules.
 */

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

type ResponseSnapshot = {
  body: string;
  status: number;
  statusText: string;
  headers: Array<[string, string]>;
};

type CacheEntry = {
  expiresAt: number;
  snapshot: ResponseSnapshot;
};

type PerfState = {
  cache: Map<string, CacheEntry>;
  inFlight: Map<string, Promise<ResponseSnapshot>>;
  stats: {
    network: number;
    cacheHits: number;
    inFlightHits: number;
    negativeCacheHits: number;
  };
};

const MAX_CACHE_ENTRIES = 500;
const restReadTtlMs = 1_000;
const storageSignTtlMs = 45 * 60_000;
const negativeReadTtlMs = 10_000;
const transientReadFailureTtlMs = 3_000;

const TIME_BUCKET_MS_BY_TABLE: Record<string, number> = {
  buklod_scope_bulletins: 5_000,
  app_sponsors: 30_000,
  buklod_cluster_events: 30_000,
};

const rpcReadTtlMs: Record<string, number> = {
  buklod_has_permission: 10_000,
  buklod_my_scopes: 8_000,
  buklod_my_foundation_workspaces_v1: 12_000,
  buklod_scope_entitlements_v1: 12_000,
  buklod_scope_faith_access_status_v1: 12_000,
  buklod_scope_home_summary_v1: 8_000,
  buklod_can_use_organization_focus_app_v1: 30_000,
  buklod_my_clusters: 8_000,
  buklod_can_view_cluster_progress_v1: 12_000,
  buklod_user_formation_context_v1: 12_000,
  buklod_scope_faith_monitoring_summary_v1: 15_000,
  buklod_scope_faith_monitoring_feedback_for_member_v1: 15_000,
  get_my_buklod_referral_summary_v1: 30_000,
  get_buklod_public_community_feed_v7_page: 1_500,
  get_buklod_public_community_feed_v5: 1_500,
  get_my_buklod_points_dashboard: 12_000,
  get_member_circle_ranks_v1: 30_000,
  get_buklod_points_leaderboard: 12_000,
  get_my_weekly_devotional: 60_000,
  get_automatic_bible_today: 5 * 60_000,
  get_client_runtime_config: 60_000,
  list_buklod_active_attendance_events: 8_000,
  get_my_formation_stage_catalog_v1: 20_000,
};

const restTableTtlMs: Record<string, number> = {
  buklod_scope_bulletins: 5_000,
  app_sponsors: 30_000,
  buklod_cluster_events: 10_000,
  buklod_profile_status: 10_000,
  buklod_system_announcement_boards: 30_000,
  buklod_music_library: 2 * 60_000,
  buklod_user_addresses: 30_000,
  buklod_dashboard_themes: 30_000,
  profiles: 5_000,
};

const GLOBAL_STATE_KEY = '__BUKLOD_ROOT_PERF_FETCH_R3_6__';

function getState(): PerfState {
  const root = globalThis as any;
  const existing = root[GLOBAL_STATE_KEY] as PerfState | undefined;
  if (existing?.cache && existing?.inFlight && existing?.stats) {
    return existing;
  }

  const created: PerfState = {
    cache: new Map<string, CacheEntry>(),
    inFlight: new Map<string, Promise<ResponseSnapshot>>(),
    stats: {
      network: 0,
      cacheHits: 0,
      inFlightHits: 0,
      negativeCacheHits: 0,
    },
  };

  root[GLOBAL_STATE_KEY] = created;
  return created;
}

const state = getState();

function rawUrlOf(input: FetchInput): string {
  if (typeof input === 'string') return input;

  try {
    if (
      typeof URL !== 'undefined' &&
      input instanceof URL
    ) {
      return input.toString();
    }
  } catch {}

  const maybeUrl = (input as any)?.url;
  return typeof maybeUrl === 'string'
    ? maybeUrl
    : String(input);
}

function methodOf(input: FetchInput, init?: FetchInit): string {
  return String(
    (init as any)?.method ??
      (input as any)?.method ??
      'GET'
  ).toUpperCase();
}

async function bodyKey(
  input: FetchInput,
  init?: FetchInit
): Promise<string> {
  const initBody = (init as any)?.body;
  if (initBody != null) {
    return typeof initBody === 'string'
      ? initBody
      : String(initBody);
  }

  try {
    const request = input as any;
    if (
      request &&
      typeof request.clone === 'function' &&
      typeof request.text === 'function'
    ) {
      return await request.clone().text();
    }
  } catch {}

  return '';
}

function headerKey(input: FetchInput, init?: FetchInit): string {
  try {
    const sourceHeaders =
      (init as any)?.headers ??
      (input as any)?.headers ??
      undefined;

    const headers = new Headers(sourceHeaders);

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

function stableRuntimeHash(value: string): string {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function isAuthInFlightOnlyRequest(
  rawUrl: string,
  method: string
): boolean {
  if (
    method === 'GET' &&
    /\/auth\/v1\/user(?:[?#]|$)/i.test(rawUrl)
  ) {
    return true;
  }

  return (
    method === 'POST' &&
    /\/auth\/v1\/token(?:[?#]|$)/i.test(rawUrl) &&
    /(?:[?&])grant_type=refresh_token(?:&|$)/i.test(rawUrl)
  );
}

async function authInFlightKey(
  rawUrl: string,
  method: string,
  input: FetchInput,
  init?: FetchInit
): Promise<string> {
  const headers = headerKey(input, init);
  const body = await bodyKey(input, init);

  /*
   * Keep bearer/refresh-token material out of the in-memory Map key while
   * still distinguishing different sessions and request payloads.
   */
  return [
    'BUKLOD_AUTH_INFLIGHT_SHIELD_R1',
    method,
    rawUrl,
    stableRuntimeHash(headers),
    stableRuntimeHash(body),
  ].join('::');
}

function rpcNameFromUrl(rawUrl: string): string | null {
  const match = rawUrl.match(/\/rest\/v1\/rpc\/([^?/#]+)/i);
  if (!match?.[1]) return null;

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function restTableFromUrl(rawUrl: string): string | null {
  const match = rawUrl.match(/\/rest\/v1\/([^?/#]+)/i);
  if (!match?.[1] || match[1].toLowerCase() === 'rpc') {
    return null;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function canonicalUrlForKey(rawUrl: string): string {
  const table = restTableFromUrl(rawUrl);
  const bucketMs = table
    ? TIME_BUCKET_MS_BY_TABLE[table]
    : undefined;

  if (!bucketMs) {
    return rawUrl;
  }

  return rawUrl.replace(
    /(starts_at=(?:lte|gte)\.)([^&]+)/gi,
    (_full, prefix: string, encodedValue: string) => {
      try {
        const decoded = decodeURIComponent(encodedValue);
        const ms = Date.parse(decoded);
        if (!Number.isFinite(ms)) return `${prefix}${encodedValue}`;

        const bucketed = Math.floor(ms / bucketMs) * bucketMs;

        return `${prefix}${encodeURIComponent(
          new Date(bucketed).toISOString()
        )}`;
      } catch {
        return `${prefix}${encodedValue}`;
      }
    }
  );
}

function ttlFor(rawUrl: string, method: string): number {
  if (
    method === 'POST' &&
    rawUrl.includes('/storage/v1/object/sign/')
  ) {
    return storageSignTtlMs;
  }

  const rpcName = rpcNameFromUrl(rawUrl);
  if (rpcName) {
    return rpcReadTtlMs[rpcName] ?? 0;
  }

  if (method === 'GET' || method === 'HEAD') {
    const table = restTableFromUrl(rawUrl);
    if (table && restTableTtlMs[table] != null) {
      return restTableTtlMs[table];
    }

    if (rawUrl.includes('/rest/v1/')) {
      return restReadTtlMs;
    }
  }

  return 0;
}

function shouldNegativeCache(status: number): boolean {
  return status === 400 || status === 404 || status === 405;
}

function shouldTransientFailureCache(status: number): boolean {
  return [
    408,
    425,
    429,
    500,
    502,
    503,
    504,
    520,
    521,
    522,
    523,
    524,
  ].includes(status);
}

const mutationInvalidationTables = new Set([
  'buklod_scope_bulletins',
  'app_sponsors',
  'buklod_cluster_events',
  'buklod_profile_status',
  'buklod_music_library',
  'buklod_system_announcement_boards',
  'buklod_dashboard_themes',
  'profiles',
]);

function invalidateAfterMutation(rawUrl: string, method: string) {
  if (method === 'GET' || method === 'HEAD') return;

  const table = restTableFromUrl(rawUrl);
  if (!table || !mutationInvalidationTables.has(table)) return;

  const needle = `/rest/v1/${table}`;
  for (const key of state.cache.keys()) {
    if (key.includes(needle)) {
      state.cache.delete(key);
    }
  }
}

async function requestKey(
  rawUrl: string,
  method: string,
  input: FetchInput,
  init?: FetchInit
): Promise<string> {
  return [
    method,
    canonicalUrlForKey(rawUrl),
    headerKey(input, init),
    await bodyKey(input, init),
  ].join('::');
}

async function toSnapshot(response: Response): Promise<ResponseSnapshot> {
  const headers: Array<[string, string]> = [];
  response.headers.forEach((value, key) => {
    headers.push([key, value]);
  });

  return {
    body: await response.text(),
    status: response.status,
    statusText: response.statusText,
    headers,
  };
}

function fromSnapshot(snapshot: ResponseSnapshot): Response {
  const bodyAllowed = ![204, 205, 304].includes(snapshot.status);

  return new Response(
    bodyAllowed ? snapshot.body : null,
    {
      status: snapshot.status,
      statusText: snapshot.statusText,
      headers: snapshot.headers,
    }
  );
}

function prune(now: number) {
  for (const [key, entry] of state.cache) {
    if (entry.expiresAt <= now) {
      state.cache.delete(key);
    }
  }

  if (state.cache.size <= MAX_CACHE_ENTRIES) return;

  const overflow = state.cache.size - MAX_CACHE_ENTRIES;
  const oldest = [...state.cache.entries()]
    .sort((a, b) => a[1].expiresAt - b[1].expiresAt)
    .slice(0, overflow);

  for (const [key] of oldest) {
    state.cache.delete(key);
  }
}

export function clearBuklodPerformanceFetchCache() {
  state.cache.clear();
  state.inFlight.clear();
}

export function getBuklodPerformanceFetchStats() {
  return {
    ...state.stats,
    cacheEntries: state.cache.size,
    inFlight: state.inFlight.size,
  };
}

export function createBuklodPerformanceFetch(
  baseFetch: typeof fetch
): typeof fetch {
  const wrapped = async (
    input: FetchInput,
    init?: FetchInit
  ): Promise<Response> => {
    const rawUrl = rawUrlOf(input);
    const method = methodOf(input, init);

    /*
     * BUKLOD_AUTH_INFLIGHT_SHIELD_R1
     *
     * Supabase can legitimately have several consumers asking for the same
     * current user or trying to refresh the same session at nearly the same
     * instant. Under database pressure those duplicates amplify Auth work and
     * can race refresh-token rotation. Collapse only identical requests that
     * are concurrently in flight. Never cache them and never auto-retry them.
     */
    if (isAuthInFlightOnlyRequest(rawUrl, method)) {
      const key = await authInFlightKey(
        rawUrl,
        method,
        input,
        init
      );
      const pending = state.inFlight.get(key);

      if (pending) {
        state.stats.inFlightHits += 1;
        return fromSnapshot(await pending);
      }

      state.stats.network += 1;

      const task = (async () => {
        const response = await baseFetch(input, init);
        return toSnapshot(response);
      })();

      state.inFlight.set(key, task);

      try {
        return fromSnapshot(await task);
      } finally {
        state.inFlight.delete(key);
      }
    }

    const ttlMs = ttlFor(rawUrl, method);

    /*
     * Unknown calls and all writes bypass the cache entirely.
     * This prevents the performance layer from becoming an authorization
     * or mutation-consistency boundary.
     */
    if (ttlMs <= 0) {
      const response = await baseFetch(input, init);
      if (response.ok) {
        invalidateAfterMutation(rawUrl, method);
      }
      return response;
    }

    const key = await requestKey(rawUrl, method, input, init);
    const now = Date.now();
    prune(now);

    const cached = state.cache.get(key);
    if (cached && cached.expiresAt > now) {
      state.stats.cacheHits += 1;
      if (!cached.snapshot.status.toString().startsWith('2')) {
        state.stats.negativeCacheHits += 1;
      }
      return fromSnapshot(cached.snapshot);
    }

    const pending = state.inFlight.get(key);
    if (pending) {
      state.stats.inFlightHits += 1;
      return fromSnapshot(await pending);
    }

    state.stats.network += 1;

    const task = (async () => {
      const response = await baseFetch(input, init);
      const snapshot = await toSnapshot(response);

      const cacheTtl = response.ok
        ? ttlMs
        : shouldNegativeCache(response.status)
          ? Math.min(ttlMs, negativeReadTtlMs)
          : shouldTransientFailureCache(response.status)
            ? Math.min(ttlMs, transientReadFailureTtlMs)
            : 0;

      if (cacheTtl > 0) {
        state.cache.set(key, {
          expiresAt: Date.now() + cacheTtl,
          snapshot,
        });
      }

      return snapshot;
    })();

    state.inFlight.set(key, task);

    try {
      return fromSnapshot(await task);
    } finally {
      state.inFlight.delete(key);
    }
  };

  return wrapped as typeof fetch;
}