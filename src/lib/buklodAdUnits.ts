import {
  TestIds,
} from 'react-native-google-mobile-ads';


export type BuklodAdPlacement =
  | 'home'
  | 'community'
  | 'prayer'
  | 'messages'
  | 'bible'
  | 'devotion'
    | 'me'
  | 'test';


const appEnvironment =
  (
    process.env.EXPO_PUBLIC_APP_ENV ??
    'development'
  )
    .trim()
    .toLowerCase();


export const buklodAdsTestMode =
  __DEV__ ||
  appEnvironment !== 'production';


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


export function getBuklodBannerUnitId(
  placement:
    BuklodAdPlacement
): string | null {

  if (buklodAdsTestMode) {
    return TestIds.BANNER;
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
      return TestIds.BANNER;
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