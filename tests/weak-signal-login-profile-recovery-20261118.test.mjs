import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const auth = read('src/providers/AuthProvider.tsx');
const tabs = read('src/app/(tabs)/_layout.tsx');
const login = read('src/app/(auth)/login.tsx');
const transport = read('src/lib/buklodPerformanceFetch.ts');
const resilient = read('src/lib/buklodAuthResilience.ts');

test('weak signal does not misclassify an unavailable profile as a new member', () => {
  assert.match(auth, /profileLoadState: BuklodProfileLoadState/);
  assert.match(auth, /String\(error\?\.code \?\? ''\) === 'PGRST116' \? 'missing' : 'unavailable'/);
  assert.match(auth, /snapshot\?\.profile\?\.id === userId/);
  assert.match(auth, /sessionUserIdRef\.current !== userId/);
  assert.match(tabs, /if \(profileLoadState !== 'missing'\)/);
  assert.match(tabs, /Your account is signed in\. A stable connection/);
  assert.match(tabs, /<Redirect href="\/onboarding" \/>/);
});

test('password grant remains bounded, single-flight and server-authoritative', () => {
  assert.match(resilient, /passwordSignInInFlight/);
  assert.match(resilient, /resolveBuklodAccountLifecycleAfterLogin/);
  assert.match(transport, /grant_type=password/);
  assert.match(transport, /boundedReadSnapshot\(baseFetch, input, init, 24_000/);
  assert.doesNotMatch(login, /setInterval\([\s\S]*?signInWithPasswordResilient/);
  assert.match(login, /await resolveBuklodAccountLifecycleAfterLogin\(\)/);
  assert.match(login, /if \(accountLifecycleError\) \{\s*await signOutBuklodResilient\(\)/);
});

test('long login gets clear progress without removing privacy gates or ad startup', () => {
  assert.match(login, /setTimeout\(\(\) => setSlowLogin\(true\), 4_000\)/);
  assert.match(login, /The connection is weak or unavailable/);
  assert.match(tabs, /if \(requiresAcceptance\)/);
  assert.match(tabs, /BuklodDashboardAdWarmup/);
});
