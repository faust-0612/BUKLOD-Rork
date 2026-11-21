import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Single existing paid staging source runs Android parity and Metro, never publishes itself',()=>{
 const wf=source('.github/workflows/season2-empire-arena-conso-qa-20261121.yml');
 assert.match(wf,/integration\/season2-genesis-full-conso-staging-20261121/);
 assert.match(wf,/contents: read/);
 assert.match(wf,/NO OTA/);
 assert.match(wf,/node scripts\/season2-native-apk-source-parity\.mjs/);
 assert.match(wf,/node scripts\/season2-android-bundle-compatibility\.mjs --compile/);
 assert.match(wf,/npx tsc --noEmit/);
 assert.match(wf,/tests\/season2-premium-ad-navigation-guard-20261121\.test\.mjs/);
 assert.match(wf,/tests\/kingdom-signature-missions-39-20261121\.test\.mjs/);
 assert.doesNotMatch(wf,/(?:eas (?:update|build|submit)|expo publish|npm publish|secrets\.EXPO_TOKEN)/i);
});
test('Live production and financial writes are not part of the Genesis source update',()=>{
 const world=source('src/app/buklod-map.tsx');
 const home=source('src/app/(tabs)/hub.tsx');
 assert.match(world,/<GenesisApprovedEntryMap/);
 assert.match(world,/<BuklodMapHeader \/>/);
 assert.doesNotMatch(world,/BuklodFirstViewAd|supabase\.rpc|awardBp|withdrawQMP/);
 assert.match(home,/BuklodFirstViewAd/);
 const stage=source('src/features/season2/world/Season2DevelopmentMap.tsx');
 assert.doesNotMatch(stage,/supabase\.rpc|spendBp|mintBp/);
 const arena=source('src/features/games/empire/rankedClient.ts');
 assert.match(arena,/EXPO_PUBLIC_BUKLOD_ARENA_RANKED_ENABLED/);
});
