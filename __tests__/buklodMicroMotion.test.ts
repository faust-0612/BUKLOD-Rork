import {
  BUKLOD_MAX_ACTIVE_MICRO_MOTIONS,
  normalizeBuklodMicroMotion,
  shouldEmitBuklodMicroMotion,
  subscribeBuklodMicroMotion,
  emitBuklodMicroMotion,
} from '@/lib/buklodMicroMotion';

describe('BUKLOD app-wide micro-motion safety', () => {
  it('rejects missing coordinates and invalid kinds without animating the screen corner', () => {
    expect(normalizeBuklodMicroMotion({ kind: 'tap', pageX: 0, pageY: 0 })).toBeNull();
    expect(normalizeBuklodMicroMotion({ kind: 'reaction', pageX: NaN, pageY: 15 })).toBeNull();
    expect(normalizeBuklodMicroMotion({ kind: 'tap', pageX: -1, pageY: 15 })).toBeNull();
    expect(normalizeBuklodMicroMotion({ kind: 'invalid' as 'tap', pageX: 10, pageY: 10 })).toBeNull();
  });

  it('keeps the animation budget bounded and rate-limits accidental press floods', () => {
    expect(BUKLOD_MAX_ACTIVE_MICRO_MOTIONS).toBeLessThanOrEqual(3);
    expect(shouldEmitBuklodMicroMotion('tap', 300, 100)).toBe(false);
    expect(shouldEmitBuklodMicroMotion('tap', 381, 100)).toBe(true);
    expect(shouldEmitBuklodMicroMotion('reaction', 226, 100)).toBe(true);
  });

  it('subscribes without a backend dependency and removes listeners after use', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeBuklodMicroMotion(listener);
    const oldNow = Date.now;
    Date.now = () => 9876543210000;
    try {
      expect(emitBuklodMicroMotion({ kind: 'reward', pageX: 55, pageY: 99, emoji: '⭐' })).toBe(true);
      expect(listener).toHaveBeenCalledTimes(1);
      unsubscribe();
      expect(emitBuklodMicroMotion({ kind: 'reward', pageX: 55, pageY: 99 })).toBe(false);
    } finally {
      unsubscribe();
      Date.now = oldNow;
    }
  });
});
