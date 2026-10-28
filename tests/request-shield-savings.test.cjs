const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripTypeScriptTypes } = require('node:module');

const root = process.env.BUKLOD_TEST_ROOT || path.resolve(__dirname, '..');
const code = stripTypeScriptTypes(
  fs.readFileSync(path.join(root, 'src/lib/buklodR4RequestShield.ts'), 'utf8')
).replace(/^export\s+/gm, '');

function makeShield(baseFetch) {
  delete globalThis.__BUKLOD_R4_REQUEST_SHIELD__;
  return new Function('baseFetch', code +
    '\nreturn { fetch: createBuklodR4RequestShield(baseFetch), stats: getBuklodR4RequestShieldStats };'
  )(baseFetch);
}

const countUrl = 'https://project.supabase.co/rest/v1/rpc/buklod_internal_share_count_v2';
const writeUrl = 'https://project.supabase.co/rest/v1/rpc/buklod_internal_share_post_v2';
const countRequest = (token, postId = 'post-a') => ({
  method: 'POST',
  headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_post_id: postId }),
});

test('actual local accounting records 40 concurrent reads as one upstream call', async () => {
  let networkCalls = 0;
  const { fetch, stats } = makeShield(async () => {
    networkCalls += 1;
    await new Promise(resolve => setTimeout(resolve, 10));
    return new Response('7', { status: 200 });
  });
  const responses = await Promise.all(Array.from({ length: 40 }, () =>
    fetch(countUrl, countRequest('account-a'))));
  assert.deepEqual(await Promise.all(responses.map(r => r.text())),
    Array(40).fill('7'));
  assert.equal(networkCalls, 1);
  const first = stats();
  assert.equal(first.eligible, 40);
  assert.equal(first.upstream, 1);
  assert.equal(first.inFlightShares, 39);
  assert.equal(first.cacheHits, 0);
  assert.equal(first.savedUpstreamRequests, 39);
  assert.equal(first.savingsPercent, 97.5);
  assert.equal(first.operations[0].operation, 'buklod_internal_share_count_v2');

  assert.equal((await fetch(countUrl, countRequest('account-a'))).status, 200);
  const second = stats();
  assert.equal(networkCalls, 1);
  assert.equal(second.cacheHits, 1);
  assert.equal(second.savingsPercent, 97.6);
});

test('authorization and post identity isolate cached reads; writes still invalidate', async () => {
  let count = 0;
  const { fetch, stats } = makeShield(async (url) => {
    if (String(url).includes('/buklod_internal_share_post_v2')) {
      count += 1;
      return new Response(String(count), { status: 200 });
    }
    return new Response(String(count), { status: 200 });
  });

  await fetch(countUrl, countRequest('account-a', 'post-a'));
  await fetch(countUrl, countRequest('account-b', 'post-a'));
  await fetch(countUrl, countRequest('account-a', 'post-b'));
  assert.equal(stats().upstream, 3);

  await fetch(writeUrl, {
    method: 'POST',
    headers: { Authorization: 'Bearer account-a' },
    body: JSON.stringify({ p_post_id: 'post-a', p_target_kind: 'PUBLIC_WALL' }),
  });
  await fetch(countUrl, countRequest('account-a', 'post-a'));
  assert.equal(stats().upstream, 4);
  assert.equal(stats().operations.length, 1);
});

test('metrics contain no user identifiers, raw query bodies or auth tokens', async () => {
  const { fetch, stats } = makeShield(async () => new Response('1'));
  await fetch(countUrl, countRequest('private-Bearer-token-XYZ', 'secret-post-id'));
  const output = JSON.stringify(stats());
  assert.doesNotMatch(output, /private-Bearer-token-XYZ/);
  assert.doesNotMatch(output, /secret-post-id/);
  assert.match(output, /buklod_internal_share_count_v2/);
});

