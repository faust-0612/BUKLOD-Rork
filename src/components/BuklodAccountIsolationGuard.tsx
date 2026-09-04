import { useEffect, useRef } from 'react';
import { router } from 'expo-router';

import { useAuth } from '@/providers/AuthProvider';

/**
 * BUKLOD_ACCOUNT_ISOLATION_R1
 *
 * Expo Router keeps the active route mounted while the auth session changes.
 * That is convenient for token refreshes, but wrong for a real account switch:
 * user B must never inherit user A's classroom/thread/workspace route.
 *
 * The first hydrated account is accepted without navigation. Every later
 * identity change resets to a neutral entry route.
 */
export default function BuklodAccountIsolationGuard() {
  const { user, loading } = useAuth();
  const previousUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (loading) return;

    const nextUserId = user?.id ?? null;
    const previousUserId = previousUserIdRef.current;

    if (previousUserId === undefined) {
      previousUserIdRef.current = nextUserId;
      return;
    }

    if (previousUserId === nextUserId) {
      return;
    }

    previousUserIdRef.current = nextUserId;

    if (!nextUserId) {
      router.replace('/(auth)/login' as any);
      return;
    }

    // A different authenticated identity must start from the canonical root.
    // The root boot then rebuilds Public scope/profile state for that user.
    router.replace('/' as any);
  }, [loading, user?.id]);

  return null;
}
