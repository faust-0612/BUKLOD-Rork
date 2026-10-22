import { useCallback, useContext, useEffect, useRef } from 'react';
import type { VideoPlayer, VideoSourceObject } from 'expo-video';
import { NetworkContext } from '@/providers/NetworkProvider';
import { resignCommunityMediaUrl } from '@/lib/buklodMediaUrl';
import { createBuklodMediaRecovery } from '@/lib/buklodMediaRecovery';

/** Shared error recovery only; callers retain visibility, pause and player ownership. */
export function useBuklodMediaRecovery(
  player: VideoPlayer,
  source: VideoSourceObject,
  mediaPath: string | undefined,
  canRecover: () => boolean,
  reset: () => void,
) {
  const network = useContext(NetworkContext);
  const online = network?.online ?? true;
  const latest = useRef({ source, mediaPath, canRecover, reset, online });
  latest.current = { source, mediaPath, canRecover, reset, online };
  const recovery = useRef<ReturnType<typeof createBuklodMediaRecovery> | null>(null);
  const wasOnline = useRef(online);
  useEffect(() => {
    const owner = createBuklodMediaRecovery({
      canRecover: () => latest.current.online && latest.current.canRecover(),
      status: () => player.status,
      freshUri: async () => {
        const path = latest.current.mediaPath;
        // AWS URLs must be refreshed by their secure feed API, never Supabase.
        if (!path || /^(aws:|https?:|file:|content:|blob:|data:)/i.test(path)) return null;
        return resignCommunityMediaUrl(path);
      },
      replace: uri => player.replaceAsync({ ...latest.current.source, uri: uri || latest.current.source.uri }),
      reset: () => latest.current.reset(),
    });
    recovery.current = owner;
    return () => { owner.dispose(); if (recovery.current === owner) recovery.current = null; };
  }, [player]);
  // Type-only compatibility for callers still passing a retry flag.
  // The restored V25 R1 media behavior remains error-only; ignore the flag.
  const retry = useCallback((_forceStalled?: boolean) => recovery.current?.retry().catch(() => undefined) ?? Promise.resolve(), []);
  useEffect(() => {
    const reconnected = !wasOnline.current && online;
    wasOnline.current = online;
    if (reconnected) void retry();
  }, [online, retry]);
  return retry;
}
