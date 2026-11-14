'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');

const registration = readFileSync(
  join(__dirname, '..', 'src/app/(auth)/register.tsx'),
  'utf8',
);

test('interrupted auth signup never replays signup during account check', () => {
  const verify = registration.slice(
    registration.indexOf('const verifyInterruptedRegistration ='),
    registration.indexOf('const showInterruptedRegistration ='),
  );
  const check = verify.indexOf('if (await isBuklodRegistrationDefinitelyOffline())');
  const signIn = verify.indexOf('signInWithPasswordResilient(');
  assert.ok(check >= 0 && signIn > check);
  assert.doesNotMatch(verify, /signUp\(/);
  assert.match(verify, /if \(error \|\| !data\?\.session \|\| !data\?\.user\)/);
  assert.match(verify, /finally \{\s*finishCreateAccount\(\)/);
});

test('auth signup remains single-flight and waits for explicit connectivity', () => {
  const create = registration.slice(registration.indexOf('const createAccount ='));
  const flight = create.indexOf('createAccountInFlight.current = true;');
  const offline = create.indexOf('if (await isBuklodRegistrationDefinitelyOffline())');
  const signup = create.indexOf('supabase.auth.signUp(');
  assert.ok(flight >= 0 && offline > flight && signup > offline);
  assert.equal((registration.match(/supabase\.auth\.signUp\(/g) || []).length, 1);
  assert.match(create.slice(offline, signup), /finishCreateAccount\(\)/);
  assert.match(create, /if \(isBuklodTransientAuthError\(error\)\)/);
});
