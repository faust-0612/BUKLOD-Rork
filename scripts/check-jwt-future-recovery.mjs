import assert from 'node:assert/strict';
import test from 'node:test';

import { createBuklodJwtFutureRecoveryFetch } from '../src/lib/buklodJwtFutureRecoveryFetch.ts';
import { createBuklodPermissionSnapshotFetch } from '../src/lib/buklodPermissionSnapshotFetch.ts';

const restUrl = 'https://test.supabase.co/rest/v1/prayer_requests';
const futureJwtBody = JSON.stringify({
  code: 'PGRST303',
  message: 'JWT issued at future',
});
const jwtFutureResponse = () => new Response(futureJwtBody, {
  status: 401,
  headers: { 'content-type': 'application/json' },
});

test('a confirmed PostgREST clock rejection retries a JSON mutation only once', async () => {
  let calls = 0;
  const request = { method: 'POST', body: JSON.stringify({ text: 'prayer' }) };
  const fetcher = createBuklodJwtFutureRecoveryFetch(async (_url, init) => {
    calls += 1;
    assert.equal(init.body, request.body);
    return calls === 1 ? jwtFutureResponse() : new Response('{}', { status: 201 });
  }, { retryDelayMs: 0 });

  const response = await fetcher(restUrl, request);
  assert.equal(response.status, 201);
  assert.equal(calls, 2);
});

test('a persistent outage permits at most one bounded retry per cooldown', async () => {
  let calls = 0;
  const fetcher = createBuklodJwtFutureRecoveryFetch(async () => {
    calls += 1;
    return jwtFutureResponse();
  }, { retryDelayMs: 0, cooldownMs: 60_000 });

  const responses = await Promise.all(
    Array.from({ length: 30 }, () => fetcher(restUrl))
  );
  assert.equal(calls, 31);
  assert.ok(responses.every((response) => response.status === 401));
});

test('unrelated failures and Edge Function calls never replay', async () => {
  let calls = 0;
  const fetcher = createBuklodJwtFutureRecoveryFetch(async () => {
    calls += 1;
    return jwtFutureResponse();
  }, { retryDelayMs: 0 });

  const edge = await fetcher('https://test.supabase.co/functions/v1/account-recovery-v4');
  const stream = await fetcher(restUrl, { method: 'POST', body: new Uint8Array([1, 2]) });
  assert.equal(edge.status, 401);
  assert.equal(stream.status, 401);
  assert.equal(calls, 2);

  let otherCalls = 0;
  const otherFetcher = createBuklodJwtFutureRecoveryFetch(async () => {
    otherCalls += 1;
    return new Response('Unauthorized', { status: 401 });
  }, { retryDelayMs: 0 });
  await otherFetcher(restUrl);
  assert.equal(otherCalls, 1);
});

test('permission snapshot JWT rejection does not amplify into individual RPCs', async () => {
  let snapshotRequests = 0;
  let individualRequests = 0;
  const fetcher = createBuklodPermissionSnapshotFetch(async (url) => {
    if (String(url).includes('buklod_my_permission_snapshot_v1')) {
      snapshotRequests += 1;
      return jwtFutureResponse();
    }
    individualRequests += 1;
    return new Response('true', { status: 200 });
  });

  const responses = await Promise.all(Array.from({ length: 40 }, (_, index) =>
    fetcher('https://test.supabase.co/rest/v1/rpc/buklod_has_permission', {
      method: 'POST',
      headers: { authorization: 'Bearer valid-user-token', apikey: 'publishable-key' },
      body: JSON.stringify({ p_permission_key: `view_${index}` }),
    })
  ));

  assert.equal(snapshotRequests, 1);
  assert.equal(individualRequests, 0);
  assert.ok(responses.every((response) => response.status === 401));
  assert.ok(responses.every((response) => response.headers.get('content-type') === 'application/json'));
  assert.equal((await responses[0].json()).code, 'PGRST303');
});

test('a missing snapshot RPC still falls back to the original authoritative check', async () => {
  let snapshotRequests = 0;
  let originalChecks = 0;
  const fetcher = createBuklodPermissionSnapshotFetch(async (url) => {
    if (String(url).includes('buklod_my_permission_snapshot_v1')) {
      snapshotRequests += 1;
      return new Response('Not found', { status: 404 });
    }
    originalChecks += 1;
    return new Response('false', { status: 200 });
  });
  const response = await fetcher('https://test.supabase.co/rest/v1/rpc/buklod_has_permission', {
    method: 'POST',
    headers: { authorization: 'Bearer another-user', apikey: 'publishable-key' },
    body: JSON.stringify({ p_permission_key: 'view_cluster' }),
  });
  assert.equal(await response.json(), false);
  assert.equal(snapshotRequests, 1);
  assert.equal(originalChecks, 1);
});
