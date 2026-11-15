import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Home stays dense and removes personal and Health Center launchers', () => {
  const home=read('src/components/home/BuklodHomeUtilityCards.tsx');
  const family=read('src/app/profile/buklod-family.tsx');
  const health=read('src/app/profile/buklod-health.tsx');
  assert.ok(home.includes("Children's Story World") && home.includes('minHeight: 88'));
  assert.ok(!home.includes('My BUKLOD Home') && !home.includes('Online Consultation'));
  assert.ok(family.includes("router.push('/personal-home'"));
  assert.ok(health.includes('Online Consultation') && health.includes('Full Health Center'));
});
test('Profile Quick Actions are all visible without offscreen carousel and preserve direct routes', () => {
  const s = read('src/app/(tabs)/me.tsx');
  const start = s.indexOf('function ProfileQuickActionsStrip(');
  const end = s.indexOf('function roleLabel(', start);
  const strip = s.slice(start,end);
  assert.match(strip, /<View style=\{styles\.quickRow\}>/);
  assert.doesNotMatch(strip, /<ScrollView|horizontal=\{true\}|snapToInterval/);
  assert.match(strip, /allowFontScaling style=\{styles\.quickLabel\}/);
  assert.match(strip, /style=\{\{ width: tileWidth, maxWidth: 180 \}\}/);
  assert.match(s, /quickRow:\s*\{[\s\S]*?flexWrap: 'wrap'/);
  assert.match(s, /label: 'Live Support'/);
  assert.match(s, /label: 'Attendance QR'/);
  assert.match(s, /label: 'Organization'/);
});
