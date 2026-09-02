import {
  buklodDominantSwipe,
  buklodMovementExceeded,
  stopBuklodNestedPress,
} from '@/lib/buklodTouch';

describe('BUKLOD touch helpers', () => {
  it('treats small finger movement as a tap, not a drag', () => {
    expect(
      buklodMovementExceeded({ x: 10, y: 10 }, 16, 12, 10),
    ).toBe(false);
  });

  it('cancels a press after a clear finger slide', () => {
    expect(
      buklodMovementExceeded({ x: 10, y: 10 }, 40, 10, 10),
    ).toBe(true);
  });

  it('requires dominant-axis intent for a swipe', () => {
    expect(buklodDominantSwipe(4, 4, 'y')).toBe(false);
    expect(buklodDominantSwipe(2, 24, 'y')).toBe(true);
    expect(buklodDominantSwipe(24, 20, 'y')).toBe(false);
    expect(buklodDominantSwipe(24, 4, 'x')).toBe(true);
  });

  it('stops nested press propagation when the event supports it', () => {
    const stopPropagation = jest.fn();
    stopBuklodNestedPress({ stopPropagation });
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(() => stopBuklodNestedPress(null)).not.toThrow();
  });
});
