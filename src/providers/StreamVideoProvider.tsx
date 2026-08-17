import {
  prewarmBuklodStreamVideoClient,
} from '@/lib/buklodStreamVideoClient';
﻿import {
  rememberStreamPushUser,
} from '@/utils/setPushConfig';
import {
  PropsWithChildren,
  useEffect,
  useState,
} from 'react';

import {
  StreamVideo,
  StreamVideoClient,
  type User,
} from '@/lib/streamVideoSdk';

import {
  supabase,
} from '@/lib/supabase';

import {
  useAuth,
} from '@/providers/AuthProvider';

import {
  RingingCalls,
} from '@/components/RingingCalls';

const STREAM_API_KEY =
  (
    process.env
      .EXPO_PUBLIC_STREAM_API_KEY
    ?? ''
  ).trim();

export function StreamVideoProvider({
  children,
}: PropsWithChildren) {
  const {
    user,
  } = useAuth();

  /* PATCH_179F_CALL_PROVIDER_PREWARM */
  useEffect(
    () => {
      if (!user?.id) {
        return;
      }

      prewarmBuklodStreamVideoClient();
    },
    [
      user?.id,
    ]
  );

  const [
    client,
    setClient,
  ] =
    useState<
      StreamVideoClient | undefined
    >(undefined);

  useEffect(
    () => {
      if (
        !user?.id ||
        !STREAM_API_KEY
      ) {
        setClient(undefined);
        return;
      }

      /* PATCH_168F_REMEMBER_STREAM_PUSH_USER */
      void rememberStreamPushUser(
        user.id,
        (
          user.user_metadata?.full_name
          ??
          user.user_metadata?.name
          ??
          user.email
          ??
          'BUKLOD Member'
        )
          .toString()
          .trim()
      )
        .catch(error => {
          console.warn(
            'BUKLOD Stream push identity cache:',
            error
          );
        });
      const tokenProvider =
        async (): Promise<string> => {
          const {
            data,
            error,
          } =
            await supabase
              .functions
              .invoke(
                'stream-token',
                {
                  body: {},
                }
              );

          if (error) {
            throw new Error(
              error.message
              || 'Could not get call token.'
            );
          }

          if (!data?.token) {
            throw new Error(
              'Call token was not returned.'
            );
          }

          return data.token;
        };

      const streamUser: User = {
        id: user.id,

        name:
          user.user_metadata
            ?.full_name
          ||
          user.user_metadata
            ?.name
          ||
          user.email
          ||
          'BUKLOD Member',
      };

      const nextClient =
        StreamVideoClient
          .getOrCreateInstance({
            apiKey:
              STREAM_API_KEY,

            user:
              streamUser,

            tokenProvider,

            options: {
              rejectCallWhenBusy:
                true,
            },
          });

      setClient(
        nextClient
      );

      return () => {
        nextClient
          .disconnectUser()
          .catch(
            error => {
              console.warn(
                'Stream disconnect:',
                error
              );
            }
          );
      };
    },
    [
      user?.id,
      user?.email,
    ]
  );

  if (!client) {
    return (
      <>
        {children}
      </>
    );
  }

  return (
    <StreamVideo client={client}>
      {children}
      <RingingCalls />
    </StreamVideo>
  );
}

