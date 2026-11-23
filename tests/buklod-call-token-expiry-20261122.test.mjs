import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const jwtSource = read('src/lib/buklodCallJwt.ts');
// Evaluate only the pure, dependency-free helper after removing its two TS annotations.
const jsSource = jwtSource.replace(
  'export function isBuklodCallJwtExpired(token: string, skewSeconds = 90): boolean',
  'function isBuklodCallJwtExpired(token, skewSeconds = 90)'
);
assert.notEqual(jsSource, jwtSource, 'JWT guard signature must be present');
const isExpired = new Function(`${jsSource}\nreturn isBuklodCallJwtExpired;`)();
const jwt = exp => `header.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.signature`;

// Fixed clock makes near-expiration checks deterministic in CI and locally.
test('Stream JWT expiring within the skew window is never reused', () => {
  const original = Date.now;
  Date.now = () => 1_800_000_000_000;
  try {
    assert.equal(isExpired(jwt(1_800_000_180)), false);
    assert.equal(isExpired(jwt(1_800_000_030)), true);
    assert.equal(isExpired(jwt(1_799_999_999)), true);
    assert.equal(isExpired(jwt(1_800_000_030), 0), false);
    assert.equal(isExpired('bad'), true);
    assert.equal(isExpired(jwt(undefined)), true);
  } finally {
    Date.now = original;
  }
});

test('native client never falls back to an expired Stream or Supabase credential', () => {
  const client = read('src/lib/buklodStreamVideoClient.ts');
  assert.match(client, /!token \|\| !apiKey \|\| isBuklodCallJwtExpired\(token\)/);
  assert.match(client, /tokenProvider: streamTokenProvider/);
  assert.match(client, /throw new Error\('CALL_SESSION_EXPIRED'\)/);
  assert.doesNotMatch(client, /const stale = cachedStreamToken/);
  assert.doesNotMatch(client, /refreshed\.data\.session\?\.access_token \?\? current/);
});

test('web client expires cached JWTs and will not continue with invalid refresh', () => {
  const client = read('src/lib/buklodStreamVideoClient.web.ts');
  assert.match(client, /!isBuklodCallJwtExpired\(cachedCredentials\.token\)/);
  assert.match(client, /throw new Error\('CALL_SESSION_EXPIRED'\)/);
});

test('raw expired-WebSocket JSON is converted to actionable member feedback', () => {
  const format = read('src/lib/buklodStreamCall.ts');
  assert.match(format, /autherrortokenexpired/);
  assert.match(format, /Nag-expire ang calling session/);
});
