import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Genesis starts on canonical Home after existing account gates',()=>{
 const boot=read('src/app/index.tsx');
 assert.match(boot,/isGenesisPreviewBuild\(\) \? '\/\(tabs\)\/hub'/);
 for(const gate of ['if (!session)','maintenance_mode','update_required','pilot_access_required','requiresAcceptance','if (!bootReady)']) assert.ok(boot.lastIndexOf(gate)<boot.lastIndexOf('href={isGenesisPreviewBuild()')&&boot.includes(gate),gate);
 assert.match(read('src/app/(auth)/login.tsx'),/isGenesisPreviewBuild\(\) \? '\/\(tabs\)\/hub'/);
});
test('Retired routes redirect without mounting game or map UI',()=>{
 for(const p of ['src/app/buklod-map.tsx','src/app/games/_layout.tsx']){
  const s=read(p);assert.match(s,/<Redirect href="\/\(tabs\)\/hub"/);assert.doesNotMatch(s,/\bSlot\b|\bStack\b|require\(|features\/games/);
 }
});
test('Home, menu, finder and shell have no retired shortcuts; Home ads remain',()=>{
 const home=read('src/app/(tabs)/hub.tsx');assert.doesNotMatch(home,/onExplore=|['"]\/games/);assert.ok(home.includes('new_home_first_view'));assert.ok(home.includes('hub_mid_native'));
 for(const p of ['src/components/BuklodNavigationSideMenu.tsx','src/lib/buklodNavigationV2.ts','src/components/BuklodFeatureFinder.tsx']) assert.doesNotMatch(read(p),/BUKLOD Kingdom|'kingdom'|['"]\/games/);
 const shell=read('src/components/BuklodNavSafeShell.tsx');assert.doesNotMatch(shell,/worldReturnEligible|Return to BUKLOD Map|['"]\/buklod-map/);assert.ok(shell.includes('<BuklodPersistentBottomNav />'));assert.ok(shell.includes('<BuklodFocusAppAdStrip />'));
});
