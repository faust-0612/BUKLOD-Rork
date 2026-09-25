/* BUKLOD_NATIVE_COMMUNITY_MAP_HEADER_R1 */
import React from 'react';
import { View } from 'react-native';

import BuklodNativeCommunityMapHeader
  from '@/components/BuklodNativeCommunityMapHeader.native';

type Props = {
  locationScopeId?: string | null;
};

const BaseBuklodMaritesBoard = require('./BuklodMaritesBoard.tsx')
  .default as React.ComponentType<Props>;

/**
 * Native Community Wall composition mirrors the canonical web structure:
 * map preview in the scrolling Community header, then stories/content.
 */
export default function BuklodMaritesBoardNative(props: Props) {
  return (
    <View>
      <BuklodNativeCommunityMapHeader />
      <BaseBuklodMaritesBoard {...props} />
    </View>
  );
}
