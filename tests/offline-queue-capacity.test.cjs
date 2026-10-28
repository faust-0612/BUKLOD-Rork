const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripTypeScriptTypes } = require('node:module');

const root = process.env.BUKLOD_TEST_ROOT || path.resolve(__dirname, '..');

function queueApi(storage) {
  const source = fs.readFileSync(path.join(root, 'src/lib/offlineSyncQueue.ts'), 'utf8');
  const code = stripTypeScriptTypes(source)
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*$/gm, '')
    .replace(/^export\s+/gm, '');
  return new Function('AsyncStorage', code +
    '\nreturn { enqueueOfflineAction, removeOfflineQueueItem, getOfflineQueueSnapshot, OfflineQueueCapacityError };'
  )(storage);
}

function storageMock() {
  const map = new Map();
  return {
    getItem: async key => map.get(key) ?? null,
    setItem: async (key, value) => { map.set(key, value); },
    removeItem: async key => { map.delete(key); },
  };
}

test('full offline queue preserves first and last unsynced actions', async () => {
  const api = queueApi(storageMock());
  let firstId;
  for (let index = 0; index < 500; index++) {
    const item = await api.enqueueOfflineAction({
      kind: 'faith_abc_completion_v1',
      userId: 'account-a',
      dedupeKey: 'lesson-' + index,
      payload: { index },
    });
    if (index === 0) firstId = item.id;
  }

  await assert.rejects(
    api.enqueueOfflineAction({
      kind: 'faith_abc_completion_v1',
      userId: 'account-a',
      dedupeKey: 'lesson-500',
      payload: { index: 500 },
    }),
    error => error instanceof api.OfflineQueueCapacityError &&
      /500 pending actions/.test(error.message),
  );

  let snapshot = await api.getOfflineQueueSnapshot();
  assert.equal(snapshot.pendingCount, 500);
  assert.equal(snapshot.items[0].payload.index, 0);
  assert.equal(snapshot.items[499].payload.index, 499);

  // Updating an existing, same-user idempotency key is still allowed at cap.
  await api.enqueueOfflineAction({
    kind: 'faith_abc_completion_v1',
    userId: 'account-a',
    dedupeKey: 'lesson-0',
    payload: { index: 0, edited: true },
  });
  snapshot = await api.getOfflineQueueSnapshot();
  assert.equal(snapshot.pendingCount, 500);
  assert.equal(snapshot.items.find(item => item.id === firstId).payload.edited, true);

  await api.removeOfflineQueueItem(firstId);
  await api.enqueueOfflineAction({
    kind: 'faith_abc_completion_v1',
    userId: 'account-a',
    dedupeKey: 'lesson-500',
    payload: { index: 500 },
  });
  snapshot = await api.getOfflineQueueSnapshot();
  assert.equal(snapshot.pendingCount, 500);
  assert.equal(snapshot.items.some(item => item.payload.index === 0), false);
  assert.equal(snapshot.items.some(item => item.payload.index === 500), true);
});
