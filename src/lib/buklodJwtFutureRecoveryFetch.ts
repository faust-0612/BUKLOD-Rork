/*
 * PGRST303 mitigation for Supabase/PostgREST clock skew.
 *
 * A rejected JWT has not passed PostgREST authentication, so its request has
 * not reached a database write. Replay that exact REST request at most once
 * after a short delay. Never refresh/forge a token or weaken RLS.
 *
 * The process-wide burst gate within this client instance prevents a
 * persistent upstream outage from multiplying requests.
 */
type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

type RecoveryOptions = {
  retryDelayMs?: number;
  cooldownMs?: number;
};

const DEFAULT_RETRY_DELAY_MS = 2_200;
const DEFAULT_COOLDOWN_MS = 20_000;

function isReplayableRestRequest(input: FetchInput, init?: FetchInit) {
  // Supabase's REST transport uses string URLs and replayable JSON bodies.
  // Request streams and external auth/storage/function URLs are left alone.
  if (typeof input !== 'string') return false;
  if (init?.body != null && typeof init.body !== 'string') return false;

  try {
    const url = new URL(input);
    return /\/rest\/v1\//i.test(url.pathname) &&
      ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(
        String(init?.method ?? 'GET').toUpperCase()
      );
  } catch {
    return false;
  }
}

async function isJwtIssuedInFuture(response: Response) {
  if (response.status !== 401) return false;
  try {
    const payload = await response.clone().json();
    return payload?.code === 'PGRST303' &&
      /JWT issued at future/i.test(String(payload?.message ?? ''));
  } catch {
    return false;
  }
}

export function createBuklodJwtFutureRecoveryFetch(
  baseFetch: typeof fetch,
  options: RecoveryOptions = {}
): typeof fetch {
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS);
  const cooldownMs = Math.max(0, options.cooldownMs ?? DEFAULT_COOLDOWN_MS);
  let nextAllowedRetryAt = 0;

  return (async (input: FetchInput, init?: FetchInit): Promise<Response> => {
    const firstResponse = await baseFetch(input, init);
    if (
      !isReplayableRestRequest(input, init) ||
      init?.signal?.aborted ||
      !(await isJwtIssuedInFuture(firstResponse))
    ) {
      return firstResponse;
    }

    const now = Date.now();
    if (now < nextAllowedRetryAt) return firstResponse;
    nextAllowedRetryAt = now + cooldownMs;

    await new Promise<void>((resolve) => setTimeout(resolve, retryDelayMs));
    if (init?.signal?.aborted) return firstResponse;

    try {
      return await baseFetch(input, init);
    } catch {
      // The original precise 401 still explains the upstream clock failure.
      return firstResponse;
    }
  }) as typeof fetch;
}
