/*
 * PostgREST can sporadically reject a just-issued valid JWT with PGRST303
 * ("JWT issued at future"). Retry only that exact pre-execution auth rejection.
 * Never retry other 401s, auth grants, network failures or unknown responses.
 */
type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

export function isBuklodPostgrestJwtFutureError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { code?: unknown; message?: unknown };
  return value.code === 'PGRST303' &&
    value.message === 'JWT issued at future';
}

function requestUrl(input: FetchInput): string {
  if (typeof input === 'string') return input;
  return String((input as { url?: string })?.url ?? input);
}

const SAFE_READ_RPCS = new Set([
  'buklod_my_clusters',
  'buklod_discover_clusters',
  'get_buklod_public_community_feed_v7_page',
  'get_buklod_public_community_feed_v5',
  'buklod_my_permission_snapshot_v1',
  'buklod_has_permission',
  'buklod_my_scopes',
]);

function isRetryableRead(url: string, method: string): boolean {
  if (method === 'GET' || method === 'HEAD') return true;
  if (method !== 'POST') return false;
  const name = url.match(/\/rest\/v1\/rpc\/([^?/#]+)/i)?.[1] ?? '';
  return SAFE_READ_RPCS.has(name.toLowerCase());
}

export function createBuklodPostgrestJwtRetryFetch(
  baseFetch: typeof fetch,
  delayMs = 1_250,
): typeof fetch {
  // A backend timing incident may reject thousands of unrelated requests.
  // Never double that traffic indefinitely: at most three retries per
  // minute per runtime, shared by all screens and RPCs.
  let retryWindowStartMs = 0;
  let retriesInWindow = 0;

  return (async (input: FetchInput, init?: FetchInit): Promise<Response> => {
    const response = await baseFetch(input, init);
    if (response.status !== 401 || !/\/rest\/v1\//i.test(requestUrl(input))) {
      return response;
    }

    let rejectedBeforeExecution = false;
    try {
      rejectedBeforeExecution = isBuklodPostgrestJwtFutureError(await response.clone().json());
    } catch {
      return response;
    }
    if (!rejectedBeforeExecution) return response;

    // Avoid delayed mutations across sign-out/account-switch boundaries.
    // Only known read-only POST RPCs and GET/HEAD requests may be retried.
    const method = String(init?.method ?? (input as Request)?.method ?? 'GET').toUpperCase();
    if (!isRetryableRead(requestUrl(input), method) ||
        (typeof input !== 'string' && method !== 'GET' && method !== 'HEAD')) {
      return response;
    }

    const signal = init?.signal ?? (typeof input === 'object' ? (input as Request).signal : undefined);
    if (signal?.aborted) return response;

    const now = Date.now();
    if (now - retryWindowStartMs >= 60_000 || now < retryWindowStartMs) {
      retryWindowStartMs = now;
      retriesInWindow = 0;
    }
    if (retriesInWindow >= 3) return response;
    retriesInWindow += 1;

    await new Promise<void>(resolve => setTimeout(resolve, Math.max(0, delayMs)));
    if (signal?.aborted) return response;

    // Exactly one retry. Return the second response unchanged if it also fails.
    return baseFetch(input, init);
  }) as typeof fetch;
}
