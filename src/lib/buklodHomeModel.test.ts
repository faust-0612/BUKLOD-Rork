import {
  getBuklodHomeDaypart,
  getBuklodHomeGreeting,
  getBuklodHomeTodayItems,
} from '@/lib/buklodHomeModel';

describe('buklodHomeModel', () => {
  it('maps local hours into stable dayparts', () => {
    expect(getBuklodHomeDaypart(new Date('2026-09-16T06:00:00'))).toBe('morning');
    expect(getBuklodHomeDaypart(new Date('2026-09-16T12:00:00'))).toBe('day');
    expect(getBuklodHomeDaypart(new Date('2026-09-16T18:00:00'))).toBe('evening');
    expect(getBuklodHomeDaypart(new Date('2026-09-16T22:00:00'))).toBe('night');
  });

  it('returns simple greetings for each daypart', () => {
    expect(getBuklodHomeGreeting('morning')).toBe('Good morning');
    expect(getBuklodHomeGreeting('day')).toBe('Good day');
    expect(getBuklodHomeGreeting('evening')).toBe('Good evening');
    expect(getBuklodHomeGreeting('night')).toBe('Good night');
  });

  it('keeps Home priorities contextual without requiring faith features', () => {
    const items = getBuklodHomeTodayItems({
      daypart: 'morning',
      mode: 'home',
      showFaithContent: false,
    });

    expect(items).toHaveLength(3);
    expect(items[0].id).toBe('faith-or-focus');
    expect(items[0].title).toBe('Choose one important thing');
    expect(items[1].title).toBe('Check home priorities');
  });

  it('uses faith encouragement when the active scope allows it', () => {
    const items = getBuklodHomeTodayItems({
      daypart: 'morning',
      mode: 'school',
      showFaithContent: true,
    });

    expect(items[0].title).toBe('Start with encouragement');
    expect(items[1].title).toBe('Check school priorities');
  });
});
