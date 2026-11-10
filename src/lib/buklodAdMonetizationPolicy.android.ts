/**
 * Android feed ads have a native-media creative that reads like a sponsored
 * post; use stronger but bounded content spacing without serving ads on
 * every scroll or changing iOS/web. Explicit production env setting wins.
 * The existing row viewability/consent gates and cooldown remain authoritative.
 */
import {
  AD_OPERATIONAL_FLUSH_MS,
  AD_OPERATIONAL_MAX_BATCH_KEYS,
  AD_SLOT_REMOUNT_COOLDOWN_MS,
  BANNER_RETRY_DELAYS_MS,
  COMMUNITY_AD_INTERVAL as BASE_INTERVAL,
  COMMUNITY_AD_INTERVAL_MAX as BASE_MAX,
  COMMUNITY_AD_INTERVAL_MIN as BASE_MIN,
  COMMUNITY_AD_MIN_LEADING as BASE_LEADING,
  INTERSTITIAL_COOLDOWN_MS,
  INTERSTITIAL_MIN_EVENT_COUNT,
  INTERSTITIAL_SESSION_CAP,
  REELS_AD_INTERVAL as BASE_REELS_INTERVAL,
  REELS_AD_INTERVAL_MAX as BASE_REELS_MAX,
  REELS_AD_INTERVAL_MIN as BASE_REELS_MIN,
  REELS_AD_MIN_LEADING as BASE_REELS_LEADING,
} from '@/lib/buklodAdMonetizationPolicy.shared';

export {
  AD_OPERATIONAL_FLUSH_MS,
  AD_OPERATIONAL_MAX_BATCH_KEYS,
  AD_SLOT_REMOUNT_COOLDOWN_MS,
  BANNER_RETRY_DELAYS_MS,
  INTERSTITIAL_COOLDOWN_MS,
  INTERSTITIAL_MIN_EVENT_COUNT,
  INTERSTITIAL_SESSION_CAP,
};

export const COMMUNITY_AD_MIN_LEADING =
  process.env.EXPO_PUBLIC_ADS_WALL_MIN_CONTENT_BEFORE_FIRST_AD
    ? BASE_LEADING
    : 4;
export const COMMUNITY_AD_INTERVAL =
  process.env.EXPO_PUBLIC_ADS_WALL_CONTENT_INTERVAL
    ? BASE_INTERVAL
    : 5;
export const COMMUNITY_AD_INTERVAL_MIN =
  process.env.EXPO_PUBLIC_ADS_WALL_INTERVAL_MIN
    ? BASE_MIN
    : 4;
export const COMMUNITY_AD_INTERVAL_MAX = Math.max(
  COMMUNITY_AD_INTERVAL_MIN,
  process.env.EXPO_PUBLIC_ADS_WALL_INTERVAL_MAX
    ? BASE_MAX
    : 6,
);

// Existing sponsored Reels pages: five organic videos first, then 5-7.
export const REELS_AD_MIN_LEADING =
  process.env.EXPO_PUBLIC_ADS_REELS_MIN_CONTENT_BEFORE_FIRST_AD
    ? BASE_REELS_LEADING
    : 5;
export const REELS_AD_INTERVAL =
  process.env.EXPO_PUBLIC_ADS_REELS_CONTENT_INTERVAL
    ? BASE_REELS_INTERVAL
    : 6;
export const REELS_AD_INTERVAL_MIN =
  process.env.EXPO_PUBLIC_ADS_REELS_INTERVAL_MIN
    ? BASE_REELS_MIN
    : 5;
export const REELS_AD_INTERVAL_MAX = Math.max(
  REELS_AD_INTERVAL_MIN,
  process.env.EXPO_PUBLIC_ADS_REELS_INTERVAL_MAX
    ? BASE_REELS_MAX
    : 7,
);
