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

export const BUKLOD_DASHBOARD_BANNER_AD_HEIGHT = 50;

export const BUKLOD_DASHBOARD_BANNER_RESERVED_HEIGHT = 68;

export const buklodAdsLiveIdsEnabled =
  String(process.env.EXPO_PUBLIC_ADS_ALLOW_LIVE_IDS ?? '')
    .trim()
    .toLowerCase() === 'true';

export const buklodAdsTestMode = !buklodAdsLiveIdsEnabled;

export const BUKLOD_GOOGLE_TEST_ANDROID_APP_ID =
  'ca-app-pub-3940256099942544~3347511713';

export function getBuklodAdTestDeviceIds(): string[] {
  return [];
}

export function diagnosticPlacementFor(
  _placement: BuklodAdPlacement,
) {
  return 'home_bottom_banner' as const;
}

export function getBuklodBannerUnitId(
  _placement: BuklodAdPlacement
): string | null {
  return null;
}

export function getBuklodInterstitialUnitId():
  string | null {
  return null;
}
