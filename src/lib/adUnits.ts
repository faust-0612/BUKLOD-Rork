import {
  TestIds,
} from 'react-native-google-mobile-ads';

const APP_ENV =
  (
    process.env.EXPO_PUBLIC_APP_ENV
    ?? 'development'
  )
    .trim()
    .toLowerCase();

export const BUKLOD_AD_TEST_MODE =
  __DEV__ ||
  APP_ENV !== 'production';

function productionUnit(
  value: string | undefined
) {
  return (
    value
    ?? ''
  ).trim();
}

export const BUKLOD_AD_UNITS = {
  banner:
    BUKLOD_AD_TEST_MODE
      ? TestIds.ADAPTIVE_BANNER
      : productionUnit(
          process.env
            .EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID
        ),

  interstitial:
    BUKLOD_AD_TEST_MODE
      ? TestIds.INTERSTITIAL
      : productionUnit(
          process.env
            .EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID
        ),

  rewarded:
    BUKLOD_AD_TEST_MODE
      ? TestIds.REWARDED
      : productionUnit(
          process.env
            .EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID
        ),

  appOpen:
    BUKLOD_AD_TEST_MODE
      ? TestIds.APP_OPEN
      : productionUnit(
          process.env
            .EXPO_PUBLIC_ADMOB_APP_OPEN_UNIT_ID
        ),
} as const;

export function hasProductionAdUnits() {
  if (BUKLOD_AD_TEST_MODE) {
    return true;
  }

  return (
    BUKLOD_AD_UNITS.banner.length > 0 &&
    BUKLOD_AD_UNITS.interstitial.length > 0 &&
    BUKLOD_AD_UNITS.rewarded.length > 0 &&
    BUKLOD_AD_UNITS.appOpen.length > 0
  );
}