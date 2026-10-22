import {
  StreamVideoClient,
  type User,
} from '@stream-io/video-react-native-sdk';

import {
  supabase,
} from '@/lib/supabase';
import {
  resolvePersonDisplayName,
} from '@/lib/buklodPersonDisplay';
import {
  getBuildStreamApiKey,
  readCachedStreamApiKey,
  rememberStreamApiKey,
} from '@/lib/buklodStreamPushStorage';

/*
 * PATCH_179F_CALL_AVAILABILITY_HARDENING
 * PATCH_187A_CALL_CLIENT_CACHE
 *
 * One StreamVideoClient per signed-in user.
 * - Uses Stream's singleton factory.
 * - Uses server-issued tokens.
 * - Coalesces simultaneous first-tap initialization.
 * - Caches the resolved client so RingingCalls can mount immediately.
 * - Resolves the public Stream API key from build env or stream-token.
 */

const BUILD_STREAM_API_KEY =
  getBuildStreamApiKey();

const STREAM_TOKEN_TTL_MS =
  50 * 60 * 1000;

let resolvedApiKey:
  string | null =
    BUILD_STREAM_API_KEY ||
    null;

let cachedStreamToken:
  {
    token: string;
    api_key: string;
    at: number;
  } | null =
    null;

let refreshMutex:
  Promise<string | null> | null =
    null;

let inFlightToken:
  Promise<{
    token: string;
    api_key: string;
  }> | null =
    null;

let inFlightClient:
  Promise<StreamVideoClient> | null =
    null;

let inFlightUserId:
  string | null =
    null;

let cachedClient:
  StreamVideoClient | null =
    null;

let cachedUserId:
  string | null =
    null;

type ClientListener = (
  client: StreamVideoClient | null
) => void;

const clientListeners =
  new Set<ClientListener>();

function notifyClientListeners(
  client: StreamVideoClient | null
) {
  clientListeners.forEach(
    listener => {
      listener(client);
    }
  );
}

export function
subscribeBuklodStreamVideoClient(
  listener: ClientListener
) {
  clientListeners.add(listener);

  listener(cachedClient);

  return () => {
    clientListeners.delete(
      listener
    );
  };
}

function isJwtExpired(
  jwt: string,
  skewSeconds = 90
) {
  try {
    const payload = JSON.parse(
      globalThis.atob(
        jwt.split('.')[1] ?? ''
      )
    );
    const exp = Number(payload?.exp ?? 0);

    if (!Number.isFinite(exp) || exp <= 0) {
      return false;
    }

    return exp * 1000 < Date.now() + skewSeconds * 1000;
  } catch {
    return false;
  }
}

function supabaseAnonKey() {
  return String(
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
      ''
  ).trim();
}

async function getCallAccessToken(
  forceRefresh = false
): Promise<string> {
  const {
    data,
    error,
  } =
    await supabase.auth.getSession();

  if (error) {
    throw new Error(
      'Could not start the call. Try again in a moment.'
    );
  }

  const current =
    data.session?.access_token ??
    '';

  if (
    !forceRefresh &&
    current &&
    !isJwtExpired(current)
  ) {
    return current;
  }

  const pendingRefresh =
    refreshMutex ??
    (refreshMutex =
      (async () => {
        try {
          const refreshed =
            await supabase.auth.refreshSession();

          return (
            refreshed.data.session?.access_token ??
            current ??
            null
          );
        } catch {
          return current || null;
        } finally {
          refreshMutex = null;
        }
      })());

  const next = await pendingRefresh;

  if (!next) {
    throw new Error(
      'Could not start the call. Try again in a moment.'
    );
  }

  return next;
}

function rememberTokenPayload(payload: {
  token: string;
  api_key: string;
}) {
  cachedStreamToken = {
    ...payload,
    at: Date.now(),
  };
  resolvedApiKey = payload.api_key;
  void rememberStreamApiKey(payload.api_key);
}

function readCachedTokenPayload(): {
  token: string;
  api_key: string;
} | null {
  if (
    !cachedStreamToken ||
    Date.now() - cachedStreamToken.at >
      STREAM_TOKEN_TTL_MS
  ) {
    return null;
  }

  return {
    token: cachedStreamToken.token,
    api_key: cachedStreamToken.api_key,
  };
}

async function requestStreamToken(
  accessToken: string
): Promise<{
  token: string;
  api_key: string;
} | null> {
  const functionsUrl =
    `${String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')}/functions/v1/stream-token`;
  const publishableKey = supabaseAnonKey();

  const readPayload = (
    raw: any
  ): {
    token: string;
    api_key: string;
  } | null => {
    const token = String(
      raw?.token ??
      raw?.data?.token ??
      ''
    ).trim();

    /*
     * PATCH_190A_STREAM_TOKEN_PAYLOAD_FALLBACK
     *
     * Accept a valid Stream token even when api_key is not
     * duplicated in the token response. The public API key can
     * come from the production build/update environment or a
     * previously resolved value.
     */
    const serverApiKey = String(
      raw?.api_key ??
      raw?.data?.api_key ??
      ''
    ).trim();

    const apiKey =
      serverApiKey ||
      resolvedApiKey ||
      BUILD_STREAM_API_KEY ||
      '';

    if (!token || !apiKey) {
      return null;
    }

    return {
      token,
      api_key: apiKey,
    };
  };

  try {
    const { data } = await supabase.functions.invoke(
      'stream-token',
      {
        body: {},
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const payload = readPayload(data);

    if (payload) {
      return payload;
    }
  } catch {
    // Fall through to direct fetch.
  }

  if (!functionsUrl.startsWith('http')) {
    return null;
  }

  const response = await fetch(functionsUrl, {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    const status = response.status;
    if (status === 401 || status === 403) {
      throw new Error('AUTH_REQUIRED');
    }

    throw new Error(
      String(json?.message || json?.error || 'CALL_TOKEN_FAILED')
    );
  }

  return readPayload(json);
}

async function fetchStreamTokenPayload():
  Promise<{
    token: string;
    api_key: string;
  }> {
  const cached = readCachedTokenPayload();

  if (cached) {
    return cached;
  }

  if (inFlightToken) {
    return inFlightToken;
  }

  inFlightToken =
    (async () => {
      let accessToken =
        await getCallAccessToken(false);
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const payload =
            await requestStreamToken(accessToken);

          if (payload) {
            rememberTokenPayload(payload);
            return payload;
          }
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : String(error);

          if (message === 'AUTH_REQUIRED' && attempt === 0) {
            accessToken = await getCallAccessToken(true);
            continue;
          }

          lastError =
            error instanceof Error
              ? error
              : new Error(String(error));
        }
      }

      const stale = cachedStreamToken;

      if (stale?.token && stale.api_key) {
        return {
          token: stale.token,
          api_key: stale.api_key,
        };
      }

      throw (
        lastError ??
        new Error(
          'Could not start the call. Try again in a moment.'
        )
      );
    })();

  try {
    return await inFlightToken;
  } finally {
    inFlightToken = null;
  }
}

async function ensureStreamApiKey():
  Promise<string> {
  if (resolvedApiKey) {
    return resolvedApiKey;
  }

  const cached =
    await readCachedStreamApiKey();

  if (cached) {
    resolvedApiKey =
      cached;
    return cached;
  }

  const payload =
    await fetchStreamTokenPayload();

  return payload.api_key;
}

async function streamTokenProvider():
  Promise<string> {
  const payload =
    await fetchStreamTokenPayload();

  return payload.token;
}

async function createClientForUser(
  authUser: {
    id: string;
    email?: string | null;
    user_metadata?: Record<
      string,
      any
    >;
  },
  apiKey: string
): Promise<StreamVideoClient> {
  const name = resolvePersonDisplayName(
    {
      full_name:
        authUser.user_metadata?.full_name ??
        authUser.user_metadata?.name,
      username: authUser.email,
    },
    authUser.id,
  );

  const streamUser: User = {
    id:
      authUser.id,

    name,
  };

  return StreamVideoClient
    .getOrCreateInstance({
      apiKey,

      user:
        streamUser,

      tokenProvider:
        async () => {
          try {
            return await streamTokenProvider();
          } catch {
            const cached =
              readCachedTokenPayload();

            if (cached?.token) {
              return cached.token;
            }

            throw new Error(
              'Could not start the call. Try again in a moment.'
            );
          }
        },

      options: {
        rejectCallWhenBusy:
          true,

        maxConnectUserRetries:
          3,
      },
    });
}

export function
getCachedBuklodStreamVideoClient():
  StreamVideoClient | null {
  return cachedClient;
}

export async function
ensureBuklodStreamVideoClient():
  Promise<StreamVideoClient> {
  const {
    data,
    error,
  } =
    await supabase.auth
      .getSession();

  if (error) {
    throw new Error(
      'Could not start the call. Try again in a moment.'
    );
  }

  const session =
    data.session;

  const authUser =
    session?.user;

  if (!authUser?.id) {
    throw new Error(
      'Could not start the call. Try again in a moment.'
    );
  }

  if (
    cachedClient &&
    cachedUserId &&
    cachedUserId !==
      authUser.id
  ) {
    await disconnectBuklodStreamVideoClient();
  }

  if (
    cachedClient &&
    cachedUserId ===
      authUser.id
  ) {
    notifyClientListeners(
      cachedClient
    );
    return cachedClient;
  }

  if (
    inFlightClient &&
    inFlightUserId ===
      authUser.id
  ) {
    return inFlightClient;
  }

  const currentUserId =
    authUser.id;

  const request =
    (async () => {
      const apiKey =
        await ensureStreamApiKey();

      return createClientForUser(
        authUser,
        apiKey
      );
    })();

  inFlightUserId =
    currentUserId;

  inFlightClient =
    request;

  try {
    const client =
      await request;

    cachedClient =
      client;

    cachedUserId =
      currentUserId;

    notifyClientListeners(
      client
    );

    return client;
  }
  finally {
    if (
      inFlightClient ===
        request
    ) {
      inFlightClient =
        null;

      inFlightUserId =
        null;
    }
  }
}

export function
prewarmBuklodStreamVideoClient():
  void {
  void ensureBuklodStreamVideoClient()
    .catch(
      error => {
        console.warn(
          'BUKLOD call prewarm:',
          error
        );
      }
    );
}

export async function
disconnectBuklodStreamVideoClient():
  Promise<void> {
  const client =
    cachedClient;

  cachedClient =
    null;

  cachedUserId =
    null;

  cachedStreamToken =
    null;

  inFlightClient =
    null;

  inFlightUserId =
    null;

  notifyClientListeners(
    null
  );

  if (!client) {
    return;
  }

  try {
    await client.disconnectUser();
  }
  catch (error) {
    console.warn(
      'BUKLOD call disconnect:',
      error
    );
  }
}
