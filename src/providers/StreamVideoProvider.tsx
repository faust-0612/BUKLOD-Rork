import { getMessaging, getToken, onTokenRefresh } from '@react-native-firebase/messaging';
import { androidPushProviderName } from '@/utils/setPushConfig';
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
  PermissionsAndroid,
  Platform,
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

  /* BUKLOD_V25_RECEIVER_TOKEN_SYNC_R1
   * Stream Video owns call.ring handling and Android Telecom notifications.
   * This only makes receiver device registration explicit/recoverable when
   * an authenticated Stream client appears or the FCM token rotates.
   * Never creates a duplicate call UI, outgoing call, or PTT receiver.
   */
  useEffect(() => {
    if (
      Platform.OS !== 'android' ||
      !user?.id ||
      !client ||
      !androidPushProviderName
    ) {
      return;
    }

    let disposed = false;
    const messaging = getMessaging();
    const syncDevice = async (token: string) => {
      if (disposed || !token) return;
      try {
        await client.addDevice(token, 'firebase', androidPushProviderName);
        if (!disposed) {
          console.info('BUKLOD receiver push: device registered with Stream');
        }
      } catch (error) {
        console.warn('BUKLOD receiver push device registration:', error);
      }
    };

    void getToken(messaging)
      .then(syncDevice)
      .catch(error => {
        console.warn('BUKLOD receiver FCM token:', error);
      });

    const unsubscribe = onTokenRefresh(messaging, token => {
      void syncDevice(token);
    });

    // Android 13+ requires a user-granted notification permission.
    // Do not grant silently or alter native manifest in an OTA patch.
    if (Number(Platform.Version) >= 33) {
      void PermissionsAndroid.check('android.permission.POST_NOTIFICATIONS')
        .then(granted => {
          if (!granted && !disposed) {
            return PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS');
          }
          return undefined;
        })
        .catch(error => {
          console.warn('BUKLOD receiver notification permission:', error);
        });
    }

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [client, user?.id]);
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
