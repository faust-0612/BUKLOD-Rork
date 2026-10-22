import { KL_SEASON_ONE_ID } from './catalog';

/** Only Series 1 is approved. Later series stay hidden until an owner approval record exists. */
export const APPROVED_SERIES_IDS = [KL_SEASON_ONE_ID] as const;

export function selectReaderSeries(input: {
  currentSeriesId: string | null;
  completedSeriesIds: readonly string[];
}): string {
  const approved = APPROVED_SERIES_IDS.filter((id) => !input.completedSeriesIds.includes(id));
  if (input.currentSeriesId && approved.includes(input.currentSeriesId as (typeof APPROVED_SERIES_IDS)[number])) {
    return input.currentSeriesId;
  }
  return approved[0] ?? APPROVED_SERIES_IDS[APPROVED_SERIES_IDS.length - 1];
}
