import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {
  mayRestoreOfflineAuthSnapshot,
  hasMatchingPolicySession,
  allRequiredPoliciesAccepted,
} from '../src/lib/buklodPolicyAuthGuard.ts';

test('offline identity cannot authenticate an online or degraded request', () => {
  assert.equal(mayRestoreOfflineAuthSnapshot('offline'), true);
  for (const status of ['online', 'degraded', 'unknown', 'syncing']) {
    assert.equal(mayRestoreOfflineAuthSnapshot(status), false);
  }
  assert.equal(hasMatchingPolicySession(null, 'member'), false);
  assert.equal(hasMatchingPolicySession({ access_token: '', user: { id: 'member' } }, 'member'), false);
  assert.equal(hasMatchingPolicySession({ access_token: 'token', user: { id: 'other' } }, 'member'), false);
  assert.equal(hasMatchingPolicySession({ access_token: 'token', user: { id: 'member' } }, 'member'), true);
});

test('an offline placeholder or partial server acceptance never counts as saved', () => {
  assert.equal(allRequiredPoliciesAccepted([{ accepted: false }]), false);
  assert.equal(allRequiredPoliciesAccepted([{ accepted: true }, { accepted: false }]), false);
  assert.equal(allRequiredPoliciesAccepted([{ accepted: true }]), true);
  assert.equal(allRequiredPoliciesAccepted([]), true); // verified backend says none required
});

test('boot, privacy screen and writes preserve authentication boundaries', () => {
  const auth = fs.readFileSync('src/providers/AuthProvider.tsx', 'utf8');
  const compliance = fs.readFileSync('src/providers/ComplianceProvider.tsx', 'utf8');
  const consent = fs.readFileSync('src/app/privacy/consent.tsx', 'utf8');
  assert.match(auth, /!data\.session && mayRestoreOfflineAuthSnapshot\(networkStatusRef\.current\)/);
  assert.match(auth, /if \(!online \|\| !offlineSnapshotPendingRef\.current\) return;/);
  assert.match(compliance, /supabase\.auth\.getUser\(\)/);
  assert.match(compliance, /const verified = await readRequiredPolicies\(targetUserId\)/);
  assert.match(compliance, /if \(!allRequiredPoliciesAccepted\(verified\)\)/);
  assert.match(compliance, /if \(cacheKey\) await AsyncStorage\.setItem\(cacheKey, 'true'\)/);
  assert.match(consent, /result\.needsLogin/);
  for (const path of ['src/app/index.tsx', 'src/app/index.web.tsx', 'src/app/(tabs)/_layout.tsx']) {
    assert.match(fs.readFileSync(path, 'utf8'), /loading && !session/);
    assert.doesNotMatch(fs.readFileSync(path, 'utf8'), /loading && !session && !profile/);
  }
});
