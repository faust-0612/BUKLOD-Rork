import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const read = path => fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const menu=read('src/components/BuklodNavigationSideMenu.tsx');
const header=read('src/app/(tabs)/_layout.tsx');
const baseline='6b0f7e3167867bb746e34da4637430f131b588bb';

test('navigation side menu is a real accessible modal and never replaces the private file Drawer',()=>{
  assert.match(menu, /<Modal visible=\{visible\} transparent/);
  assert.match(menu, /onRequestClose=\{onClose\}/);
  assert.match(menu, /accessibilityLabel="Close navigation menu"/);
  for (const [label,route] of [['Home','/hub'],['Wall & Marites','/buklod'],
    ['Cluster','/clusters'],['Connect','/messages'],['Profile','/me'],
    ['Notifications','/notifications'],['My Drawer','/drawer'],['Settings','/settings'],
    ['Help & Support','/settings/navigation-help'],['About BUKLOD','/about-buklod']]) {
    assert.ok(menu.includes("label: '"+label+"'") && menu.includes("route: '"+route+"'"),label);
  }
  assert.doesNotMatch(menu,/igpat/i);
  assert.match(menu,/minHeight: 54/);
  assert.match(menu,/allowFontScaling/);
  assert.match(header,/import BuklodNavigationSideMenu from/);
  assert.match(header,/accessibilityLabel="Open navigation menu"/);
  assert.match(header,/<BuklodNavigationSideMenu visible=\{navigationMenuOpen\}/);
  assert.ok(read('src/app/drawer/index.tsx').includes('initializeSmartDrawerStore'));
});

test('navigation menu preserves global organization/cluster scope isolation',()=>{
  assert.match(menu,/activeScope\?\.scope_type === 'ORGANIZATION'/);
  assert.match(menu,/activeScope\?\.scope_type === 'CLUSTER'/);
  assert.match(menu,/scopes\.find\(scope => scope\.scope_type === 'PUBLIC'\)/);
  assert.match(menu,/await selectScope\(publicScope\.scope_id\)/);
  assert.match(menu,/if \(busy\.current\) return/);
  assert.match(menu,/buklodInstantNavigate\(item\.route/);
});

test('preview navigation is a change to existing authenticated header, not a duplicate shell',()=>{
  assert.match(header,/publicMinimal \? '#0B2048' : theme\.headerSurface/);
  assert.match(header,/accessibilityLabel="Find a BUKLOD feature"/);
  assert.match(header,/router\.navigate\('\/hub'/);
  assert.match(header,/accessibilityLabel="Open navigation menu"/);
  const oldShell=execFileSync('git',['show',baseline+':src/components/BuklodNavSafeShell.tsx'],{encoding:'utf8'});
  assert.equal(read('src/components/BuklodNavSafeShell.tsx'),oldShell);
  const oldBottom=execFileSync('git',['show',baseline+':src/components/BuklodPersistentBottomNav.tsx'],{encoding:'utf8'});
  assert.equal(read('src/components/BuklodPersistentBottomNav.tsx'),oldBottom);
});
