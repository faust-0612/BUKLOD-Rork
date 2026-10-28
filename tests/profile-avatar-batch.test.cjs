const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

const sourcePath = resolve(__dirname, '../src/lib/buklodAvatarBatch.ts');
const profileSource = readFileSync(resolve(__dirname, '../src/components/ProfileAvatar.tsx'), 'utf8');
const userIds = Array.from({ length: 43 }, (_, i) =>
  `aaaaaaaa-aaaa-4aaa-8aaa-${String(i + 1).padStart(12, '0')}`,
);
const viewerA = 'viewer-1';
const viewerB = 'viewer-2';

async function factory() {
  return (await import(pathToFileURL(sourcePath).href)).createBuklodAvatarBatchLookup;
}

test('avatar lookup uses bounded batches and caches missing results without 404 probes', async () => {
  const create = await factory();
  const batches = [];
  let clock = 1000;
  const lookup = create(async (viewerId, ids) => {
    batches.push({ viewerId, ids });
    return ids.filter(id => id === userIds[0]).map(id => ({
      user_id: id, avatar_url: `${id}/avatar.jpg`,
    }));
  }, { delayMs: 0, now: () => clock });

  const results = await Promise.all(userIds.map(id => lookup.resolve(viewerA, id)));
  assert.equal(batches.length, 2);
  assert.ok(batches.every(batch => batch.ids.length <= 32));
  assert.equal(results[0], `${userIds[0]}/avatar.jpg`);
  assert.ok(results.slice(1).every(value => value === null));
  await lookup.resolve(viewerA, userIds[0]);
  await lookup.resolve(viewerA, userIds[1]);
  assert.equal(batches.length, 2, 'positive and negative cache avoid another RPC');

  clock += 61_000;
  await lookup.resolve(viewerA, userIds[1]);
  assert.equal(batches.length, 3, 'negative cache expires for newly uploaded avatars');
  await lookup.resolve(viewerA, userIds[0]);
  assert.equal(batches.length, 3, 'positive cache has a longer TTL');
});

test('same user mounted in multiple cards joins one in-flight lookup', async () => {
  const create = await factory();
  let requests = 0;
  const lookup = create(async (_viewerId, ids) => {
    requests += 1;
    return [{ user_id: ids[0], avatar_url: null }];
  }, { delayMs: 0 });
  const all = await Promise.all(Array.from({ length: 16 }, () => lookup.resolve(viewerA, userIds[0])));
  assert.equal(requests, 1);
  assert.ok(all.every(v => v === null));
});

test('different signed-in viewers never share lookup results', async () => {
  const create = await factory();
  const calls = [];
  const lookup = create(async (viewerId, ids) => {
    calls.push(viewerId);
    return [{ user_id: ids[0], avatar_url: `${viewerId}/avatar.jpg` }];
  }, { delayMs: 0 });
  const [a, b] = await Promise.all([
    lookup.resolve(viewerA, userIds[0]),
    lookup.resolve(viewerB, userIds[0]),
  ]);
  assert.equal(a, `${viewerA}/avatar.jpg`);
  assert.equal(b, `${viewerB}/avatar.jpg`);
  assert.deepEqual(calls, [viewerA, viewerB]);
});

test('temporary RPC errors are not cached and preserve legacy fallback signal', async () => {
  const create = await factory();
  let calls = 0;
  const lookup = create(async () => {
    calls += 1;
    if (calls === 1) throw new Error('weak connection');
    return [];
  }, { delayMs: 0 });
  assert.equal(await lookup.resolve(viewerA, userIds[0]), undefined);
  assert.equal(await lookup.resolve(viewerA, userIds[0]), null);
  assert.equal(calls, 2);
});

test('a new card arriving while the first batch is pending gets a later wave', async () => {
  const create = await factory();
  const calls = [];
  let releaseFirst;
  const waitForFirst = new Promise(resolveFirst => { releaseFirst = resolveFirst; });
  const lookup = create(async (_viewerId, ids) => {
    calls.push(ids);
    if (calls.length === 1) await waitForFirst;
    return [];
  }, { delayMs: 0 });
  const one = lookup.resolve(viewerA, userIds[0]);
  await new Promise(resolveTick => setTimeout(resolveTick, 12));
  const two = lookup.resolve(viewerA, userIds[1]);
  releaseFirst();
  assert.deepEqual(await Promise.all([one, two]), [null, null]);
  assert.equal(calls.length, 2);
});

test('invalid IDs are never sent to the backend', async () => {
  const create = await factory();
  let calls = 0;
  const lookup = create(async () => { calls += 1; return []; }, { delayMs: 0 });
  assert.equal(await lookup.resolve(viewerA, 'not-a-uuid'), undefined);
  assert.equal(calls, 0);
});

test('ProfileAvatar resolves existing URLs before attempting canonical fallback', () => {
  assert.match(profileSource, /avatarLookup\.resolve\(viewerId, userId\)/);
  assert.match(profileSource, /if \(resolved === undefined\) \{/);
  assert.match(profileSource, /setRemoteUrl\(normalizeAvatarUrl\(resolved\)\)/);
  assert.match(profileSource, /get_buklod_profile_avatars_v1/);
});
