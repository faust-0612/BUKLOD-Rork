import {
  COMMUNITY_AD_INTERVAL,
  COMMUNITY_AD_INTERVAL_MAX,
  COMMUNITY_AD_INTERVAL_MIN,
  COMMUNITY_AD_MIN_LEADING,
  REELS_AD_INTERVAL,
  REELS_AD_INTERVAL_MAX,
  REELS_AD_INTERVAL_MIN,
  REELS_AD_MIN_LEADING,
} from '@/lib/buklodAdMonetizationPolicy';

export {
  COMMUNITY_AD_INTERVAL,
  COMMUNITY_AD_INTERVAL_MAX,
  COMMUNITY_AD_INTERVAL_MIN,
  COMMUNITY_AD_MIN_LEADING,
  REELS_AD_INTERVAL,
  REELS_AD_INTERVAL_MAX,
  REELS_AD_INTERVAL_MIN,
  REELS_AD_MIN_LEADING,
};

/**
 * Shared AdMob feed helpers.
 * Placement cadence is platform-configured so Android can monetize more
 * aggressively without changing web/PWA behavior.
 */

export type CommunityFeedInlineAdRow = {
  id: string;
  __buklodInlineAd: true;
};

export type ReelsFeedInlineAdRow = {
  id: string;
  __buklodReelsInlineAd: true;
};

export function isCommunityFeedInlineAdRow(
  item: unknown,
): item is CommunityFeedInlineAdRow {
  return Boolean(
    item &&
      typeof item === 'object' &&
      (item as CommunityFeedInlineAdRow).__buklodInlineAd === true,
  );
}

export function isReelsFeedInlineAdRow(
  item: unknown,
): item is ReelsFeedInlineAdRow {
  return Boolean(
    item &&
      typeof item === 'object' &&
      (item as ReelsFeedInlineAdRow).__buklodReelsInlineAd === true,
  );
}

function hashSeed(value: string) {
  let hash = 0;
  const text = String(value ?? '');
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export function adIntervalForSlot(
  slot: number,
  seed: string,
  min = COMMUNITY_AD_INTERVAL_MIN,
  max = COMMUNITY_AD_INTERVAL_MAX,
) {
  const span = Math.max(1, max - min + 1);
  return min + (hashSeed(`${seed}:${slot}`) % span);
}

function buildFeedWithInlineAds<T extends { id?: string | null }>(
  items: T[],
  options: {
    minLeading: number;
    intervalMin: number;
    intervalMax: number;
    idPrefix: string;
    mark: (id: string) => T | CommunityFeedInlineAdRow | ReelsFeedInlineAdRow;
  },
): Array<T | CommunityFeedInlineAdRow | ReelsFeedInlineAdRow> {
  const minLeading = options.minLeading;
  if (items.length < minLeading) {
    return items;
  }

  const rows: Array<T | CommunityFeedInlineAdRow | ReelsFeedInlineAdRow> = [];
  let adSlot = 0;
  let sinceAd = 0;
  let nextAt = adIntervalForSlot(
    0,
    String(items[0]?.id ?? 'feed'),
    minLeading,
    options.intervalMax,
  );

  items.forEach((item, index) => {
    rows.push(item);
    sinceAd += 1;
    const itemNumber = index + 1;

    // First slot has its own leading threshold. Android can use five posts
    // before the first ad without weakening the later six-plus post spacing.
    const minSpacing = adSlot === 0 ? minLeading : options.intervalMin;
    if (itemNumber >= nextAt && sinceAd >= minSpacing) {
      adSlot += 1;
      const slotId = `${options.idPrefix}${adSlot}_${String(item.id ?? itemNumber)}`;
      rows.push(options.mark(slotId) as CommunityFeedInlineAdRow);
      sinceAd = 0;
      nextAt =
        itemNumber +
        adIntervalForSlot(
          adSlot,
          String(item.id ?? itemNumber),
          options.intervalMin,
          options.intervalMax,
        );
    }
  });

  return rows;
}

/**
 * Inserts inline ad markers using the active platform cadence.
 * Android uses the heavier APK policy while other targets retain the
 * existing conservative spacing.
 */
export function buildCommunityFeedWithInlineAds<
  T extends { id?: string | null },
>(
  posts: T[],
  options?: {
    interval?: number;
    minLeading?: number;
  },
): Array<T | CommunityFeedInlineAdRow> {
  const minLeading = options?.minLeading ?? COMMUNITY_AD_MIN_LEADING;
  const interval = options?.interval;
  const intervalMin = interval ?? COMMUNITY_AD_INTERVAL_MIN;
  const intervalMax = interval ?? COMMUNITY_AD_INTERVAL_MAX;

  return buildFeedWithInlineAds(posts, {
    minLeading,
    intervalMin,
    intervalMax,
    idPrefix: '__buklod_inline_ad_',
    mark: (id) => ({
      id,
      __buklodInlineAd: true,
    }),
  }) as Array<T | CommunityFeedInlineAdRow>;
}

export function buildReelsFeedWithInlineAds<
  T extends { id?: string | null },
>(
  reels: T[],
  options?: {
    minLeading?: number;
  },
): Array<T | ReelsFeedInlineAdRow> {
  return buildFeedWithInlineAds(reels, {
    minLeading: options?.minLeading ?? REELS_AD_MIN_LEADING,
    intervalMin: REELS_AD_INTERVAL_MIN,
    intervalMax: REELS_AD_INTERVAL_MAX,
    idPrefix: '__buklod_reels_ad_',
    mark: (id) => ({
      id,
      __buklodReelsInlineAd: true,
    }),
  }) as Array<T | ReelsFeedInlineAdRow>;
}
