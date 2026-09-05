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
};

const GLOBAL_KEY = '__BUKLOD_R4_REQUEST_SHIELD__';
const MAX_ENTRIES = 300;

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
  get_member_circle_ranks_v1: 60_000,
  get_automatic_bible_today: 60_000,
  get_buklod_points_leaderboard: 30_000,
  get_my_daily_devotional: 60_000,
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
  if (existing?.cache && existing?.inFlight) return existing;

  const created: ShieldState = {
    cache: new Map<string, CacheEntry>(),
    inFlight: new Map<string, Promise<Snapshot>>(),
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

function invalidateTable(table: string) {
  const needle = `/rest/v1/${table}`;
  for (const key of shield.cache.keys()) {
    if (key.includes(needle)) shield.cache.delete(key);
  }
}

function invalidateAfterMutation(rawUrl: string, method: string) {
  if (method === 'GET' || method === 'HEAD') return;
  const table = tableFromUrl(rawUrl);
  if (table && invalidatedTables.has(table)) invalidateTable(table);
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
    const now = Date.now();
    prune(now);

    const cached = shield.cache.get(key);
    if (cached && cached.expiresAt > now) {
      return responseFrom(cached.snapshot);
    }

    const pending = shield.inFlight.get(key);
    if (pending) return responseFrom(await pending);

    const task = (async () => {
      const response = await baseFetch(input, init);
      const snapshot = await snapshotOf(response);
      if (response.ok) {
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
      shield.inFlight.delete(key);
    }
  };

  return wrapped as typeof fetch;
}
