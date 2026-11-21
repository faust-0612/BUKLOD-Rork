#!/usr/bin/env node
/**
 * Compare BUKLOD premium Genesis OTA source with the actual Nov 20 verified
 * signed Genesis staging APK native source. Source integrity only; no EAS API,
 * APK download, physical device, wallet changes, production or OTA publication.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
export const PINNED_GENESIS_APK={
 source:'5bd80dbcafd85b0e8dc3c78f8d555b4aff2193d0',
 easBuildId:'d9e279a6-766b-4bd9-8316-3f700749594c',
 package:'org.mzbministry.buklod.staging',
 channel:'season2-genesis-preview',
 runtime:'2.0.0-genesis-preview',
 easProjectId:'23dad7d0-389a-406e-8dec-08965dab85d8',
};
const git=(args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',timeout:30000}).trim();
const sha=git(['rev-parse','HEAD']);
assert.match(sha,/^[a-f0-9]{40}$/);
try{git(['merge-base','--is-ancestor',PINNED_GENESIS_APK.source,sha]);}
catch{throw Error('Signed Genesis native APK source is not an ancestor; never reuse without a fresh APK');}

// Native code, plugin config, pinned dependencies, generated native projects and
// native helper scripts must match the installed full-functionality signed APK.
// JavaScript, graphics, audio, routes and tests may evolve by OTA, not native code.
const lockedInputs=[
 'app.config.js','app.json','babel.config.js','metro.config.js','package-lock.json',
 'modules','plugins','android','ios','patches','gradle.properties',
 'scripts/genesis-prepare-skia-binaries.mjs',
 'scripts/genesis-assert-native-autolinking.mjs',
];
const drift=git(['diff','--name-only',PINNED_GENESIS_APK.source,sha,'--',...lockedInputs]);
assert.equal(drift,'','Native source changed from signed APK; new verified native build required: '+drift);
const oldPkg=JSON.parse(git(['show',PINNED_GENESIS_APK.source+':package.json']));
const currentPkg=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
for(const key of ['dependencies','devDependencies','overrides','resolutions']){
 assert.deepEqual(currentPkg[key]??{},oldPkg[key]??{},'Installed runtime package lock drift: '+key);
}
const eas=JSON.parse(readFileSync(resolve(root,'eas.json'),'utf8'));
const preview=eas.build?.['season2-genesis-preview'];
const production=eas.build?.production;
assert.equal(preview?.channel,PINNED_GENESIS_APK.channel);
assert.equal(preview?.environment,'preview');
assert.equal(preview?.distribution,'internal');
assert.equal(preview?.android?.buildType,'apk');
assert.equal(preview?.env?.APP_VARIANT,'staging');
assert.equal(preview?.env?.EXPO_PUBLIC_APP_ENV,'staging');
assert.equal(preview?.env?.EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW,'true');
assert.equal(preview?.env?.EXPO_PUBLIC_SUPABASE_URL,'https://yhanxndaqbmuzbdqlblu.supabase.co');
assert.match(preview?.env?.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'',/^sb_publishable_[A-Za-z0-9_-]+$/);
assert.equal(preview?.env?.EXPO_PUBLIC_BUKLOD_ARENA_EXPERIMENTAL,'false');
assert.equal(production?.channel,'production');
assert.notEqual(preview?.channel,production?.channel);
console.log(JSON.stringify({
 nativeSourceCompatible:true,
 signedNativeBaselineSha:PINNED_GENESIS_APK.source,
 knownSignedEasBuildId:PINNED_GENESIS_APK.easBuildId,
 sourceSha:sha,package:PINNED_GENESIS_APK.package,
 channel:PINNED_GENESIS_APK.channel,runtime:PINNED_GENESIS_APK.runtime,
 stagingOtaPublished:false,existingSignedApkLiveReverified:false,
 physicalDeviceVerified:false,
 note:'Code/config/dependency parity only; previous EAS signed binary evidence exists. Verify current EAS channel and signed APK proof before a new OTA.'
}));
