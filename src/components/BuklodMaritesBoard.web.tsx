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
 * Add only the Messages/Connect search + profile bubbles. Both live inside the
 * Community FlashList header so they scroll away naturally with Wall content.
 */
const BaseBuklodMaritesBoard = require('./BuklodMaritesBoard.tsx')
  .default as React.ComponentType<Props>;

export default function BuklodMaritesBoardWeb(props: Props) {
  return (
    <View>
      <BuklodCommunityConnectHeaderWeb />
      <BuklodWebCommunityMapHeader />
      <BaseBuklodMaritesBoard {...props} />
    </View>
  );
}
