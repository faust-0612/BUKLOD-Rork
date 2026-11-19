import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (name) => readFileSync(name, 'utf8');
const login = source('src/app/(auth)/login.tsx');
const nativeStore = source('src/lib/buklodRememberedLoginSecrets.ts');
const reset = source('src/lib/buklodSuggestedLoginStorage.ts');
const securityUi = source('src/app/admin/security-operations.tsx');
const rootLayout = source('src/app/_layout.tsx');

test('passwords no longer persist in unencrypted AsyncStorage on any platform', () => {
  assert.doesNotMatch(login, /AsyncStorage\.setItem\(\s*['"]buklod\.remembered_credentials\.v1['"]/);
  assert.doesNotMatch(login, /await AsyncStorage\.setItem\(key,\s*value\)/);
  assert.match(login, /writeBuklodRememberedLogin\(/);
  assert.match(nativeStore, /SecureStore\.setItemAsync\(\s*BUKLOD_NATIVE_REMEMBERED_CREDENTIALS_KEY/);
  assert.doesNotMatch(nativeStore, /AsyncStorage\.setItem\(/);
});

test('web must never load or save a remembered password; native migration scrubs plaintext', () => {
  assert.match(nativeStore, /Platform\.OS === 'web'[\s\S]*?removeItem\(BUKLOD_LEGACY_REMEMBERED_CREDENTIALS_KEY\)[\s\S]*?return null/);
  assert.match(login, /if \(Platform\.OS === 'web'\) \{\s*await AsyncStorage\.removeItem\(key\);\s*return null;/);
  assert.match(login, /if \(Platform\.OS === 'web'\) \{[\s\S]*?await AsyncStorage\.removeItem\(key\);\s*return;/);
  assert.match(nativeStore, /SecureStore\.getItemAsync\(BUKLOD_NATIVE_REMEMBERED_CREDENTIALS_KEY\)/);
  assert.match(nativeStore, /SecureStore\.setItemAsync\(BUKLOD_NATIVE_REMEMBERED_CREDENTIALS_KEY, current\)/);
  assert.match(nativeStore, /finally \{[\s\S]*?await AsyncStorage\.removeItem\(BUKLOD_LEGACY_REMEMBERED_CREDENTIALS_KEY\)/);
  assert.match(login, /passwords are not saved in this browser/);
  assert.match(login, /Platform\.OS !== 'web' && item\.hasPassword === true/);
  assert.match(login, /JSON\.stringify\(parsed\.map\(item => \(\{ \.\.\.item, hasPassword: false \}\)\)\)/);
});

test('password recovery clears matching native secrets and legacy cache', () => {
  assert.match(reset, /clearMatchingBuklodRememberedLogin\(\{/);
  assert.match(reset, /identifiers: \[\.\.\.matchedIdentifiers, targetIdentifier\]/);
  assert.match(nativeStore, /SecureStore\.deleteItemAsync\(BUKLOD_NATIVE_REMEMBERED_CREDENTIALS_KEY\)/);
  assert.match(nativeStore, /await AsyncStorage\.removeItem\(BUKLOD_LEGACY_REMEMBERED_CREDENTIALS_KEY\)/);
});

test('admin security screen does not present unqueried auth audit rows as zero activity', () => {
  assert.match(securityUi, /UNVERIFIED — database audit window not checked/);
  assert.match(securityUi, /External Auth log monitoring is separate/);
  assert.doesNotMatch(securityUi, /24h rows: \{data\.auth_audit_rows_24h\}/);
  assert.match(securityUi, /finance_hold/);
});

test('scanner R2 flags unverified Auth DB windows and privilege re-exposure without weakening existing checks', () => {
  const migration = source('supabase/migrations/20261119144500_security_scan_rpc_acl_and_auth_coverage_signals_r2.sql');
  assert.match(migration, /INTERNAL_ROLE_HELPER_CLIENT_EXECUTE/);
  assert.match(migration, /AUTH_AUDIT_DB_WINDOW_UNVERIFIED/);
  for (const key of ['PUBLIC_TABLE_WITHOUT_RLS','PUBLIC_UNSAFE_DDL_GRANTS',
    'ANON_ADMIN_PRIVILEGED_RPC','FINANCE_BLOCKING_FRAUD',
    'BSOC_P0_OPEN','BACKEND_CAPACITY_REVIEW',
    'FINANCE_MONEY_SWITCH_ACTIVE']) {
    assert.ok(migration.includes(key), `existing detection missing: ${key}`);
  }
  assert.match(migration, /REVOKE ALL ON FUNCTION private\.buklod_security_scan_v1\(\)/);
  assert.doesNotMatch(migration, /cron\.schedule\(|DROP TABLE|DROP POLICY/);
  assert.match(source('supabase/tests/buklod_security_scanner_signals_r2_20261119.sql'),
    /Existing scan cadence not active/);
});

test('startup independently cleans legacy secrets for users with persistent sessions', () => {
  assert.match(rootLayout, /secureBuklodRememberedLoginOnStartup\(\)\.catch\(\(\) => undefined\)/);
  assert.match(rootLayout, /useEffect\(\(\) => \{\s*void secureBuklodRememberedLoginOnStartup/);
  assert.match(nativeStore, /export async function secureBuklodRememberedLoginOnStartup/);
  assert.match(nativeStore, /await readBuklodRememberedLogin\(\)/);
  assert.match(nativeStore, /AsyncStorage\.getAllKeys\(\)/);
  assert.match(nativeStore, /key\.startsWith\('buklod\.suggested_login\.password\.'/);
});
