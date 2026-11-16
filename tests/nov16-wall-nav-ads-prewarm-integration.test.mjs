import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const block = (src, key) => src.match(new RegExp(key+':\\s*\\{([\\s\\S]*?)\\n\\s*\\},'))?.[1] ?? '';

test('Wall and Connect compact Notes coexist with real AdMob navigation prewarming', () => {
 const wall=read('src/components/BuklodCommunityWallProfileBubbles.tsx');
 const connect=read('src/components/connect/ConnectQuickContacts.tsx');
 for(const src of [wall, connect]) {
  const zone=block(src,'noteZone');
  assert.match(zone,/minHeight:\s*44/);
  assert.doesNotMatch(zone,/^\s*height\s*:/m);
 }
 assert.match(block(wall,'row'),/alignItems:\s*'flex-end'/);
 assert.match(block(connect,'scroll'),/alignItems:\s*'flex-end'/);
 const nav=read('src/app/(tabs)/_layout.tsx');
 const ad=read('src/components/BuklodCommunityInlineAd.android.tsx');
 const warm=read('src/components/BuklodDashboardAdWarmup.android.tsx');
 assert.match(nav,/<BuklodDashboardAdWarmup \/>/);
 assert.match(warm,/MAX_WARM_CREATIVES = 2/);
 assert.match(warm,/isBuklodPassiveAdAllowed/);
 assert.match(ad,/takeBuklodDashboardAdPreload/);
 assert.match(ad,/NativeAdEventType\.IMPRESSION/);
});
test('Combined Android staging release preserves artifact provenance and never targets production', () => {
 const workflow=read('.github/workflows/buklod-nov16-compact-art-staging-release.yml');
 for(const s of ['const sourceRC=','const notesRC=','const adsRC=','Require exactly one reviewed combined PR','Approved prewarm source mismatch']) {
  assert.ok(workflow.includes(s),s);
 }
 assert.match(workflow,/update --channel staging-user --platform android/);
 assert.doesNotMatch(workflow,/update --channel production/);
});
