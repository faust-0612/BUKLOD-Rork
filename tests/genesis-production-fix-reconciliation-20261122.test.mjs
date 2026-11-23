import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');

test('Production policy recovery and authentication authority remain enforced in Genesis', () => {
  const provider = read('src/providers/ComplianceProvider.tsx');
  assert.match(provider, /readRequiredPolicies/);
  assert.match(provider, /A timeout can happen AFTER the database committed/);
  assert.match(provider, /expectedUserId|user\.id/);
  const consent = read('src/app/privacy/consent.tsx');
  assert.match(consent, /accept|acknowledge/i);
});

test('Production first-view AdMob recovery retains real health and no forged impressions', () => {
  const ads = read('src/lib/buklodNativeAdRecovery.ts');
  assert.match(ads, /NATIVE_FAILURE_THRESHOLD/);
  assert.match(ads, /retryNativeAfter/);
  assert.match(ads, /does NOT manufacture impressions/);
});

test('Cluster attendance imports exact scope admin RPC and server receipt', () => {
  const page = read('src/app/clusters/home-checkin-review.tsx');
  assert.match(page, /buklod_cluster_can_review_home_checkin_v1/);
  assert.match(page, /Attendance review was not confirmed by the server/);
  assert.match(read('src/app/_layout.tsx'), /clusters\/home-checkin-review/);
});

test('Mentor-report carryover requires verified mentor capability and retains actionable feedback', () => {
  const mentor = read('src/app/faith/mentor-evidence.tsx');
  assert.match(mentor, /has_capability/);
  assert.match(mentor, /mentorEligible === true/);
  assert.match(mentor, /missingReportRequirements/);
  assert.match(mentor, /Review requirements to submit/);
  assert.match(mentor, /setRetrySessionId/);
});

test('PTT preferences and Genesis ambient audio focus are both preserved', () => {
  const runtime = read('src/ptt/buklodPttRuntime.ts');
  assert.match(runtime, /loadBuklodPttUserSettings/);
  assert.match(runtime, /saveBuklodPttUserSettings/);
  assert.match(runtime, /targetSwitchTail/);
  assert.match(runtime, /setBuklodPttVoiceActive/);
  assert.match(runtime, /clearNormalReceiving/);
});

test('Genesis retains safer admin notification UUID path than production', () => {
  const nav = read('src/lib/buklodNotificationNavigation.ts');
  assert.match(nav, /admin_new_user/);
  assert.match(nav, /admin\/new-users\?user_id=/);
  assert.match(nav, /\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}/i);
});

test('Silent OTA and Genesis native runtime hold are not overwritten by production 1.3.2', () => {
  const host = read('src/components/BuklodOtaFreshnessHost.native.tsx');
  assert.match(host, /expo-updates|Updates/);
  const marker = JSON.parse(read('.buklod/releases/genesis-all-updates-conso-20261122.json'));
  assert.equal(marker.releaseSafety.doNotPublishToExistingRuntime, true);
  assert.equal(marker.releaseSafety.newSignedStagingApkRequired, true);
  assert.equal(marker.releaseSafety.season2ProductionApkAabOtaProhibited, true);
});

test('Production-only release markers are never copied as Genesis publication receipts', () => {
  assert.throws(() => read('.buklod/releases/buklod-nonseason2-consent-prod-ota-20261122.json'));
  assert.throws(() => read('.buklod/releases/buklod-main-conso-ota-promotion-20261122.json'));
});
