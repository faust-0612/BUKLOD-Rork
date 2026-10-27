import {
  StreamVideoClient,
  type User,
} from '@stream-io/video-client';

import { supabase } from '@/lib/supabase';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';

/* BUKLOD_WEB_CALLING_R1
 * Browser calls use Stream's official low-level browser client. The native
 * app keeps its React Native Stream client through the platform default file.
 */

type ClientListener = (
  client: StreamVideoClient | null
) => void;

type StreamCredentials = {
  token: string;
  apiKey: string;
};

let cachedClient: StreamVideoClient | null = null;
let cachedUserId: string | null = null;
let inFlightClient: Promise<StreamVideoClient> | null = null;
let inFlightUserId: string | null = null;
let cachedCredentials: (StreamCredentials & { at: number }) | null = null;

const listeners = new Set<ClientListener>();
const TOKEN_CACHE_MS = 45 * 60 * 1000;

function notify(client: StreamVideoClient | null) {
  listeners.forEach(listener => listener(client));
}

export function subscribeBuklodStreamVideoClient(
  listener: ClientListener
) {
  listeners.add(listener);
  listener(cachedClient);

  return () => {
    listeners.delete(listener);
  };
}

export function getCachedBuklodStreamVideoClient() {
  return cachedClient;
}

async function getSessionAccessToken(
  forceRefresh = false
) {
  if (forceRefresh) {
    try {
      const refreshed =
        await supabase.auth.refreshSession();

      if (refreshed.data.session?.access_token) {
        return refreshed.data.session.access_token;
      }
    } catch {
      // Fall through to the current session.
    }
  }

  const { data, error } =
    await supabase.auth.getSession();

  if (error || !data.session?.access_token) {
    throw new Error('Sign in again to use BUKLOD calling.');
  }

  return data.session.access_token;
}

async function fetchCredentials(
  forceRefresh = false
): Promise<StreamCredentials> {
  if (
    !forceRefresh &&
    cachedCredentials &&
    Date.now() - cachedCredentials.at < TOKEN_CACHE_MS
  ) {
    return {
      token: cachedCredentials.token,
      apiKey: cachedCredentials.apiKey,
    };
  }

  let accessToken =
    await getSessionAccessToken(forceRefresh);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data, error } =
      await supabase.functions.invoke(
        'stream-token',
        {
          body: {},
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

    const token = String(
      data?.token ??
      data?.data?.token ??
      ''
    ).trim();

    const apiKey = String(
      data?.api_key ??
      data?.data?.api_key ??
      process.env.EXPO_PUBLIC_STREAM_API_KEY ??
      ''
    ).trim();

    if (!error && token && apiKey) {
      cachedCredentials = {
        token,
        apiKey,
        at: Date.now(),
      };

      return { token, apiKey };
    }

    if (attempt === 0) {
      accessToken =
        await getSessionAccessToken(true);
    }
  }

  throw new Error(
    'Could not initialize browser calling. Please refresh and try again.'
  );
}

async function createClient(
  authUser: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, any>;
  }
) {
  const credentials =
    await fetchCredentials(false);

  const streamUser: User = {
    id: authUser.id,
    name: resolvePersonDisplayName(
      {
        full_name:
          authUser.user_metadata?.full_name ??
          authUser.user_metadata?.name,
        username: authUser.email,
      },
      authUser.id,
    ),
  };

  return StreamVideoClient.getOrCreateInstance({
    apiKey: credentials.apiKey,
    user: streamUser,
    token: credentials.token,
    tokenProvider: async () => {
      try {
        return (await fetchCredentials(false)).token;
      } catch {
        return (await fetchCredentials(true)).token;
      }
    },
    options: {
      maxConnectUserRetries: 3,
    },
  });
}

export async function ensureBuklodStreamVideoClient() {
  const { data, error } =
    await supabase.auth.getSession();

  if (error || !data.session?.user?.id) {
    throw new Error('Sign in again to use BUKLOD calling.');
  }

  const authUser = data.session.user;

  if (
    cachedClient &&
    cachedUserId === authUser.id
  ) {
    notify(cachedClient);
    return cachedClient;
  }

  if (
    cachedClient &&
    cachedUserId !== authUser.id
  ) {
    await disconnectBuklodStreamVideoClient();
  }

  if (
    inFlightClient &&
    inFlightUserId === authUser.id
  ) {
    return inFlightClient;
  }

  inFlightUserId = authUser.id;
  inFlightClient = createClient(authUser);

  try {
    const client = await inFlightClient;
    cachedClient = client;
    cachedUserId = authUser.id;
    notify(client);
    return client;
  } finally {
    inFlightClient = null;
    inFlightUserId = null;
  }
}

export function prewarmBuklodStreamVideoClient() {
  void ensureBuklodStreamVideoClient()
    .catch(error => {
      console.warn(
        'BUKLOD browser call prewarm:',
        error
      );
    });
}

export async function disconnectBuklodStreamVideoClient() {
  const client = cachedClient;

  cachedClient = null;
  cachedUserId = null;
  cachedCredentials = null;
  inFlightClient = null;
  inFlightUserId = null;
  notify(null);

  if (!client) {
    return;
  }

  try {
    await client.disconnectUser();
  } catch (error) {
    console.warn(
      'BUKLOD browser call disconnect:',
      error
    );
  }
}
