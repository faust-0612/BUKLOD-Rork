import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const index = readFileSync('src/app/index.tsx','utf8');
const login = readFileSync('src/app/(auth)/login.tsx','utf8');
const fis = readFileSync('src/app/admin/fis.tsx','utf8');

test('FIS-only router bootstrap isolates entry and preserves normal Main navigation', () => {
  assert.ok(index.includes("process.env.EXPO_PUBLIC_BUKLOD_FIS === '1'"));
  assert.ok(index.includes('<Redirect href="/admin/fis" />'));
  assert.ok(index.includes('href="/(tabs)/buklod"'));
  assert.ok(login.includes("process.env.EXPO_PUBLIC_BUKLOD_FIS === '1' ? '/admin/fis' : '/(tabs)/buklod'"));
  assert.ok(fis.includes('<AdminGate>'));
});

test('FIS-only routing respects the existing login, maintenance and consent gates', () => {
  assert.ok(index.indexOf('if (!session)') < index.indexOf("process.env.EXPO_PUBLIC_BUKLOD_FIS === '1'"));
  assert.ok(index.includes('config?.maintenance_mode'));
  assert.ok(index.includes('config?.update_required'));
  assert.ok(index.includes('if (requiresAcceptance)'));
});
