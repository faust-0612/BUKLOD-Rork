import fs from 'node:fs';

const loginPath = 'src/app/(auth)/login.tsx';
const login = fs.readFileSync(loginPath, 'utf8');

const failures = [];

function requireText(text, label) {
  if (!login.includes(text)) {
    failures.push(`Missing canonical login contract: ${label}`);
  }
}

function forbidText(text, label) {
  if (login.includes(text)) {
    failures.push(`Forbidden legacy login pattern returned: ${label}`);
  }
}

requireText('BUKLOD_CANONICAL_LOGIN_RESOLVER_R23', 'R23 marker');
requireText("'buklod-auth-login-v2'", 'central login edge function');
requireText('supabase.auth.setSession', 'canonical returned-session persistence');
requireText('await signInForFreshPublicHome(\n        raw,\n        effectivePassword', 'all identifiers use one canonical path');

forbidText('function mobileInternalEmail(', 'mobileInternalEmail guessing helper');
forbidText('function legacyMobileInternalEmail(', 'legacy mobile email guessing helper');
forbidText('function usernameInternalEmail(', 'usernameInternalEmail guessing helper');
forbidText('.signInWithPassword(', 'direct password grant in Login screen');

if (failures.length) {
  console.error('BUKLOD CANONICAL LOGIN CONTRACT FAILED');
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  process.exit(1);
}

console.log('BUKLOD CANONICAL LOGIN CONTRACT PASS');
