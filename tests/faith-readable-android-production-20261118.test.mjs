import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(p, 'utf8');
const marker = JSON.parse(read('.buklod/releases/faith-readable-android-production-20261118.json'));

test('production release marker pins the previously reviewed non-Season2 contrast correction', () => {
  assert.equal(marker.exactReviewedMainBase, 'd074a9d853719eb0468cfbe7df4c18bd0a7a3e61');
  assert.equal(marker.reviewedPullRequest, 949);
  assert.equal(marker.reviewedFixHead, '54ada4f705525b539aace52e1ba4f1382c40d8e8');
  assert.equal(marker.season2ProductionAuthorized, false);
  assert.equal(marker.physicalAndroidDeviceCheck, 'OWNER_WAIVED_NOT_PASSED');
  assert.equal(marker.status, 'REQUESTED_NOT_PUBLISHED');
});

test('production OTA must require frozen hash-matched RC, served manifest and prepublish AdMob checks', () => {
  const w = read('.github/workflows/production_android_ota.yml');
  const rc = read('scripts/android-ota-rc.cjs');
  assert.match(w, /node scripts\/android-ota-rc\.cjs freeze/);
  assert.match(w, /node scripts\/android-ota-rc\.cjs verify/);
  assert.match(w, /node scripts\/android-ota-rc\.cjs published/);
  assert.match(w, /node --test tests\/production-ota-ads-regression\.test\.mjs/);
  assert.match(w, /node scripts\/buklod-season2-production-embargo\.cjs --production/);
  assert.match(rc, /Served bundle differs from frozen RC/);
  assert.match(rc, /Production advanced while building RC/);
});

test('release marker cannot import Season 2 or change app native dependencies', () => {
  assert.equal(marker.target.runtimeVersion, '1.3.2');
  assert.equal(marker.target.package, 'org.mzbministry.buklod');
  assert.equal(marker.target.channel, 'production');
  assert.equal(marker.authorizedScope.length, 8);
  const material = read('src/components/education/ReadableFaithSurface.tsx');
  assert.match(material, /backgroundColor:\s*colors\.white/);
  assert.match(material, /color:\s*colors\.muted/);
});
