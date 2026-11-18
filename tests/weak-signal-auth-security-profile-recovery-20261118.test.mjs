import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const provider = readFileSync(new URL('../src/providers/AuthProvider.tsx', import.meta.url), 'utf8');
const login = readFileSync(new URL('../src/app/(auth)/login.tsx', import.meta.url), 'utf8');
const transport = readFileSync(new URL('../src/lib/buklodPerformanceFetch.ts', import.meta.url), 'utf8');

test('verified missing profile clears same-account snapshot and roles instead of granting cached access', () => {
  assert.match(provider, /if \(String\(error\?\.code \?\? ''\) === 'PGRST116'\) \{\s*await clearAuthSnapshot\(userId\)/);
  assert.match(provider, /await clearAuthSnapshot\(userId\);\s*if \(sessionUserIdRef\.current !== userId\) return;\s*setProfile\(null\);\s*setRoles\(\[\]\)/);
  assert.match(provider, /setProfileLoadState\('missing'\)/);
});

test('weak network cannot install stale account profile or bypass Supabase auth verification', () => {
  assert.match(provider, /snapshot\?\.profile\?\.id === userId/);
  assert.match(provider, /if \(sessionUserIdRef\.current !== userId\) return;/);
  assert.match(provider, /setProfileLoadState\('unavailable'\)/);
  assert.match(login, /await resolveBuklodAccountLifecycleAfterLogin\(\)/);
  assert.match(login, /if \(accountLifecycleError\) \{\s*await signOutBuklodResilient\(\)/);
  assert.match(transport, /state\.passwordTransport/);
});
