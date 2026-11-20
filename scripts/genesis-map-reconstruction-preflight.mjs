#!/usr/bin/env node
/** Read-only Genesis map navigation preflight. Never publishes or edits backend. */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

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
check('Old navigation bars suppressed ONLY in preview',()=>{
 const tab=read('src/app/(tabs)/_layout.tsx');
 const shell=read('src/components/BuklodNavSafeShell.tsx');
 assert.match(tab,/!desktopWebShell && !genesisMapNavigation/);
 assert.match(shell,/!genesisMapNavigation && !immersiveIgpat/);
 assert.match(shell,/Return to BUKLOD Map/);
 assert.match(shell,/normalizedPath !== '\/buklod-map'/);
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
 assert.match(map,/useRorkGameAmbience\('kingdom-map'\)/);
 assert.match(map,/musicEnabled/);
});
check('No direct backend writes, economy minting, OTA publish, or forced unlock in new map',()=>{
 const map=read('src/app/buklod-map.tsx');
 for(const bad of [/supabase\./,/rpc\(/,/eas update/,/service_role/,/apply_migration/,/points.*\+=/]) assert.doesNotMatch(map,bad);
});
for(const [title,passed,reason] of cases) console.log((passed?'PASS ':'BLOCK ')+title+(reason?': '+reason:''));
if(cases.some(c=>!c[1])){process.exitCode=1;console.error('GENESIS MAP SOURCE BLOCKED');}
else console.log('GENESIS MAP SOURCE PREFLIGHT PASS — NOT APK/OTA READY');
