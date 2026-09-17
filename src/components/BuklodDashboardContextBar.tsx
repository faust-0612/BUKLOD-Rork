import { usePathname } from 'expo-router';
import React from 'react';
import { Platform, View } from 'react-native';

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
  const pathname = usePathname();

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
  const webCommunityRoute =
    Platform.OS === 'web' && communityRoute;
  const { activeScope } = useBuklodScope();

  if (profileRoute) {
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

  if (
    isManagedCommunityScope(
      activeScope,
    )
  ) {
    return null;
  }

  if (
    activeScope?.scope_type === 'PUBLIC'
  ) {
    if (communityRoute) {
      /*
       * WEB_COMMUNITY_MAP_R5
       * On web, the real City map is rendered inside the Community Wall list
       * header so it scrolls with the feed. The old compact BUKLOD NAV remains
       * only for native compatibility.
       */
      if (webCommunityRoute) {
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
