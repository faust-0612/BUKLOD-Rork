import React from 'react';

import BuklodNativeCommunityMapHeader
  from '@/components/BuklodNativeCommunityMapHeader';

/*
 * BUKLOD COMMUNITY WALL MAP
 *
 * Native: functional live Community map.
 * Web: BuklodCommunityMapNav.web.tsx remains the web override.
 */
export default function BuklodCommunityMapNav() {
  return <BuklodNativeCommunityMapHeader />;
}
