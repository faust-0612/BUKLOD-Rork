/** Kabihasnang Ligaw monetization release policy.
 * This is a fail-closed configuration: no ad request, premium billing, or entitlement
 * is enabled without separately verified production integrations and user consent.
 */
export const KL_MONETIZATION = Object.freeze({
  version: 'kl-monetization-v1-preflight',
  freeMainStory: true,
  allowReaderInterruptingAds: false,
  placements: Object.freeze({
    libraryBanner: 'pending_verified_admob_placement',
    postChapterInterstitial: 'pending_verified_admob_placement',
    optInRewarded: 'pending_verified_admob_placement',
  }),
  adServingEnabled: false,
  requireAdConsent: true,
  requireChildAndAgePolicyCompliance: true,
  premiumBillingEnabled: false,
  premiumMayUnlockCoreChapters: false,
  premiumOptions: Object.freeze(['ad_free_reading', 'approved_bonus_art', 'licensed_ambient_audio']),
  pointsHaveCashValue: false,
  pointsToBayanihanConversionEnabled: false,
  revenueEstimateIsGuarantee: false,
} as const);

export function mayRequestKlAd(input: {
  placement: keyof typeof KL_MONETIZATION.placements;
  consentGranted: boolean;
  approvedPlacement: boolean;
  isReadingChapter: boolean;
  childSafe: boolean;
}): boolean {
  return KL_MONETIZATION.adServingEnabled
    && input.consentGranted
    && input.approvedPlacement
    && input.childSafe
    && !input.isReadingChapter;
}
