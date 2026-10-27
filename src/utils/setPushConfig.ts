// BUKLOD_PRODUCTION_SOURCE_IDENTITY_TRIGGER_R3
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import {
  StreamVideoClient,
  StreamVideoRN,
} from '@/lib/streamVideoSdk';

import {
  supabase,
} from '@/lib/supabase';
import {
  resolvePersonDisplayName,
} from '@/lib/buklodPersonDisplay';
import {
  rememberStreamApiKey,
  resolveStreamApiKey,
} from '@/lib/buklodStreamPushStorage';

/*
 * PATCH_CALL_LIFECYCLE_R1
 *
 * Public Stream push provider names are configuration identifiers, not secrets.
 * Keep a runtime fallback because EAS Update does not inherit eas.json build.env
 * when the remote production environment has no EXPO_PUBLIC_* variables. Without
 * this fallback an OTA can accidentally disable killed/background call push.
 */
const explicitAndroidPushProviderName =
  (
    process.env
      .EXPO_PUBLIC_STREAM_ANDROID_PUSH_PROVIDER_NAME
    ?? ''
  ).trim();

const appEnvironment =
  (
    process.env
      .EXPO_PUBLIC_APP_ENV
    ?? ''
  )
    .trim()
    .toLowerCase();

const productionRuntime =
  !__DEV__ &&
  appEnvironment !== 'development' &&
  appEnvironment !== 'preview' &&
  appEnvironment !== 'staging';

const androidPushProviderName =
  explicitAndroidPushProviderName ||
  (
    Platform.OS === 'android'
      ? productionRuntime
        ? 'firebase-video-production'
        : 'firebase-video-staging'
      : ''
  );

const iosPushProviderName =
  (
    process.env
      .EXPO_PUBLIC_STREAM_IOS_PUSH_PROVIDER_NAME
    ?? ''
  ).trim();

const STREAM_USER_ID_KEY =
  '@buklod_stream_push_user_id';

const STREAM_USER_NAME_KEY =
  '@buklod_stream_push_user_name';

type AuthenticatedStreamUser = {
  id: string;
  name: string;
  type: 'authenticated';
};

export async function rememberStreamPushUser(
  userId: string,
  userName?: string | null
) {
  const id =
    userId.trim();

  if (!id) {
    return;
  }

  await AsyncStorage.multiSet([
    [
      STREAM_USER_ID_KEY,
      id,
    ],
    [
      STREAM_USER_NAME_KEY,
      resolvePersonDisplayName(userName, id),
    ],
  ]);
}

async function createTokenProvider():
  Promise<string> {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  let session = sessionData.session;

  // FCM can wake a killed app with a still-valid session. A forced refresh on
  // every incoming ring adds network latency and can fail under weak signal.
  // Only refresh if the token is missing or about to expire.
  if (
    !session?.access_token ||
    (session.expires_at != null &&
      session.expires_at * 1000 <= Date.now() + 45000)
  ) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error || !refreshed.data.session?.access_token) {
      throw refreshed.error ?? new Error(
        'BUKLOD session unavailable for incoming call push.'
      );
    }
    session = refreshed.data.session;
  }

  if (!session?.access_token) {
    throw new Error('No active BUKLOD session for Stream push.');
  }

  if (
    session.expires_at != null &&
    session.expires_at * 1000 <= Date.now() + 30000
  ) {
    throw new Error('BUKLOD session expired for incoming call push.');
  }

  const {
    data,
    error,
  } =
    await supabase.functions.invoke(
      'stream-token',
      {
        body: {},
        headers: {
          Authorization:
            `Bearer ${session.access_token}`,
        },
      }
    );

  if (error) {
    throw error;
  }

  const token =
    (
      data?.token ??
      data?.data?.token ??
      ''
    )
      .toString()
      .trim();

  const apiKey =
    (
      data?.api_key ??
      data?.data?.api_key ??
      ''
    )
      .toString()
      .trim();

  if (apiKey) {
    await rememberStreamApiKey(
      apiKey
    );
  }

  if (!token) {
    throw new Error(
      'Stream token provider returned no token.'
    );
  }

  return token;
}

async function fetchStreamApiKeyFromServer():
  Promise<string> {
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
    throw error;
  }

  return (
    data?.api_key ??
    data?.data?.api_key ??
    ''
  )
    .toString()
    .trim();
}

async function resolvePushUser():
  Promise<AuthenticatedStreamUser | undefined> {
  try {
    const {
      data,
    } =
      await supabase.auth
        .getSession();

    const authUser =
      data.session?.user;

    if (authUser?.id) {
      const name = resolvePersonDisplayName(
        {
          full_name:
            authUser.user_metadata?.full_name ??
            authUser.user_metadata?.name,
          username: authUser.email,
        },
        authUser.id,
      );

      await rememberStreamPushUser(
        authUser.id,
        name
      );

      return {
        id:
          authUser.id,

        name,

        type:
          'authenticated',
      };
    }
  }
  catch (error) {
    console.warn(
      'BUKLOD Stream killed-state session lookup:',
      error
    );
  }

  const values =
    await AsyncStorage.multiGet([
      STREAM_USER_ID_KEY,
      STREAM_USER_NAME_KEY,
    ]);

  const map =
    Object.fromEntries(
      values
    );

  const id =
    (
      map[
        STREAM_USER_ID_KEY
      ]
      ?? ''
    ).trim();

  if (!id) {
    return undefined;
  }

  const name = resolvePersonDisplayName(
    map[STREAM_USER_NAME_KEY],
    id,
  );

  return {
    id,

    name,

    type:
      'authenticated',
  };
}

export function setPushConfig() {
  const hasAndroid =
    Boolean(
      androidPushProviderName
    );

  const hasIos =
    Boolean(
      iosPushProviderName
    );

  if (
    !hasAndroid &&
    !hasIos
  ) {
    console.warn(
      'BUKLOD Stream push: no Android or iOS push provider configured.'
    );

    return;
  }

  StreamVideoRN.setPushConfig({
    ...(hasAndroid
      ? {
          android: {
            pushProviderName:
              androidPushProviderName,

            incomingChannel: {
              /*
               * v2 intentionally creates a fresh Android channel so devices
               * that cached an older silent channel get the SDK's current
               * ringing behavior again. Users can still control it in system
               * notification settings.
               */
              id:
                'buklod_incoming_calls_v2',

              name:
                'Incoming BUKLOD Calls',

              vibration:
                true,
            },

            notificationTexts: {
              accepting:
                'Connecting to BUKLOD call...',

              rejecting:
                'Declining BUKLOD call...',
            },

            // PTT joins are non-ringing media sessions, not Connect calls.
            // Keep Android Telecom for real ringing calls; StreamCall's
            // foreground service keeps non-ringing PTT audio alive instead.
            enableOngoingCalls:
              false,

            defaultDeviceEndpointType:
              'speaker',
          },
        }
      : {}),

    ...(hasIos
      ? {
          ios: {
            pushProviderName:
              iosPushProviderName,

            callsHistory:
              true,

            enableOngoingCalls:
              true,
          },
        }
      : {}),

    shouldRejectCallWhenBusy:
      true,

    createStreamVideoClient:
      async () => {
        const user =
          await resolvePushUser();

        if (!user) {
          return undefined;
        }

        const apiKey =
          await resolveStreamApiKey(
            fetchStreamApiKeyFromServer
          );

        if (!apiKey) {
          console.warn(
            'BUKLOD Stream push: API key unavailable for killed-state calls.'
          );

          return undefined;
        }

        const tokenProvider =
          async () =>
            createTokenProvider();

        return StreamVideoClient
          .getOrCreateInstance({
            apiKey,

            user,

            tokenProvider,

            options: {
              rejectCallWhenBusy:
                true,
            },
          });
      },
  });
}
