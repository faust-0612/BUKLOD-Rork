#!/usr/bin/env node
// Static release contract. Does not replace device, app runtime or visual acceptance.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const read = path => readFileSync(resolve(process.cwd(), path), 'utf8');
const visual = read('src/lib/buklodVisual.ts');
const token = name => {
  const group = visual.match(/space:\s*\{([^}]*)\}/)?.[1] || '';
  const value = group.match(new RegExp('\\b' + name + ':\\s*(\\d+)\\b'))?.[1];
  assert.ok(value, 'Missing global space token: ' + name);
  return Number(value);
};
assert.ok(token('screen') <= 12);
assert.ok(token('section') <= 8);
assert.ok(token('card') <= 12);
assert.ok(token('tight') >= 4);
assert.match(visual, /touch:\s*(4[4-9]|[5-9]\d)/, 'Touch target under 44dp');
const rules = [
  ['src/lib/buklodThemePresentation.ts', /paddingHorizontal:\s*buklodVisual\.space\.card/],
  ['src/app/(tabs)/me.tsx', /sectionPad:\s*\{\s*paddingHorizontal:\s*buklodVisual\.space\.screen/],
  ['src/app/(tabs)/messages.tsx', /searchDock:\s*\{[\s\S]{0,220}marginTop:\s*4\b/],
  ['src/components/connect/ConnectQuickContacts.tsx', /noteZone:\s*\{[\s\S]{0,160}minHeight:\s*44\b/],
  ['src/components/BuklodCommunityWallProfileBubbles.tsx', /noteZone:\s*\{[\s\S]{0,180}minHeight:\s*44\b/],
  ['src/app/clusters/index.tsx', /directorySection:\s*\{\s*gap:\s*5\s*\}/],
  ['src/app/bible/read.tsx', /readingHeader:\s*\{[\s\S]{0,170}paddingBottom:\s*8\b/],
  // Character selector is a SHA-locked R31/R40 visual. Its independent visual gate preserves this baseline.
  ['src/app/community-contribution.tsx', /content:\s*\{padding:12,paddingBottom:80,gap:8\}/],
];
for (const [file, pattern] of rules) assert.match(read(file), pattern, 'Compact spacing regression: ' + file);
for (const file of ['src/components/connect/ConnectQuickContacts.tsx', 'src/components/BuklodCommunityWallProfileBubbles.tsx']) {
  const source = read(file);
  const zone = source.match(/noteZone:\s*\{([\s\S]*?)\n\s*\},/)?.[1] || '';
  assert.doesNotMatch(zone, /^\s*height\s*:/m, 'Do not reserve empty Notes height: ' + file);
  assert.match(source, /alignItems:\s*'flex-end'/, 'Avatar rail must bottom-align variable Notes: ' + file);
}
for (const [file, keyword] of [
  ['src/app/(tabs)/messages.tsx','BuklodFirstViewAd'],
  ['src/app/(tabs)/buklod.tsx','BuklodAdMobBanner'],
  ['src/app/bible/read.tsx','paddingBottom: 50'],
]) assert.ok(read(file).includes(keyword), 'Critical ad or scroll clearance was removed: ' + file);

const wallHeaderSource = read('src/app/(tabs)/buklod.tsx');
const wallHeaderStart = wallHeaderSource.indexOf('BUKLOD_WALL_TWO_COLUMN_HEADER_R3_20261117');
const wallHeaderEnd = wallHeaderSource.indexOf('<BuklodPostMotion preset=', wallHeaderStart);
assert.ok(wallHeaderStart >= 0 && wallHeaderEnd > wallHeaderStart, 'Wall post header regression: missing compact author layout');
const wallHeader = wallHeaderSource.slice(wallHeaderStart, wallHeaderEnd);
assert.match(wallHeader, /flexDirection:'row',alignItems:'flex-start',gap:8/, 'Wall author header must retain avatar and details columns');
assert.match(wallHeader, /flexDirection:'row',alignItems:'center',gap:6,marginTop:3,minWidth:0/, 'Wall timestamp must share its row with the actions');
assert.match(wallHeader, /style=\{\[s\.meta,\{flex:1,minWidth:0,marginTop:0\}\]\}/, 'Wall date must flex rather than push the Follow/Report controls below');
assert.match(wallHeader, /flexDirection:'row',alignItems:'center',gap:4,flexShrink:0/, 'Follow and Report must stay adjacent');
assert.match(wallHeader, /formatCompactWallDateTime\(item\.created_at\)/, 'Compact wall date lost');
assert.match(wallHeader, /numberOfLines=\{1\}/, 'Full author name must stay on one line');
assert.match(wallHeader, /openReport\('post', item\.id\)/, 'Post report action lost');
assert.match(wallHeader, /toggleAuthorFollow\(/, 'Follow action lost');
assert.ok(wallHeader.indexOf('formatCompactWallDateTime(item.created_at)') < wallHeader.indexOf('toggleAuthorFollow('), 'Follow should be placed beside the date, not in a separate header band');
assert.doesNotMatch(wallHeader, /justifyContent:'flex-end',alignItems:'center',marginTop:3,gap:6/, 'Do not restore the separate trailing action row');

console.log('Compact layout source contract PASS (physical-device and OTA verification are separate).');
