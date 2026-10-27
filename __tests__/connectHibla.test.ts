import {
  DEFAULT_HIBLA_REACTION,
  HIBLA_QUICK_REACTIONS,
  hiblaCalendarDay,
  hiblaDayHeading,
  hiblaReactionPreferenceKey,
  isHiblaQuickReaction,
} from '@/lib/connectHibla';

describe('HIBLA Connect quick reaction preference', () => {
  it('supports heart and like and rejects arbitrary stored values', () => {
    expect(DEFAULT_HIBLA_REACTION).toBe('👍');
    expect(isHiblaQuickReaction('❤️')).toBe(true);
    expect(isHiblaQuickReaction('👍')).toBe(true);
    expect(isHiblaQuickReaction('<script>')).toBe(false);
    expect(new Set(HIBLA_QUICK_REACTIONS.map(option => option.emoji)).size)
      .toBe(HIBLA_QUICK_REACTIONS.length);
  });

  it('keeps reaction preferences account-scoped', () => {
    expect(hiblaReactionPreferenceKey('member-a'))
      .not.toBe(hiblaReactionPreferenceKey('member-b'));
  });
});

describe('HIBLA message day dividers', () => {
  it('only groups messages sharing a local calendar day', () => {
    expect(hiblaCalendarDay('2026-10-27T09:00:00.000Z'))
      .toBe(hiblaCalendarDay('2026-10-27T09:05:00.000Z'));
    expect(hiblaCalendarDay('not-a-date')).toBeNull();
  });

  it('labels today, yesterday and earlier messages', () => {
    const now = new Date(2026, 9, 27, 12, 0);
    expect(hiblaDayHeading(new Date(2026, 9, 27, 9).toISOString(), now))
      .toBe('NGAYON · OCT 27');
    expect(hiblaDayHeading(new Date(2026, 9, 26, 9).toISOString(), now))
      .toBe('KAHAPON · OCT 26');
    expect(hiblaDayHeading(new Date(2026, 8, 3, 9).toISOString(), now))
      .toBe('SEP 3 · 2026');
  });
});
