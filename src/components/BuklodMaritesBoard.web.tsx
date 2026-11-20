/* BUKLOD_WEB_COMMUNITY_LOCKED_MAP_PLUS_CONNECT_R2 */
import React from 'react';
import { View } from 'react-native';

import BuklodCommunityConnectHeaderWeb from '@/components/BuklodCommunityConnectHeader.web';
import BuklodWebCommunityMapHeader from '@/components/BuklodWebCommunityMapHeader.web';

type Props = {
  locationScopeId?: string | null;
};

/*
 * Web-only Community Wall composition.
 *
 * Keep the canonical locked live satellite map exactly as previously approved.
 * Show Today's Best before the Messages/Connect search and profile bubbles.
 * All three scroll with the Wall header, leaving feed behavior unchanged.
 */
const BaseBuklodMaritesBoard = require('./BuklodMaritesBoard.tsx')
  .default as React.ComponentType<Props>;

export default function BuklodMaritesBoardWeb(props: Props) {
  return (
    <View>
      <BaseBuklodMaritesBoard {...props} />
      <BuklodCommunityConnectHeaderWeb />
      <BuklodWebCommunityMapHeader />
    </View>
  );
}
