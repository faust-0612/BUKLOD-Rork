import { useEffect } from 'react';
import { router, usePathname } from 'expo-router';

import { isClassroomApp } from '@/lib/appIdentity';

const MAIN_ONLY_PREFIXES = [
  '/home',
  '/messages',
  '/buklod',
  '/me',
  '/learn',
  '/prayer',
  '/organizations',
  '/clusters',
  '/mzb',
  '/church',
  '/reels',
  '/word',
  '/bible',
  '/leader',
  '/mentor',
  '/scope',
  '/formation',
  '/advertise',
  '/bayanihan',
] as const;

function isMainOnlyPath(pathname: string) {
  return MAIN_ONLY_PREFIXES.some(
    prefix => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Standalone Classroom is allowed to share auth/account/backend infrastructure,
 * but it must never fall through into BUKLOD Main's dashboard/navigation shell.
 * Main builds are a strict no-op here.
 */
export default function ClassroomAppRouteGuard() {
  const pathname = usePathname();

  useEffect(() => {
    if (!isClassroomApp || !isMainOnlyPath(pathname)) return;

    router.replace('/classroom' as any);
  }, [pathname]);

  return null;
}
