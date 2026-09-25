import type { BuklodAdDiagnosticPlacement } from '@/lib/buklodAdDiagnostics';

export type BsocAdProvider =
  | 'ADMOB_NATIVE'
  | 'ADSENSE_WEB'
  | 'BUKLOD_SPONSOR';

export type BsocAdPlacementStatus =
  | 'ACTIVE'
  | 'TEST'
  | 'DISABLED'
  | 'LEGACY'
  | 'DEPRECATED';

export type BsocAdPlatform =
  | 'ANDROID'
  | 'WEB';

export type BsocAdPlacementRegistryItem = {
  placementId: string;
  displayName: string;
  appId: string;
  platform: BsocAdPlatform;
  format: string;
  route: string;
  status: BsocAdPlacementStatus;
  provider: BsocAdProvider;
  environment: 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT';
  introducedVersion: string;
  ownerTeam: string;
  diagnosticPlacement?: BuklodAdDiagnosticPlacement;
  note?: string;
};

/**
 * BSOC_AD_PLACEMENT_REGISTRY_R1
 *
 * Central operational naming for the placements already represented by the
 * current BUKLOD ad layer. This registry deliberately does not contain money,
 * eCPM, payout, pool, or user-earnings fields.
 *
 * Home remains ACTIVE here because the current source still renders a home
 * placement in multiple route families. It should become LEGACY only after a
 * verified release removes current-version traffic from those routes.
 */
export const BSOC_AD_PLACEMENTS: readonly BsocAdPlacementRegistryItem[] = [
  {
    placementId: 'BUKLOD_MAIN_HOME_BANNER_NATIVE',
    displayName: 'Main Home / Dashboard Banner',
    appId: 'BUKLOD_MAIN',
    platform: 'ANDROID',
    format: 'BANNER',
    route: 'Home and scoped dashboard surfaces',
    status: 'ACTIVE',
    provider: 'ADMOB_NATIVE',
    environment: 'PRODUCTION',
    introducedVersion: 'existing',
    ownerTeam: 'Platform Operations',
    diagnosticPlacement: 'home_bottom_banner',
  },
  {
    placementId: 'BUKLOD_MAIN_COMMUNITY_INLINE_NATIVE',
    displayName: 'Community Wall Inline',
    appId: 'BUKLOD_MAIN',
    platform: 'ANDROID',
    format: 'INLINE / NATIVE',
    route: 'Community Wall',
    status: 'ACTIVE',
    provider: 'ADMOB_NATIVE',
    environment: 'PRODUCTION',
    introducedVersion: 'existing',
    ownerTeam: 'Platform Operations',
    diagnosticPlacement: 'community_inline',
  },
  {
    placementId: 'BUKLOD_MAIN_REELS_INLINE_NATIVE',
    displayName: 'BUKLOD IGPAT Inline',
    appId: 'BUKLOD_MAIN',
    platform: 'ANDROID',
    format: 'INLINE / NATIVE',
    route: 'BUKLOD IGPAT',
    status: 'ACTIVE',
    provider: 'ADMOB_NATIVE',
    environment: 'PRODUCTION',
    introducedVersion: 'existing',
    ownerTeam: 'Platform Operations',
    diagnosticPlacement: 'reels_inline',
  },
  {
    placementId: 'BUKLOD_MAIN_HOME_BANNER_WEB',
    displayName: 'Main Home / Dashboard Web Slot',
    appId: 'BUKLOD_MAIN',
    platform: 'WEB',
    format: 'RESPONSIVE',
    route: 'Home and scoped dashboard surfaces',
    status: 'ACTIVE',
    provider: 'ADSENSE_WEB',
    environment: 'PRODUCTION',
    introducedVersion: 'existing',
    ownerTeam: 'Platform Operations',
    note: 'Falls back to approved BUKLOD sponsor inventory when AdSense is not configured.',
  },
  {
    placementId: 'BUKLOD_MAIN_COMMUNITY_INLINE_WEB',
    displayName: 'Community Wall Web Slot',
    appId: 'BUKLOD_MAIN',
    platform: 'WEB',
    format: 'RESPONSIVE',
    route: 'Community Wall',
    status: 'ACTIVE',
    provider: 'ADSENSE_WEB',
    environment: 'PRODUCTION',
    introducedVersion: 'existing',
    ownerTeam: 'Platform Operations',
    note: 'Falls back to approved BUKLOD sponsor inventory when AdSense is not configured.',
  },
  {
    placementId: 'BUKLOD_MAIN_REELS_INLINE_WEB',
    displayName: 'BUKLOD IGPAT Web Slot',
    appId: 'BUKLOD_MAIN',
    platform: 'WEB',
    format: 'RESPONSIVE',
    route: 'BUKLOD IGPAT',
    status: 'ACTIVE',
    provider: 'ADSENSE_WEB',
    environment: 'PRODUCTION',
    introducedVersion: 'existing',
    ownerTeam: 'Platform Operations',
    note: 'Falls back to approved BUKLOD sponsor inventory when AdSense is not configured.',
  },
  {
    placementId: 'BUKLOD_AD_TEST',
    displayName: 'Ad Diagnostics Test Placement',
    appId: 'BUKLOD_MAIN',
    platform: 'ANDROID',
    format: 'TEST',
    route: 'Authorized diagnostics only',
    status: 'TEST',
    provider: 'ADMOB_NATIVE',
    environment: 'STAGING',
    introducedVersion: 'existing',
    ownerTeam: 'Platform Operations',
    diagnosticPlacement: 'test',
  },
] as const;

export function bsocActiveProductionPlacements() {
  return BSOC_AD_PLACEMENTS.filter(
    (item) =>
      item.environment === 'PRODUCTION' &&
      item.status === 'ACTIVE',
  );
}

export function bsocLegacyProductionPlacements() {
  return BSOC_AD_PLACEMENTS.filter(
    (item) =>
      item.environment === 'PRODUCTION' &&
      item.status === 'LEGACY',
  );
}
