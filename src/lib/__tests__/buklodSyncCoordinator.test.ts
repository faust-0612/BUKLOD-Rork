jest.mock('../buklodNetworkQuality', () => ({
  classifyNetworkQuality: jest.fn(() => 'normal'),
  subscribeNetworkQuality: jest.fn(() => () => {}),
}));

import { configureBuklodSyncNetwork, enqueueBuklodRead, getBuklodSyncQueueState, setBuklodSyncView } from '../buklodSyncCoordinator';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
};

describe('BUKLOD sync coordinator', () => {
  beforeEach(() => {
    configureBuklodSyncNetwork({ online: true, degraded: false });
    setBuklodSyncView('test');
  });

  it('deduplicates identical account-scoped reads', async () => {
    const wait = deferred<number>();
    const run = jest.fn(() => wait.promise);
    const args = { key: 'account:scope:dedup', view: 'test', priority: 'visible' as const, run };
    const first = enqueueBuklodRead(args);
    const second = enqueueBuklodRead(args);
    expect(first).toBe(second);
    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(1);
    wait.resolve(7);
    await expect(first).resolves.toBe(7);
  });

  it('keeps degraded concurrency to one active read', async () => {
    configureBuklodSyncNetwork({ online: true, degraded: true });
    const firstWait = deferred<number>();
    const secondWait = deferred<number>();
    const first = enqueueBuklodRead({ key: 'account:scope:first', view: 'test', priority: 'visible', run: () => firstWait.promise });
    const secondRun = jest.fn(() => secondWait.promise);
    const second = enqueueBuklodRead({ key: 'account:scope:second', view: 'test', priority: 'visible', run: secondRun });
    await Promise.resolve();
    expect(getBuklodSyncQueueState().active).toBe(1);
    expect(secondRun).not.toHaveBeenCalled();
    firstWait.resolve(1);
    await first;
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(secondRun).toHaveBeenCalledTimes(1);
    secondWait.resolve(2);
    await expect(second).resolves.toBe(2);
  });

  it('does not issue new reads when offline', async () => {
    configureBuklodSyncNetwork({ online: false, degraded: true });
    const run = jest.fn(async () => 1);
    await expect(enqueueBuklodRead({ key: 'account:scope:offline', view: 'test', priority: 'visible', run })).rejects.toThrow('offline');
    expect(run).not.toHaveBeenCalled();
  });
});
