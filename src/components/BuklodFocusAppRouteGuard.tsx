import { useEffect, useRef } from 'react';
import { router, usePathname } from 'expo-router';

import { useBuklodAccess } from '@/hooks/useBuklodAccess';
import { focusAppForPathname } from '@/lib/buklodFoundation';

export default function BuklodFocusAppRouteGuard() {
  const pathname = usePathname();
  const { loading, verifyFocusApp } = useBuklodAccess();
  const checkingRef = useRef('');

  useEffect(() => {
    const app = focusAppForPathname(pathname);

    if (loading || !app) {
      return;
    }

    const key = `${pathname}|${app}`;

    if (checkingRef.current === key) {
      return;
    }

    checkingRef.current = key;

    void verifyFocusApp(app).then((access) => {
      if (!access.canSee) {
        router.replace('/profile/focus-apps' as any);
      }
    });
  }, [pathname, loading, verifyFocusApp]);

  return null;
}
