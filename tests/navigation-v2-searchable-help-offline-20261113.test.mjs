import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { BUKLOD_NAV_HELP, findBuklodNavigationHelp } from '../src/lib/buklodNavHelp.ts';
import { buklodNavHintStorageKey } from '../src/lib/buklodPinnedNavigation.ts';

const read = path => fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('offline indexed Help is five-tab canonical, no IGPAT or admin leaks', () => {
  const routes = BUKLOD_NAV_HELP.map(x => x.route);
  for(const route of ['/hub','/clusters','/buklod','/messages','/me']) assert.ok(routes.includes(route));
  assert.equal(new Set(BUKLOD_NAV_HELP.map(x=>x.id)).size,BUKLOD_NAV_HELP.length);
  assert.ok(BUKLOD_NAV_HELP.every(x => !/\/admin|igpat/i.test(x.route)));
  assert.ok(findBuklodNavigationHelp('walang internet').some(x=>x.id==='offline'));
  assert.ok(findBuklodNavigationHelp('GBoard').some(x=>x.id==='accessibility'));
  assert.ok(findBuklodNavigationHelp('3g').some(x=>x.id==='offline'));
  assert.deepEqual(findBuklodNavigationHelp(''),BUKLOD_NAV_HELP);
  assert.deepEqual(findBuklodNavigationHelp('zzzzunknown'),[]);
});
test('Help, first-use hint, local search and network recovery are independent of server access', () => {
  const help=read('src/app/settings/navigation-help.tsx');
  const finder=read('src/components/BuklodFeatureFinder.tsx');
  assert.match(help,/TextInput allowFontScaling/);
  assert.match(help,/findBuklodNavigationHelp\(query\)/);
  assert.match(help,/matches\.map/);
  assert.match(help,/minHeight: 48/);
  assert.match(finder,/NetInfo\.addEventListener/);
  assert.match(finder,/firstUseHint === 'show'/);
  assert.match(finder,/Dismiss feature finder tip/);
  assert.match(finder,/Offline right now/);
  assert.match(finder,/buklodNavHintStorageKey/);
  assert.match(finder,/findBuklodFeatures\(query\)/);
});
test('onboarding acknowledgement is account-scoped; reject invalid account identity', () => {
 const a=buklodNavHintStorageKey('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa');
 const b=buklodNavHintStorageKey('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb');
 assert.notEqual(a,b);
 assert.match(a,/hint\.v1:/);
 assert.throws(()=>buklodNavHintStorageKey('not-an-account'));
});
