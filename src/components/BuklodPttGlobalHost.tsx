import React, { useEffect, useState } from 'react';
import {
  StreamCall,
  StreamVideo,
} from '@stream-io/video-react-native-sdk';

import {
  getBuklodPttRuntimeState,
  subscribeBuklodPttRuntime,
} from '@/ptt/buklodPttRuntime';

/*
 * BUKLOD_PTT_GLOBAL_HOST_R2
 *
 * This component stays mounted at the Expo root so StreamCall's Android
 * keep-call-alive effect remains mounted even after leaving the PTT screen.
 */
export default function BuklodPttGlobalHost() {
  const [runtime, setRuntime] = useState(getBuklodPttRuntimeState());

  useEffect(
    () => subscribeBuklodPttRuntime(setRuntime),
    [],
  );

  const connection = runtime.connection;
  if (!connection) return null;

  return (
    <StreamVideo client={connection.client}>
      <StreamCall call={connection.call}>
        {null}
      </StreamCall>
    </StreamVideo>
  );
}