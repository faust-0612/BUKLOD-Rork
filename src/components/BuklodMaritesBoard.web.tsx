/* BUKLOD_WEB_COMMUNITY_CONNECT_SCROLL_MOUNT_R1 */
import React from 'react';
import { View } from 'react-native';

import BuklodCommunityConnectHeaderWeb from '@/components/BuklodCommunityConnectHeader.web';

type Props = {
  locationScopeId?: string | null;
};

/*
 * Web-only Community Wall composition.
 *
 * The existing web map remains owned by BuklodDashboardContextBar and is not
 * changed here. BuklodMaritesBoard already lives inside the Community Wall
 * FlashList ListHeaderComponent, so mounting the Messages/Connect search and
 * profile bubbles here makes them scroll away naturally with Wall content.
 */
const BaseBuklodMaritesBoard = require('./BuklodMaritesBoard.tsx')
  .default as React.ComponentType<Props>;

export default function BuklodMaritesBoardWeb(props: Props) {
  return (
    <View>
      <BuklodCommunityConnectHeaderWeb />
      <BaseBuklodMaritesBoard {...props} />
    </View>
  );
}
