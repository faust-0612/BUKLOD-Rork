/**
 * Default BUKLOD ad monetization policy.
 *
 * Android can override this module through
 * `buklodAdMonetizationPolicy.android.ts` without changing web/PWA behavior.
 */
export const COMMUNITY_AD_INTERVAL = 10;
export const COMMUNITY_AD_INTERVAL_MIN = 8;
export const COMMUNITY_AD_INTERVAL_MAX = 12;
export const COMMUNITY_AD_MIN_LEADING = 8;

export const REELS_AD_INTERVAL = 10;
export const REELS_AD_INTERVAL_MIN = 8;
export const REELS_AD_INTERVAL_MAX = 12;
export const REELS_AD_MIN_LEADING = 8;

export const INTERSTITIAL_MIN_EVENT_COUNT = 3;
export const INTERSTITIAL_COOLDOWN_MS = 12 * 60 * 1000;
