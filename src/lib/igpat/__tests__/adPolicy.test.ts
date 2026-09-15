import {
  buildIgpatFeedItems,
  IGPAT_MAX_ADS_PER_FEED_WINDOW,
  IGPAT_MIN_ORGANIC_BEFORE_AD,
  IGPAT_ORGANIC_BETWEEN_ADS,
} from '../adPolicy';

function rows(count: number) {
  return Array.from({ length: count }, (_, index) => ({ id: `p${index + 1}` }));
}

describe('IGPAT ad policy', () => {
  it('never inserts an ad when sponsored pages are disabled', () => {
    const items = buildIgpatFeedItems(rows(20), false);
    expect(items).toHaveLength(20);
    expect(items.every(item => item.kind === 'organic')).toBe(true);
  });

  it('does not insert before the healthy-session threshold', () => {
    const items = buildIgpatFeedItems(rows(IGPAT_MIN_ORGANIC_BEFORE_AD), true);
    expect(items.some(item => item.kind === 'sponsored')).toBe(false);
  });

  it('inserts the first sponsored page only after enough organic videos and never at the end', () => {
    const items = buildIgpatFeedItems(rows(IGPAT_MIN_ORGANIC_BEFORE_AD + 1), true);
    const sponsoredIndex = items.findIndex(item => item.kind === 'sponsored');
    expect(sponsoredIndex).toBe(IGPAT_MIN_ORGANIC_BEFORE_AD);
    expect(items[sponsoredIndex - 1]?.kind).toBe('organic');
    expect(items[sponsoredIndex + 1]?.kind).toBe('organic');
  });

  it('keeps enough organic videos between sponsored pages and caps the feed window', () => {
    const items = buildIgpatFeedItems(
      rows(IGPAT_MIN_ORGANIC_BEFORE_AD + IGPAT_ORGANIC_BETWEEN_ADS + 3),
      true,
    );
    const sponsored = items
      .map((item, index) => ({ item, index }))
      .filter(entry => entry.item.kind === 'sponsored');

    expect(sponsored.length).toBeLessThanOrEqual(IGPAT_MAX_ADS_PER_FEED_WINDOW);
    expect(sponsored.length).toBe(2);
    expect(sponsored[1].index - sponsored[0].index).toBeGreaterThan(IGPAT_ORGANIC_BETWEEN_ADS);
    expect(items.some((item, index) => item.kind === 'sponsored' && items[index + 1]?.kind === 'sponsored')).toBe(false);
  });
});
