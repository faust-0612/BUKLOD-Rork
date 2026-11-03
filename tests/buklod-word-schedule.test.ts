import {
  selectCurrentWeekWord,
  selectPreviousWords,
  type ScheduledWordSummary,
} from '../src/lib/buklodWordSchedule';

const word = (
  id: string,
  publish_date: string,
  sort_order: number | null = 1,
): ScheduledWordSummary => ({
  id,
  title: id,
  bible_passage: null,
  publish_date,
  sort_order,
});

describe('BUKLOD daily Word schedule', () => {
  const monday = '2026-11-02';
  const today = '2026-11-03';

  it('selects the latest published daily Word in the current week', () => {
    const selected = selectCurrentWeekWord([
      word('monday', '2026-11-02'),
      word('tuesday', '2026-11-03'),
      word('older-week', '2026-10-31'),
    ], monday, today);

    expect(selected?.id).toBe('tuesday');
  });

  it('does not fall back to a previous week when the current week has no Word', () => {
    const selected = selectCurrentWeekWord([
      word('last-week', '2026-10-31'),
    ], monday, today);

    expect(selected).toBeNull();
  });

  it('does not expose future-dated cached publications', () => {
    const selected = selectCurrentWeekWord([
      word('tomorrow', '2026-11-04'),
      word('today', today),
    ], monday, today);

    expect(selected?.id).toBe('today');
  });

  it('uses the lowest lesson order when multiple rows share one date', () => {
    const selected = selectCurrentWeekWord([
      word('later-order', today, 2),
      word('first-order', today, 1),
    ], monday, today);

    expect(selected?.id).toBe('first-order');
  });

  it('keeps earlier daily Words in newest-first order without duplicate dates', () => {
    const archive = selectPreviousWords([
      word('today-featured-duplicate', today),
      word('yesterday', '2026-11-02'),
      word('yesterday-duplicate', '2026-11-02', 2),
      word('sunday', '2026-11-01'),
      word('future', '2026-11-04'),
    ], word('featured', today), today);

    expect(archive.map(item => item.id)).toEqual([
      'yesterday',
      'sunday',
    ]);
  });

  it('deduplicates repeated ids and respects the archive limit', () => {
    const archive = selectPreviousWords([
      word('one', '2026-11-02'),
      word('one', '2026-11-02'),
      word('two', '2026-11-01'),
    ], null, today, 1);

    expect(archive.map(item => item.id)).toEqual(['one']);
  });
});
