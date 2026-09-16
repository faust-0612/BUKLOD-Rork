/**
 * Android/APK-only BUKLOD monetization policy.
 *
 * Intentionally more aggressive than web/iOS while keeping full-screen ads
 * limited to explicit natural completion transitions.
 */
export const COMMUNITY_AD_INTERVAL = 6;
export const COMMUNITY_AD_INTERVAL_MIN = 5;
export const COMMUNITY_AD_INTERVAL_MAX = 7;
export const COMMUNITY_AD_MIN_LEADING = 5;

export const REELS_AD_INTERVAL = 5;
export const REELS_AD_INTERVAL_MIN = 4;
export const REELS_AD_INTERVAL_MAX = 6;
export const REELS_AD_MIN_LEADING = 4;

export const INTERSTITIAL_MIN_EVENT_COUNT = 2;
export const INTERSTITIAL_COOLDOWN_MS = 6 * 60 * 1000;
