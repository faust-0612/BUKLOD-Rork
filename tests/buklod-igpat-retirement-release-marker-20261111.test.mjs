import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = file => readFileSync(file, 'utf8');
const marker = JSON.parse(read('.buklod/scopes/nov11-igpat-retirement-production-marker.json'));

test('Production marker only promotes verified compiled Main RC source', () => {
  assert.equal(marker.baseRef, 'd670b1177c87d7aa1a8eabf1d47a59c024ebf2db');
  assert.equal(marker.sourceMergeSha, marker.baseRef);
  assert.equal(marker.rc.sha, 'b01ac0511010a07fe2e5751d4398b44286f8390c');
  assert.equal(marker.rc.checksPassed, 4);
  assert.equal(marker.rc.androidFiles, 263);
  assert.equal(marker.rc.webFiles, 254);
  assert.deepEqual(marker.allowedPaths, [
    '.buklod/scopes/nov11-igpat-retirement-production-marker.json',
    'tests/buklod-igpat-retirement-release-marker-20261111.test.mjs',
  ]);
});

test('Android OTA and Expo Web production publishing are review-marker only', () => {
  const android = read('.github/workflows/production_android_ota.yml');
  const web = read('.github/workflows/production_web_deploy.yml');
  assert.equal(marker.releasePrefix, 'BUKLOD_CONSOLIDATED_PROD_20261108');
  assert.ok(android.includes("startsWith(github.event.head_commit.message, 'BUKLOD_CONSOLIDATED_PROD_20261108')"));
  assert.ok(web.includes("startsWith(github.event.head_commit.message, 'BUKLOD_CONSOLIDATED_PROD_20261108')"));
  assert.match(android, /--channel production --platform android/);
  assert.match(android, /node scripts\/android-ota-rc\.cjs verify/);
  assert.match(android, /node scripts\/android-ota-rc\.cjs published/);
  assert.match(web, /eas-cli@latest deploy --prod --export-dir dist/);
  assert.equal(marker.target.runtimeVersion, '1.3.2');
  assert.equal(marker.target.androidVersionCode, 30);
  assert.equal(marker.target.androidPackage, 'org.mzbministry.buklod');
  assert.equal(marker.target.easProjectId, '23dad7d0-389a-406e-8dec-08965dab85d8');
  assert.match(read('app.config.js'), /runtimeVersion: isClassroom \? '1\.3\.0' : '1\.3\.2'/);
});

test('IGPAT is retired but Marites, Wall and Kingdom content remains in the release source', () => {
  assert.match(read('src/app/igpat/index.tsx'), /export default function RetiredIgpatRoute/);
  assert.match(read('src/app/igpat/create.tsx'), /export default function RetiredIgpatRoute/);
  assert.match(read('src/app/igpat/index.web.tsx'), /export default function RetiredIgpatRoute/);
  assert.match(read('src/app/igpat/create.web.tsx'), /export default function RetiredIgpatRoute/);
  assert.doesNotMatch(read('src/components/BuklodWallQuickLinks.tsx'), /IGPAT|\/igpat/);
  assert.match(read('supabase/migrations/20261111151816_retire_igpat_preserve_history_v1.sql'), /trg_buklod_retired_igpat_write/);
  for (const file of [
    'src/components/BuklodMaritesBoard.tsx',
    'src/components/BuklodMaritesStoryAudio.tsx',
    'src/features/games/trudice/PlaygroundPathGameV2.tsx',
    'src/features/games/kingdom/BuklodKingdomMapPremium.tsx',
    'src/lib/buklodCanonicalAdminEconomy.ts',
    'src/app/personal-home/ptt.web.tsx',
  ]) assert.ok(existsSync(file), file);
});
