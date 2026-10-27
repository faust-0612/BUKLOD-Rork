// BUKLOD recovery-feedback regression contracts (source checks, not an authenticated E2E).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const screen = readFileSync('src/app/(auth)/forgot-password.tsx', 'utf8');
const admin = readFileSync('src/app/admin/account-recovery.tsx', 'utf8');

test('every recovery path shows a persistent inline problem instead of web-only silent alerts', () => {
  for (const [flow, setter] of Object.entries({
    email: 'setEmailStatus',
    pin: 'setPinStatus',
    admin: 'setRecoveryStateText',
    code: 'setCodeStatus',
  })) {
    assert.ok(screen.includes("if (flow === '"+flow+"') "+setter+"(detail)"));
    assert.ok(screen.includes("reportRecoveryProblem('"+flow+"'"));
  }
  assert.ok(screen.includes("if (Platform.OS !== 'web') Alert.alert(title, message)"));
});

test('admin approval advances to the password form, not the login screen', () => {
  for (const value of [
    "state === 'verified'",
    'setReceivedCode(nextCode)',
    'setCode(nextCode)',
    'codeCardY.current - 20',
    'Create your new password',
  ]) assert.ok(screen.includes(value), value);
  assert.equal(screen.split("router.replace('/(auth)/login'").length - 1, 1);
});

test('server-confirmed password changes reveal explicit success and the sign-in action', () => {
  for (const flow of ['email', 'pin', 'admin']) {
    assert.ok(screen.includes("setCompletedPath('"+flow+"')"));
    assert.ok(screen.includes("completedPath === '"+flow+"'"));
  }
  assert.ok(screen.split('if (!data?.ok) throw').length - 1 >= 6);
  assert.ok(screen.includes('Password updated successfully'));
  assert.ok(screen.includes('GO TO LOGIN'));
});

test('a pending admin recovery request cannot be double-submitted', () => {
  for (const value of [
    'requestInFlight.current',
    "disabled={!!recoverySession || !!receivedCode || completedPath === 'admin'}",
    'Request received. Waiting for System Admin verification',
    'setRequestSent(false)',
  ]) assert.ok(screen.includes(value), value);
});

test('admin verify/reject requires a real confirmation and one shared action lock', () => {
  for (const value of [
    "setConfirmation({ action: 'verify'",
    "setConfirmation({ action: 'reject'",
    'CONFIRM VERIFY',
    'CONFIRM REJECT',
    'if (actionInFlight.current || busyId) return',
    'data?.deliveredAutomatically !== true',
    'row.needs_match || !row.user_id',
    '!row.auto_delivery_ready',
  ]) assert.ok(admin.includes(value), value);
  assert.equal(admin.includes("if (Platform.OS === 'web') {\n      void run();"), false);
});

test('recovery retains the existing secured service endpoints', () => {
  for (const endpoint of ['account-recovery-otp-v1', 'account-recovery-v3', 'account-recovery-v4']) {
    assert.ok(screen.includes(endpoint), endpoint);
  }
});
