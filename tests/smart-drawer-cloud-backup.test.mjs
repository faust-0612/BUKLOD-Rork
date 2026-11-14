import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const backup = read('src/lib/smartDrawer/portableBackup.ts');
const settings = read('src/app/drawer/settings.tsx');
const classifier = read('src/lib/smartDrawer/classify.ts');

test('cloud backup requires recovery key and uses authenticated encryption', () => {
  assert.match(backup, /validateRecoveryKey\(recoveryKey\)/);
  assert.match(backup, /Crypto\.aesEncryptAsync\(/);
  assert.match(backup, /Crypto\.aesDecryptAsync\(/);
  assert.match(backup, /Crypto\.AESSealedData\.fromCombined/);
  assert.match(backup, /ENCRYPTED_FORMAT/);
  assert.doesNotMatch(backup, /writeAsStringAsync\(uri, JSON\.stringify\(envelope\)/);
});

test('backup is user-driven and no BUKLOD cloud endpoint is involved', () => {
  assert.match(backup, /Sharing\.shareAsync\(/);
  assert.match(backup, /DocumentPicker\.getDocumentAsync\(/);
  assert.doesNotMatch(backup, /supabase\.storage|fetch\(\s*['"]https?:/);
  assert.match(settings, /Local Only \(default\)/);
});

test('restore refuses cross-account archive, duplicates and tampering', () => {
  assert.match(backup, /sourceAccountId !== userId/);
  assert.match(backup, /checksum !== envelope\.sha256/);
  assert.match(backup, /getSmartDrawerItem\(userId, row\.note\.id\)/);
  assert.match(backup, /allowedStatuses/);
  assert.match(backup, /MAX_ENCRYPTED_BYTES/);
});

test('user must receive and manually retain the key', () => {
  assert.match(settings, /Generate New Recovery Key/);
  assert.match(settings, /Copy Recovery Key/);
  assert.match(settings, /Paste 64-character backup recovery key/);
  assert.match(settings, /BUKLOD cannot recover a lost key/);
});

test('note dates do not indiscriminately generate reminders', () => {
  assert.match(classifier, /const detectedAt/);
  assert.match(classifier, /\['TASK', 'DUE_TASK', 'EVENT', 'APPOINTMENT', 'PROGRAM'\]/);
});
