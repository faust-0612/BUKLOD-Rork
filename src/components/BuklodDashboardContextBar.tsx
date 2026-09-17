import { usePathname } from 'expo-router';
import React from 'react';
import {
  Platform,
  useWindowDimensions,
  View,
} from 'react-native';

import BuklodCommunityMapNav
  from '@/components/BuklodCommunityMapNav';
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
  const pathname =
    usePathname();
  const { width } = useWindowDimensions();

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
  const desktopCommunity =
    Platform.OS === 'web' &&
    width >= 1200 &&
    communityRoute;
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
  if (profileRoute) {
    /* PATCH_186F_ENCOURAGEMENT_THROUGH_PROFILE */
    return (
      <BuklodPublicDailyMessageBar
        forceVisible
      />
    );
  }

  if (
    messagesRoute &&
    activeScope?.scope_type === 'PUBLIC'
  ) {
    return null;
  }

  /*
   * Organization / Sub-organization / Cluster workspaces live only under
   * `/scope` (opened from Profile or portal actions). Never show the global
   * scope drawer on the personal tab dashboard.
   */
  if (
    isManagedCommunityScope(
      activeScope,
    )
  ) {
    return null;
  }

  if (
    activeScope?.scope_type ===
    'PUBLIC'
  ) {
    if (communityRoute) {
      /*
       * BUKLOD_DESKTOP_COMMUNITY_MAP_R4
       * Desktop uses the real City map from inside the Wall list header, so
       * the map scrolls with Community. Keep the legacy compact nav untouched
       * on mobile/tablet.
       */
      if (desktopCommunity) {
        return <BuklodPublicDailyMessageBar />;
      }

      return (
        <View>
          <BuklodCommunityMapNav />
          <BuklodPublicDailyMessageBar />
        </View>
      );
    }

    return (
      <BuklodPublicDailyMessageBar />
    );
  }

  return <BuklodScopeBar
    hideLocalScopes={
      profileRoute
    }
  />;
}
