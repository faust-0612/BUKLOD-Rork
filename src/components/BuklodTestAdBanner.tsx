import {
  BannerAd,
  BannerAdSize,
} from 'react-native-google-mobile-ads';

import {
  BUKLOD_AD_UNITS,
} from '@/lib/adUnits';

import {
  useAds,
} from '@/providers/AdsProvider';

export function BuklodTestAdBanner() {
  const {
    ready,
    canRequestAds,
    testMode,
  } =
    useAds();

  /*
   * This component is deliberately staging/dev only.
   * Production pages should use their own production
   * placement component after production unit IDs exist.
   */
  if (
    !testMode ||
    !ready ||
    !canRequestAds
  ) {
    return null;
  }

  return (
    <BannerAd
      unitId={
        BUKLOD_AD_UNITS.banner
      }
      size={
        BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER
      }
      onAdFailedToLoad={
        error => {
          console.warn(
            'BUKLOD staging banner:',
            error
          );
        }
      }
    />
  );
}