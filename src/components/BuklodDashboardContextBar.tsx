import { usePathname } from 'expo-router';
import React from 'react';

import BuklodScopeBar
  from '@/components/BuklodScopeBar';

import BuklodPublicDailyMessageBar
  from '@/components/BuklodPublicDailyMessageBar';

import {
  useBuklodScope,
} from '@/providers/BuklodScopeProvider';

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
    activeScope?.scope_type ===
    'PUBLIC'
  ) {
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