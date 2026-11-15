import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const settings=read('src/app/drawer/settings.tsx');
const service=read('src/lib/smartDrawer/nativeDriveBackup.ts');
const backup=read('src/lib/smartDrawer/portableBackup.ts');

test('personal Google Drive connect/backup/restore is visible only in separate Native QA APK', () => {
  assert.match(settings, /Platform\.OS === 'android' &&\s*process\.env\.EXPO_PUBLIC_KINGDOM_NATIVE_LAB === '1'/);
  for (const name of ['connectNativeDrawerDrive','disconnectNativeDrawerDrive',
    'backupNativeDrawerToDrive','restoreNativeDrawerFromDrive','getNativeDrawerDriveConnection']) {
    assert.ok(settings.includes(name), name);
  }
  assert.match(settings, /Native QA/);
  assert.match(settings, /confirmNativeDriveRestore/);
  assert.match(settings, /backupBusy/);
});

test('manual backup/restore and explicit recovery key protections are preserved', () => {
  assert.match(settings, /shareSmartDrawerBackup/);
  assert.match(settings, /restoreSmartDrawerBackup/);
  assert.match(settings, /Copy Recovery Key/);
  assert.match(settings, /BUKLOD cannot recover a lost key/);
  assert.match(backup, /sourceAccountId !== userId/);
  assert.match(service, /SecureStore\.deleteItemAsync/);
});
