import fs from 'node:fs';

const failures = [];
const checks = [];

function read(path) {
  return fs.readFileSync(path, 'utf8').replace(/\r\n?/g, '\n');
}

function pass(label, ok, detail = '') {
  checks.push({ label, ok });
  if (!ok) failures.push(detail || label);
}

function requireText(path, text, label) {
  const src = read(path);
  pass(label, src.includes(text), `${label}: missing "${text}" in ${path}`);
}

function forbidText(path, text, label) {
  const src = read(path);
  pass(label, !src.includes(text), `${label}: forbidden "${text}" found in ${path}`);
}

console.log('BUKLOD MAIN USER FEEDBACK / NO-SILENT-FAILURE GATE');
console.log('===================================================');

requireText(
  'src/lib/buklodUserFeedback.ts',
  "| 'VALIDATION_ERROR'",
  'Central error taxonomy exists',
);
requireText(
  'src/lib/buklodUserFeedback.ts',
  "| 'KNOWN_INCIDENT'",
  'Known incident is a canonical error category',
);
requireText(
  'src/lib/buklodUserFeedback.ts',
  "'support_opened_after_error'",
  'Support-deflection telemetry catalog exists',
);
requireText(
  'src/lib/buklodUserFeedback.ts',
  '/password|pin|otp|token|secret|credential|answer/i',
  'Client telemetry strips secret-like metadata',
);
requireText(
  'src/components/BuklodFeedbackBanner.tsx',
  'Next:',
  'Canonical feedback banner provides next-step guidance',
);
requireText(
  'src/providers/BuklodFeedbackProvider.tsx',
  "pathname: '/help'",
  'App-wide feedback can escalate to Need Help',
);
requireText(
  'src/app/_layout.tsx',
  'Support code: SYS-500',
  'Root error state uses safe support code',
);
forbidText(
  'src/app/_layout.tsx',
  '{error.message}',
  'Root error boundary never displays raw exception text',
);

requireText(
  'src/app/(auth)/login.tsx',
  '<BuklodFeedbackBanner',
  'Login has persistent visible feedback',
);
requireText(
  'src/app/(auth)/login.tsx',
  "message: t('auth.invalidCredentials')",
  'Login uses security-safe combined credential message',
);
requireText(
  'src/app/(auth)/login.tsx',
  "'support_opened_after_error'",
  'Login emits support escalation telemetry',
);
requireText(
  'src/app/(auth)/login.tsx',
  "router.replace(\n      '/(tabs)/buklod'\n    )",
  'Successful Login opens canonical Community Wall',
);
forbidText(
  'src/app/(auth)/login.tsx',
  "router.replace(\n      '/(tabs)/home'\n    )",
  'Login cannot resurrect retired Public Home',
);
requireText(
  'src/app/(auth)/login.tsx',
  "SIGNING IN…",
  'Login exposes specific processing state',
);
requireText(
  'src/app/(auth)/login.tsx',
  "onNeedHelp=",
  'Login unresolved error exposes Need Help action',
);

requireText(
  'src/app/(auth)/forgot-password.tsx',
  'withBuklodTimeout<any>',
  'Automatic recovery remains time-bounded',
);
requireText(
  'src/app/(auth)/forgot-password.tsx',
  '<BuklodFeedbackBanner',
  'Account recovery has persistent visible feedback',
);
requireText(
  'src/app/(auth)/forgot-password.tsx',
  "'recovery_attempted'",
  'Account recovery emits attempt telemetry',
);
requireText(
  'src/app/(auth)/forgot-password.tsx',
  "'recovery_success'",
  'Account recovery emits success telemetry',
);
requireText(
  'src/app/(auth)/forgot-password.tsx',
  "pathname: '/help'",
  'Account recovery exposes Need Help',
);

requireText(
  'src/app/account/reset-password.tsx',
  'Update recovery password',
  'Password reset operation has timeout',
);
requireText(
  'src/app/account/reset-password.tsx',
  '<BuklodFeedbackBanner',
  'Password reset has persistent visible feedback',
);
forbidText(
  'src/app/account/reset-password.tsx',
  "String(\n            (\n              error as any\n            )?.message",
  'Password reset no longer renders raw exception text',
);

requireText(
  'src/app/account/recovery-pin.tsx',
  'Recovery PIN status',
  'Recovery PIN status read has timeout',
);
requireText(
  'src/app/account/recovery-pin.tsx',
  'Save Recovery PIN',
  'Recovery PIN save has timeout',
);
requireText(
  'src/app/account/recovery-pin.tsx',
  '<BuklodFeedbackBanner',
  'Recovery PIN status failures are visible',
);

requireText(
  'src/components/OfflineBanner.tsx',
  'You appear to be offline.',
  'Offline state is explicit',
);
requireText(
  'src/components/OfflineBanner.tsx',
  'Connection restored.',
  'Recovered connection state is explicit',
);

requireText(
  'src/app/help/index.tsx',
  'useLocalSearchParams',
  'Need Help accepts error context',
);
requireText(
  'src/app/help/index.tsx',
  'errorCode:',
  'Need Help forwards support code into diagnostics',
);
requireText(
  'src/lib/buklodSupport.ts',
  "outcome: 'CASE_CREATED'",
  'Unresolved Help preserves support case creation',
);

forbidText(
  'src/app/(auth)/forgot-password.tsx',
  'System Admin verification',
  'Recovery no longer tells users to contact System Admin',
);
forbidText(
  'src/app/(auth)/forgot-password.tsx',
  'Use Admin Help',
  'Recovery unresolved path uses central Need Help',
);
forbidText(
  'src/app/(auth)/forgot-password.tsx',
  'Status check: ${String(error?.message',
  'Recovery polling never renders raw exception text',
);
forbidText(
  'src/app/(tabs)/buklod.tsx',
  "'Community',\n      error.message",
  'Community refresh never renders raw backend error',
);
forbidText(
  'src/app/organizations/manage.tsx',
  '? error.message',
  'Organization screen never renders raw backend error',
);
forbidText(
  'src/app/organizations/suborganizations.tsx',
  '? error.message',
  'Sub-Org screen never renders raw backend error',
);
requireText(
  'src/app/bayanihan/index.tsx',
  "pathname: '/help'",
  'Bayanihan failure exposes Need Help',
);
requireText(
  'src/app/(tabs)/me.tsx',
  'reportProfileFailure',
  'Profile critical actions use safe failure presenter',
);

requireText(
  'supabase/migrations/20260921090716_bsoc_feedback_operations_r1.sql',
  'bsoc_feedback_events',
  'Feedback telemetry backend schema is source-tracked',
);
requireText(
  'supabase/functions/buklod-support-v1/index.ts',
  'action==="telemetry"',
  'Support backend receives Main feedback telemetry',
);
requireText(
  'supabase/functions/buklod-support-v1/index.ts',
  '/password|pin|otp|token|secret|credential|security.?answer|payment|title|body|text|note|image|asset|list|content|extract/i',
  'Server telemetry strips secret-like metadata',
);

for (const { label, ok } of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
}

if (failures.length) {
  console.error('\nBUKLOD MAIN UX FEEDBACK GATE FAILED');
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  process.exit(1);
}

console.log('\nBUKLOD MAIN UX FEEDBACK GATE PASS');
