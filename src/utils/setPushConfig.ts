import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  StreamVideoClient,
  StreamVideoRN,
} from '@/lib/streamVideoSdk';

import {
  supabase,
} from '@/lib/supabase';

const streamApiKey =
  (
    process.env.EXPO_PUBLIC_STREAM_API_KEY
    ?? ''
  ).trim();

const androidPushProviderName =
  (
    process.env
      .EXPO_PUBLIC_STREAM_ANDROID_PUSH_PROVIDER_NAME
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
      (
        userName
        ?? 'BUKLOD Member'
      ).trim() || 'BUKLOD Member',
    ],
  ]);
}

async function createTokenProvider():
  Promise<string> {
  const {
    data: sessionData,
  } =
    await supabase.auth
      .getSession();

  if (!sessionData.session) {
    throw new Error(
      'No active BUKLOD session for Stream push.'
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
    throw error;
  }

  const token =
    (
      data?.token
      ?? ''
    )
      .toString()
      .trim();

  if (!token) {
    throw new Error(
      'Stream token provider returned no token.'
    );
  }

  return token;
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
      const name =
        (
          authUser.user_metadata?.full_name
          ??
          authUser.user_metadata?.name
          ??
          authUser.email
          ??
          'BUKLOD Member'
        )
          .toString()
          .trim();

      await rememberStreamPushUser(
        authUser.id,
        name
      );

      return {
        id:
          authUser.id,

        name:
          name ||
          'BUKLOD Member',

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

  const name =
    (
      map[
        STREAM_USER_NAME_KEY
      ]
      ?? 'BUKLOD Member'
    ).trim();

  return {
    id,

    name:
      name ||
      'BUKLOD Member',

    type:
      'authenticated',
  };
}

export function setPushConfig() {
  if (!streamApiKey) {
    console.warn(
      'BUKLOD Stream push: EXPO_PUBLIC_STREAM_API_KEY is missing.'
    );

    return;
  }

  if (!androidPushProviderName) {
    console.warn(
      'BUKLOD Stream push: EXPO_PUBLIC_STREAM_ANDROID_PUSH_PROVIDER_NAME is missing.'
    );

    return;
  }

  StreamVideoRN.setPushConfig({
    android: {
      pushProviderName:
        androidPushProviderName,

      incomingChannel: {
        id:
          'buklod_incoming_calls',

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

      enableOngoingCalls:
        true,

      defaultDeviceEndpointType:
        'speaker',
    },

    shouldRejectCallWhenBusy:
      true,

    createStreamVideoClient:
      async () => {
        const user =
          await resolvePushUser();

        if (!user) {
          return undefined;
        }

        const tokenProvider =
          async () =>
            createTokenProvider();

        return StreamVideoClient
          .getOrCreateInstance({
            apiKey:
              streamApiKey,

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
