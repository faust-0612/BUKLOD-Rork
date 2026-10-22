const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verifyWebBuildEnv } = require('../scripts/verify-web-build-env.cjs');
const valid = {
  EXPO_PUBLIC_SUPABASE_URL: 'https://approved.example',
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public-test-fixture',
  BUKLOD_EXPECTED_SUPABASE_URL: 'https://approved.example',
};
test('refuses missing Supabase bindings before producing a blank Web export', () => {
  for (const name of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY']) {
    assert.throws(() => verifyWebBuildEnv({ ...valid, [name]: ' ' }), new RegExp(name));
  }
});
test('refuses a different project or credentials inside the URL without exposing values', () => {
  assert.throws(() => verifyWebBuildEnv({ ...valid, EXPO_PUBLIC_SUPABASE_URL: 'https://other.example' }), /approved production project/);
  assert.throws(() => verifyWebBuildEnv({ ...valid, EXPO_PUBLIC_SUPABASE_URL: 'https://user:private@approved.example' }), /without credentials/);
});
test('accepts the supplied approved project configuration', () => {
  assert.doesNotThrow(() => verifyWebBuildEnv(valid));
});
