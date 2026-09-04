import Constants from 'expo-constants';
import {
  TestIds,
} from 'react-native-google-mobile-ads';

import type { BuklodAdDiagnosticPlacement } from '@/lib/buklodAdDiagnostics';

export type BuklodAdPlacement =
  | 'home'
  | 'community'
  | 'prayer'
  | 'messages'
  | 'bible'
  | 'devotion'
  | 'me'
  | 'reels'
  | 'focus'
  | 'test';

/* Standard AdMob BANNER creative is 320x50. Dashboard chrome
 * reserves this plus the Sponsored label/padding so the shell
 * never collapses while an ad is loading, empty, or failed. */
export const BUKLOD_DASHBOARD_BANNER_AD_HEIGHT = 50;
export const BUKLOD_DASHBOARD_BANNER_RESERVED_HEIGHT = 68;

const GOOGLE_SAMPLE_ANDROID_APP_ID =
  'ca-app-pub-3940256099942544~3347511713';

const PRODUCTION_PACKAGE =
  'org.mzbministry.buklod';

const STAGING_PACKAGE =
  'org.mzbministry.buklod.staging';

const appEnvironment =
  (
    process.env.EXPO_PUBLIC_APP_ENV ||
    String(
      Constants.expoConfig?.extra?.appEnvironment ||
        'production',
    )
  )
    .trim()
    .toLowerCase();

function nativePackages() {
  return {
    androidPackage: String(
      Constants.expoConfig?.android?.package ?? '',
    ).trim(),
    iosBundle: String(
      Constants.expoConfig?.ios?.bundleIdentifier ?? '',
    ).trim(),
  };
}

function isStagingNativeIdentity() {
  const { androidPackage, iosBundle } =
    nativePackages();

  return (
    androidPackage === STAGING_PACKAGE ||
    iosBundle === STAGING_PACKAGE
  );
}

function isProductionNativeIdentity() {
  const { androidPackage, iosBundle } =
    nativePackages();

  return (
    androidPackage === PRODUCTION_PACKAGE ||
    iosBundle === PRODUCTION_PACKAGE
  );
}

export const buklodAdsTestMode =
  isStagingNativeIdentity() ||
  (
    !isProductionNativeIdentity() &&
    (
      __DEV__ ||
      appEnvironment !== 'production'
    )
  );

export const BUKLOD_GOOGLE_TEST_ANDROID_APP_ID =
  GOOGLE_SAMPLE_ANDROID_APP_ID;

function clean(
  value:
    string | undefined
) {
  return (
    value ?? ''
  ).trim();
}


const genericBanner =
  clean(
    process.env
      .EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID
  );

export function getBuklodAdTestDeviceIds(): string[] {
  return clean(process.env.EXPO_PUBLIC_ADMOB_TEST_DEVICE_IDS)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function diagnosticPlacementFor(
  placement: BuklodAdPlacement,
): BuklodAdDiagnosticPlacement {
  if (placement === 'community') return 'community_inline';
  if (placement === 'reels') return 'reels_inline';
  if (placement === 'test') return 'test';
  return 'home_bottom_banner';
}

export function getBuklodBannerUnitId(
  placement:
    BuklodAdPlacement
): string | null {

  if (buklodAdsTestMode) {
    return TestIds.ADAPTIVE_BANNER;
  }


  let placementId = '';

  switch (placement) {
    case 'home':
      placementId =
        clean(
          process.env
            .EXPO_PUBLIC_ADMOB_HOME_BANNER_UNIT_ID
        );
      break;

    case 'community':
    case 'reels':
      placementId =
        clean(
          process.env
            .EXPO_PUBLIC_ADMOB_COMMUNITY_BANNER_UNIT_ID
        );
      break;

    case 'prayer':
      placementId =
        clean(
          process.env
            .EXPO_PUBLIC_ADMOB_PRAYER_BANNER_UNIT_ID
        );
      break;

    case 'messages':
      placementId =
        clean(
          process.env
            .EXPO_PUBLIC_ADMOB_MESSAGES_BANNER_UNIT_ID
        );
      break;

    case 'bible':
    case 'devotion':
    case 'focus':
      placementId =
        clean(
          process.env
            .EXPO_PUBLIC_ADMOB_CONTENT_BANNER_UNIT_ID
        );
      break;

    case 'me':
      placementId =
        genericBanner;
      break;


    case 'test':
      return TestIds.ADAPTIVE_BANNER;
  }


  return (
    placementId ||
    genericBanner ||
    null
  );
}


export function getBuklodInterstitialUnitId():
  string | null {

  if (buklodAdsTestMode) {
    return TestIds.INTERSTITIAL;
  }


  return (
    clean(
      process.env
        .EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID
    ) ||
    null
  );
}
