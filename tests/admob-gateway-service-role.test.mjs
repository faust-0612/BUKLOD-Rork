import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hasGatewayVerifiedServiceRoleClaims } from '../supabase/functions/buklod-admob-revenue-preview-sync/gateway-service-role.mjs';

const token = (payload, signature = 'signature') => {
  const encoded = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encoded({ alg: 'HS256', typ: 'JWT' })}.${encoded(payload)}.${signature}`;
};

// The pure role check intentionally does NOT validate signatures.
// Supabase verify_jwt=true is the required upstream cryptographic boundary.
test('accepts a current service_role JWT after gateway signature verification', () => {
  const now = 1794180000;
  assert.equal(hasGatewayVerifiedServiceRoleClaims(token({ role: 'service_role', exp: now + 3600 }), now), true);
  assert.equal(hasGatewayVerifiedServiceRoleClaims(token({ role: 'service_role', exp: now + 3600, nbf: now - 1 }), now), true);
});
test('rejects non-service roles, expired, not-yet-valid, or malformed tokens', () => {
  const now = 1794180000;
  for (const role of ['anon', 'authenticated', 'admin', '', null]) {
    assert.equal(hasGatewayVerifiedServiceRoleClaims(token({ role, exp: now + 3600 }), now), false);
  }
  assert.equal(hasGatewayVerifiedServiceRoleClaims(token({ role: 'service_role', exp: now - 1 }), now), false);
  assert.equal(hasGatewayVerifiedServiceRoleClaims(token({ role: 'service_role' }), now), false);
  assert.equal(hasGatewayVerifiedServiceRoleClaims(token({ role: 'service_role', exp: '9999999999' }), now), false);
  assert.equal(hasGatewayVerifiedServiceRoleClaims(token({ role: 'service_role', exp: now + 3600, nbf: now + 600 }), now), false);
  for (const invalid of ['', 'a.b', 'a.b.', 'a.bad.bad', 'a.e30.b', null]) {
    assert.equal(hasGatewayVerifiedServiceRoleClaims(invalid, now), false);
  }
});
test('production source depends on enforced Supabase JWT signature validation', () => {
  const importer = readFileSync('supabase/functions/buklod-admob-revenue-preview-sync/index.ts', 'utf8');
  assert.match(importer, /verify_jwt=true/);
  assert.match(importer, /hasGatewayVerifiedServiceRoleClaims\(token\)/);
  assert.doesNotMatch(importer, /verify_jwt=false/);
  assert.doesNotMatch(importer, /token !== serviceRole/);
  assert.match(importer, /admin_set_buklod_community_admob_estimate_v1/);
  assert.doesNotMatch(importer, /payout_processing|credit_wallet|process_withdrawal/i);
});
