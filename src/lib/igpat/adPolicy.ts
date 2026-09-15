export type IgpatOrganicFeedItem<T> = {
  kind: 'organic';
  id: string;
  row: T;
  organicIndex: number;
};

export type IgpatSponsoredFeedItem = {
  kind: 'sponsored';
  id: string;
  afterOrganicCount: number;
};

export type IgpatFeedItem<T> =
  | IgpatOrganicFeedItem<T>
  | IgpatSponsoredFeedItem;

// Revenue per healthy session, not maximum ad count.
// The current IGPAT fetch window is intentionally small, so one sponsored page
// after seven organic videos is the conservative default. The helper is ready
// for larger future windows without ever creating back-to-back ads.
export const IGPAT_MIN_ORGANIC_BEFORE_AD = 7;
export const IGPAT_ORGANIC_BETWEEN_ADS = 9;
export const IGPAT_MAX_ADS_PER_FEED_WINDOW = 2;

export function buildIgpatFeedItems<T extends { id: string }>(
  rows: T[],
  allowSponsored: boolean,
): IgpatFeedItem<T>[] {
  const items: IgpatFeedItem<T>[] = [];
  let adsInserted = 0;
  let organicSinceAd = 0;

  rows.forEach((row, index) => {
    items.push({
      kind: 'organic',
      id: `igpat:${row.id}`,
      row,
      organicIndex: index,
    });

    organicSinceAd += 1;

    const hasMoreOrganic = index < rows.length - 1;
    const threshold = adsInserted === 0
      ? IGPAT_MIN_ORGANIC_BEFORE_AD
      : IGPAT_ORGANIC_BETWEEN_ADS;

    if (
      allowSponsored &&
      hasMoreOrganic &&
      adsInserted < IGPAT_MAX_ADS_PER_FEED_WINDOW &&
      organicSinceAd >= threshold
    ) {
      const afterOrganicCount = index + 1;
      items.push({
        kind: 'sponsored',
        id: `igpat-sponsored:${afterOrganicCount}:${adsInserted + 1}`,
        afterOrganicCount,
      });
      adsInserted += 1;
      organicSinceAd = 0;
    }
  });

  return items;
}
