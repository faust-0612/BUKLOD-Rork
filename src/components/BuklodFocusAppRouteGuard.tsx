import { useEffect, useRef } from 'react';
import { router, usePathname } from 'expo-router';

import { useBuklodAccess } from '@/hooks/useBuklodAccess';
import { focusAppForPathname } from '@/lib/buklodFoundation';

export default function BuklodFocusAppRouteGuard() {
  const pathname = usePathname();
  const { loading, verifyFocusApp } = useBuklodAccess();
  const checkingRef = useRef('');

  useEffect(() => {
    // The patient-facing Health Center is an external website doorway,
    // not a privileged Health Worker workspace. Do not role-gate it.
    if (pathname === '/profile/buklod-health') {
      checkingRef.current = '';
      return;
    }
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
      if (!access.canSee && checkingRef.current === key) {
        router.replace('/profile/focus-apps' as any);
      }
    });
  }, [pathname, loading, verifyFocusApp]);

  return null;
}
