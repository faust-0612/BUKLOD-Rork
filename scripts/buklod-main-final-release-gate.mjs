import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const checks = [];

function read(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    failures.push(`Missing required file: ${rel}`);
    return '';
  }
  return fs.readFileSync(p, 'utf8');
}
function requireText(rel, text, label) {
  const src = read(rel);
  const ok = src.includes(text);
  checks.push({ label, ok });
  if (!ok) failures.push(`${label}: missing "${text}" in ${rel}`);
}
function forbidText(rel, text, label) {
  const src = read(rel);
  const ok = !src.includes(text);
  checks.push({ label, ok });
  if (!ok) failures.push(`${label}: forbidden "${text}" found in ${rel}`);
}

console.log('BUKLOD MAIN FINAL RELEASE GATE R1');
console.log('=================================');

// Canonical auth + mass-login resilience.
requireText('src/app/(auth)/login.tsx', 'signInWithCanonicalIdentifierResilient', 'Canonical identifier login');
requireText('src/app/(auth)/login.tsx', 'BUKLOD_MASS_LOGIN_RATE_LIMIT_GUARD_R22', 'Local 429 cooldown');
requireText('src/lib/buklodAuthResilience.ts', 'BUKLOD_CANONICAL_LOGIN_RESOLVER_R23', 'Canonical auth resolver');
requireText('src/lib/buklodAuthResilience.ts', "'buklod-auth-login-v2'", 'Server-side login resolver');
requireText('src/lib/buklodAuthResilience.ts', 'canonicalIdentifierSignInInFlight', 'Canonical login single-flight');
requireText('src/lib/buklodAuthResilience.ts', 'isBuklodRateLimitError', 'Explicit Auth rate-limit detection');
forbidText('src/app/(auth)/login.tsx', 'function mobileInternalEmail(', 'No guessed mobile auth email in Login');
forbidText('src/app/(auth)/login.tsx', 'function legacyMobileInternalEmail(', 'No legacy guessed mobile auth email in Login');
forbidText('src/app/(auth)/login.tsx', 'function usernameInternalEmail(', 'No guessed username auth email in Login');
forbidText('src/app/(auth)/login.tsx', '.signInWithPassword(', 'No direct password grant in Login UI');
requireText('src/app/(auth)/forgot-password.tsx', 'invokeRecovery', 'Recovery requests use one bounded function wrapper');
requireText('src/app/(auth)/forgot-password.tsx', 'withBuklodTimeout', 'Recovery requests cannot wait forever');
requireText('supabase/functions/account-recovery-otp-v1/index.ts', 'AbortSignal.timeout(RECOVERY_PROVIDER_TIMEOUT_MS)', 'Recovery delivery providers have bounded waits');
requireText('supabase/functions/buklod-auth-login-v2/index.ts', 'AbortSignal.timeout(12000)', 'Canonical login upstream request is bounded');
forbidText('supabase/functions/buklod-auth-login-v2/index.ts', 'central_auth_v4_success', 'No per-success auth logging at scale');
forbidText('supabase/functions/buklod-auth-login-v2/index.ts', 'central_auth_v4_invalid_credentials', 'No per-invalid-password auth logging at scale');
forbidText('supabase/functions/buklod-auth-login-v2/index.ts', 'central_auth_v4_no_candidate', 'No per-unknown-account auth logging at scale');

// Community Wall is the public root on both native and web.
requireText('src/app/index.tsx', 'href="/(tabs)/buklod"', 'Native root is Community Wall');
requireText('src/app/index.web.tsx', 'BUKLOD_FINAL_WEB_COMMUNITY_ROOT_R1', 'Web root lock marker');
requireText('src/app/index.web.tsx', 'href="/(tabs)/buklod"', 'Web root is Community Wall');
forbidText('src/app/index.web.tsx', 'href="/city"', 'City must not replace Community Wall root');

// Scoped workspace may never strand the user.
requireText('src/app/scope/index.tsx', '<Redirect href="/(tabs)/buklod" />', 'PUBLIC /scope converges on Wall');
requireText('src/app/scope/index.tsx', "router.replace('/(tabs)/buklod' as any)", 'No-history workspace exit converges on Wall');
requireText('src/app/scope/index.tsx', 'BUKLOD_SCOPED_EXIT_PUBLIC_FIRST_R2', 'Managed scope exit restores PUBLIC before history navigation');
requireText('src/lib/buklodScopeRoute.ts', "| '/buklod'", 'Scoped-exit helper accepts Community Wall destination');
forbidText('src/app/scope/index.tsx', 'Opening Public BUKLOD...', 'No infinite PUBLIC workspace loader');

// IGPAT and Profile exit safety.
requireText('src/components/BuklodNavSafeShell.tsx', 'Back to Community Wall', 'IGPAT has explicit Wall return');
requireText('src/components/BuklodNavSafeShell.tsx', "router.replace('/buklod' as any)", 'IGPAT Wall return is route-authoritative');
requireText('src/components/BuklodNavSafeShell.tsx', 'BUKLOD_ROOT_BACK_TO_WALL_R1', 'Android core direct-entry back converges on Wall');

// IGPAT / Community Wall parity consolidated from the pending web + Android targeted updates.
requireText('src/components/BuklodCommunityIgpatPreview.web.tsx', 'contentFit="contain"', 'Web Community IGPAT preview preserves source aspect');
requireText('src/components/BuklodCommunityIgpatPreview.web.tsx', '/igpat?post=', 'Web Community IGPAT preview opens exact video');
requireText('src/components/BuklodCommunityIgpatPreview.android.tsx', 'contentFit="contain"', 'Android Community IGPAT preview preserves source aspect');
requireText('src/components/BuklodCommunityInlineAd.android.tsx', 'BuklodCommunityIgpatPreview', 'Android Community inline slot can render IGPAT preview');
requireText('src/hooks/useBuklodCommunityAdViewability.ts', 'useBuklodCommunityInlineVisibility', 'Off-screen IGPAT playback uses true visibility');
requireText('src/app/igpat/[postId].android.tsx', 'contentFit="contain"', 'Android focused IGPAT preserves source aspect');
requireText('src/app/igpat/index.web.tsx', 'postId', 'Web IGPAT supports exact post targeting');
requireText('src/app/igpat/index.tsx', 'get_buklod_igpat_feed_v4', 'Native IGPAT uses bounded cursor feed');
requireText('src/app/igpat/index.web.tsx', 'get_buklod_igpat_feed_v4', 'Web IGPAT uses bounded cursor feed');
requireText('src/app/igpat/index.tsx', 'onEndReachedThreshold={0.7}', 'Native IGPAT progressive pagination');
requireText('src/app/igpat/index.web.tsx', 'onEndReachedThreshold={0.7}', 'Web IGPAT progressive pagination');
requireText('src/app/igpat/index.tsx', 'withBuklodTimeout', 'Native IGPAT bounded remote waits');
requireText('src/app/igpat/index.web.tsx', 'withBuklodTimeout', 'Web IGPAT bounded remote waits');
requireText('supabase/migrations/20260919173848_igpat_cursor_pagination_scale_r18.sql', 'community_posts_igpat_live_created_idx', 'IGPAT scale index migration tracked');
requireText('supabase/migrations/20260919173848_igpat_cursor_pagination_scale_r18.sql', 'get_buklod_igpat_feed_v4', 'IGPAT v4 cursor RPC migration tracked');
requireText('src/app/account/security.tsx', 'Current Password', 'Change Password requires current-password verification');
requireText('src/app/account/security.tsx', "router.canGoBack()", 'Password & Recovery has safe back');
requireText('src/app/account/recovery-pin.tsx', "router.canGoBack()", 'Recovery PIN has safe back');

// Existing performance hardening must remain present.
requireText('src/lib/buklodPerformanceFetch.ts', 'simultaneous identical GET /auth/v1/user checks', 'Auth request dedupe');
requireText('src/lib/buklodR4RequestShield.ts', 'BUKLOD_MASS_CONCURRENCY_R32', 'Mass concurrency request shield');
requireText('src/app/(tabs)/buklod.tsx', 'BUKLOD_ROOT_PERFORMANCE_R3_COMMUNITY_REALTIME', 'Community realtime performance lock');
requireText('src/app/(tabs)/buklod.tsx', 'PERF_EMERGENCY_R2_STALE_LOAD', 'Community stale-load protection');

// Community AI must fail/recover instead of holding UI indefinitely.
requireText('src/lib/buklodCommunityAi.ts', 'withBuklodTimeout', 'Community AI client waits are bounded');
requireText('src/lib/buklodCommunityAnonymousMedia.ts', 'withBuklodTimeout', 'Community anonymous-media AI wait is bounded');
requireText('supabase/functions/buklod-community-ai/index.ts', 'AbortSignal.timeout(GEMINI_TIMEOUT_MS)', 'Community AI provider waits are bounded');

// Main production identity.
requireText('app.config.js', "'23dad7d0-389a-406e-8dec-08965dab85d8'", 'Main EAS project identity');
requireText('app.config.js', "'org.mzbministry.buklod'", 'Main Android package identity');
requireText('app.config.js', "version: '1.3.0'", 'Main app version');
requireText('app.config.js', 'versionCode: isStaging ? undefined : 20', 'Main Android versionCode');
requireText('.buklod/app-boundaries.json', '"appId": "buklod-main"', 'Main app boundary');

// Migration sanity: never use stale hard-coded expected counts.
const migrationDir = path.join(root, 'supabase', 'migrations');
if (!fs.existsSync(migrationDir)) {
  failures.push('Missing supabase/migrations');
} else {
  const files = fs.readdirSync(migrationDir).filter(f => /^\d{14}_.+\.sql$/.test(f)).sort();
  const versions = files.map(f => f.slice(0, 14));
  const duplicates = versions.filter((v, i) => versions.indexOf(v) !== i);
  if (files.length === 0) failures.push('No migration files found');
  if (duplicates.length) failures.push(`Duplicate migration versions: ${[...new Set(duplicates)].join(', ')}`);
  const unsorted = files.some((f, i) => i > 0 && f < files[i - 1]);
  if (unsorted) failures.push('Migration filenames are not deterministic');
  checks.push({ label: `Migration sanity (${files.length} files)`, ok: files.length > 0 && duplicates.length === 0 && !unsorted });
}

// Final release must not mutate source while building.
if (fs.existsSync(path.join(root, '.github/workflows/buklod_main_final_release.yml'))) {
  forbidText('.github/workflows/buklod_main_final_release.yml', 'patch-', 'Final workflow never runs patch scripts');
  forbidText('.github/workflows/buklod_main_final_release.yml', 'git apply', 'Final workflow never mutates RC source');
}

for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}: ${c.label}`);
}
if (failures.length) {
  console.error('\nBUKLOD MAIN FINAL RELEASE GATE FAILED');
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log('\nBUKLOD MAIN FINAL RELEASE GATE PASS');
