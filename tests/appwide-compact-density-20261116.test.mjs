import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = p => readFileSync(new URL('../'+p, import.meta.url),'utf8');

test('app-wide spacing tokens are compact without shrinking touch controls',()=>{
  const c=read('src/lib/buklodVisual.ts');
  assert.match(c,/space:\s*\{ screen: 12, section: 8, card: 10, inline: 8, tight: 4 \}/);
  assert.match(c,/touch:\s*48/);
  assert.match(read('src/lib/buklodThemePresentation.ts'),/paddingHorizontal:\s*buklodVisual\.space\.card/);
});
test('Connect and Wall leave room for notes and genuine ads',()=>{
  const connect=read('src/app/(tabs)/messages.tsx');
  const quick=read('src/components/connect/ConnectQuickContacts.tsx');
  const wall=read('src/app/(tabs)/buklod.tsx');
  const avatar=read('src/components/BuklodCommunityWallProfileBubbles.tsx');
  assert.match(connect,/searchDock:\s*\{[\s\S]{0,220}marginTop:\s*4/);
  assert.match(quick,/NOTE_LINE_HEIGHT\s*\*\s*NOTE_MAX_LINES\s*\+\s*12/);
  assert.match(avatar,/noteZone:\s*\{[\s\S]{0,80}height:\s*100/);
  assert.ok(connect.includes('BuklodFirstViewAd'));
  assert.ok(wall.includes('BuklodAdMobBanner'));
});
test('Daily Bible keeps scroll clearance and text size while reducing card gaps',()=>{
  const daily=read('src/app/bible/index.tsx');
  const reader=read('src/app/bible/read.tsx');
  assert.match(daily,/content:\s*\{paddingBottom:40,gap:8\}/);
  assert.match(daily,/readBibleButton:\s*\{[\s\S]{0,75}minHeight:72/);
  assert.match(reader,/readingHeader:\s*\{[\s\S]{0,170}paddingBottom:\s*8/);
  assert.ok(reader.includes('paddingBottom: readerScrollBottom'));
});
test('Profile, Cluster, Character and QMP retain compact content layout',()=>{
  assert.match(read('src/components/BuklodReferralInviteCard.tsx'),/padding: 10,\s*gap: 6/);
  assert.match(read('src/app/clusters/index.tsx'),/directorySection:\s*\{ gap: 5 \}/);
  assert.match(read('scripts/character-release-contract.mjs'), /a298732870bef208ec6bb13500ff804d7d723d48/);
  assert.match(read('src/app/community-contribution.tsx'),/content:\{padding:12,paddingBottom:80,gap:8\}/);
});
