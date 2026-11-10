import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');

function cacheRuntime() {
  const storage = new Map();
  const asyncStorage = {
    async getItem(key) {
      await Promise.resolve();
      return storage.get(key) ?? null;
    },
    async setItem(key, value) {
      await Promise.resolve();
      storage.set(key, value);
    },
    async removeItem(key) {
      await Promise.resolve();
      storage.delete(key);
    },
    async multiRemove(keys) {
      await Promise.resolve();
      for (const key of keys) storage.delete(key);
    },
    async getAllKeys() {
      await Promise.resolve();
      return [...storage.keys()];
    },
  };
  const source = readFileSync(new URL('../src/lib/offlineCache.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const mod = { exports: {} };
  const mockRequire = name => {
    if (name === '@react-native-async-storage/async-storage') {
      return { __esModule: true, default: asyncStorage };
    }
    throw new Error('Unexpected import: ' + name);
  };
  new Function('require', 'module', 'exports', js)(mockRequire, mod, mod.exports);
  return { ...mod.exports, storage };
}

test('parallel Bible/Word/lesson downloads never lose cache-index entries', async () => {
  const cache = cacheRuntime();
  await Promise.all(Array.from({ length: 40 }, (_, i) =>
    cache.setOfflineCache('lesson-reading-v1:' + i, { id: i }, {
      userId: 'member-one', ttlMs: 30 * 24 * 60 * 60 * 1000,
    })));
  const index = JSON.parse(cache.storage.get('@buklod/cache/v1-index') ?? '[]');
  assert.equal(index.length, 40);
  assert.equal(new Set(index.map(x => x.storageKey)).size, 40);
});

test('faith downloads survive routine 14-day pruning, but ordinary UI data expires', async () => {
  const cache = cacheRuntime();
  const realNow = Date.now;
  const DAY = 24 * 60 * 60 * 1000;
  try {
    const start = Date.UTC(2026, 10, 1);
    Date.now = () => start;
    await cache.setOfflineCache('lesson-reading-v1:L1', { text: 'Lesson' }, { userId: 'member' });
    await cache.setOfflineCache('daily-bible-week:v2:2026-11-02', { text: 'Week' }, { userId: 'member' });
    await cache.setOfflineCache('word-full:W1', { text: 'Word' }, { userId: 'member' });
    await cache.setOfflineCache('ordinary-feed', { text: 'Feed' }, { userId: 'member' });
    Date.now = () => start + 15 * DAY;
    await cache.pruneOfflineCache({ olderThanMs: 14 * DAY });
    for (const key of [
      'lesson-reading-v1:L1', 'daily-bible-week:v2:2026-11-02', 'word-full:W1',
    ]) {
      assert.ok((await cache.getOfflineCache(key, { userId: 'member', allowStale: true }))?.data, key);
    }
    assert.equal(await cache.getOfflineCache('ordinary-feed',
      { userId: 'member', allowStale: true }), null);
  } finally {
    Date.now = realNow;
  }
});

test('clearing one member never deletes another member’s saved lessons', async () => {
  const cache = cacheRuntime();
  await cache.setOfflineCache('lesson-reading-v1:L1', { account: 'A' }, { userId: 'A' });
  await cache.setOfflineCache('lesson-reading-v1:L1', { account: 'B' }, { userId: 'B' });
  await cache.clearOfflineCacheForUser('A');
  assert.equal(await cache.getOfflineCache('lesson-reading-v1:L1', { userId: 'A' }), null);
  assert.equal((await cache.getOfflineCache('lesson-reading-v1:L1', { userId: 'B' }))?.data.account, 'B');
});
