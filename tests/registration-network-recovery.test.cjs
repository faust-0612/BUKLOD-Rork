'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');

const root = join(__dirname, '..');
const registration = readFileSync(join(root, 'src/app/(auth)/register.tsx'), 'utf8');
const resilience = readFileSync(join(root, 'src/lib/buklodAuthResilience.ts'), 'utf8');

test('network resets are classified as uncertain, not rejected signup', () => {
  assert.match(resilience, /text\.includes\('connection reset'\)/);
  assert.match(resilience, /text\.includes\('fetch failed'\)/);
  assert.match(registration, /if \(isBuklodTransientAuthError\(error\)\) \{\s*showInterruptedRegistration\(authEmail, password\)/);
  assert.match(registration, /Registration connection interrupted/);
  assert.match(registration, /cannot tell whether your account was created/);
});

test('only one signup call; interrupted path verifies by sign-in and never retries signup', () => {
  assert.equal((registration.match(/supabase\.auth\.signUp\(/g) || []).length, 1);
  const recovery = registration.slice(
    registration.indexOf('const verifyInterruptedRegistration ='),
    registration.indexOf('const showInterruptedRegistration ='),
  );
  assert.match(recovery, /signInWithPasswordResilient\(/);
  assert.doesNotMatch(recovery, /\.signUp\(/);
  assert.match(registration, /if \(registrationNeedsCheck\) \{\s*await verifyInterruptedRegistration\(authEmail, password\);\s*return;/);
});

test('recovery requires authenticated session and does not trust invalid credentials', () => {
  assert.match(registration, /if \(error \|\| !data\?\.session \|\| !data\?\.user\)/);
  assert.match(registration, /isBuklodInvalidCredentialsError\(error\)/);
  assert.match(registration, /setRegistrationNeedsCheck\(false\)/);
  assert.match(registration, /CHECK ACCOUNT STATUS/);
  assert.match(registration, /Do not register again yet/);
});

test('referral and local setup resume only after login verification', () => {
  const recovery = registration.slice(
    registration.indexOf('const verifyInterruptedRegistration ='),
    registration.indexOf('const showInterruptedRegistration ='),
  );
  const authCheck = recovery.indexOf('if (error || !data?.session || !data?.user)');
  const localSync = recovery.indexOf('await completeRegistrationLocalSetup()');
  const referral = recovery.indexOf('await attachRegistrationReferral(data.user.id)');
  assert.ok(authCheck >= 0 && localSync > authCheck && referral > localSync);
  assert.match(registration, /'buklod_complete_registration_v1'/);
  assert.match(registration, /let lastError: unknown = null;/);
});

test('all auth failure paths clear busy/single-flight guard', () => {
  assert.match(registration, /const finishCreateAccount = \(\) => \{\s*createAccountInFlight\.current = false;\s*setBusy\(false\)/);
  assert.match(registration, /const verifyInterruptedRegistration =[\s\S]*?finally \{\s*finishCreateAccount\(\)/);
  assert.match(registration, /authSessionConfirmed = true/);
  assert.match(registration, /if \(authSessionConfirmed\) \{[\s\S]*?Account created - setup interrupted/);
  assert.match(registration, /catch \(error\) \{\s*finishCreateAccount\(\);\s*if \(authSessionConfirmed\)/);
});
