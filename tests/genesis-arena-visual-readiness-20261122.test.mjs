import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {EXPECTED,inspectVisualReadiness} from '../scripts/genesis-arena-visual-readiness-20261122.mjs';

test('13 heroes, 4 real poses each and 3 approved source map plates are inventoried',()=>{
 const r=inspectVisualReadiness();
 assert.equal(r.expected.heroPoses,52);
 assert.equal(r.expected.heroSprites,13);
 assert.equal(r.expected.battlefieldPlates,3);
 assert.equal(r.found.reactHeroPoses,52);
 assert.equal(r.found.reactHeroSprites,13);
 assert.equal(r.found.reactBattlefieldPlates,3);
 assert.equal(r.found.godotHeroPoses,52);
 assert.equal(r.found.godotHeroSprites,13);
 assert.equal(r.found.godotBattlefieldPlates,3);
 assert.equal(r.found.rendersNativeHeroAtlases,true);
 assert.equal(r.found.usesCanonicalMapArt,true);
});
test('Original Library minion/drop art absent from APK pack must be reported—not marked verified',()=>{
 const r=inspectVisualReadiness();
 assert.equal(EXPECTED.minionPortraits,8);
 assert.equal(EXPECTED.dropIcons,300);
 assert.equal(r.verifiedProduction,false);
 assert.ok(r.missing.some(m=>m.component==='library_faction_minions'));
 assert.ok(r.missing.some(m=>m.component==='library_drop_icons'));
 assert.ok(r.missing.some(m=>m.component==='native_structure_art_render'));
 assert.equal(r.status,'NOT_VISUAL_RELEASE_READY');
});
test('Strict source release-check fails closed on missing required runtime artwork',()=>{
 const result=spawnSync(process.execPath,['scripts/genesis-arena-visual-readiness-20261122.mjs','--strict'],
  {encoding:'utf8',timeout:30000});
 assert.equal(result.status,1);
 assert.match(result.stderr,/BUKLOD_VISUAL_RELEASE_HOLD/);
});
test('Only new 2.0.4 library build uses guarded native-first Arena entry',()=>{
 const screen=readFileSync(new URL('../src/app/games/empire-arena.tsx',import.meta.url),'utf8');
 assert.match(screen,/const nativeFirstLibrary = godotNativeEnabled &&\s+process\.env\.EXPO_PUBLIC_BUKLOD_ARENA_LIBRARY_BUNDLE === 'true'/);
 assert.match(screen,/nativeAutoAttempted\.current = true/);
 assert.match(screen,/if \(!cancelled && nativeFirstLibrary/);
 assert.match(screen,/if \(!started\) setMessage\('Godot Arena pack unavailable/);
 assert.match(screen,/return <EmpireArenaInApp\/>/);
 assert.match(screen,/if \(!isGenesisPreviewBuild\(\)\) return <Redirect/);
 assert.doesNotMatch(screen,/EXPO_PUBLIC_BUKLOD_ARENA_RANKED_ENABLED = 'true'/);
});
