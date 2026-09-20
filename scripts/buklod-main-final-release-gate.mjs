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


const packageJson = JSON.parse(read('package.json'));
const expectedTestToolchain = 'npm install --no-save --package-lock=false --ignore-scripts --no-audit --no-fund jest@29.7.0 jest-expo@57.0.4 @react-native/jest-preset@0.86.2 @testing-library/react-native@13.3.3 react-test-renderer@19.2.3 && jest --runInBand';
const testToolchainOk = packageJson?.scripts?.test === expectedTestToolchain;
checks.push({ label: 'Pinned Windows-safe Jest toolchain', ok: testToolchainOk });
if (!testToolchainOk) failures.push('Pinned Windows-safe Jest toolchain: package.json test script drifted.');
forbidText('package.json', '--experimental-vm-modules', 'No VM-module-only Jest runner');
requireText('jest.setup.ts', "import '@testing-library/react-native';", 'RNTL built-in matcher bootstrap');
forbidText('jest.setup.ts', '@testing-library/react-native/extend-expect', 'No removed RNTL extend-expect subpath');
requireText('jest.setup.ts', '@react-native-async-storage/async-storage/jest/async-storage-mock', 'AsyncStorage Jest native mock');
requireText('jest.setup.ts', 'EXPO_PUBLIC_SUPABASE_URL', 'Supabase Jest environment');

console.log('BUKLOD MAIN FINAL RELEASE GATE R1');
console.log('=================================');

// Canonical auth + mass-login resilience.
requireText('src/app/(auth)/login.tsx', 'signInWithCanonicalIdentifierResilient', 'Canonical identifier login');
requireText('src/app/(auth)/login.tsx', 'BUKLOD_MASS_LOGIN_RATE_LIMIT_GUARD_R22', 'Local 429 cooldown');
requireText('src/lib/buklodAuthResilience.ts', 'BUKLOD_CANONICAL_LOGIN_RESOLVER_R23', 'Canonical auth resolver');
requireText('src/lib/buklodAuthResilience.ts', "'buklod-auth-login-v2'", 'Server-side login resolver');
requireText('src/lib/buklodAuthResilience.ts', 'canonicalIdentifierSignInInFlight', 'Canonical login single-flight');
requireText('src/lib/buklodAuthResilience.ts', 'isBuklodRateLimitError', 'Explicit Auth rate-limit detection');
requireText('supabase/migrations/20260919182307_auth_login_indexed_resolver_scale_r24.sql', 'idx_profiles_active_login_identifier_value', 'Mass-login resolver has indexed login identifier path');
requireText('supabase/migrations/20260919182307_auth_login_indexed_resolver_scale_r24.sql', 'buklod_auth_candidates_for_service_v2', 'Canonical auth resolver migration is source-tracked');
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

// Final BUKLOD Main scope containment: Home, Kingdom and IGPAT stay excluded.
requireText(
  'src/components/BuklodMainExcludedSurfaceRedirect.tsx',
  '<Redirect href="/" />',
  'Excluded Main surfaces recover through canonical root',
);
for (const rel of [
  'src/app/igpat/index.tsx',
  'src/app/igpat/create.tsx',
  'src/app/reels/index.tsx',
  'src/app/games/index.tsx',
  'src/app/personal-home/index.tsx',
]) {
  requireText(
    rel,
    "BuklodMainExcludedSurfaceRedirect",
    `Excluded route locked: ${rel}`,
  );
}
forbidText(
  'src/components/BuklodFoundationWorkspaceNav.tsx',
  "router.push('/games'",
  'Kingdom launcher removed from Main Profile',
);
forbidText(
  'src/components/BuklodCommunityMapNav.tsx',
  "route: '/personal-home'",
  'Home launcher removed from Main Community map',
);
forbidText(
  'src/app/(tabs)/buklod.tsx',
  '/igpat',
  'IGPAT launcher removed from Main Community Wall',
);
forbidText(
  'src/components/BuklodCommunityInlineAd.android.tsx',
  'BuklodCommunityIgpatPreview',
  'IGPAT preview removed from Android Community ads',
);
forbidText(
  'src/components/BuklodCommunityInlineAd.web.tsx',
  'BuklodCommunityIgpatPreview',
  'IGPAT preview removed from web Community ads',
);

// Central ad safety and test/live-ID separation are release-critical.
requireText(
  'src/lib/buklodGlobalAdController.ts',
  'reserveBuklodFullScreenAd',
  'Central full-screen ad reservation guard',
);
requireText(
  'src/lib/buklodGlobalAdController.ts',
  'fullScreenShownThisSession < INTERSTITIAL_SESSION_CAP',
  'Full-screen ads use centralized session cap',
);
requireText(
  'src/lib/buklodAdMonetizationPolicy.shared.ts',
  'EXPO_PUBLIC_ADS_SESSION_INTERSTITIAL_CAP,\n  3,\n  0,\n  3,',
  'Full-screen ads capped at three per session',
);
requireText(
  'src/lib/buklodGlobalAdController.ts',
  'SENSITIVE_PREFIXES',
  'Sensitive-route ad exclusion',
);
requireText(
  'src/components/BuklodAdSafetyRouteBridge.tsx',
  "AppState.addEventListener('change'",
  'Foreground/background ad safety',
);
requireText(
  'src/components/BuklodAdSafetyRouteBridge.tsx',
  'setBuklodAdRemoteFeatures',
  'Remote ad feature switches',
);
requireText(
  'src/lib/buklodAdUnits.ts',
  'EXPO_PUBLIC_ADS_ALLOW_LIVE_IDS',
  'Live ad IDs require explicit production opt-in',
);
requireText(
  'src/components/BuklodCommunityInlineAd.android.tsx',
  "placementId: 'community_wall_feed'",
  'Community ad has stable placement attribution',
);
requireText(
  'src/components/BuklodNavSafeShell.tsx',
  'BUKLOD_ROOT_BACK_TO_WALL_R1',
  'Android core direct-entry back converges on Wall',
);
requireText('src/app/account/security.tsx', 'Current Password', 'Change Password requires current-password verification');
requireText('src/app/account/security.tsx', "router.canGoBack()", 'Password & Recovery has safe back');
requireText('src/app/account/recovery-pin.tsx', "router.canGoBack()", 'Recovery PIN has safe back');


// Web AdSense is a separate, web-only monetization path.
requireText(
  'src/components/BuklodWebAdSenseProvider.web.tsx',
  "google-adsense-account",
  'AdSense site verification metadata support',
);
requireText(
  'src/components/BuklodWebAdSenseProvider.web.tsx',
  'EXPO_PUBLIC_ADSENSE_SITE_APPROVED',
  'AdSense live script requires explicit site approval',
);
requireText(
  'src/components/BuklodWebAdSenseProvider.web.tsx',
  'EXPO_PUBLIC_ADS_ALLOW_LIVE_IDS',
  'AdSense live traffic requires explicit production opt-in',
);
forbidText(
  'src/components/BuklodWebAdSenseProvider.tsx',
  'pagead2.googlesyndication.com',
  'Native provider never loads AdSense script',
);
requireText(
  'src/app/(tabs)/_layout.tsx',
  "google-side-rail-overlap",
  'Desktop center content protected from AdSense side-rail overlap',
);
requireText(
  'scripts/write-adsense-dist-assets.mjs',
  'f08c47fec0942fa0',
  'AdSense ads.txt publisher record generator',
);


// AI Daily Engagement: one shared cached batch/day, never per-render generation.
requireText(
  'src/lib/buklodDailyEngagement.ts',
  'claim_buklod_today_generation_v1',
  'Daily AI uses atomic once-per-day generation claim',
);
requireText(
  'supabase/functions/buklod-community-daily-engagement/index.ts',
  'REAL_TRENDING_INPUTS',
  'Trending AI is grounded only in real activity inputs',
);
requireText(
  'supabase/functions/buklod-community-daily-engagement/index.ts',
  'Daily AI key unavailable',
  'Daily AI has explicit outage fallback path',
);
requireText(
  'src/components/BuklodTodayCard.tsx',
  'SAFE FALLBACK',
  'Wall daily layer exposes curated fallback without blocking',
);
requireText(
  'src/app/(tabs)/buklod.tsx',
  '<BuklodTodayCard',
  'BUKLOD TODAY is mounted in Community Wall',
);


// Targeted Community Wall visual/engagement upgrade must preserve locked features.
requireText(
  'src/components/BuklodPublicLocationChips.tsx',
  '<BuklodCommunityHelp />',
  'SOS remains mounted on Public Community Wall',
);
requireText(
  'src/components/BuklodMaritesBoard.web.tsx',
  '<BuklodCommunityConnectHeaderWeb />',
  'Web Connect Bubbles remain mounted',
);
requireText(
  'src/app/(tabs)/buklod.tsx',
  '<BuklodMaritesBoard',
  'Marites remains mounted',
);
requireText(
  'src/app/(tabs)/buklod.tsx',
  '<BuklodTodayCard',
  'Compact BUKLOD TODAY remains mounted',
);
requireText(
  'src/components/BuklodTodayCard.tsx',
  'activeIndex',
  'BUKLOD TODAY uses rotating single-card presentation',
);
requireText(
  'src/app/(tabs)/buklod.tsx',
  '<BuklodCommunityQuickActions',
  'Wall quick participation reuses existing composer',
);
requireText(
  'src/components/BuklodCommunityWallEngagementLayer.tsx',
  'Habang Wala Ka',
  'Wall real unread return card installed',
);
requireText(
  'src/components/BuklodCommunityWallEngagementLayer.tsx',
  "from('notifications')",
  'Habang Wala Ka uses real notifications',
);
requireText(
  'src/components/BuklodCommunityWallEngagementLayer.tsx',
  "from('group_members')",
  'Samahang uses real membership data',
);
requireText(
  'src/components/BuklodCommunityInlineAd.web.tsx',
  'placementId="community_wall_feed"',
  'Web Community feed ad has stable attribution ID',
);
forbidText(
  'src/app/(tabs)/buklod.tsx',
  'BuklodCommunitySponsoredAd',
  'No above-the-fold sponsored card before real feed content',
);



// Canonical finance V3 is active release scope.
requireText(
  'supabase/migrations/20260920140000_buklod_main_profit_first_referral_v2.sql',
  'user_pool_bps integer not null default 3000',
  '30% User Revenue Pool is centrally versioned',
);
requireText(
  'supabase/migrations/20260920140000_buklod_main_profit_first_referral_v2.sql',
  'one_time_referral_centavos bigint not null default 2000',
  'Referral one-time ₱20 uses integer centavos',
);
requireText(
  'supabase/migrations/20260920140000_buklod_main_profit_first_referral_v2.sql',
  'referred_qualification_centavos bigint not null default 4000',
  'Referred qualification threshold is centrally versioned',
);
requireText(
  'supabase/migrations/20260920140000_buklod_main_profit_first_referral_v2.sql',
  'no_referrer_qualification_centavos bigint not null default 6000',
  'No-referrer qualification threshold is centrally versioned',
);
requireText(
  'supabase/migrations/20260920140000_buklod_main_profit_first_referral_v2.sql',
  'first_line_bps integer not null default 1000',
  'First-line 10% share is centrally versioned',
);
requireText(
  'supabase/migrations/20260920140000_buklod_main_profit_first_referral_v2.sql',
  'cluster_fund_bps integer not null default 500',
  'Cluster Community Fund 5% is centrally versioned',
);
requireText(
  'supabase/migrations/20260920140000_buklod_main_profit_first_referral_v2.sql',
  'organization_fund_bps integer not null default 700',
  'Organization Community Fund 7% is centrally versioned',
);
requireText(
  'supabase/migrations/20260920140000_buklod_main_profit_first_referral_v2.sql',
  'idx_buklod_pf_one_active_community_destination',
  'One active Community Contribution Destination is database-enforced',
);
requireText(
  'supabase/migrations/20260920140000_buklod_main_profit_first_referral_v2.sql',
  'unique(signal_type,signal_hash)',
  'Durable identity signals prevent lifetime reward reset',
);
requireText(
  'src/lib/buklodReferralV2.ts',
  'attachPendingBuklodReferral',
  'Interrupted referral attribution retries after sign-in',
);
requireText(
  'src/app/+native-intent.ts',
  'captureBuklodReferralCodeFromPath',
  'Installed-app referral deep link preserves attribution',
);


// Profit-First payout reuses hardened payout snapshots with person-linked cash.
requireText(
  'supabase/migrations/20260920143000_buklod_main_profit_first_payout_v2.sql',
  "source_pool='PROFIT_FIRST_V3'",
  'Canonical payout queue is explicitly isolated',
);
requireText(
  'supabase/migrations/20260920143000_buklod_main_profit_first_payout_v2.sql',
  'idx_buklod_pf_withdrawal_person_request',
  'Withdrawal idempotency survives account recreation',
);
requireText(
  'src/lib/buklodR38Economy.ts',
  "'request_my_buklod_pf_withdrawal_v2'",
  'User payout requests use durable Profit-First reserve path',
);
requireText(
  'src/lib/buklodR38AdminEconomy.ts',
  "'admin_mark_buklod_pf_withdrawal_paid_v2'",
  'Admin payout completion consumes durable reserved cash',
);
requireText(
  'src/app/(auth)/register.tsx',
  'Referral not found',
  'Invalid referral is explicitly rejected',
);
requireText(
  'src/components/BuklodReferralInviteCard.tsx',
  '₱20 PENDING',
  'Referral dashboard separates pending reward',
);


// Daily AI remains under explicit human admin control.
requireText(
  'src/app/admin/daily-engagement.tsx',
  'BUKLOD Today AI Control',
  'Admin can preview and control daily engagement AI',
);
requireText(
  'src/app/admin/daily-engagement.tsx',
  'REGENERATE TODAY',
  'Admin can regenerate today content',
);
requireText(
  'src/app/admin/daily-engagement.tsx',
  'Schedule manual card',
  'Admin can schedule manual daily content',
);
requireText(
  'supabase/migrations/20260920123000_buklod_main_ai_daily_engagement_r1.sql',
  "generation_frequency in ('DAILY','WEEKDAYS','MANUAL')",
  'Daily AI generation frequency is configurable',
);


// Canonical user Economy + one-guide + app-wide i18n release locks.
requireText(
  'src/lib/buklodEconomyV3.ts',
  'get_my_buklod_financial_summary_v3',
  'User economy reads canonical backend summary only',
);
requireText(
  'src/app/bayanihan/index.tsx',
  'loadMyBuklodFinancialSummaryV3',
  'Active Bayanihan screen uses canonical V3 economy',
);
forbidText(
  'src/app/bayanihan/index.tsx',
  'Qualified BCU',
  'Active user economy no longer displays legacy BCU',
);
forbidText(
  'src/app/bayanihan/index.tsx',
  'Qualified RCU',
  'Active user economy no longer displays legacy RCU',
);
requireText(
  'src/app/bayanihan/guide.tsx',
  "t('economy.guide.stickySummary')",
  'Single Economy & Bayanihan guide has sticky live-summary entry',
);
requireText(
  'src/app/bayanihan/guide.tsx',
  "router.push('/preferences/language'",
  'Economy guide opens global language selector',
);
requireText(
  'src/providers/BuklodI18nProvider.tsx',
  "currency: 'PHP'",
  'Language changes never silently convert PHP balances',
);
requireText(
  'src/i18n/catalog.ts',
  'productionReady: true',
  'Language selector is production-pack gated',
);
requireText(
  'src/app/(tabs)/me.tsx',
  "router.push('/bayanihan/guide'",
  'Economy guide is discoverable from Profile',
);
requireText(
  'src/app/(auth)/login.tsx',
  "router.push('/preferences/language'",
  'Language is accessible before authentication',
);

// Existing performance hardening must remain present.
requireText('src/lib/buklodPerformanceFetch.ts', 'simultaneous identical GET /auth/v1/user checks', 'Auth request dedupe');
requireText('src/lib/buklodR4RequestShield.ts', 'BUKLOD_MASS_CONCURRENCY_R32', 'Mass concurrency request shield');
requireText('src/app/(tabs)/buklod.tsx', 'BUKLOD_ROOT_PERFORMANCE_R3_COMMUNITY_REALTIME', 'Community realtime performance lock');
requireText('src/app/(tabs)/buklod.tsx', 'PERF_EMERGENCY_R2_STALE_LOAD', 'Community stale-load protection');
requireText('src/app/(tabs)/buklod.tsx', 'BUKLOD_WALL_REMOTE_GUARD_R4', 'Wall remote actions normalize transport failures');
requireText('src/app/(tabs)/buklod.tsx', 'communityReadRpc', 'Wall interactive reads are time-bounded');
requireText('src/app/(tabs)/me.tsx', "'Profile Circle Rank'", 'Profile rank read is time-bounded');
requireText('src/app/(tabs)/me.tsx', "'Profile background'", 'Profile background read is time-bounded');
requireText('src/lib/buklodRewards.ts', 'BUKLOD_POINTS_AUTHORITATIVE_BALANCE_R4', 'Points UI preserves lifetime vs available accounting');
requireText('src/lib/buklodRewards.ts', 'pointsReadRpc', 'Points dashboard reads are time-bounded');
requireText('src/components/points/BuklodProfileCharacterCard.tsx', "'Profile Points leaderboard'", 'Profile Points leaderboard is time-bounded');
requireText('src/lib/buklodPointsRedemption.ts', 'BUKLOD_BAYANIHAN_ACCOUNTING_VIEW_R4', 'Bayanihan redemption view preserves accounting invariants');
requireText('src/lib/buklodPointsRedemption.ts', 'redemptionReadRpc', 'Bayanihan/redemption reads are time-bounded');

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
