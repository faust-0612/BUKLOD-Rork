const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const {
  createBuklodPostgrestJwtRetryFetch,
  isBuklodPostgrestJwtFutureError,
} = require('../src/lib/buklodPostgrestJwtRetryFetch.ts');

const jwtFuture = () => new Response(JSON.stringify({ code: 'PGRST303', message: 'JWT issued at future' }), {
  status: 401,
  headers: { 'content-type': 'application/json' },
});
const ok = () => new Response('{"saved":true}', { status: 200 });

test('recognizes only the precise PostgREST error', () => {
  assert.equal(isBuklodPostgrestJwtFutureError({ code: 'PGRST303', message: 'JWT issued at future' }), true);
  assert.equal(isBuklodPostgrestJwtFutureError({ code: 'PGRST303', message: 'Invalid JWT' }), false);
  assert.equal(isBuklodPostgrestJwtFutureError({ code: '401', message: 'JWT issued at future' }), false);
});

test('retries the exact pre-execution rejection once and leaves response consumable', async () => {
  let calls = 0;
  const fetcher = createBuklodPostgrestJwtRetryFetch(async () => (++calls === 1 ? jwtFuture() : ok()), 0);
  const response = await fetcher('https://example.supabase.co/rest/v1/rpc/buklod_my_clusters', {
    method: 'POST', body: '{}',
  });
  assert.equal(calls, 2);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { saved: true });
});

test('does not automatically replay prayer writes or unknown mutations', async () => {
  let calls = 0;
  const fetcher = createBuklodPostgrestJwtRetryFetch(async () => { calls++; return jwtFuture(); }, 0);
  await fetcher('https://example.supabase.co/rest/v1/prayer_requests', {
    method: 'POST', body: JSON.stringify({ request_text: 'test' }),
  });
  await fetcher('https://example.supabase.co/rest/v1/rpc/delete_prayer_request', {
    method: 'POST', body: '{}',
  });
  assert.equal(calls, 2);
});

test('never retries other 401s, auth endpoints, or 5xx errors', async () => {
  let calls = 0;
  const base = async () => { calls++; return jwtFuture(); };
  const fetcher = createBuklodPostgrestJwtRetryFetch(base, 0);
  await fetcher('https://example.supabase.co/auth/v1/user');
  await fetcher('https://example.supabase.co/functions/v1/account-recovery-v4');
  assert.equal(calls, 2);

  let otherCalls = 0;
  const other = createBuklodPostgrestJwtRetryFetch(async () => {
    otherCalls++;
    return new Response('{"code":"PGRST301","message":"JWT expired"}', { status: 401 });
  }, 0);
  await other('https://example.supabase.co/rest/v1/prayer_requests');
  assert.equal(otherCalls, 1);
  const failed = createBuklodPostgrestJwtRetryFetch(async () => {
    otherCalls++;
    return new Response('Service unavailable', { status: 503 });
  }, 0);
  assert.equal((await failed('https://example.supabase.co/rest/v1/prayer_requests')).status, 503);
  assert.equal(otherCalls, 2);
});

test('permanent timing errors are capped at one retry', async () => {
  let calls = 0;
  const fetcher = createBuklodPostgrestJwtRetryFetch(async () => { calls++; return jwtFuture(); }, 0);
  assert.equal((await fetcher('https://example.supabase.co/rest/v1/rpc/buklod_my_clusters')).status, 401);
  assert.equal(calls, 2);
});

test('repeated incidents have a per-runtime retry budget', async () => {
  let calls = 0;
  const fetcher = createBuklodPostgrestJwtRetryFetch(async () => { calls++; return jwtFuture(); }, 0);
  for (let n = 0; n < 6; n++) {
    assert.equal((await fetcher('https://example.supabase.co/rest/v1/rpc/buklod_my_clusters')).status, 401);
  }
  assert.equal(calls, 9); // six initial requests and at most three retries
});

test('does not retry after a cancelled request', async () => {
  let calls = 0;
  const controller = new AbortController();
  const fetcher = createBuklodPostgrestJwtRetryFetch(async () => {
    calls++;
    controller.abort();
    return jwtFuture();
  }, 0);
  assert.equal((await fetcher('https://example.supabase.co/rest/v1/prayer_requests', {
    signal: controller.signal,
  })).status, 401);
  assert.equal(calls, 1);
});

test('account recovery keeps its rate checks and caps server-side retries per invocation', async () => {
  const source = fs.readFileSync(__dirname + '/../supabase/functions/account-recovery-v4/index.ts', 'utf8');
  assert.match(source, /if \(gate\.checkError\) return json\(\{ ok: false/);
  const start = source.indexOf('function createPostgrestTimingFetch()');
  const end = source.indexOf('Deno.serve(', start);
  assert.ok(start > 0 && end > start);
  let calls = 0;
  const factory = vm.runInNewContext(
    stripTypeScriptTypes(source.slice(start, end)) + '\ncreatePostgrestTimingFetch',
    { fetch: async () => { calls++; return jwtFuture(); }, setTimeout: callback => callback() },
  );
  const fetcher = factory();
  for (let n = 0; n < 4; n++) {
    assert.equal((await fetcher('https://example.supabase.co/rest/v1/buklod_account_recovery_events')).status, 401);
  }
  assert.equal(calls, 6); // four initial requests and only two retries
});
