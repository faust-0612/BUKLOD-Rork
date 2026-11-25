import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Genesis starts on canonical Home after existing account gates',()=>{
 const boot=read('src/app/index.tsx');
 assert.match(boot,/if \(isGenesisPreviewBuild\(\)\) return <Redirect href="\/\(tabs\)\/hub"/);
 for(const gate of ['if (!session)','maintenance_mode','update_required','pilot_access_required','requiresAcceptance','if (!bootReady)']) assert.ok(boot.lastIndexOf(gate)<boot.lastIndexOf('if (isGenesisPreviewBuild()) return')&&boot.includes(gate),gate);
 assert.match(read('src/app/(auth)/login.tsx'),/isGenesisPreviewBuild\(\) \? '\/\(tabs\)\/hub'/);
});
test('Retired routes redirect without mounting game or map UI',()=>{
 for(const p of ['src/app/buklod-map.tsx']){
  const s=read(p);assert.match(s,/<Redirect href="\/\(tabs\)\/hub"/);assert.doesNotMatch(s,/\bSlot\b|\bStack\b|require\(|features\/games/);
 }
});
test('Home and shell have no retired shortcuts; Home ads remain and Kingdom menu returns',()=>{
 const home=read('src/app/(tabs)/hub.tsx');assert.doesNotMatch(home,/onExplore=|['"]\/games/);assert.ok(home.includes('new_home_first_view'));assert.ok(home.includes('hub_mid_native'));
 assert.ok(read('src/components/BuklodNavigationSideMenu.tsx').includes("route: '/games'"));
 assert.ok(read('src/components/BuklodFeatureFinder.tsx').includes("'kingdom'"));
 assert.ok(read('src/app/games/_layout.tsx').includes('!isGenesisKingdomRoute(pathname)'));
 assert.doesNotMatch(read('src/features/season2/genesis/GenesisKingdomPortal.tsx'),/\/games\/empire-arena|\/buklod-map/);
 const shell=read('src/components/BuklodNavSafeShell.tsx');assert.doesNotMatch(shell,/worldReturnEligible|Return to BUKLOD Map|['"]\/buklod-map/);assert.ok(shell.includes('<BuklodPersistentBottomNav />'));assert.ok(shell.includes('<BuklodFocusAppAdStrip />'));
});

test('MAIN retires virtual home, land and community estate without mounting workshops',()=>{
 for(const p of ['src/app/season2/my-world.tsx','src/app/season2/community-village.tsx','src/app/community-village.tsx','src/features/season2/world/GuardedSeason2DevelopmentWorld.tsx']){
  const s=read(p);assert.match(s,/<Redirect href="\/\(tabs\)\/hub"/);assert.doesNotMatch(s,/import .*Season2DevelopmentMap|openBundledBuklodWorld|<GuardedSeason2DevelopmentWorld|require\(|useEstateFeedback/);
 }
 assert.ok(read('src/app/personal-home/index.tsx').includes('BuklodPersonalHomeE2E'));
 assert.ok(read('src/components/home/BuklodPersonalHomeE2E.tsx').includes('BuklodBahayHome'));
 assert.ok(read('src/app/profile/buklod-family.tsx').includes('/profile/buklod-family-workspace'));
});
