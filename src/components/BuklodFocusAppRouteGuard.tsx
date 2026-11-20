import { useEffect, useRef } from 'react';
import { router, usePathname } from 'expo-router';

import { useBuklodAccess } from '@/hooks/useBuklodAccess';
import { focusAppForPathname } from '@/lib/buklodFoundation';

export default function BuklodFocusAppRouteGuard() {
  const pathname = usePathname();
  const { loading, verifyFocusApp } = useBuklodAccess();
  const checkingRef = useRef('');

  useEffect(() => {
    // Patient Health and personal Family doors are public; their privileged workspaces remain gated.
    if (pathname === '/profile/buklod-health' || pathname === '/profile/buklod-family' || pathname === '/profile/buklod-local') {
      checkingRef.current = '';
      return;
    }
    const app = focusAppForPathname(pathname);

    // Invalidate pending denials when moving to any ungated route or
    // while permissions are loading; stale requests cannot bounce Home.
    if (loading || !app) {
      checkingRef.current = '';
      return;
    }

    const key = `${pathname}|${app}`;

    if (checkingRef.current === key) {
      return;
    }

    checkingRef.current = key;

    void verifyFocusApp(app).then((access) => {
      if (!access.canSee && checkingRef.current === key) {
        router.replace('/profile/focus-apps' as any);
      }
    });
  }, [pathname, loading, verifyFocusApp]);

  return null;
}
