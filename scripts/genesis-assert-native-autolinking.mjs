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
for(const [pkg,cls] of candidates){
 const folder=path.join(root,'modules',pkg.replace('@buklod/genesis-','buklod-genesis-'));
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
 const found=modules.filter(m=>m.packageName===pkg && Array.isArray(m.modules) && m.modules.includes(cls));
 if(found.length!==1)throw Error('Android native module missing/duplicated in actual Expo autolinking output: '+pkg+' ('+found.length+')');
}
console.log('Exact Android Expo autolinking includes all five Genesis local native modules. NOT signed APK proof.');
