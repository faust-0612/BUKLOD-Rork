import {
  StreamVideoClient,
  type User,
} from '@stream-io/video-react-native-sdk';

import {
  supabase,
} from '@/lib/supabase';

/*
 * PATCH_179F_CALL_AVAILABILITY_HARDENING
 *
 * One StreamVideoClient per signed-in user.
 * - Uses Stream's singleton factory.
 * - Uses server-issued tokens.
 * - Coalesces simultaneous first-tap initialization.
 * - Safe to call from provider, Personal Connect, Org/Sub-org and Cluster.
 */

const STREAM_API_KEY =
  (
    process.env
      .EXPO_PUBLIC_STREAM_API_KEY
    ?? ''
  )
    .toString()
    .trim();

let inFlightClient:
  Promise<StreamVideoClient> | null =
    null;

let inFlightUserId:
  string | null =
    null;

async function streamTokenProvider():
  Promise<string> {
  const {
    data: sessionData,
    error: sessionError,
  } =
    await supabase.auth
      .getSession();

  if (sessionError) {
    throw new Error(
      sessionError.message ||
      'Could not read the BUKLOD session.'
    );
  }

  if (!sessionData.session) {
    throw new Error(
      'Please sign in to BUKLOD again before starting a call.'
    );
  }

  const {
    data,
    error,
  } =
    await supabase.functions.invoke(
      'stream-token',
      {
        body: {},
      }
    );

  if (error) {
    throw new Error(
      error.message ||
      'Could not get the BUKLOD call token.'
    );
  }

  const token =
    (
      data?.token ??
      ''
    )
      .toString()
      .trim();

  if (!token) {
    throw new Error(
      'The BUKLOD call token service returned no token.'
    );
  }

  return token;
}

async function createClientForUser(
  authUser: {
    id: string;
    email?: string | null;
    user_metadata?: Record<
      string,
      any
    >;
  }
): Promise<StreamVideoClient> {
  const name =
    (
      authUser
        .user_metadata
        ?.full_name
      ??
      authUser
        .user_metadata
        ?.name
      ??
      authUser.email
      ??
      'BUKLOD Member'
    )
      .toString()
      .trim();

  const streamUser: User = {
    id:
      authUser.id,

    name:
      name ||
      'BUKLOD Member',
  };

  return StreamVideoClient
    .getOrCreateInstance({
      apiKey:
        STREAM_API_KEY,

      user:
        streamUser,

      tokenProvider:
        streamTokenProvider,

      options: {
        rejectCallWhenBusy:
          true,

        maxConnectUserRetries:
          3,
      },
    });
}

export async function
ensureBuklodStreamVideoClient():
  Promise<StreamVideoClient> {
  if (!STREAM_API_KEY) {
    throw new Error(
      'Calling is not configured in this app build.'
    );
  }

  const {
    data,
    error,
  } =
    await supabase.auth
      .getSession();

  if (error) {
    throw new Error(
      error.message ||
      'Could not read the BUKLOD session.'
    );
  }

  const authUser =
    data.session?.user;

  if (!authUser?.id) {
    throw new Error(
      'Please sign in to BUKLOD again before starting a call.'
    );
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
    createClientForUser(
      authUser
    );

  inFlightUserId =
    currentUserId;

  inFlightClient =
    request;

  try {
    return await request;
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