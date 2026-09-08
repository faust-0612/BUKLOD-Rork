import { useEffect, useRef } from 'react';
import { router, usePathname } from 'expo-router';

import { isBuklodClassroomApp } from '@/lib/buklodAppTarget';
import { useAuth } from '@/providers/AuthProvider';

const MAIN_ROOT_PATHS = new Set([
  '/home',
  '/messages',
  '/community',
  '/buklod',
  '/me',
]);

function normalize(pathname: string) {
  const value = String(pathname || '/').split('?')[0].replace(/\/+$/, '');
  return value || '/';
}

/**
 * Runtime containment for the Classroom build target.
 *
 * Login/account services are intentionally shared with BUKLOD Main, but a
 * successful Classroom login must land in Classroom rather than Main tabs.
 * This also contains stale cached Main-tab routes after an app-target switch.
 */
export default function ClassroomExtensionRouteGuard() {
  const { session, loading } = useAuth();
  const pathname = usePathname();
  const redirectingRef = useRef(false);

  useEffect(() => {
    if (!isBuklodClassroomApp() || loading || !session?.user?.id) {
      redirectingRef.current = false;
      return;
    }

    const current = normalize(pathname);
    if (!MAIN_ROOT_PATHS.has(current)) {
      redirectingRef.current = false;
      return;
    }

    if (redirectingRef.current) return;
    redirectingRef.current = true;
    router.replace('/classroom' as any);
  }, [loading, pathname, session?.user?.id]);

  return null;
}
