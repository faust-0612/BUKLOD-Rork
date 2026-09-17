/* BUKLOD_ANDROID_COMMUNITY_SCROLL_HEADER_R4 */
import React from 'react';
import { View } from 'react-native';

import BuklodCommunityMapNav from '@/components/BuklodCommunityMapNav';

type Props = {
  locationScopeId?: string | null;
};

/*
 * Android-only Community Wall composition.
 *
 * BuklodMaritesBoard is already rendered inside the Community FlashList
 * ListHeaderComponent. Mounting the Connect search + profile bubbles here
 * makes them part of that scrollable header instead of a fixed dashboard
 * context bar. The explicit .tsx require loads the shared Marites board while
 * this .android.tsx file remains only the Android platform wrapper.
 */
const BaseBuklodMaritesBoard = require('./BuklodMaritesBoard.tsx')
  .default as React.ComponentType<Props>;

export default function BuklodMaritesBoardAndroid(props: Props) {
  return (
    <View>
      <BuklodCommunityMapNav />
      <BaseBuklodMaritesBoard {...props} />
    </View>
  );
}
