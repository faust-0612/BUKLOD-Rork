import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Home utilities no longer force giant square cards while remaining content-resizable', () => {
  const s = read('src/components/home/BuklodHomeUtilityCards.tsx');
  assert.match(s, /width: '48\.5%', minHeight: 180, flexGrow: 1/);
  assert.doesNotMatch(s, /aspectRatio: 1, minHeight: 216/);
  assert.match(s, /borderRadius: 14, borderWidth: 1/);
  assert.match(s, /router\.push\('\/personal-home' as any\)/);
  assert.match(s, /router\.push\('\/profile\/buklod-health' as any\)/);
});
test('Profile Quick Actions are all visible without offscreen carousel and preserve direct routes', () => {
  const s = read('src/app/(tabs)/me.tsx');
  const start = s.indexOf('function ProfileQuickActionsStrip(');
  const end = s.indexOf('function roleLabel(', start);
  const strip = s.slice(start,end);
  assert.match(strip, /<View style=\{styles\.quickRow\}>/);
  assert.doesNotMatch(strip, /horizontal|snapToInterval|ScrollView/);
  assert.match(strip, /allowFontScaling style=\{styles\.quickLabel\}/);
  assert.match(strip, /style=\{\{ width: tileWidth, maxWidth: 180 \}\}/);
  assert.match(s, /quickRow:\s*\{[\s\S]*?flexWrap: 'wrap'/);
  assert.match(s, /label: 'Live Support'/);
  assert.match(s, /label: 'Attendance QR'/);
  assert.match(s, /label: 'Organization'/);
});
