import React from 'react';
import { StyleSheet, View } from 'react-native';
import { usePathname } from 'expo-router';

import BuklodAdMobBanner from '@/components/BuklodAdMobBanner';
import { normalizeBuklodPathname } from '@/lib/buklodSafeArea';

/*
 * BUKLOD_NAV_AD_OPPORTUNITY_R1
 *
 * Keep one persistent, visible banner opportunity across ordinary navigation.
 * The banner is intentionally NOT keyed/remounted per route change. Google
 * controls banner refresh; BUKLOD does not force a new request on every tap.
 *
 * Exclusions protect immersive gameplay/video, authentication, privacy,
 * admin/system, account deletion and payment-sensitive flows.
 */

const BLOCKED_PREFIXES = [
  '/igpat',
  '/reels',
  '/login',
  '/auth',
  '/onboarding',
  '/privacy',
  '/policy',
  '/delete-account',
  '/account',
  '/admin',
  '/system',
  '/premium',
  '/billing',
  '/checkout',
  '/scope-giving-settings',
] as const;

function isActiveGameRoute(path: string) {
  if (path === '/games' || path === '/games/training-grounds') {
    return false;
  }

  return path.startsWith('/games/');
}

export function isBuklodNavigationAdEligiblePath(pathname: string) {
  const path = normalizeBuklodPathname(pathname);

  if (!path || path === '/') {
    return false;
  }

  if (isActiveGameRoute(path)) {
    return false;
  }

  return !BLOCKED_PREFIXES.some(
    (prefix) =>
      path === prefix ||
      path.startsWith(`${prefix}/`)
  );
}

export default function BuklodNavigationAdStrip({
  hidden = false,
}: {
  hidden?: boolean;
}) {
  const pathname = usePathname();

  if (
    hidden ||
    !isBuklodNavigationAdEligiblePath(pathname)
  ) {
    return null;
  }

  return (
    <View style={styles.shell}>
      <BuklodAdMobBanner
        placement="focus"
        compact
        format="adaptive"
        requireViewport={false}
        showLabel
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexShrink: 0,
    width: '100%',
    maxWidth: 940,
    alignSelf: 'center',
    paddingHorizontal: 8,
  },
});
