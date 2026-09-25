import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const failures = [];
const passes = [];

function read(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    failures.push(`Missing Main APK surface: ${rel}`);
    return '';
  }
  return fs.readFileSync(full, 'utf8');
}

function requireAll(rel, needles, label = rel) {
  const text = read(rel);
  let ok = true;

  for (const needle of needles) {
    if (!text.includes(needle)) {
      failures.push(`${label} missing: ${needle}`);
      ok = false;
    }
  }

  if (ok) passes.push(label);
  return text;
}

function requireFile(rel, label = rel) {
  const text = read(rel);
  if (text) passes.push(label);
  return text;
}

function forbid(rel, needles, label = rel) {
  const text = read(rel);
  let ok = true;

  for (const needle of needles) {
    if (text.includes(needle)) {
      failures.push(`${label} forbidden marker present: ${needle}`);
      ok = false;
    }
  }

  if (ok) passes.push(`${label} regression exclusions`);
}

console.log('BUKLOD MAIN APK COMPLETENESS CONTRACT R1');
console.log('========================================');

// ---------------------------------------------------------------------
// CANONICAL ROOT + COMMUNITY WALL
// ---------------------------------------------------------------------
requireAll('src/app/(tabs)/buklod.tsx', [
  'SmartDrawerWallCard',
  'BuklodPublicLocationChips',
  'BuklodMaritesBoard',
  'BuklodCommunityContributionCard',
], 'Community Wall integrated surfaces');

requireAll('src/components/SmartDrawerWallCard.tsx', [
  'initializeSmartDrawerStore',
  'getSmartDrawerSummary',
], 'Smart Drawer');

requireAll('src/components/BuklodMaritesBoard.tsx', [
  'BuklodMaritesBoard',
], 'Marites');

requireAll('src/components/BuklodCommunityContributionCard.tsx', [
  'BUKLOD_COMMUNITY_CONTRIBUTION_CARD_R1',
  'loadMyCommunityContribution',
], 'Community Fund / contribution');

requireAll('src/components/BuklodPublicLocationChips.tsx', [
  "import BuklodLifeEntryCard from '@/components/BuklodLifeEntryCard';",
  '<BuklodLifeEntryCard />',
  '<BuklodCommunityHelp />',
], 'Wall LIFE + SOS first-view integration');

// ---------------------------------------------------------------------
// LIFE — MAIN MISSION FEATURE
// ---------------------------------------------------------------------
requireAll('src/components/BuklodLifeEntryCard.tsx', [
  'LIFE',
  'Hope • Purpose • Direction',
  'Answers for the moments that matter.',
  "router.push('/life'",
  "router.push('/life?mode=help'",
], 'LIFE Community Wall entry');

requireAll('src/app/_layout.tsx', [
  '<Stack.Screen name="life/index" />',
  '<BuklodMainHealthAgent />',
], 'Main root route + Self-Heal agent');

requireAll('src/lib/buklodLifeContent.ts', [
  'LIFE_GOSPEL_CORE_2026_09_V1',
  'LIFE_SOUL_WINNER_GUIDE_2026_09_V1',
  'LIFE_BRIDGES_2026_09_V1',
  'LIFE_SCRIPTURE_PACK_2026_09_V1',
  'You were made with meaning.',
  'Sin separates us from God.',
  'Jesus Christ came into the world',
  "Salvation is God's gift.",
  'repent and place faith in Jesus Christ',
  'Following Christ is not merely joining a religion.',
  'LIFE_SOUL_WINNER_GUIDE',
  'LIFE_CRISIS_COPY',
], 'Versioned LIFE curated content');

requireAll('src/app/life/index.tsx', [
  'What do you need today?',
  'Hope • Purpose • Direction',
  'QUESTIONS WORTH ASKING',
  'EXPLORE JESUS',
  'HELP SOMEONE',
  'Not Now',
  "You're offline. Core LIFE content is still available.",
  "router.replace('/buklod'",
  'Continue Your Journey',
  'AsyncStorage',
  'trackBuklodLifeEvent',
  'LIFE does not publish this response',
  'label you SAVED / UNSAVED / CONVERTED',
], 'LIFE E2E / privacy / offline / resume');

requireAll('src/lib/buklodLifeTelemetry.ts', [
  'BUKLOD_LIFE_PRIVACY_SAFE_TELEMETRY_R1',
  'life_opened',
  'life_topic_opened',
  'life_question_opened',
  'life_explore_jesus_started',
  'life_gospel_step_viewed',
  'life_help_someone_opened',
  'life_ai_fallback_used',
  'life_content_error',
  'life_language_selected',
  'life_gospel_path_completed',
  "feature: 'LIFE'",
], 'LIFE privacy-safe operational telemetry');

forbid('src/app/life/index.tsx', [
  'user_saved = true',
  'souls won leaderboard',
  'conversion points',
  'cash rewards for profession of faith',
], 'LIFE no conversion gamification');

// ---------------------------------------------------------------------
// SELF-HEAL / OPERATIONAL SAFETY
// ---------------------------------------------------------------------
requireAll('src/components/BuklodMainHealthAgent.tsx', [
  'enqueueBuklodMainHealthIssue',
  'pollBuklodMainRecoveryCommands',
  'verifyBuklodMainRecovery',
], 'Main Self-Heal agent');

requireAll('src/lib/buklodMainHealth.ts', [
  'BUKLOD_MAIN',
  'privateContentFields',
  "'NOT_SUPPORTED'",
], 'Main Self-Heal privacy contract');

// ---------------------------------------------------------------------
// PROFILE / BACK / CONNECT
// ---------------------------------------------------------------------
requireAll('src/app/(tabs)/me.tsx', [
  'BuklodReferralInviteCard',
  'BuklodFoundationWorkspaceNav',
  'BUKLOD_PROFILE_NATIVE_BACK_TO_WALL_R4',
  "router.push('/organizations'",
], 'Profile / Referral / Focus Apps');

requireAll('src/components/BuklodNavSafeShell.tsx', [
  "normalized === '/buklod'",
  "router.replace('/buklod'",
  'return true',
], 'Native Community/Profile Back safety');

requireAll('src/components/BuklodNavSafeShell.web.tsx', [
  'BUKLOD_WEB_TERMINAL_BACK_GUARD_R4',
  '__BUKLOD_WEB_TERMINAL_GUARD_R4__',
], 'Web Community/Profile Back safety');

requireAll('src/app/connect/index.tsx', [
  '<Redirect href="/messages" />',
], 'Connect canonical entry');

requireFile('src/app/(tabs)/messages.tsx', 'Connect messages');
requireFile('src/components/BuklodConnectThread.tsx', 'Connect thread');

// ---------------------------------------------------------------------
// SOS / CALLS / NATIVE SAFETY
// ---------------------------------------------------------------------
requireAll('src/components/BuklodCommunityHelp.tsx', [
  'Emergency SOS',
  'Confirm Emergency SOS',
  'HOLD TO SEND SOS',
  'requestForegroundPermissionsAsync',
  'BUKLOD_SOS_QUICK_SETTINGS_R1',
], 'Community Help / Emergency SOS');

requireAll('plugins/withBuklodSosQuickSettings.js', [
  'BuklodSosTileService',
  'android.permission.BIND_QUICK_SETTINGS_TILE',
  'android.service.quicksettings.action.QS_TILE',
  'buklod://buklod?sos=1',
], 'Android SOS Quick Settings tile');

// ---------------------------------------------------------------------
// ORGANIZATION / SUB-ORG / REPORTING
// ---------------------------------------------------------------------
requireFile('src/app/organizations/index.tsx', 'Organization hub');
requireAll('src/app/organizations/suborganizations.tsx', [
  'Sub-Organization',
], 'Sub-Organization management');
requireFile(
  'src/app/scope/faith-monitoring/report.tsx',
  'Formation / faith monitoring report',
);

// ---------------------------------------------------------------------
// FOCUS APPS — CLASSROOM / QUIZ / QUICKCHECK
// ---------------------------------------------------------------------
requireAll('src/app/profile/buklod-classroom.tsx', [
  'openBuklodQuizFromMain',
  'buklod_classroom_context_v1',
], 'BUKLOD Classroom');

requireAll('src/components/BuklodFoundationWorkspaceNav.tsx', [
  'BUKLOD_FOCUS_APP_CATALOG',
  'openBuklodQuizFromMain',
  'quickcheck-handoff-mint',
  'Quick Check',
  'Quiz',
  'Classroom',
], 'Focus Apps / Quiz / QuickCheck handoffs');

requireAll('src/lib/buklodQuizEntry.ts', [
  'BUKLOD_QUIZ_UNIFIED_MAIN_ENTRY_R21',
  'openBuklodQuizFromMain',
], 'Quiz SSO Main handoff');

// ---------------------------------------------------------------------
// BIBLE / FORMATION / POINTS / CHARACTER
// ---------------------------------------------------------------------
requireFile('src/app/bible/index.tsx', 'Bible');
requireAll('src/app/learn/[id].tsx', [
  'formation',
], 'Formation lessons');
requireFile('src/app/points/index.tsx', 'Points canonical entry');

requireAll('package.json', [
  '"character:contract"',
  '"native:contract"',
  '"sos:contract"',
], 'Character/native protected release scripts');

// ---------------------------------------------------------------------
// ECONOMY / BAYANIHAN / REFERRAL
// ---------------------------------------------------------------------
requireFile('src/app/bayanihan/index.tsx', 'Bayanihan portal');
requireAll('src/lib/buklodR38Economy.ts', [
  'direct_referral',
  'bayanihan',
], 'Economy / revenue-share contract');

requireAll('src/components/BuklodReferralInviteCard.tsx', [
  'loadBuklodReferralSummaryV2',
  'recordBuklodReferralFunnel',
], 'Referral');

// ---------------------------------------------------------------------
// AUTH / RECOVERY / NOTIFICATIONS
// ---------------------------------------------------------------------
requireFile('src/app/(auth)/login.tsx', 'Login');
requireFile('src/app/account/recovery-pin.tsx', 'Recovery PIN');
requireAll('src/providers/NotificationProvider.tsx', [
  'registerPushToken',
  'resolveBuklodNotificationTarget',
  'getLastNotificationResponse',
], 'Notification exact/cold-start routing');

// ---------------------------------------------------------------------
// ADS / VIDEO / MAP
// ---------------------------------------------------------------------
requireAll('src/lib/buklodAds.ts', [
  'react-native-google-mobile-ads',
], 'AdMob native integration');

requireAll('src/lib/buklodCommunityPostMedia.ts', [
  'get_buklod_post_media_v2',
], 'Community media v2');
forbid(
  'src/lib/buklodCommunityPostMedia.ts',
  ['get_buklod_post_media_v1'],
  'Community media helper',
);

requireAll('src/components/BuklodNativeCommunityMapHeader.native.tsx', [
  'PROVIDER_GOOGLE',
  'showsTraffic',
  'showsPointsOfInterests',
  'google.navigation:q=',
], 'Native Google map/navigation');

requireAll('src/components/BuklodLiveSatelliteMap.web.tsx', [
  'Street / Navigation',
  'poi-label-marker',
  'renderNearbyPlaces',
], 'Web canonical map/navigation');

// ---------------------------------------------------------------------
// EXCLUDED LEGACY SURFACES MUST STAY EXCLUDED
// ---------------------------------------------------------------------
requireAll('src/components/BuklodMainExcludedSurfaceRedirect.tsx', [
  'HOME, KINGDOM and IGPAT are outside this BUKLOD MAIN release.',
  '<Redirect href="/" />',
], 'Main excluded legacy surfaces');

if (failures.length) {
  console.error('');
  for (const failure of failures) {
    console.error(`FAIL: ${failure}`);
  }
  console.error('');
  console.error(
    `MAIN APK COMPLETENESS FAILED with ${failures.length} blocker(s).`,
  );
  console.error('DO NOT BUILD FINAL APK.');
  process.exit(1);
}

console.log('');
for (const pass of passes) {
  console.log(`PASS: ${pass}`);
}
console.log('');
console.log(
  'MAIN APK COMPLETENESS PASSED — protected BUKLOD Main surfaces are present in this RC.',
);
