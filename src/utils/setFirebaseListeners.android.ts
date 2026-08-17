import {
  getMessaging,
  onMessage,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';

import {
  firebaseDataHandler,
  isFirebaseStreamVideoMessage,
} from '@/lib/streamVideoSdk';

let configured =
  false;

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
        if (
          isFirebaseStreamVideoMessage(
            message
          )
        ) {
          await firebaseDataHandler(
            message.data
          );
        }
      }
    );

    onMessage(
      messaging,
      async message => {
        if (
          isFirebaseStreamVideoMessage(
            message
          )
        ) {
          await firebaseDataHandler(
            message.data
          );
        }
      }
    );
  };
