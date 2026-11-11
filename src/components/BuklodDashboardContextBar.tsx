import { buklodDashboardRoute, isBuklodDashboardScrollCompact, subscribeBuklodDashboardScroll } from '@/lib/buklodDashboardScroll';
import { usePathname } from 'expo-router';
import React from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';
import { normalizeBuklodPathname } from '@/lib/buklodSafeArea';
import { shouldUseBuklodPublicDesktopShell } from '@/lib/buklodWebResponsivePolicy';

import BuklodScopeBar
  from '@/components/BuklodScopeBar';
import BuklodPublicDailyMessageBar
  from '@/components/BuklodPublicDailyMessageBar';

import {
  useBuklodScope,
} from '@/providers/BuklodScopeProvider';

import {
  isManagedCommunityScope,
} from '@/lib/buklodScopeRoute';

export default function BuklodDashboardContextBar() {
  /* PATCH_169F_R3_PROFILE_ROUTE */
  const pathname = usePathname();
  const route = buklodDashboardRoute(pathname);
  const [scrollCompact, setScrollCompact] = React.useState(() => isBuklodDashboardScrollCompact(route));
  React.useEffect(() => {
    setScrollCompact(isBuklodDashboardScrollCompact(route));
    return subscribeBuklodDashboardScroll((r, compact) => {
      if (r === route) setScrollCompact(compact);
    });
  }, [route]);
  const { width } = useWindowDimensions();
  // Desktop header owns the daily encouragement; avoid a duplicate banner
  // inside the routed center card. Mobile/web-phone retains the original bar.
  const dailyMessageInDesktopHeader =
    Platform.OS === 'web' &&
    shouldUseBuklodPublicDesktopShell(
      normalizeBuklodPathname(pathname), width
    );

  const profileRoute =
    pathname === '/me' ||
    pathname === '/profile' ||
    pathname.endsWith('/me') ||
    pathname.endsWith('/profile') ||
    pathname.includes('/me/') ||
    pathname.includes('/profile/');
  const messagesRoute =
    pathname === '/messages' ||
    pathname.startsWith('/messages/');
  const communityRoute =
    pathname === '/buklod' ||
    pathname.startsWith('/buklod/');
  const {
    activeScope,
  } = useBuklodScope();

  /*
   * PATCH_172G_R2_GENERIC_PROFILE_NO_CONTEXTBAR
   *
   * Profile / My BUKLOD is a fully generic personal screen.
   * No Public / Church / Cluster / Organization / Sub-org
   * context bar or scope selector is rendered here.
   */
  if (dailyMessageInDesktopHeader) {
    return null;
  }

  if (profileRoute) {
    /* PATCH_186F_ENCOURAGEMENT_THROUGH_PROFILE */
    return (
      <BuklodPublicDailyMessageBar forceVisible compact={scrollCompact} />
    );
  }

  if (messagesRoute && activeScope?.scope_type === 'PUBLIC') {
    return <BuklodPublicDailyMessageBar compact={scrollCompact} />;
  }

  /*
   * Organization / Sub-organization / Cluster workspaces live only under
   * `/scope` (opened from Profile or portal actions). Never show the global
   * scope drawer on the personal tab dashboard.
   */
  if (isManagedCommunityScope(activeScope)) {
    return <BuklodPublicDailyMessageBar forceVisible compact={scrollCompact} />;
  }

  if (
    activeScope?.scope_type ===
    'PUBLIC'
  ) {
    if (communityRoute) {
      return (
        <View>
          <BuklodPublicDailyMessageBar compact={scrollCompact} />
        </View>
      );
    }

    return (
      <BuklodPublicDailyMessageBar compact={scrollCompact} />
    );
  }

  return <BuklodScopeBar
    hideLocalScopes={
      profileRoute
    }
  />;
}
