import {
  buildCommunityFeedWithInlineAds,
  buildReelsFeedWithInlineAds,
  COMMUNITY_AD_INTERVAL_MAX,
  COMMUNITY_AD_INTERVAL_MIN,
  COMMUNITY_AD_MIN_LEADING,
  isCommunityFeedInlineAdRow,
  isReelsFeedInlineAdRow,
  REELS_AD_MIN_LEADING,
} from '@/lib/buklodAdPlacements';

function posts(count: number, prefix = 'post') {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    body: `hello ${index + 1}`,
  }));
}

function organicRunsBeforeAds<T>(
  rows: T[],
  isAd: (row: T) => boolean,
) {
  const gaps: number[] = [];
  let organic = 0;
  for (const row of rows) {
    if (isAd(row)) {
      gaps.push(organic);
      organic = 0;
    } else {
      organic += 1;
    }
  }
  return gaps;
}

describe('community inline ad placement', () => {
  it('does not insert ads into short feeds', () => {
    const source = posts(COMMUNITY_AD_MIN_LEADING - 1);
    const rows = buildCommunityFeedWithInlineAds(source);
    expect(rows).toHaveLength(source.length);
    expect(rows.some(isCommunityFeedInlineAdRow)).toBe(false);
  });

  it('never places an ad before several organic posts', () => {
    const source = posts(40);
    const rows = buildCommunityFeedWithInlineAds(source);
    const firstAd = rows.findIndex(isCommunityFeedInlineAdRow);
    expect(firstAd).toBeGreaterThanOrEqual(COMMUNITY_AD_MIN_LEADING);
    expect(
      rows.slice(0, firstAd).some(isCommunityFeedInlineAdRow),
    ).toBe(false);
  });

  it('spaces ads about every 8–12 posts', () => {
    const source = posts(60);
    const rows = buildCommunityFeedWithInlineAds(source);
    const gaps = organicRunsBeforeAds(rows, isCommunityFeedInlineAdRow);
    expect(gaps.length).toBeGreaterThan(1);
    for (const gap of gaps) {
      expect(gap).toBeGreaterThanOrEqual(COMMUNITY_AD_INTERVAL_MIN);
      expect(gap).toBeLessThanOrEqual(COMMUNITY_AD_INTERVAL_MAX);
    }
  });

  it('keeps original post objects and ids, using synthetic ad ids', () => {
    const source = posts(24);
    const snapshot = source.map((row) => ({ ...row }));
    const rows = buildCommunityFeedWithInlineAds(source);

    expect(source).toEqual(snapshot);
    const organic = rows.filter((row) => !isCommunityFeedInlineAdRow(row));
    expect(organic).toEqual(source);

    const ads = rows.filter(isCommunityFeedInlineAdRow);
    const adIds = ads.map((row) => row.id);
    expect(new Set(adIds).size).toBe(adIds.length);
    expect(
      adIds.every((id) => id.startsWith('__buklod_inline_ad_')),
    ).toBe(true);
    expect(
      adIds.some((id) => source.some((post) => post.id === id)),
    ).toBe(false);
  });

  it('varies interval deterministically by nearby post id', () => {
    const a = buildCommunityFeedWithInlineAds(posts(40, 'alpha'));
    const b = buildCommunityFeedWithInlineAds(posts(40, 'beta'));
    const adsA = a
      .map((row, index) => (isCommunityFeedInlineAdRow(row) ? index : -1))
      .filter((index) => index >= 0);
    const adsB = b
      .map((row, index) => (isCommunityFeedInlineAdRow(row) ? index : -1))
      .filter((index) => index >= 0);
    expect(adsA).not.toEqual(adsB);
  });
});

describe('reels inline ad placement', () => {
  it('does not insert ads into short reel feeds', () => {
    const source = posts(REELS_AD_MIN_LEADING - 1, 'reel');
    const rows = buildReelsFeedWithInlineAds(source);
    expect(rows.some(isReelsFeedInlineAdRow)).toBe(false);
  });

  it('never starts Reels on an ad page', () => {
    const rows = buildReelsFeedWithInlineAds(posts(36, 'reel'));
    expect(isReelsFeedInlineAdRow(rows[0])).toBe(false);
    const firstAd = rows.findIndex(isReelsFeedInlineAdRow);
    expect(firstAd).toBeGreaterThanOrEqual(REELS_AD_MIN_LEADING);
  });

  it('uses synthetic reel ad ids without mutating source rows', () => {
    const source = posts(30, 'reel');
    const rows = buildReelsFeedWithInlineAds(source);
    expect(rows.filter((row) => !isReelsFeedInlineAdRow(row))).toEqual(source);
    expect(
      rows
        .filter(isReelsFeedInlineAdRow)
        .every((row) => row.id.startsWith('__buklod_reels_ad_')),
    ).toBe(true);
  });
});
