import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Profile cover gear removed; personal overflow and central Settings route preserved', () => {
  const me = read('src/app/(tabs)/me.tsx');
  const menu = read('src/components/BuklodNavigationSideMenu.tsx');
  assert.doesNotMatch(me, /BUKLOD_NAV_V2_PERMANENT_SETTINGS/);
  assert.doesNotMatch(me, /profileSettingsBtn/);
  assert.match(me, /accessibilityLabel="Profile options"/);
  assert.match(me, /setProfileMenuOpen\(true\)/);
  assert.match(menu, /label: 'Settings'.*route: '\/settings'/);
  assert.match(read('src/app/settings/index.tsx'), /account\/security/);
});

test('Home retains meaningful widgets, removes duplicate feature finder, shortcuts and navigation cards', () => {
  const hub = read('src/app/(tabs)/hub.tsx');
  const header = read('src/app/(tabs)/_layout.tsx');
  const root = read('src/app/_layout.tsx');
  const search = read('src/app/feature-search.tsx');
  assert.doesNotMatch(hub, /<BuklodFeatureFinder\s*\/>|<BuklodHomeDestinations\s*\/>/);
  assert.doesNotMatch(hub, /Return to Community Wall|<Text[^>]*>Quick Actions<\/Text>/);
  assert.match(hub, /<Contribution \//);
  assert.match(hub, /<BuklodFirstViewAd/);
  assert.match(hub, /<BuklodKingdomHubCard/);
  assert.match(header, /router\.push\('\/feature-search'/);
  assert.match(root, /<Stack\.Screen name="feature-search"\s*\/>/);
  assert.match(search, /<BuklodFeatureFinder autoFocus showSuggestions\s*\/>/);
  assert.match(search, /Redirect href="\/(auth)\/login"/); 
});
