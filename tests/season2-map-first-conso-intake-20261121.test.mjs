import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
test('preview starts at governed map, production retains canonical Wall',()=>{
 const boot=read('src/app/index.tsx');
 assert.match(boot,/isGenesisPreviewBuild\(\) \? '\/buklod-map' : '\/\(tabs\)\/buklod'/);
 assert.match(boot,/selectScope/);
 const map=read('src/app/buklod-map.tsx');
 for(const gate of ['loading','requiresAcceptance','maintenance_mode','update_required','pilot_access_required','!profile','!session'])assert.ok(map.includes(gate),gate);
 assert.match(map,/if \(!isGenesisPreviewBuild\(\)\)/);
 assert.match(read('src/app/_layout.tsx'),/Stack.Screen name="buklod-map"/);
});
test('map districts preserve unique real routes and Show Faith optionality',()=>{
 const content=read('src/features/season2/genesis/genesisMapDistricts.ts');
 const routes=[...content.matchAll(/route: '(\/[^']+)'/g)].map(m=>m[1]);
 assert.equal(new Set(routes).size,routes.length);
 for(const r of ['/buklod','/messages','/me','/clusters','/organizations','/games','/profile/focus-apps','/profile/buklod-market'])assert.ok(routes.includes(r));
 assert.match(content,/entry.faithOnly \|\| showFaith/);
 for(const route of routes){const file='src/app/'+route.slice(1);assert.ok(existsSync(resolve(root,file+'.tsx'))||existsSync(resolve(root,file+'/index.tsx'))||existsSync(resolve(root,file+'.native.tsx'))||existsSync(resolve(root,'src/app/(tabs)/'+route.slice(1)+'.tsx')),'missing '+route);}
});
test('Genesis keeps its one persistent bottom nav and the map return action without duplicating main doors',()=>{
 const tabs=read('src/app/(tabs)/_layout.tsx');
 const shell=read('src/components/BuklodNavSafeShell.tsx');
 const map=read('src/app/buklod-map.tsx');
 assert.match(tabs,/!isGenesisPreviewBuild\(\) \? <SwipeDashboardHeader/);
 assert.match(tabs,/!isGenesisPreviewBuild\(\) \? <BuklodDashboardContextBar/);
 assert.match(shell,/!immersiveIgpat && !immersiveConversation && rawNavOccupied > 0/);
 assert.match(shell,/normalizedPath !== '\/buklod-map'/);
 assert.match(shell,/router.replace\('\/buklod-map'/);
 assert.match(shell,/!keyboardVisible/);
 assert.doesNotMatch(map,/BuklodFirstViewAd/);
 assert.match(map,/<BuklodMapHeader \/>/);
 assert.match(map,/<BuklodMapGuideDock active=\{focused\} \/>/);
 assert.match(read('src/app/(tabs)/hub.tsx'),/BuklodFirstViewAd placement="home"/);
 assert.match(map,/useRorkGameAmbience\('kingdom-map'/);
 assert.doesNotMatch(map,/(?:service_role|supabase\.rpc|eas update|claimBp|mintBp|awardBp)/i);
});
test('bundled CC0 audio and actual Valley map included; native acceptance still held',()=>{
 for(const path of ['assets/sounds/kingdom-premium/LICENSES.md','assets/sounds/kingdom-premium/kingdom-theme.ogg','assets/season2/genesis/galaxy/nebula.jpg'])assert.ok(existsSync(resolve(root,path)),path);
 const map=read('src/app/buklod-map.tsx');assert.match(map,/GenesisApprovedEntryMap/);
 assert.match(read('src/features/season2/genesis/GenesisApprovedEntryMap.tsx'),/buklod-genesis-portrait-welcome-720x995\.webp/);
});
