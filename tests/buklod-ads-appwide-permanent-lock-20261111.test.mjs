import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { auditBuklodAdSurfaces } from '../scripts/buklod-ad-surface-audit.mjs';

const read = file => readFileSync(file, 'utf8');

function controller() {
  const source = read('src/lib/buklodGlobalAdController.ts');
  const noImports = source.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*/gm, '');
  const executable = stripTypeScriptTypes(noImports, { mode: 'strip' })
    .replace(/^export\s+(?=(?:async\s+)?function|const|let|class)/gm, '');
  return vm.runInNewContext(executable +
    '\n({setBuklodAdRoute,setBuklodAdRemoteFeatures,setBuklodAdForeground,isBuklodAdRouteSensitive,isBuklodPassiveAdAllowed,isBuklodRewardedAdAllowed,canWarmBuklodFullScreenAd,acquireBuklodAdSafetyLock})', {
    AsyncStorage: { getItem: async () => '0', setItem: async () => {} },
    Platform: { OS: 'android' },
    INTERSTITIAL_MIN_EVENT_COUNT: 2,
    AD_SLOT_REMOUNT_COOLDOWN_MS: 120000,
    Math, Number, String, Object, Date, Promise,
  });
}

test('Radio/PTT allow only their exact banner, not fullscreen or arbitrary placements', () => {
  const g = controller();
  for (const [route, banner] of [
    ['/personal-home/ptt', 'ptt_banner'],
    ['/personal-home/radio', 'dzas_radio_medium_rectangle'],
  ]) {
    g.setBuklodAdRoute(route);
    assert.equal(g.isBuklodAdRouteSensitive(), true, route);
    assert.equal(g.isBuklodPassiveAdAllowed({ placement: 'content', placementId: banner }), true);
    assert.equal(g.isBuklodPassiveAdAllowed({ placement: 'content', placementId: 'content_generic' }), false);
    assert.equal(g.isBuklodPassiveAdAllowed({ placement: 'community', placementId: banner }), false);
    assert.equal(g.canWarmBuklodFullScreenAd('interstitial_generic'), false);
    assert.equal(g.isBuklodRewardedAdAllowed(), false);
  }
});

test('Health Center allows its single screened information banner, never fullscreen', () => {
  const g = controller();
  g.setBuklodAdRoute('/profile/buklod-health');
  assert.equal(g.isBuklodAdRouteSensitive(), true);
  assert.equal(g.isBuklodPassiveAdAllowed({
    placement: 'focus', placementId: 'health_consultation_safe_info_banner',
  }), true);
  assert.equal(g.isBuklodPassiveAdAllowed({ placement: 'focus', placementId: 'focus_generic' }), false);
  assert.equal(g.canWarmBuklodFullScreenAd(), false);
  for (const route of ['/health', '/consultation', '/emergency', '/bsoc', '/support']) {
    g.setBuklodAdRoute(route);
    assert.equal(g.canWarmBuklodFullScreenAd(), false, route);
    assert.equal(g.isBuklodPassiveAdAllowed({ placement: 'content', placementId: 'content_generic' }), false, route);
  }
});

test('Remote shutoff, interaction lock and app foreground are never bypassed', () => {
  const g = controller();
  g.setBuklodAdRoute('/hub');
  assert.equal(g.isBuklodPassiveAdAllowed({ placementId: 'hub_mid_native', placement: 'content' }), true);
  const unlock = g.acquireBuklodAdSafetyLock('typing');
  assert.equal(g.isBuklodPassiveAdAllowed({ placementId: 'hub_mid_native', placement: 'content' }), false);
  assert.equal(g.canWarmBuklodFullScreenAd(), false);
  unlock();
  g.setBuklodAdRemoteFeatures({ ads_all: false });
  assert.equal(g.isBuklodPassiveAdAllowed({ placementId: 'hub_mid_native', placement: 'content' }), false);
  g.setBuklodAdRemoteFeatures({});
  g.setBuklodAdForeground(false);
  assert.equal(g.canWarmBuklodFullScreenAd(), false);
});

test('All approved high-traffic, game and points advertising surfaces remain in source', () => {
  const required = [
    ['src/app/(tabs)/hub.tsx', 'new_home_first_view', 'hub_mid_native'],
    ['src/app/(tabs)/me.tsx', 'profile_first_view', 'profile_mid_native'],
    ['src/app/(tabs)/messages.tsx', 'connect_community_inline_4', 'connect_personal_inline_4'],
    ['src/components/BuklodScopeHomeDashboard.tsx', 'organization_scope_home_mid_view', 'cluster_scope_home_mid_view'],
    ['src/components/BuklodClusterHomeCommandCenterImpl.tsx', 'cluster_command_mid_view'],
    ['src/app/games/index.tsx', 'kingdom_map_footer'],
    ['src/app/games/legacy.tsx', 'kingdom_legacy_native'],
    ['src/app/games/rewards.tsx', 'kingdom_treasury_native'],
    ['src/features/games/kingdom/platform/KingdomInteriorCenter.tsx', 'kingdom_game_center_completed'],
    ['src/app/points/progression.tsx', 'points_rank_progression_native'],
    ['src/app/points/economy.tsx', 'points_economy_footer'],
    ['src/components/points/BuklodPointsRewardsScreen.tsx', 'points_redeem_transition_native'],
    ['src/app/igpat/index.tsx', 'BuklodReelsInlineAd'],
  ];
  for (const [file, ...ids] of required) for (const id of ids) {
    assert.ok(read(file).includes(id), file + ' lost ' + id);
  }
});

test('Completed workflow monetization is registered but never credits points or cash', () => {
  const events = read('src/lib/buklodAdOpportunities.ts');
  for (const key of [
    'points_submission_success', 'points_claim_success', 'devotional_reflection_success',
    'kl_chapter_success', 'cluster_created_transition', 'organization_created_transition',
    'community_post_success', 'community_comment_overage', 'igpat_video_published',
    'kingdom_mastery_verified', 'kingdom_legacy_claim_success', 'kingdom_power_unlock_success',
    'character_studio_saved', 'profile_note_saved', 'mentoring_response_submitted',
    'bulletin_published_success', 'bible_chapter_success', 'formation_lesson_success',
  ]) assert.ok(events.includes(key + ':'), 'Lost natural break ' + key);
  assert.doesNotMatch(events, /awardPoints|claimBuklodReward|creditCash|insert\(/);
  const p = read('src/lib/buklodAdMonetizationPolicy.shared.ts');
  assert.match(p, /INTERSTITIAL_MIN_EVENT_COUNT = 2/);
  assert.match(p, /INTERSTITIAL_COOLDOWN_MS = 0/);
  assert.match(p, /INTERSTITIAL_SESSION_CAP = 0/);
  const c = read('src/lib/buklodGlobalAdController.ts');
  assert.match(c, /nextCount < Math\.max\(2, INTERSTITIAL_MIN_EVENT_COUNT\)/);
  assert.match(c, /fullScreenCadencePersistenceFailed/);
  assert.match(c, /fullScreenCadenceCheckInFlight/);
});

test('Android aggressive cadence is bounded; native inventory requires consent and viewport', () => {
  const p = read('src/lib/buklodAdMonetizationPolicy.android.ts');
  assert.match(p, /COMMUNITY_AD_MIN_LEADING =[\s\S]*?: 4;/);
  assert.match(p, /COMMUNITY_AD_INTERVAL_MIN =[\s\S]*?: 4;/);
  assert.match(p, /REELS_AD_MIN_LEADING =[\s\S]*?: 5;/);
  assert.match(p, /REELS_AD_INTERVAL_MIN =[\s\S]*?: 5;/);
  const native = read('src/components/BuklodCommunityInlineAd.android.tsx');
  assert.match(native, /useBuklodAdViewportGate/);
  assert.match(native, /NativeAdEventType\.IMPRESSION/);
  assert.match(native, /reserveBuklodPassiveAdRequest/);
  const reels = read('src/components/BuklodReelsInlineAd.tsx');
  assert.match(reels, /useAds\(\)/);
  assert.match(reels, /isBuklodPassiveAdAllowed/);
  assert.match(reels, /reserveBuklodPassiveAdRequest/);
  const units = read('src/lib/buklodAdUnits.ts');
  assert.match(units, /isStagingNativeIdentity/);
  assert.match(units, /isProductionNativeIdentity/);
});

test('All Main route files remain audited, including sensitive workflows and uncovered candidates', () => {
  const { summary, routes } = auditBuklodAdSurfaces();
  assert.ok(summary.routeFiles >= 350, 'App-wide source inventory unexpectedly shrank below 350');
  assert.ok(summary.withPressHandlers > 100);
  assert.ok(summary.restrictedOrSensitive > 0);
  assert.ok(summary.reviewVerifiedSuccessBreak > 0);
  for (const route of ['admin/index.tsx','profile/buklod-health.tsx','bayanihan/payout-profile.tsx']) {
    const row = routes.find(x => x.route === route);
    if (row) assert.equal(row.recommendation, 'NO_GENERIC_INTERSTITIAL', route);
  }
});

test('Mandatory ad contract runs in PR, compiled RC and production OTA checks', () => {
  const command = 'node --test tests/buklod-ads-appwide-permanent-lock-20261111.test.mjs';
  for (const file of [
    '.github/workflows/engineering-accountability.yml',
    '.github/workflows/unified_rc_compiled_qa_20261108.yml',
    '.github/workflows/production_android_ota.yml',
  ]) assert.ok(read(file).includes(command), file + ' missing ad lock');
  assert.match(read('.github/CODEOWNERS'), /@faust-0612/);
});

test('Sensitive live chat, quiz, financial and administrative workflows never admit generic ads', () => {
  const g = controller();
  for (const route of [
    '/connect/personal/thread-1', '/connect/community/org-1',
    '/mzb/connect/personal/thread-1', '/mzb/connect/community/org-1',
    '/faith/bible-quiz', '/prayer/new', '/giving/payment/123',
    '/bayanihan/withdrawals', '/scope/attendance/report',
    '/scope/faith-monitoring/members', '/organizations/manage',
    '/organizations/settings', '/clusters/manage', '/premium',
  ]) {
    g.setBuklodAdRoute(route);
    assert.equal(g.isBuklodAdRouteSensitive(), true, route);
    assert.equal(g.canWarmBuklodFullScreenAd('interstitial_generic'), false, route);
    assert.equal(g.isBuklodPassiveAdAllowed({ placement: 'content', placementId: 'content_generic' }), false, route);
  }
});

test('Community Discovery and Organization setup include viewable native-first sponsored inventory', () => {
  assert.match(read('src/app/community/discover.tsx'), /BuklodFirstViewAd placement="community_entry" placementId="community_discovery_first_view"/);
  assert.match(read('src/app/organizations/index.tsx'), /BuklodFirstViewAd placement="org" placementId="organization_setup_info_native"/);
  const native = read('src/components/BuklodFirstViewAd.android.tsx');
  assert.match(native, /BuklodCommunityInlineAd/);
  assert.match(native, /firstView/);
});

test('Post detail has native-first sponsored break after media outside author-only content and comments', () => {
  const detail = read('src/app/post/[id].tsx');
  assert.match(detail, /BuklodFirstViewAd placement="community_entry" placementId="community_post_detail_native"/);
  assert.match(detail, /!post\.author_only\s*\?/);
  assert.ok(detail.indexOf('community_post_detail_native') > detail.indexOf('<CommunityVideo'));
  assert.ok(detail.indexOf('community_post_detail_native') < detail.indexOf('COMMENTS ({comments.length})'));
});

test('Legacy Connect, funds, attendance and administrative deep links cannot trigger generic ads', () => {
  const g = controller();
  for(const route of [
    '/connect', '/connect/legacy-thread', '/mzb/connect',
    '/church/attendance/event-1','/profile/attendance-qr',
    '/organizations/events-attendance','/organizations/subscription',
    '/organizations/admins','/organizations/clusters-oversight',
    '/clusters/admins','/scope-fund','/scope-giving-settings',
    '/feedback','/contact-us','/reports','/office','/account/deactivate',
  ]){
    g.setBuklodAdRoute(route);
    assert.equal(g.isBuklodAdRouteSensitive(),true,route);
    assert.equal(g.canWarmBuklodFullScreenAd('interstitial_generic'),false,route);
  }
});

test('Public comment discussion offers one compact viewable sponsored banner after organic content',()=>{
 const thread=read('src/components/BuklodCommunityCommentThread.tsx');
 const wall=read('src/app/(tabs)/buklod.tsx');
 assert.match(thread,/inlineAd\?: React\.ReactNode/);
 assert.match(thread,/inlineAd && threadIndex === \(threads\.length === 1 \? 0 : 1\)/);
 assert.match(wall,/placementId="public_wall_comments_engagement_inline"/);
 assert.match(wall,/Platform\.OS === 'android' && !!commentPost && !commentPost\.author_only && !commentLoadError/);
 assert.match(wall,/format="adaptive"\s+compact\s+requireViewport\s+showLabel/);
});
test('Unknown fill blockers are classified without synthetic impressions or PII',()=>{
 const diagnostics=read('src/lib/buklodAdDiagnostics.ts');
 for(const name of ['NO_FILL','NATIVE_AD_LOAD_TIMEOUT','BANNER_AD_LOAD_TIMEOUT','NETWORK_ERROR']) assert.ok(diagnostics.includes(name));
 assert.match(diagnostics,/only fixed non-PII failure categories/);
});
