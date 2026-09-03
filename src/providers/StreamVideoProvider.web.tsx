import {
  type PropsWithChildren,
  useEffect,
  useState,
} from 'react';

import type { StreamVideoClient } from '@stream-io/video-client';

import {
  disconnectBuklodStreamVideoClient,
  ensureBuklodStreamVideoClient,
  getCachedBuklodStreamVideoClient,
  subscribeBuklodStreamVideoClient,
} from '@/lib/buklodStreamVideoClient';
import { installBuklodCallLifecycle } from '@/lib/buklodCallLifecycle';
import { useAuth } from '@/providers/AuthProvider';
import { RingingCalls } from '@/components/RingingCalls';

/* BUKLOD_WEB_CALLING_R1 */
export function StreamVideoProvider({
  children,
}: PropsWithChildren) {
  const { user } = useAuth();
  const [client, setClient] = useState<StreamVideoClient | undefined>(
    () => getCachedBuklodStreamVideoClient() ?? undefined
  );

  useEffect(() => {
    if (!user?.id) {
      setClient(undefined);
      void disconnectBuklodStreamVideoClient();
      return;
    }

    const unsubscribe =
      subscribeBuklodStreamVideoClient(
        next => setClient(next ?? undefined)
      );

    void ensureBuklodStreamVideoClient()
      .catch(error => {
        console.warn(
          'BUKLOD browser call client:',
          error
        );
      });

    return unsubscribe;
  }, [user?.id]);

  useEffect(() => {
    if (!client) {
      return;
    }

    return installBuklodCallLifecycle(client as any);
  }, [client]);

  return (
    <>
      {children}
      {client ? <RingingCalls /> : null}
    </>
  );
}

export default StreamVideoProvider;
