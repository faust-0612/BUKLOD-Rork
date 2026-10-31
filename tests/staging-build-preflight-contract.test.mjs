import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const gate = readFileSync('scripts/staging-gate.mjs', 'utf8');
const eas = JSON.parse(readFileSync('eas.json', 'utf8'));
const native = readFileSync('app.config.js', 'utf8');

test('staging user builds an installable standalone APK on isolated channel and Preview environment', () => {
  const p = eas.build['staging-user'];
  assert.equal(p.channel, 'staging-user');
  assert.equal(p.environment, 'preview');
  assert.equal(p.android.buildType, 'apk');
  assert.equal(p.distribution, 'internal');
  assert.match(native, /org\.mzbministry\.buklod\.staging/);
});

test('staging gate must reject all known operational Supabase projects', () => {
  for (const ref of ['yhanxndaqbmuzbdqlblu', 'cjtehbfspgimyhifnjon', 'oppswibwjrruxkrpiwej'])
    assert.ok(gate.includes(ref), ref);
  assert.match(gate, /protectedRefs\.includes\(urlProjectRef\)/);
  assert.match(gate, /BUKLOD_STAGING_PROJECT_REF/);
});

test('staging gate accepts migration growth while rejecting malformed and duplicate identifiers', () => {
  const migrations = readdirSync('supabase/migrations').filter(name => name.endsWith('.sql'));
  assert.ok(migrations.length > 13, 'current repo must have more than historic thirteen migrations');
  assert.doesNotMatch(gate, /migrations\.length !== 13/);
  assert.match(gate, /migrations\.length === 0/);
  assert.match(gate, /malformed\.length/);
  assert.match(gate, /new Set\(timestampIds\)/);
});
