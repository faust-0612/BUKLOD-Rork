import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const manifest = JSON.parse(readFileSync(new URL('../.buklod/releases/main-production-ota-intake-20261122.json', import.meta.url), 'utf8'));
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('production intake holds all publication and retains the installed native runtime', () => {
  assert.equal(manifest.productionAuthorizedByThisManifest, false);
  assert.equal(manifest.publishAllowed, false);
  assert.equal(manifest.otaPublished, false);
  assert.equal(manifest.prodDatabaseModified, false);
  assert.equal(manifest.nativeBuildChanged, false);
  assert.equal(manifest.productionTarget.androidPackage, 'org.mzbministry.buklod');
  assert.equal(manifest.productionTarget.channel, 'production');
  assert.equal(manifest.productionTarget.runtime, '1.3.2');
  assert.equal(manifest.lastVerifiedProductionEvidence.notReverifiedInThisIntake, true);
});

test('all collected source files are exact, unchanged copies of their reviewed DEV source blobs', () => {
  const expected = manifest.collectedCode.flatMap(item => [
    ...item.sourceFiles, ...(item.testFiles ?? []), ...(item.sqlMigration ? [item.sqlMigration] : []),
  ]);
  assert.deepEqual(new Set(expected), new Set(Object.keys(manifest.portedSourceBlobs)));
  assert.equal(new Set(expected).size, expected.length);
  for (const path of expected) {
    assert.doesNotThrow(() => read(path), 'Missing collected file: ' + path);
    const sha = execFileSync('git', ['hash-object', path], { encoding: 'utf8' }).trim();
    assert.equal(sha, manifest.portedSourceBlobs[path], 'Unexpected unreviewed source edit at ' + path);
  }
});

test('no Genesis/Season 2 assets or native build changes are carried into BUKLOD MAIN', () => {
  assert.equal(manifest.excludedFromProductionOTA.strictSeason2OwnerHold, true);
  assert.equal(manifest.excludedFromProductionOTA.noAutomaticReleaseOnDate, true);
  assert.ok(manifest.excludedFromProductionOTA.excludedRefs.includes(1074));
  assert.ok(manifest.excludedFromProductionOTA.excludedRefs.includes(1080));
  const changed = execFileSync('git', ['diff', '--name-only', 'main...HEAD'], { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
  assert.ok(changed.includes('.buklod/releases/main-production-ota-intake-20261122.json'));
  assert.ok(!changed.some(path => /^(?:assets\/|android\/|ios\/|app\.config\.|eas\.json$|src\/features\/games\/|src\/features\/.*genesis|src\/features\/.*arena)/i.test(path)),
    'Do not package Season 2 or native binary changes into the production OTA intake.');
});

test('all unmerged maintenance items are visible with explicit blockers or reconciliation tasks', () => {
  const expected = [951,994,940,833,935,932,998,958,1038,821];
  assert.deepEqual(new Set(manifest.pendingNonSeason2Candidates.map(x => x.pr)), new Set(expected));
  for (const candidate of manifest.pendingNonSeason2Candidates) {
    assert.ok(candidate.feature.length > 5);
    assert.ok(candidate.status.length > 5);
    assert.ok(candidate.blocker.length > 15);
  }
  assert.ok(manifest.releaseGates.some(x => /AdMob fill/i.test(x)));
  assert.ok(manifest.releaseGates.some(x => /independently verify live served artifact/i.test(x)));
  assert.ok(manifest.releaseGates.some(x => /isolated SQL\/RLS/i.test(x)));
  assert.ok(manifest.releaseGates.some(x => /Only announce a verified production OTA/i.test(x)));
});

test('mentoring permission, evidence and awarded BP cannot be bypassed by collected lesson UX', () => {
  const sql = read('supabase/migrations/20261122065000_mentor_full_published_catalog_v1.sql');
  const mentoring = read('src/app/faith/mentor-evidence.tsx');
  assert.match(sql, /public\.has_capability\(actor,'mentor'\)/);
  assert.match(mentoring, /report_my_mentor_teaching_with_details_r3/);
  assert.match(mentoring, /attach_my_mentor_session_photo_r2/);
  assert.match(mentoring, /mentorEligible !== true/);
  assert.ok(manifest.collectedCode.some(item => item.sourcePr === 1081 && item.status === 'COLLECTED_DEV_BACKEND_HOLD'));
});

test('background silent OTA source is collected without interactive reload or native rebuild', () => {
  assert.ok(manifest.collectedCode.some(item => item.sourcePr === 1005 &&
    item.status === 'COLLECTED_DEV_NO_PRODUCTION_AUTHORIZATION'));
  const host = read('src/components/BuklodOtaFreshnessHost.native.tsx');
  const policy = read('src/lib/buklodSilentOtaPolicy.ts');
  assert.match(host, /createSilentOtaDownloader/);
  assert.match(host, /return null;/);
  assert.doesNotMatch(host, /reloadAsync\s*\(/);
  assert.match(policy, /inFlight: Promise<boolean> \| null/);
  assert.match(policy, /pendingNextLaunch = true/);
  assert.match(policy, /failureCooldownMs/);
  assert.doesNotMatch(policy, /reloadAsync\s*\(/);
});
