import type {
  ComponentProps,
} from 'react';

import {
  View,
} from 'react-native';

export type BuklodAdMobBannerProps =
  ComponentProps<typeof View> & {
    unitId?: string;
    adUnitId?: string;
    placement?: string;
    testID?: string;
  };

export function BuklodAdMobBanner(
  _props: BuklodAdMobBannerProps
) {
  /*
   * AdMob is native-only in BUKLOD.
   * Web intentionally renders no AdMob banner.
   *
   * Android continues using:
   * BuklodAdMobBanner.tsx
   */
  return null;
}

export default BuklodAdMobBanner;