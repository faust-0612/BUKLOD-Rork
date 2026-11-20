#!/usr/bin/env node
/**
 * The source-only SDK inventory is insufficient. Compare the actual Android
 * Expo autolinking resolver output with all local native module entry points.
 * This must execute after npm ci and before Gradle or EAS signing.
 */
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const candidates=[
 ['@buklod/genesis-native-ime','expo.modules.buklodgenesisime.BuklodGenesisImeModule'],
 ['@buklod/genesis-play-updates','expo.modules.buklodgenesisplayupdates.BuklodGenesisPlayUpdateModule'],
 ['@buklod/genesis-media3','expo.modules.buklodgenesismedia3.BuklodGenesisMedia3Module'],
 ['@buklod/genesis-godot','expo.modules.buklodgenesisgodot.BuklodGenesisGodotModule'],
 ['@buklod/genesis-drive-auth','expo.modules.buklodgenesisdrive.BuklodGenesisDriveAuthModule'],
];
const expectedAndroidProjectDirs=new Map();
for(const [pkg,cls] of candidates){
 // The original GIF module predates the newer local-module folder names.
 const directory=pkg==='@buklod/genesis-native-ime' ? 'buklod-genesis-ime' :
   pkg.replace('@buklod/genesis-','buklod-genesis-');
 const folder=path.join(root,'modules',directory);
 expectedAndroidProjectDirs.set(pkg,path.join(folder,'android'));
 const manifest=JSON.parse(readFileSync(path.join(folder,'package.json'),'utf8'));
 const config=JSON.parse(readFileSync(path.join(folder,'expo-module.config.json'),'utf8'));
 if(manifest.name!==pkg||!config.platforms.includes('android')||!config.android?.modules?.includes(cls))
   throw Error('Android native source config missing: '+pkg);
}
const bin=path.join(root,'node_modules','.bin','expo-modules-autolinking');
if(!existsSync(bin))throw Error('Installed locked Expo autolinking binary not available');
const output=execFileSync(bin,['resolve','--platform','android','--json'],
 {cwd:root,encoding:'utf8',timeout:60000,maxBuffer:5*1024*1024});
const parsed=JSON.parse(output);
const modules=Array.isArray(parsed)?parsed:parsed.modules;
if(!Array.isArray(modules))throw Error('Unexpected Expo native autolinking resolver format');
for(const [pkg,cls] of candidates){
 // Android Expo resolver nests Kotlin class registration under projects[].modules.
 // A discovered npm package alone does NOT establish that Gradle links its native project.
 const selected=modules.filter(m=>m.packageName===pkg);
 const projects=selected.flatMap(m=>Array.isArray(m.projects)?m.projects:[]);
 const found=projects.filter(project=>Array.isArray(project.modules) &&
   project.modules.some(entry=>entry===cls || entry?.classifier===cls) &&
   path.resolve(project.sourceDir||'')===expectedAndroidProjectDirs.get(pkg));
 if(found.length!==1){
   const related=modules.filter(m=>String(m.packageName).includes('buklod'));
   console.error('Resolved local Android Gradle projects and classes (no secrets):',
     JSON.stringify(related.map(m=>({
       name:m.packageName,
       projects:(m.projects||[]).map(p=>({name:p.name,classes:p.modules,
         isNativeDirectory:path.resolve(p.sourceDir||'').startsWith(path.join(root,'modules'))}))
     }))));
   throw Error('Android native Gradle project/class missing or duplicated: '+cls+' ('+found.length+')');
 }
}
console.log('Exact Android Expo autolinking includes all five Genesis local native modules. NOT signed APK proof.');
