import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
test('settings gear is outside hideable Profile sections, with distinct existing overflow', () => {
  const me = read('src/app/(tabs)/me.tsx');
  const permanent = me.indexOf('BUKLOD_NAV_V2_PERMANENT_SETTINGS');
  const menu = me.indexOf('accessibilityLabel="Profile options"', permanent);
  const ordered = me.indexOf('orderedSections.map');
  assert.ok(permanent > 0 && menu > permanent && ordered > permanent);
  assert.match(me, /accessibilityLabel="Settings"/);
  assert.match(me, /router\.push\('\/settings' as any\)/);
  assert.match(me, /profileSettingsBtn:\s*\{\s*right: 64\s*\}/);
});
test('native and desktop Home get lightweight offline finder, and route is explicit', () => {
  const hub = read('src/app/(tabs)/hub.tsx');
  const root = read('src/app/_layout.tsx');
  const settings = read('src/app/settings/index.tsx');
  assert.ok((hub.match(/<BuklodFeatureFinder\s*\/>/g) ?? []).length >= 2);
  assert.match(root, /<Stack\.Screen name="settings\/index"\s*\/>/);
  assert.match(settings, /minHeight: 58/);
  assert.match(settings, /allowFontScaling/);
  assert.match(settings, /account\/security/);
  assert.match(settings, /settings\/sounds/);
});
