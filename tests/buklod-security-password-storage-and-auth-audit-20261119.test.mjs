import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (name) => readFileSync(name, 'utf8');
const login = source('src/app/(auth)/login.tsx');
const nativeStore = source('src/lib/buklodRememberedLoginSecrets.ts');
const reset = source('src/lib/buklodSuggestedLoginStorage.ts');
const securityUi = source('src/app/admin/security-operations.tsx');

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
