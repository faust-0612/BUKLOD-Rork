export type ScheduledWordSummary = {
  id: string;
  title: string;
  bible_passage: string | null;
  publish_date: string | null;
  sort_order?: number | null;
};

function compareScheduledWords(
  left: ScheduledWordSummary,
  right: ScheduledWordSummary,
): number {
  const dateOrder = String(right.publish_date).localeCompare(String(left.publish_date));
  if (dateOrder !== 0) return dateOrder;

  const leftOrder = left.sort_order ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.sort_order ?? Number.MAX_SAFE_INTEGER;
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;

  return left.id.localeCompare(right.id);
}

/**
 * Returns the latest published daily Word in the current Monday-start week.
 * It deliberately does not fall back to an older week when this week has no
 * publication, and never selects a future-dated cached entry.
 */
export function selectCurrentWeekWord(
  items: ScheduledWordSummary[],
  weekStartKey: string,
  todayKey: string,
): ScheduledWordSummary | null {
  return items
    .filter(item =>
      !!item.publish_date &&
      item.publish_date >= weekStartKey &&
      item.publish_date <= todayKey
    )
    .slice()
    .sort(compareScheduledWords)[0] ?? null;
}

/**
 * Builds a newest-first daily archive. Duplicate rows for the same calendar
 * publication date are collapsed so one scheduled day is shown only once.
 * The featured day's date is excluded even if duplicate database rows exist.
 */
export function selectPreviousWords(
  items: ScheduledWordSummary[],
  featuredWord: ScheduledWordSummary | null,
  todayKey: string,
  limit = 12,
): ScheduledWordSummary[] {
  const seenIds = new Set<string>();
  const seenDates = new Set<string>();
  const featuredDate = featuredWord?.publish_date ?? null;

  return items
    .filter(item =>
      !!item.publish_date &&
      item.publish_date <= todayKey &&
      item.publish_date !== featuredDate
    )
    .slice()
    .sort(compareScheduledWords)
    .filter(item => {
      const date = item.publish_date as string;
      if (seenIds.has(item.id) || seenDates.has(date)) return false;
      seenIds.add(item.id);
      seenDates.add(date);
      return true;
    })
    .slice(0, Math.max(0, limit));
}
