#!/usr/bin/env node
/**
 * Compare BUKLOD premium Genesis OTA source with the actual Nov 20 verified
 * signed Genesis staging APK native source (newer verified green-B package).
 * It may be on another Git branch: identical native files, not Git ancestry,
 * establish compatibility. Source integrity only; no EAS API,
 * APK download, physical device, wallet changes, production or OTA publication.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
export const PINNED_GENESIS_APK={
 source:'a04d9ccf91e508a062bab8a7657297e574ae40a2',
 verifiedApkSha256:'f2608820b522a2d58fbbcfe94be10df600f7c3915a509e625f53902288770900',
 verifiedApkVersionCode:13,
 verifiedEasBuildId:'42ce5047-70dc-47e1-b8a9-77948c9b8dba',
 verifiedGithubJobId:136181340162,
 package:'org.mzbministry.buklod.staging',
 channel:'season2-genesis-preview',
 runtime:'2.0.0-genesis-preview',
 easProjectId:'23dad7d0-389a-406e-8dec-08965dab85d8',
};
const git=(args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',timeout:30000}).trim();
const sha=git(['rev-parse','HEAD']);
assert.match(sha,/^[a-f0-9]{40}$/);
try{git(['cat-file','-e',PINNED_GENESIS_APK.source+'^{commit}']);}
catch{throw Error('Newest verified signed Genesis native source unavailable in Git; cannot claim parity');}

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
assert.equal(preview?.env?.EXPO_PUBLIC_BUKLOD_ARENA_EXPERIMENTAL,'true');
assert.equal(preview?.env?.EXPO_PUBLIC_BUKLOD_ARENA_RANKED_ENABLED,'false');
assert.equal(production?.channel,'production');
assert.notEqual(preview?.channel,production?.channel);
console.log(JSON.stringify({
 nativeSourceCompatible:true,
 signedNativeBaselineSha:PINNED_GENESIS_APK.source,
 verifiedSignedApkSha256:PINNED_GENESIS_APK.verifiedApkSha256,
 verifiedSignedApkVersionCode:PINNED_GENESIS_APK.verifiedApkVersionCode,
 verifiedSignedEasBuildId:PINNED_GENESIS_APK.verifiedEasBuildId,
 verifiedSignedApkGithubJobId:PINNED_GENESIS_APK.verifiedGithubJobId,
 sourceSha:sha,package:PINNED_GENESIS_APK.package,
 channel:PINNED_GENESIS_APK.channel,runtime:PINNED_GENESIS_APK.runtime,
 stagingOtaPublished:false,existingSignedApkLiveReverified:false,
 physicalDeviceVerified:false,
 note:'Code/config/dependency parity only against the newer VERIFIED green-B native APK. Old 2.0 runtime installers may have previous native splash; verify installed APK distribution and EAS channel before OTA.'
}));
