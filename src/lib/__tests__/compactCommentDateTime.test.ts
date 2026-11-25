import { formatCompactCommentDateTime } from '../dateTime';

describe('compact comment timestamps in Manila time', () => {
  const now = new Date('2026-11-22T10:21:00Z');

  it('shows only the clock for today', () => {
    expect(formatCompactCommentDateTime('2026-11-22T03:11:00Z', now)).toBe('11:11 AM');
  });
  it('shows the date for a different day in the current year', () => {
    expect(formatCompactCommentDateTime('2026-11-21T03:11:00Z', now)).toBe('Nov 21 · 11:11 AM');
  });
  it('retains the year for older comments', () => {
    expect(formatCompactCommentDateTime('2025-11-22T03:11:00Z', now)).toBe('Nov 22, 2025 · 11:11 AM');
  });
  it('compares local calendar dates, not UTC dates', () => {
    expect(formatCompactCommentDateTime('2026-11-21T16:30:00Z', now)).toBe('12:30 AM');
  });
  it('handles missing or invalid dates', () => {
    expect(formatCompactCommentDateTime(null, now)).toBe('');
    expect(formatCompactCommentDateTime('invalid', now)).toBe('');
  });
});
