import fs from 'node:fs';

const login =
  fs.readFileSync(
    'src/app/(auth)/login.tsx',
    'utf8'
  );
const resilience =
  fs.readFileSync(
    'src/lib/buklodAuthResilience.ts',
    'utf8'
  );

const failures = [];

function requireText(source, text, label) {
  if (!source.includes(text)) {
    failures.push(`Missing canonical login contract: ${label}`);
  }
}

function requirePattern(source, pattern, label) {
  if (!pattern.test(source)) {
    failures.push(`Missing canonical login contract: ${label}`);
  }
}

function forbidText(source, text, label) {
  if (source.includes(text)) {
    failures.push(`Forbidden legacy login pattern returned: ${label}`);
  }
}

requireText(
  login,
  'signInWithCanonicalIdentifierResilient',
  'Login UI delegates to resilient canonical auth'
);

/*
 * BUKLOD_CANONICAL_LOGIN_CONTRACT_R2
 * Verify the actual call shape independent of formatter whitespace.
 * Manual login and Suggested Login both converge on login(), which must pass
 * the resolved identifier + effective password through one canonical helper.
 */
requirePattern(
  login,
  /await\s+signInForFreshPublicHome\s*\(\s*raw\s*,\s*effectivePassword\s*\)/m,
  'all entered identifiers use one canonical Login path'
);

requirePattern(
  login,
  /await\s+signInWithCanonicalIdentifierResilient\s*\(\s*identifier\s*,\s*password\s*\)/m,
  'fresh public login helper delegates to canonical identifier auth'
);

forbidText(login, 'function mobileInternalEmail(', 'mobile auth-email guessing helper');
forbidText(login, 'function legacyMobileInternalEmail(', 'legacy mobile auth-email guessing helper');
forbidText(login, 'function usernameInternalEmail(', 'username auth-email guessing helper');
forbidText(login, '.signInWithPassword(', 'direct password grant in Login screen');

requireText(resilience, 'BUKLOD_CANONICAL_LOGIN_RESOLVER_R23', 'R23 resilience marker');
requireText(resilience, "'buklod-auth-login-v2'", 'central login edge function');
requireText(resilience, 'supabase.auth.setSession', 'canonical returned-session persistence');
requireText(resilience, 'canonicalIdentifierSignInInFlight', 'global single-flight protection');
requireText(resilience, 'AUTH_CANONICAL_IDENTIFIER_TIMEOUT_MS', 'bounded canonical login wait');
requireText(resilience, 'authRuntimeState.lastSignedInUserId = userId', 'lifecycle fresh-user cache preservation');

if (failures.length) {
  console.error('BUKLOD CANONICAL LOGIN CONTRACT FAILED');
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  process.exit(1);
}

console.log('BUKLOD CANONICAL LOGIN CONTRACT PASS');
