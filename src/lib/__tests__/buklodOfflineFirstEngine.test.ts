jest.mock('@react-native-async-storage/async-storage', () => {
  const storage = new Map<string, string>();
  return { __esModule: true, default: {
    getItem: jest.fn(async (key: string) => storage.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { storage.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { storage.delete(key); }),
  }};
});
jest.mock('../buklodSyncCoordinator', () => ({
  enqueueBuklodRead: jest.fn(({ run }: { run: (signal: AbortSignal) => Promise<unknown> }) => run(new AbortController().signal)),
}));

import { readBuklodOfflineFirst, invalidateBuklodOfflineScope } from '../buklodOfflineFirstEngine';

const base = { accountId: 'account1', permissionScope: 'public', dataset: 'test', view: 'test', authorized: true, online: true };

describe('BUKLOD offline-first engine', () => {
  afterEach(async () => { await invalidateBuklodOfflineScope(base.accountId, base.permissionScope, base.dataset); });

  it('keeps persisted snapshot available offline after initial sync', async () => {
    const fetchDelta = jest.fn(async () => ({ upserts: [{ id: 'row1', title: 'Saved' }], deletedIds: [], nextCursor: 'cursor1' }));
    const initial = await readBuklodOfflineFirst({ ...base, fetchDelta });
    expect(initial.rows).toEqual([{ id: 'row1', title: 'Saved' }]);
    const offline = await readBuklodOfflineFirst({ ...base, online: false, fetchDelta });
    expect(offline.rows).toEqual(initial.rows);
    expect(fetchDelta).toHaveBeenCalledTimes(1);
  });

  it('rejects first-load failures rather than showing an authoritative empty feed', async () => {
    const fetchDelta = jest.fn(async () => { throw new Error('network unavailable'); });
    await expect(readBuklodOfflineFirst({ ...base, fetchDelta })).rejects.toThrow('network unavailable');
  });

  it('does not permit unauthorized reads of a saved scope', async () => {
    const fetchDelta = jest.fn(async () => ({ upserts: [], deletedIds: [], nextCursor: '' }));
    await expect(readBuklodOfflineFirst({ ...base, authorized: false, fetchDelta })).rejects.toThrow('not authorized');
    expect(fetchDelta).not.toHaveBeenCalled();
  });
});
