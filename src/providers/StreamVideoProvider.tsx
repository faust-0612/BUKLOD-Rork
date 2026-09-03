import {
  disconnectBuklodStreamVideoClient,
  ensureBuklodStreamVideoClient,
  getCachedBuklodStreamVideoClient,
  prewarmBuklodStreamVideoClient,
  subscribeBuklodStreamVideoClient,
} from '@/lib/buklodStreamVideoClient';
import { installBuklodCallLifecycle } from '@/lib/buklodCallLifecycle';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';
import {
  rememberStreamPushUser,
} from '@/utils/setPushConfig';
import {
  PropsWithChildren,
  useEffect,
  useState,
} from 'react';
import {
  AppState,
} from 'react-native';

import {
  StreamVideo,
  StreamVideoClient,
} from '@/lib/streamVideoSdk';

import {
  useAuth,
} from '@/providers/AuthProvider';

import {
  RingingCalls,
} from '@/components/RingingCalls';

export function StreamVideoProvider({
  children,
}: PropsWithChildren) {
  const {
    user,
  } = useAuth();

  const [
    client,
    setClient,
  ] =
    useState<
      StreamVideoClient | undefined
    >(
      () =>
        getCachedBuklodStreamVideoClient()
        ?? undefined
    );

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

  useEffect(
    () => {
      if (!user?.id) {
        setClient(undefined);
        void disconnectBuklodStreamVideoClient();
        return;
      }

      void rememberStreamPushUser(
        user.id,
        resolvePersonDisplayName(
          {
            full_name:
              user.user_metadata?.full_name ??
              user.user_metadata?.name,
            username: user.email,
          },
          user.id,
        ),
      )
        .catch(error => {
          console.warn(
            'BUKLOD Stream push identity cache:',
            error
          );
        });

      const unsubscribe =
        subscribeBuklodStreamVideoClient(
          nextClient => {
            setClient(
              nextClient ??
                undefined
            );
          }
        );

      void ensureBuklodStreamVideoClient()
        .catch(error => {
          console.warn(
            'BUKLOD call client:',
            error
          );
        });

      const onAppState =
        AppState.addEventListener(
          'change',
          state => {
            if (state !== 'active') {
              return;
            }

            if (getCachedBuklodStreamVideoClient()) {
              return;
            }

            void ensureBuklodStreamVideoClient()
              .catch(error => {
                console.warn(
                  'BUKLOD call client retry:',
                  error
                );
              });
          }
        );

      return () => {
        onAppState.remove();
        unsubscribe();
      };
    },
    [
      user?.id,
    ]
  );

  useEffect(
    () => {
      if (!client) {
        return;
      }

      return installBuklodCallLifecycle(
        client
      );
    },
    [
      client,
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
