const test = require('node:test');
const assert = require('node:assert/strict');
const {
  readEnvValue, canonicalSupabaseRef, inspectSeason2Staging, runCli,
} = require('../scripts/season2-staging-backend-isolation.cjs');

const prod = 'yhanxndaqbmuzbdqlblu';
const separate = 'abcdefghijklmnopqrst';
const other = 'tsrqponmlkjihgfedcba';
const env = ref => 'EXPO_PUBLIC_SUPABASE_URL="https://' + ref + '.supabase.co/"\n';

test('canonical staging identity is checked without pretending to verify RLS', () => {
  const proof = inspectSeason2Staging({
    previewEnv: env(separate), productionEnv: env(prod), approvedStagingRef: separate,
  });
  assert.equal(proof.status, 'URL_IDENTITY_CHECKED_ONLY');
  assert.equal(proof.rewardsAuthorized, false);
  assert.equal(proof.databaseOrRlsVerified, false);
  assert.equal(proof.productionModified, false);
});

test('rejects preview environment routing to real BUKLOD Main even with matching proposed ref', () => {
  assert.throws(() => inspectSeason2Staging({
    previewEnv: env(prod), productionEnv: env(prod), approvedStagingRef: prod,
  }), /STAGING_PROJECT_NOT_APPROVED/);
});

test('rejects a different unapproved or unrelated BUKLOD app backend', () => {
  assert.throws(() => inspectSeason2Staging({
    previewEnv: env(other), productionEnv: env(prod), approvedStagingRef: separate,
  }), /STAGING_BACKEND_NOT_ISOLATED/);
  assert.throws(() => inspectSeason2Staging({
    previewEnv: env('cjtehbfspgimyhifnjon'), productionEnv: env(prod),
    approvedStagingRef: 'cjtehbfspgimyhifnjon',
  }), /STAGING_PROJECT_NOT_APPROVED/);
});

test('requires independent approval of a unique staging backend and known production identity', () => {
  assert.throws(() => inspectSeason2Staging({
    previewEnv: env(separate), productionEnv: env(prod), approvedStagingRef: '',
  }), /STAGING_PROJECT_NOT_APPROVED/);
  assert.throws(() => inspectSeason2Staging({
    previewEnv: env(separate), productionEnv: env(other), approvedStagingRef: separate,
  }), /PRODUCTION_IDENTITY_CHANGED/);
});

test('rejects swapped, malicious, noncanonical or absent URLs', () => {
  assert.equal(canonicalSupabaseRef('https://' + separate + '.supabase.co'), separate);
  for (const url of [
    'http://' + separate + '.supabase.co',
    'https://' + separate + '.supabase.co.evil.test',
    'https://' + separate + '.supabase.co/?next=production',
    'https://user:secret@' + separate + '.supabase.co',
    'https://' + separate + '.supabase.co/rest/v1',
    'https://localhost:54321',
  ]) assert.throws(() => canonicalSupabaseRef(url));
  assert.throws(() => readEnvValue('NOT_A_SUPABASE_URL=hello', 'EXPO_PUBLIC_SUPABASE_URL'),
    /ENV_URL_MISSING_OR_DUPLICATED/);
  assert.throws(() => readEnvValue(env(separate) + env(prod), 'EXPO_PUBLIC_SUPABASE_URL'),
    /ENV_URL_MISSING_OR_DUPLICATED/);
});

test('missing CLI inputs fail closed before attempting a network write', () => {
  assert.throws(() => runCli([]), /INVALID_GUARD_ARGUMENTS/);
  assert.throws(() => runCli(['--preview-file', '/not-a-file', '--preview-file', 'dup',
    '--approved-ref', separate]), /INVALID_GUARD_ARGUMENTS/);
});
