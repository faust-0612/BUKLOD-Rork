import {
  getMessaging,
  onMessage,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';

import {
  firebaseDataHandler,
  isFirebaseStreamVideoMessage,
} from '@/lib/streamVideoSdk';
import {
  recordBuklodStreamPushEvent,
} from '@/lib/buklodCallLifecycle';

let configured =
  false;

const CALL_EVENTS_CHANNEL =
  'buklod-call-events-v1';

function streamEventType(
  data: Record<string, any> | undefined
) {
  return String(
    data?.type ??
    data?.event_type ??
    ''
  ).trim();
}

async function ensureCallEventsChannel() {
  await Notifications
    .setNotificationChannelAsync(
      CALL_EVENTS_CHANNEL,
      {
        name:
          'BUKLOD Call Alerts',
        importance:
          Notifications
            .AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [
          0,
          300,
          180,
          300,
        ],
        enableVibrate: true,
        showBadge: true,
      }
    );
}

async function displayMissedCall(
  data: Record<string, any> | undefined
) {
  await ensureCallEventsChannel();

  const callerName =
    String(
      data?.created_by_name ??
      data?.caller_name ??
      data?.user_name ??
      'BUKLOD member'
    ).trim() ||
    'BUKLOD member';

  await Notifications
    .scheduleNotificationAsync({
      content: {
        title:
          'Missed BUKLOD call',
        body:
          `You missed a call from ${callerName}.`,
        sound: 'default',
        data: {
          kind:
            'call_missed',
          call_cid:
            String(
              data?.call_cid ??
              ''
            ),
        },
      },
      trigger: null,
    });
}

async function handleStreamMessage(
  message: any
) {
  if (
    !isFirebaseStreamVideoMessage(
      message
    )
  ) {
    return;
  }

  const data =
    (message?.data ?? {}) as
      Record<string, any>;

  const eventType =
    streamEventType(data);

  if (
    eventType ===
    'call.missed'
  ) {
    await recordBuklodStreamPushEvent(
      data
    );

    await displayMissedCall(
      data
    );

    return;
  }

  /*
   * call.ring and the SDK-managed ringing events continue through Stream's
   * native Firebase handler so Android Telecom can show/answer calls even
   * while BUKLOD is backgrounded or killed.
   */
  await firebaseDataHandler(
    data
  );
}

export const setFirebaseListeners =
  () => {
    if (configured) {
      return;
    }

    configured =
      true;

    const messaging =
      getMessaging();

    setBackgroundMessageHandler(
      messaging,
      async message => {
        try {
          await handleStreamMessage(
            message
          );
        }
        catch (error) {
          console.warn(
            'BUKLOD Stream background push:',
            error
          );
        }
      }
    );

    onMessage(
      messaging,
      async message => {
        try {
          await handleStreamMessage(
            message
          );
        }
        catch (error) {
          console.warn(
            'BUKLOD Stream foreground push:',
            error
          );
        }
      }
    );
  };
