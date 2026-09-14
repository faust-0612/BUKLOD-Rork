import { usePathname } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import BuklodScopeBar
  from '@/components/BuklodScopeBar';

import BuklodPublicDailyMessageBar
  from '@/components/BuklodPublicDailyMessageBar';

import BuklodPublicCommunityActions
  from '@/components/BuklodPublicCommunityActions';

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
  const publicCommunityRoute =
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
    return (
      <View>
        <BuklodPublicDailyMessageBar />
        {publicCommunityRoute ? (
          <BuklodPublicCommunityActions />
        ) : null}
      </View>
    );
  }

  return <BuklodScopeBar
    hideLocalScopes={
      profileRoute
    }
  />;
}
