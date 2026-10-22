import { BuklodRequestTimeoutError, withBuklodTimeout } from '../buklodAsyncTimeout';

describe('global loading timeout regression', () => {
  afterEach(() => jest.useRealTimers());

  it('returns successful reads without waiting for the timeout', async () => {
    await expect(withBuklodTimeout(Promise.resolve('ready'), 100, 'feed')).resolves.toBe('ready');
  });

  it('terminates an indefinitely pending read with an identifiable error', async () => {
    jest.useFakeTimers();
    const never = new Promise<string>(() => {});
    const request = withBuklodTimeout(never, 100, 'community');
    const assertion = expect(request).rejects.toBeInstanceOf(BuklodRequestTimeoutError);
    await jest.advanceTimersByTimeAsync(100);
    await assertion;
  });

  it('preserves underlying request failures', async () => {
    await expect(withBuklodTimeout(Promise.reject(new Error('network down')), 100, 'auth'))
      .rejects.toThrow('network down');
  });
});
