import { eligibleKlCommentPoints, expectedKlChapterPoints, KL_ECONOMY_V2 } from './economyPolicy';
import { KL_MONETIZATION, mayRequestKlAd } from './monetizationPolicy';

describe('Kabihasnang Ligaw economy and monetization gates', () => {
  it('awards seven points only for a first valid numbered chapter', () => {
    expect(expectedKlChapterPoints(true, 1)).toBe(7);
    expect(expectedKlChapterPoints(true, 30)).toBe(7);
    expect(expectedKlChapterPoints(false, 1)).toBe(0);
    expect(expectedKlChapterPoints(true, 0)).toBe(0);
    expect(expectedKlChapterPoints(true, -1)).toBe(0);
  });
  it('allows two comment points only after server qualification and anti-abuse checks', () => {
    const valid = { serverQualified: true, isDuplicate: false, isSelfInteraction: false, alreadyRewarded: false };
    expect(eligibleKlCommentPoints(valid)).toBe(2);
    expect(eligibleKlCommentPoints({ ...valid, serverQualified: false })).toBe(0);
    expect(eligibleKlCommentPoints({ ...valid, isDuplicate: true })).toBe(0);
    expect(eligibleKlCommentPoints({ ...valid, isSelfInteraction: true })).toBe(0);
    expect(eligibleKlCommentPoints({ ...valid, alreadyRewarded: true })).toBe(0);
  });
  it('does not convert points into cash or Bayanihan', () => {
    expect(KL_ECONOMY_V2.noFixedPesoConversion).toBe(true);
    expect(KL_ECONOMY_V2.noPointsToBayanihanConversion).toBe(true);
    expect(KL_ECONOMY_V2.reactionPoints).toBe(0);
  });
  it('fails closed on ads and premium until production verification', () => {
    expect(KL_MONETIZATION.adServingEnabled).toBe(false);
    expect(KL_MONETIZATION.premiumBillingEnabled).toBe(false);
    expect(mayRequestKlAd({ placement: 'libraryBanner', consentGranted: true, approvedPlacement: true, isReadingChapter: false, childSafe: true })).toBe(false);
  });
});
