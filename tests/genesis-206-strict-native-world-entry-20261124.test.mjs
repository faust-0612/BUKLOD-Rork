import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('206 strict routes are native-first, retain guarded legacy fallbacks and MAIN',()=>{
 const a=read('src/app/games/empire-arena.tsx');
 const k=read('src/app/games/index.tsx');
 const w=read('src/features/season2/world/GuardedSeason2DevelopmentWorld.tsx');
 assert.match(a,/isGenesis206NativeWorldEntry\(\).*world="arena"/);
 assert.match(k,/isGenesis206NativeWorldEntry\(\).*GuardedGenesisKingdom206/);
 assert.match(k,/world="kingdom" fallback=\{<GenesisKingdomPortal\/>\}/);
 assert.match(k,/<BuklodKingdomMap \/>/);
 assert.match(k,/!genesisPreview \? <BuklodKingdomAdSlot/);
 assert.match(w,/world=\{world==='home'\?'house':'community'\}/);
 for(const s of [a,k,w]){
  for(const route of ['maintenance','update-required','pilot-access','privacy/consent','onboarding'])assert.ok(s.includes(route),route);
 }
});
test('strict 206 does not report native Activity dispatch as gameplay readiness or silently fallback',()=>{
 const s=read('modules/buklod-genesis-godot/index.ts');
 const strict=s.slice(s.indexOf('export async function launchGenesisOtaWorld'),s.indexOf('// Legacy explicit launchers'));
 assert.match(strict,/inspectAndLaunchOtaPack/);
 assert.doesNotMatch(strict,/openBundledArena|openBundledWorld/);
 assert.match(s,/report\(dispatched \? 'dispatched' : 'native_rejected'\)/);
 assert.match(s,/if \(!canLaunch\(\)\) return report\('cancelled'\)/);
 const g=read('src/features/season2/genesis/GenesisNativeWorldEntry.tsx');
 for(const v of ['Updates.runtimeVersion','Updates.channel','Updates.isEmbeddedLaunch','Updates.updateId','Updates.useUpdates','downloadProgress','Engine-ready: not verified','GENESIS_GODOT_OTA_PACK.sha256','AsyncStorage.setItem(key','explicitRetry','FALLBACK'])assert.ok(g.includes(v),v);
 assert.match(g,/Updates\.runtimeVersion!==RUNTIME\|\|Updates\.channel!==CHANNEL/);
 assert.match(g,/if\(Updates\.isEmbeddedLaunch\|\|Updates\.isEmergencyLaunch\)/);
 assert.doesNotMatch(g,/Updates\.reloadAsync|supabase|grant_bp|rankedClient/);
});
