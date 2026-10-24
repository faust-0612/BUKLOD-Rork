/* BUKLOD_NATIVE_COMMUNITY_MAP_PARITY_R1 */
import React from 'react';
import {
  View,
} from 'react-native';


type Props = {
  locationScopeId?: string | null;
};

/*
 * Native Community Wall composition.
 *
 * Mirrors web placement:
 * compact real map inside the Wall header, followed by Marites/content.
 * The legacy large fake map card is suppressed by
 * BuklodCommunityMapNav.native.tsx.
 */
const BaseBuklodMaritesBoard =
  require('./BuklodMaritesBoard.tsx')
    .default as React.ComponentType<Props>;

export default function BuklodMaritesBoardNative(
  props: Props,
) {
  return (
    <View>
      <BaseBuklodMaritesBoard
        {...props}
      />
    </View>
  );
}
