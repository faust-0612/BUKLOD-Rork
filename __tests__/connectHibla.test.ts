import {
  DEFAULT_HIBLA_REACTION,
  HIBLA_QUICK_REACTIONS,
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
