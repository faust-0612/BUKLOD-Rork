import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

let runtimeSequence = 0;
async function cacheRuntime() {
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
  // Engineering preflight runs *before npm ci*. Use built-in Node 22 type
  // stripping and an isolated AsyncStorage mock; no package dependency.
  const source = readFileSync(new URL('../src/lib/offlineCache.ts', import.meta.url), 'utf8');
  const key = '__buklodOfflineCacheTest' + ++runtimeSequence;
  const directory = mkdtempSync(join(tmpdir(), 'buklod-offline-'));
  const file = join(directory, 'offlineCache.ts');
  const modified = source.replace(
    /^import AsyncStorage from '@react-native-async-storage\/async-storage';/m,
    'const AsyncStorage = globalThis[' + JSON.stringify(key) + '];',
  );
  assert.notEqual(modified, source, 'AsyncStorage import replacement');
  writeFileSync(file, modified, 'utf8');
  globalThis[key] = asyncStorage;
  try {
    const api = await import(pathToFileURL(file).href);
    return { ...api, storage };
  } finally {
    delete globalThis[key];
    rmSync(directory, { recursive: true, force: true });
  }
}

test('parallel Bible/Word/lesson downloads never lose cache-index entries', async () => {
  const cache = await cacheRuntime();
  await Promise.all(Array.from({ length: 40 }, (_, i) =>
    cache.setOfflineCache('lesson-reading-v1:' + i, { id: i }, {
      userId: 'member-one', ttlMs: 30 * 24 * 60 * 60 * 1000,
    })));
  const index = JSON.parse(cache.storage.get('@buklod/cache/v1-index') ?? '[]');
  assert.equal(index.length, 40);
  assert.equal(new Set(index.map(x => x.storageKey)).size, 40);
});

test('faith downloads survive routine 14-day pruning, but ordinary UI data expires', async () => {
  const cache = await cacheRuntime();
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
  const cache = await cacheRuntime();
  await cache.setOfflineCache('lesson-reading-v1:L1', { account: 'A' }, { userId: 'A' });
  await cache.setOfflineCache('lesson-reading-v1:L1', { account: 'B' }, { userId: 'B' });
  await cache.clearOfflineCacheForUser('A');
  assert.equal(await cache.getOfflineCache('lesson-reading-v1:L1', { userId: 'A' }), null);
  assert.equal((await cache.getOfflineCache('lesson-reading-v1:L1', { userId: 'B' }))?.data.account, 'B');
});
