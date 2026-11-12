import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const manifest = JSON.parse(read('.buklod/scopes/nov12-full-conso-wall-20261112.json'));
const about = read('src/app/about-buklod.tsx');
const presenter = read('src/app/about-buklod-present.tsx');
const content = read('src/lib/aboutBuklodContent.ts');

test('scope contains only public About and presenter routes plus contracts', () => {
  assert.equal(manifest.contractVersion, 2);
  assert.equal(manifest.componentScopePaths.aboutBuklod.length, 5);
  assert(manifest.allowedPaths.includes('src/app/about-buklod.tsx'));
  assert(manifest.allowedPaths.includes('src/app/about-buklod-present.tsx'));
  assert.equal(manifest.physicalDeviceVerification, 'OWNER WAIVED / SKIPPED');
  assert.match(manifest.releaseState, /NOT PUBLISHED/);
});

test('portrait reused, route actionable, copy and share functional path present', () => {
  assert.match(about, /privacy-consent-developer\.jpg/);
  assert.match(about, /router\.push\('\/about-buklod-present'/);
  assert.match(presenter, /getBuklodPitch\(selected\)/);
  assert.match(presenter, /Clipboard\.setStringAsync/);
  assert.match(presenter, /Share\.share/);
  assert.match(presenter, /Linking\.openURL\(SITE_URL\)/);
  assert.match(presenter, /accessibilityRole="button"/);
});

test('six audience presentations and truthful community purpose disclosed', () => {
  for (const key of ['church','faith','school','organization','business','public']) {
    assert.match(content, new RegExp("key: '" + key + "'"));
  }
  assert.match(content, /Christian roots/);
  assert.match(content, /Walang garantisadong kita/);
  assert.match(content, /hiwalay sa commercial transaction/);
  assert.match(content, /https:\/\/buklod\.expo\.app/);
  assert.doesNotMatch(content, /magkunwari|dayain ang|itinago ang ating relihiyon/i);
});

test('existing core product, backend, money, privacy untouched by source allowlist', () => {
  const forbidden = /^(supabase\/|src\/providers\/|src\/components\/BuklodAdMob|src\/lib\/buklodGlobalAdController|src\/app\/\(tabs\)\/|src\/app\/\(auth\)\/|app\.config|package\.json|\.github\/workflows\/)/;
  for (const path of manifest.componentScopePaths.aboutBuklod) assert.doesNotMatch(path, forbidden);
});
