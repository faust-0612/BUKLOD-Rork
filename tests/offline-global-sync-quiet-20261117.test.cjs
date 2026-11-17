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
  let writes = 0;
  return {
    getItem: async key => data.get(key) ?? null,
    setItem: async (key, value) => { writes += 1; data.set(key, value); },
    writeCount: () => writes,
  };
}

function genericQueue(db) {
  return new Function('AsyncStorage', stripModule(read('src/lib/offlineSyncQueue.ts')) +
    '\nreturn { hasReplayableOfflineQueueItems, enqueueOfflineAction, registerOfflineQueueHandler, drainOfflineQueue, getOfflineQueueSnapshot };'
  )(db);
}

function featureQueue(db) {
  return new Function('AsyncStorage', 'SCALE_LIMITS', 'peekCommunityMediaUrl',
    stripModule(read('src/lib/buklodOfflineSync.ts')) +
    '\nreturn { hasReplayablePendingActions, enqueuePendingAction, registerPendingActionHandler, flushPendingActions };'
  )(db, { offlineCommunityCachePosts: 50, offlineSyncMaxRetries: 5 }, () => null);
}

test('global banner reports only offline or limited connection, never background Syncing', () => {
  const banner = read('src/components/OfflineBanner.tsx');
  assert.match(banner, /status !== 'offline' && status !== 'degraded'/);
  assert.match(banner, /return null;/);
  assert.doesNotMatch(banner, /Syncing •|syncing: featureSyncing|status === 'syncing'/);
  assert.match(banner, /pendingCount = queuePendingCount \+ featurePendingCount/);
});

test('providers do not show a busy state before finding replayable actions', () => {
  const network = read('src/providers/NetworkProvider.tsx');
  const feature = read('src/providers/BuklodOfflineSyncProvider.tsx');
  assert.match(network, /if \(!\(await hasReplayableOfflineQueueItems\(options\?\.userId\)\)\) return;[\s\S]*setSyncing\(true\)/);
  assert.match(feature, /if \(!online \|\| !\(await hasReplayablePendingActions\(\)\)\) \{[\s\S]*setSyncing\(true\)/);
});

test('generic queue replay eligibility honors current account, due time and handler registration', async () => {
  const db = storage();
  const queue = genericQueue(db);
  assert.equal(await queue.hasReplayableOfflineQueueItems('user-a'), false);
  await queue.enqueueOfflineAction({
    kind: 'faith_abc_completion_v1', userId: 'user-a',
    dedupeKey: 'lesson-a', payload: { lessonId: 'lesson-01' },
  });
  assert.equal(await queue.hasReplayableOfflineQueueItems('user-a'), false, 'unknown handler must stay idle');
  queue.registerOfflineQueueHandler('faith_abc_completion_v1', async () => {});
  assert.equal(await queue.hasReplayableOfflineQueueItems('user-b'), false, 'account isolation');
  assert.equal(await queue.hasReplayableOfflineQueueItems('user-a'), true);
  const [pending] = (await queue.getOfflineQueueSnapshot()).items;
  await db.setItem('@buklod/offline-sync/v1',
    JSON.stringify([{ ...pending, nextAttemptAt: Date.now() + 60_000 }]));
  assert.equal(await queue.hasReplayableOfflineQueueItems('user-a'), false, 'retry backoff');
  await db.setItem('@buklod/offline-sync/v1',
    JSON.stringify([{ ...pending, attempts: pending.maxAttempts }]));
  assert.equal(await queue.hasReplayableOfflineQueueItems('user-a'), false, 'max retries');
  await db.setItem('@buklod/offline-sync/v1', JSON.stringify([pending]));
  assert.equal(await queue.hasReplayableOfflineQueueItems('user-a'), true);
  await queue.drainOfflineQueue({ userId: 'user-a' });
  assert.equal(await queue.hasReplayableOfflineQueueItems('user-a'), false);
});

test('feature queue stays idle after exhausting retries without rewriting failed state', async () => {
  const db = storage();
  const queue = featureQueue(db);
  assert.equal(await queue.hasReplayablePendingActions(), false);
  queue.registerPendingActionHandler('org_upsert_record', async () => {});
  await queue.enqueuePendingAction({
    type: 'org_upsert_record', scopeKey: 'test', label: 'Saved item', payload: {},
  });
  assert.equal(await queue.hasReplayablePendingActions(), true);
  await db.setItem('@buklod/offline/pending/v1', JSON.stringify([{
    id: 'terminal', type: 'org_upsert_record', scopeKey: 'test', label: 'Saved item',
    payload: {}, status: 'failed_to_sync', createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(), retryCount: 5,
  }]));
  assert.equal(await queue.hasReplayablePendingActions(), false);
  const writes = db.writeCount();
  await queue.flushPendingActions({ maxItems: 8 });
  assert.equal(db.writeCount(), writes, 'terminal failure should not trigger storage writes/notifications');
});
