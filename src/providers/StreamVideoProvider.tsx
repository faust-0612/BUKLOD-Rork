import {
  disconnectBuklodStreamVideoClient,
  ensureBuklodStreamVideoClient,
  getCachedBuklodStreamVideoClient,
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
  InteractionManager,
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

      // Stream registers FCM for ringing calls after the user connects.
      // Run this once after first paint, with bounded recovery if the initial
      // login/network window failed. Do not retry indefinitely under weak signal.
      let stopped = false;
      let connecting = false;
      let retryCount = 0;
      let retryTimer: ReturnType<typeof setTimeout> | null = null;
      const retryDelaysMs = [2500, 8000, 20000];

      const connectForIncomingCalls = () => {
        if (
          stopped ||
          connecting ||
          AppState.currentState === 'background' ||
          getCachedBuklodStreamVideoClient()
        ) {
          return;
        }

        connecting = true;
        void ensureBuklodStreamVideoClient()
          .then(() => {
            retryCount = 0;
          })
          .catch(error => {
            console.warn('BUKLOD call client:', error);
            if (!stopped && retryCount < retryDelaysMs.length) {
              retryTimer = setTimeout(
                connectForIncomingCalls,
                retryDelaysMs[retryCount++]
              );
            }
          })
          .finally(() => {
            connecting = false;
          });
      };

      const task = InteractionManager.runAfterInteractions(
        connectForIncomingCalls
      );

      const onAppState = AppState.addEventListener(
        'change',
        state => {
          if (state !== 'active') {
            return;
          }
          if (retryTimer) {
            clearTimeout(retryTimer);
            retryTimer = null;
          }
          retryCount = 0;
          connectForIncomingCalls();
        }
      );

      return () => {
        stopped = true;
        task.cancel();
        if (retryTimer) {
          clearTimeout(retryTimer);
        }
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
