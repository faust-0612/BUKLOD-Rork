const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripTypeScriptTypes } = require('node:module');

const root = process.env.BUKLOD_TEST_ROOT || path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const stripModule = source => stripTypeScriptTypes(source)
  .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*$/gm, '')
  .replace(/^export\s+/gm, '');

function storage() {
  const data = new Map();
  return {
    getItem: async key => data.get(key) ?? null,
    setItem: async (key, value) => { data.set(key, value); },
  };
}

function genericQueue(db) {
  const code = stripModule(read('src/lib/offlineSyncQueue.ts'));
  return new Function('AsyncStorage', code +
    '\nreturn { enqueueOfflineAction, registerOfflineQueueHandler, drainOfflineQueue, getOfflineQueueSnapshot };'
  )(db);
}

function pendingQueue(db) {
  const code = stripModule(read('src/lib/buklodOfflineSync.ts'));
  return new Function('AsyncStorage', 'SCALE_LIMITS', 'peekCommunityMediaUrl',
    code + '\nreturn { enqueuePendingAction, registerPendingActionHandler, flushPendingActions, listPendingActions };'
  )(db, { offlineCommunityCachePosts: 50, offlineSyncMaxRetries: 5 }, () => null);
}

test('reconnect jitter spreads independent devices over six seconds, never a fixed one-second herd', () => {
  const pacing = new Function(stripModule(read('src/lib/buklodReconnectPacing.ts')) +
    '\nreturn { buklodReconnectDelayMs, AUTO_SYNC_ACTIONS_PER_QUEUE };'
  )();
  assert.equal(pacing.AUTO_SYNC_ACTIONS_PER_QUEUE, 8);
  assert.equal(pacing.buklodReconnectDelayMs(0), 1000);
  assert.equal(pacing.buklodReconnectDelayMs(0.5), 4000);
  assert.equal(pacing.buklodReconnectDelayMs(0.999999), 6999);
  assert.equal(pacing.buklodReconnectDelayMs(-7), 1000);
  assert.equal(pacing.buklodReconnectDelayMs(10), 6999);
  assert.equal(pacing.buklodReconnectDelayMs(Number.NaN), 1000);
});

test('generic offline queue replays eight at a time without deleting or duplicating the rest', async () => {
  const queue = genericQueue(storage());
  const delivered = [];
  queue.registerOfflineQueueHandler('faith_abc_completion_v1', async item => {
    delivered.push(item.payload.index);
  });
  for (let i = 0; i < 19; i++) {
    await queue.enqueueOfflineAction({
      kind: 'faith_abc_completion_v1',
      userId: 'same-user',
      dedupeKey: 'lesson-' + i,
      payload: { index: i },
    });
  }
  let snapshot = await queue.drainOfflineQueue({ concurrency: 2, maxItems: 8 });
  assert.equal(delivered.length, 8);
  assert.equal(snapshot.pendingCount, 11);
  assert.equal(snapshot.items[0].payload.index, 8);
  snapshot = await queue.drainOfflineQueue({ concurrency: 2, maxItems: 8 });
  assert.equal(delivered.length, 16);
  assert.equal(snapshot.pendingCount, 3);
  snapshot = await queue.drainOfflineQueue({ concurrency: 2, maxItems: 8 });
  assert.equal(snapshot.pendingCount, 0);
  assert.deepEqual(delivered.slice().sort((a, b) => a - b),
    Array.from({ length: 19 }, (_, i) => i));
});

test('other-account backlog cannot starve current account behind a bounded wave', async () => {
  const queue = genericQueue(storage());
  const delivered = [];
  queue.registerOfflineQueueHandler('faith_abc_completion_v1', async item => {
    delivered.push(item.userId + ':' + item.payload.index);
  });
  for (let i = 0; i < 12; i++) {
    await queue.enqueueOfflineAction({
      kind: 'faith_abc_completion_v1', userId: 'old-account',
      dedupeKey: 'old-' + i, payload: { index: i },
    });
  }
  for (let i = 0; i < 3; i++) {
    await queue.enqueueOfflineAction({
      kind: 'faith_abc_completion_v1', userId: 'current-account',
      dedupeKey: 'current-' + i, payload: { index: i },
    });
  }
  const result = await queue.drainOfflineQueue({
    concurrency: 2, maxItems: 8, userId: 'current-account',
  });
  assert.deepEqual(delivered, [
    'current-account:0', 'current-account:1', 'current-account:2',
  ]);
  assert.equal(result.pendingCount, 12);
  assert.ok(result.items.every(item => item.userId === 'old-account'));
});

test('feature pending queue drains eight actions per wave and preserves remaining unsent drafts', async () => {
  const queue = pendingQueue(storage());
  const delivered = [];
  queue.registerPendingActionHandler('org_upsert_record', async item => {
    delivered.push(item.payload.index);
  });
  for (let i = 0; i < 17; i++) {
    await queue.enqueuePendingAction({
      type: 'org_upsert_record',
      scopeKey: 'scope-a',
      label: 'Saved draft ' + i,
      payload: { index: i },
    });
  }
  assert.deepEqual(await queue.flushPendingActions({ maxItems: 8 }), { processed: 8, failed: 0 });
  assert.equal((await queue.listPendingActions()).length, 9);
  assert.deepEqual(await queue.flushPendingActions({ maxItems: 8 }), { processed: 8, failed: 0 });
  assert.equal((await queue.listPendingActions()).length, 1);
  assert.deepEqual(await queue.flushPendingActions({ maxItems: 8 }), { processed: 1, failed: 0 });
  assert.equal((await queue.listPendingActions()).length, 0);
  assert.deepEqual(delivered, Array.from({ length: 17 }, (_, i) => i));
});

test('coordinator staggers foreground/reconnection waves and caps both queue drains', () => {
  const coordinator = read('src/components/BuklodSyncCoordinator.tsx');
  const network = read('src/providers/NetworkProvider.tsx');
  const offline = read('src/providers/BuklodOfflineSyncProvider.tsx');
  assert.match(coordinator, /scheduledSyncTimerRef\.current = setTimeout\(\(\) => \{/);
  assert.match(coordinator, /\}, buklodReconnectDelayMs\(\)\)/);
  assert.match(coordinator, /syncNow\(\{\s*maxItems: AUTO_SYNC_ACTIONS_PER_QUEUE,\s*userId: user\.id/);
  assert.match(coordinator, /flushNow\(\{ maxItems: AUTO_SYNC_ACTIONS_PER_QUEUE \}\)/);
  assert.match(coordinator, /const scheduleSync = useCallback\(\(\) => \{/);
  assert.match(coordinator, /clearTimeout\(scheduledSyncTimerRef\.current\)/);
  assert.match(network, /maxItems: options\?\.maxItems/);
  assert.match(offline, /flushPendingActions\(\{ maxItems: options\?\.maxItems \}\)/);
  assert.match(coordinator, /MIN_SYNC_GAP_MS = 5_000/);
});

