#!/usr/bin/env node
/** Read-only Genesis map navigation preflight. Never publishes or edits backend. */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root=resolve(import.meta.dirname,'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
const cases=[];
const check=(label,fn)=>{try{fn();cases.push([label,true]);}catch(e){cases.push([label,false,String(e.message)]);}};
check('Staging-only authentication-gated map landing',()=>{
 const index=read('src/app/index.tsx');
 const map=read('src/app/buklod-map.tsx');
 assert.match(index,/isGenesisPreviewBuild\(\) \? '\/buklod-map'/);
 assert.match(map,/if \(!isGenesisPreviewBuild\(\)\)/);
 assert.match(map,/if \(!session\)/);
 assert.match(map,/requiresAcceptance/);
 assert.match(map,/maintenance_mode/);
});
check('Genesis restores one status-safe header and one bottom nav without duplicate context bar',()=>{
 const tab=read('src/app/(tabs)/_layout.tsx');
 const shell=read('src/components/BuklodNavSafeShell.tsx');
 assert.match(tab,/!desktopWebShell \? <SwipeDashboardHeader \/> : null/);
 assert.match(tab,/const headerTopInset = genesisPreview && Platform\.OS === 'android'/);
 assert.match(tab,/paddingTop: headerTopInset/);
 // Original Genesis nav is retained; the immersive Arena excludes only its own overlay.
 assert.match(shell,/!immersiveIgpat && !immersiveConversation && rawNavOccupied > 0 && !immersiveArena/);
 assert.match(shell,/immersiveArena = normalizeBuklodPathname\(pathname\) === '\/games\/empire-arena'/);
 assert.match(shell,/Return to BUKLOD Map/);
 assert.match(shell,/normalizedPath !== '\/buklod-map'/);
 assert.match(tab,/!isGenesisPreviewBuild\(\) \? <BuklodDashboardContextBar/);
});
check('Single district ownership for all map destinations',()=>{
 const source=read('src/features/season2/genesis/genesisMapDistricts.ts');
 const routes=[...source.matchAll(/route: '(\/[^']+)'/g)].map(match=>match[1]);
 const unique=new Set(routes);
 assert.equal(routes.length,unique.size,'Every destination route belongs to one district only');
 const required=['/buklod','/messages','/me','/clusters','/organizations','/games',
 '/points/economy','/profile/focus-apps','/bible','/profile/buklod-market'];
 required.forEach(route=>assert.ok(unique.has(route),'Missing district route '+route));
 for(const route of routes){
   const basename='src/app/'+route.replace(/^\//,'');
   const tab='src/app/(tabs)/'+route.substring(1)+'.tsx';
   assert.ok(existsSync(resolve(root,basename+'.tsx'))||
     existsSync(resolve(root,basename+'/index.tsx'))||
     existsSync(resolve(root,basename+'.native.tsx'))||
     existsSync(resolve(root,tab)),
     'Missing route implementation: '+route);
 }
});
check('Bundled local Galaxy and approved CC0 music',()=>{
 for(const p of ['assets/season2/genesis/galaxy/nebula.jpg',
   'assets/season2/genesis/genesis-green-b-transparent.png',
   'assets/sounds/kingdom-premium/kingdom-theme.ogg',
   'assets/sounds/kingdom-premium/LICENSES.md',
   'assets/sounds/kingdom-premium/manifest.json']) assert.ok(existsSync(resolve(root,p)),p);
 const map=read('src/app/buklod-map.tsx');
 assert.match(map,/useRorkGameAmbience\('kingdom-map'/);
 assert.match(map,/useRorkGameAmbience\('kingdom-map',\{autoStart:canPlayMusic\}\)/);
 assert.match(map,/!requiresAcceptance/);
 assert.doesNotMatch(map,/BuklodFirstViewAd|toggleMusic|musicButton/);
 assert.match(read('src/features/games/runtime/rorkAudio.ts'),/subscribeBuklodAudioFocus/);
 assert.match(read('src/features/games/runtime/rorkAudio.ts'),/controlledAutoStart/);
 assert.match(map,/<BuklodMapHeader \/>/);
 assert.match(map,/<BuklodMapGuideDock active=\{focused\} \/>/);
 assert.match(map,/GenesisApprovedEntryMap/);
 const approved=read('src/features/season2/genesis/GenesisApprovedEntryMap.tsx');
 assert.match(approved,/GenesisReliablePortraitImage/);
 const reliable=read('src/features/season2/genesis/GenesisReliablePortraitImage.tsx');
 assert.match(reliable,/buklod-genesis-portrait-welcome-720x995\.jpg/);
 assert.match(reliable,/GENESIS_PORTRAIT_RESCUE_URI/);
 const picture=readFileSync(resolve(root,'assets/season2/genesis/world/buklod-genesis-portrait-welcome-720x995.webp'));
 assert.equal(picture.length,202914);
 assert.equal(createHash('sha256').update(picture).digest('hex'),'e8a2ee3f7d6f00b2ce657f0d4662dfd0258da018f4131d740e90414b56076f1a');
 const compact=readFileSync(resolve(root,'assets/season2/genesis/world/buklod-genesis-portrait-9doors-720x670.webp'));
 assert.equal(compact.length,160272);
 assert.match(map,/router\.push\(route as any\)/);
 for(const p of ['assets/season2/genesis/world/buklod-approved-entry-map-1672x941.webp','assets/season2/genesis/world/approved-entry-map-manifest.json'])assert.ok(existsSync(resolve(root,p)),p);
});
check('No direct backend writes, economy minting, OTA publish, or forced unlock in new map',()=>{
 const map=read('src/app/buklod-map.tsx');
 for(const bad of [/supabase\./,/rpc\(/,/eas update/,/service_role/,/apply_migration/,/points.*\+=/]) assert.doesNotMatch(map,bad);
});
for(const [title,passed,reason] of cases) console.log((passed?'PASS ':'BLOCK ')+title+(reason?': '+reason:''));
if(cases.some(c=>!c[1])){process.exitCode=1;console.error('GENESIS MAP SOURCE BLOCKED');}
else console.log('GENESIS MAP SOURCE PREFLIGHT PASS — NOT APK/OTA READY');
