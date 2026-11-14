import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const read = path => fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const menu=read('src/components/BuklodNavigationSideMenu.tsx');
const header=read('src/app/(tabs)/_layout.tsx');
const baseline='6b0f7e3167867bb746e34da4637430f131b588bb';

test('side menu contains only useful destinations absent from persistent top/bottom nav',()=>{
  assert.match(menu, /<Modal visible=\{visible\} transparent/);
  assert.match(menu, /onRequestClose=\{onClose\}/);
  assert.match(menu, /accessibilityLabel="Close navigation menu"/);
  const matches=[...menu.matchAll(/label: '([^']+)'[^\n]+route: '([^']+)'/g)];
  const values=matches.map(m=>({label:m[1],route:m[2]}));
  assert.equal(values.length,9);
  assert.equal(new Set(values.map(x=>x.route)).size,values.length);
  for (const [label,route] of [
    ['Bible & Reading','/bible'],['Community Contribution','/community-contribution'],
    ['BUKLOD Kingdom','/games'],['My Drawer','/drawer'],
    ['Health Center','/profile/buklod-health'],['Settings','/settings'],
    ['Live Support','/support/live'],['How to use BUKLOD','/settings/navigation-help'],
    ['About BUKLOD','/about-buklod']
  ]) assert.ok(values.some(x=>x.label===label && x.route===route),label);
  for (const route of ['/hub','/buklod','/clusters','/messages','/me','/notifications'])
    assert.ok(!values.some(x=>x.route===route),'duplicated navigation '+route);
  assert.doesNotMatch(menu,/igpat/i);
  assert.match(menu,/minHeight: 56/);
  assert.match(menu,/allowFontScaling/);
  assert.match(menu,/<StatusBar barStyle="light-content"/);
  assert.match(header,/import BuklodNavigationSideMenu from/);
  assert.match(header,/accessibilityLabel="Open navigation menu"/);
  assert.match(header,/<BuklodNavigationSideMenu visible=\{navigationMenuOpen\}/);
  assert.ok(read('src/app/drawer/index.tsx').includes('initializeSmartDrawerStore'));
});

test('side menu retains role-safe scope transition and navigation debounce',()=>{
  assert.match(menu,/activeScope\?\.scope_type === 'ORGANIZATION'/);
  assert.match(menu,/activeScope\?\.scope_type === 'CLUSTER'/);
  assert.match(menu,/scopes\.find\(scope => scope\.scope_type === 'PUBLIC'\)/);
  assert.match(menu,/await selectScope\(publicScope\.scope_id\)/);
  assert.match(menu,/if \(busy\.current\) return/);
  assert.match(menu,/router\.push\(item\.route/);
});

test('header search goes straight to an offline suggested search screen',()=>{
  const finder=read('src/components/BuklodFeatureFinder.tsx');
  const screen=read('src/app/feature-search.tsx');
  assert.match(header,/accessibilityLabel="Find a BUKLOD feature"/);
  assert.match(header,/router\.push\('\/feature-search'/);
  assert.doesNotMatch(header,/router\.navigate\('\/hub' as any\)/);
  assert.match(screen,/<BuklodFeatureFinder autoFocus showSuggestions \/>/);
  assert.match(finder,/autoFocus=\{autoFocus\}/);
  assert.match(finder,/SUGGESTED FEATURES/);
  assert.match(finder,/recentLinks\.length > 0/);
  assert.match(finder,/savedLinks\.length > 0/);
  const oldBottom=execFileSync('git',['show',baseline+':src/components/BuklodPersistentBottomNav.tsx'],{encoding:'utf8'});
  assert.equal(read('src/components/BuklodPersistentBottomNav.tsx'),oldBottom);
});
