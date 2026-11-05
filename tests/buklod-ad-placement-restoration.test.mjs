import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const sponsor = read('src/components/BuklodHeaderSponsor.tsx');
const tabs = read('src/app/(tabs)/_layout.tsx');
const scoped = read('src/components/BuklodScopedDashboardHeader.tsx');
const sharedBanner = read('src/components/BuklodScopedHeaderBanner.tsx');
const androidBanner = read('src/components/BuklodScopedHeaderBanner.android.tsx');
const webBanner = read('src/components/BuklodScopedHeaderBanner.web.tsx');

assert.doesNotMatch(sponsor, /Platform\.OS === ['"]android['"]\s*\)\s*\{\s*return null/);
assert.match(sponsor, /BuklodPaidHeaderAd/);
assert.match(sponsor, /BuklodHeaderSponsorLegacy/);
for (const placement of ['messages', 'prayer', 'me']) {
  assert.match(tabs, new RegExp(`placement = ['"]${placement}['"]`));
}
assert.match(scoped, /BuklodScopedHeaderBanner/);
assert.match(scoped, /section !== 'connect'/);
for (const source of [sharedBanner, androidBanner, webBanner]) {
  assert.match(source, /BuklodAdMobBanner/);
  assert.match(source, /BuklodPaidHeaderAd/);
  assert.match(source, /requireViewport/);
}
console.log('BUKLOD ad placement restoration source tests passed.');
