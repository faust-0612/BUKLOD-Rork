import React from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';
import { usePathname } from 'expo-router';

import BuklodAdMobBanner from '@/components/BuklodAdMobBanner';
import { normalizeBuklodPathname } from '@/lib/buklodSafeArea';

/*
 * BUKLOD_FOCUS_APP_ADS_R1
 * One visible ad placement for every Focus App route family. Native resolves
 * AdMob; web resolves the AdSense/BUKLOD-sponsor bridge. The ad is a normal
 * layout element (never hidden behind content and never auto-refreshed).
 * Release trigger: includes the Community reaction hover travel-gap fix.
 */

const FOCUS_APP_ROUTE_PREFIXES = [
  '/profile/buklod-faculty',
  '/profile/buklod-business',
  '/profile/buklod-local',
  '/profile/buklod-family',
  '/profile/buklod-health',
  '/profile/buklod-market',
  '/profile/attendance-qr',
  '/scope/attendance',
  '/giving',
  '/scope-giving-settings',
  '/organizations/manage',
] as const;

export function isBuklodFocusAppAdPath(
  pathname: string
) {
  const path = normalizeBuklodPathname(pathname);

  return FOCUS_APP_ROUTE_PREFIXES.some(
    (prefix) =>
      path === prefix ||
      path.startsWith(`${prefix}/`) ||
      path.startsWith(`${prefix}-`)
  );
}

export default function BuklodFocusAppAdStrip() {
  const pathname = usePathname();

  if (!isBuklodFocusAppAdPath(pathname)) {
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
