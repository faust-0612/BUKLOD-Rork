import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const service=read('src/lib/smartDrawer/nativeDriveBackup.ts');
const portable=read('src/lib/smartDrawer/portableBackup.ts');
const transport=read('src/lib/smartDrawer/googleDriveTransport.ts');

test('Drive token is short-lived, authorization is native and account identity is checked every action', () => {
  assert.match(service, /requireNativeModule<NativeDrive>\('BuklodNativeDrive'\)/);
  assert.match(service, /www\.googleapis\.com\/oauth2\/v3\/userinfo/);
  assert.match(service, /requestGoogleIdentity\(true\)/);
  assert.match(service, /googleSubject !== info\.subject/);
  assert.match(service, /googleEmail\.toLowerCase\(\) !== info\.email\.toLowerCase\(\)/);
  assert.match(service, /SecureStore\.getItemAsync/);
  assert.match(service, /SecureStore\.deleteItemAsync/);
  assert.match(service, /const activeAccountOperations = new Set<string>/);
  assert.match(service, /withAccountLock\(userId, async \(\) =>/);
  assert.doesNotMatch(service, /setItemAsync\([^\n]*accessToken/);
  assert.doesNotMatch(service, /setInterval/);
});

test('encrypted backups cannot overwrite another BUKLOD account on the same Drive', () => {
  assert.match(service, /buklodOwnerHash === idHash/);
  assert.match(service, /uploadEncryptedSmartDrawerBackup\(getToken, encrypted, own\[0\]\?\.id, fetch, idHash\)/);
  assert.match(transport, /Invalid BUKLOD account binding/);
  assert.match(transport, /buklodOwnerHash: ownerHash/);
  assert.match(portable, /buildEncryptedSmartDrawerBackup/);
  assert.match(portable, /restoreSmartDrawerBackupFromEncryptedText/);
  assert.match(portable, /sourceAccountId !== userId/);
  assert.match(portable, /checksum !== envelope\.sha256/);
});

test('manual portable backup and picker remain intact for existing staging and production', () => {
  assert.match(portable, /export async function shareSmartDrawerBackup/);
  assert.match(portable, /Sharing\.shareAsync/);
  assert.match(portable, /export async function restoreSmartDrawerBackup\(/);
  assert.match(portable, /DocumentPicker\.getDocumentAsync/);
  assert.match(service, /EXPO_PUBLIC_KINGDOM_NATIVE_LAB === '1'/);
});
