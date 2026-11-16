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
  ['src/components/connect/ConnectQuickContacts.tsx', /NOTE_LINE_HEIGHT\s*\*\s*NOTE_MAX_LINES\s*\+\s*12/],
  ['src/components/BuklodCommunityWallProfileBubbles.tsx', /noteZone:\s*\{[\s\S]{0,70}height:\s*100\b/],
  ['src/app/clusters/index.tsx', /directorySection:\s*\{\s*gap:\s*5\s*\}/],
  ['src/app/bible/read.tsx', /readingHeader:\s*\{[\s\S]{0,170}paddingBottom:\s*8\b/],
  // Character selector is a SHA-locked R31/R40 visual. Its independent visual gate preserves this baseline.
  ['src/app/community-contribution.tsx', /content:\s*\{padding:12,paddingBottom:80,gap:8\}/],
];
for (const [file, pattern] of rules) assert.match(read(file), pattern, 'Compact spacing regression: ' + file);
for (const [file, keyword] of [
  ['src/app/(tabs)/messages.tsx','BuklodFirstViewAd'],
  ['src/app/(tabs)/buklod.tsx','BuklodAdMobBanner'],
  ['src/app/bible/read.tsx','paddingBottom: 50'],
]) assert.ok(read(file).includes(keyword), 'Critical ad or scroll clearance was removed: ' + file);
console.log('Compact layout source contract PASS (physical-device and OTA verification are separate).');
