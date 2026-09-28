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
  | 'content'
  | 'community_entry'
  | 'profile'
  | 'org'
  | 'cluster'
  | 'submission'
  | 'video_companion'
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
  placement: BuklodAdPlacement,
) {
  if (placement === 'home') return 'legacy_home_banner' as const;
  if (placement === 'community_entry') return 'community_wall_entry' as const;
  if (placement === 'community') return 'community_wall_feed' as const;
  if (placement === 'reels') return 'reels_inline' as const;
  if (
    placement === 'content' ||
    placement === 'focus' ||
    placement === 'bible' ||
    placement === 'devotion'
  ) return 'content_inline' as const;
  if (placement === 'prayer') return 'prayer_banner' as const;
  if (placement === 'messages') return 'messages_banner' as const;
  if (placement === 'me' || placement === 'profile') return 'profile_banner' as const;
  if (placement === 'org') return 'org_home_entry' as const;
  if (placement === 'cluster') return 'cluster_home_entry' as const;
  if (placement === 'submission') return 'content_submission' as const;
  if (placement === 'video_companion') return 'video_companion' as const;
  return 'test' as const;
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
