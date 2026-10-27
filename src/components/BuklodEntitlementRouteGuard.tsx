import {
  useEffect,
  useMemo,
  useRef,
} from 'react';

import {
  router,
  usePathname,
} from 'expo-router';

import type {
  BuklodEntitlement,
} from '@/lib/buklodAccess';

import {
  useBuklodAccess,
} from '@/hooks/useBuklodAccess';

type GuardRule = {
  entitlement: BuklodEntitlement;
  matches: (pathname: string) => boolean;
};

const RULES: GuardRule[] = [
  {
    entitlement: 'bayanihan',
    matches: (pathname) =>
      pathname === '/bayanihan' ||
      pathname.startsWith('/bayanihan/'),
  },
  {
    entitlement: 'tithes',
    matches: (pathname) =>
      pathname === '/giving' ||
      pathname.startsWith('/giving/'),
  },
  {
    entitlement: 'learn_paid',
    matches: (pathname) =>
      pathname.startsWith('/learn/paid') ||
      pathname.startsWith('/learning/paid'),
  },
  {
    entitlement: 'financial_admin',
    matches: (pathname) =>
      pathname.startsWith('/admin/bayanihan') ||
      pathname.startsWith('/admin/giving') ||
      pathname.startsWith('/admin/finance'),
  },
];

export default function BuklodEntitlementRouteGuard() {
  const pathname = usePathname();

  const {
    loading,
    activeScope,
    hasEntitlement,
    verifyEntitlement,
  } = useBuklodAccess();

  const checkingRef = useRef('');

  const rule =
    useMemo(
      () =>
        RULES.find(
          (candidate) =>
            candidate.matches(pathname)
        ) ?? null,
      [pathname]
    );

  useEffect(() => {
    if (
      loading ||
      !activeScope ||
      !rule
    ) {
      return;
    }

    const key =
      `${pathname}|${activeScope.scope_id}|${rule.entitlement}`;

    if (checkingRef.current === key) {
      return;
    }

    checkingRef.current = key;

    if (!hasEntitlement(rule.entitlement)) {
      router.replace('/hub' as any);
      return;
    }

    void verifyEntitlement(
      rule.entitlement
    ).then((allowed) => {
      if (!allowed) {
        router.replace('/hub' as any);
      }
    });
  }, [
    pathname,
    loading,
    activeScope,
    rule,
    hasEntitlement,
    verifyEntitlement,
  ]);

  return null;
}
