import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const inventory=JSON.parse(read('release/genesis-native-build-inventory-20261120.json'));
const nativeIds=["preview-identity","native-graphics-stack","genesis-cosmic-ui","adaptive-graphics","rive-character-runtime","character-rig-assets","premium-audio-runtime","mastered-genesis-soundtrack","genesis-haptics","reward-animation","genesis-assets-integrity","smart-drawer-sqlite","smart-drawer-file-provider","smart-drawer-manual-encrypted-backup","native-android-gif-ime","native-file-provider-comments","android-camera-media","native-media3-compression","godot-android-3d","drive-oauth-cloud-sync","silent-ota-next-launch","play-core-in-app-update","android-admob","android-stream-ptt-calls","navigation-v2-drawer","scroll-stop-ad-prewarm","secure-store-password-migration","offline-sync-reliability"];
test('all reviewed Genesis and held native capabilities are individually accounted for',()=>{
 assert.equal(inventory.schemaVersion,1);
 assert.equal(inventory.buildReady,false);
 assert.equal(inventory.releaseReady,false);
 assert.equal(inventory.signedApk.exists,false);
 assert.equal(inventory.runtimeVersion,'2.0.0-genesis-preview');
 assert.equal(inventory.packageId,'org.mzbministry.buklod.staging');
 const rows=inventory.nativeFeatures;
 assert.deepEqual(rows.map(x=>x.id),nativeIds);
 assert.equal(new Set(rows.map(x=>x.id)).size,rows.length);
 for(const row of rows){
   assert.match(row.status,/^(source-implemented|native-source-uncompiled|dependency-declared|existing-source|held-no-bytes|held-no-implementation|held-credentials|queued-separate)$/);
   assert.ok(row.origin && row.description && row.remaining,row.id+' missing evidence');
 }
});
test('exact Genesis staging identity with no accidental APK release or production flip',()=>{
 const eas=JSON.parse(read('eas.json'));
 const app=read('app.config.js');
 assert.equal(eas.build['season2-genesis-preview'].channel,'season2-genesis-preview');
 assert.equal(eas.build['season2-genesis-preview'].env.EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW,'true');
 assert.equal(eas.build['season2-genesis-preview'].android.buildType,'apk');
 assert.match(app,/genesisNativePreview \? '2\.0\.0-genesis-preview' : '1\.3\.2'/);
 assert.match(app,/org\.mzbministry\.buklod\.staging/);
});
test('the reviewed foundations and explicit release-risk gates cannot be silently omitted',()=>{
 const pkg=JSON.parse(read('package.json'));
 for(const dep of ['@rive-app/react-native','@shopify/react-native-skia','react-native-reanimated',
   'lottie-react-native','expo-audio','expo-haptics','expo-sqlite','expo-document-picker','expo-updates'])
   assert.ok(pkg.dependencies[dep],dep+' dependency absent');
 for(const path of [
   'modules/buklod-genesis-ime/expo-module.config.json',
   'modules/buklod-genesis-ime/android/src/main/java/expo/modules/buklodgenesisime/BuklodGenesisImeModule.kt',
   'src/lib/smartDrawer/portableBackup.ts',
   'src/features/season2/genesis/genesisDeviceQuality.ts',
   'scripts/genesis-native-asset-gate.mjs',
   'assets/season2/genesis/sources.json'
 ])assert.ok(existsSync(new URL('../'+path,import.meta.url)),path+' omitted');
 const approved=JSON.parse(read('assets/season2/genesis/sources.json'));
 assert.equal(approved.releaseStatus,'SOURCE_DISCOVERY_ONLY_NO_BINARY_IMPORT');
 assert.ok(inventory.nativeFeatures.some(x=>x.id==='godot-android-3d'&&x.status==='held-no-implementation'));
 assert.ok(inventory.nativeFeatures.some(x=>x.id==='drive-oauth-cloud-sync'&&x.status==='held-credentials'));
 assert.ok(inventory.requiredChecks.some(x=>/AdMob/.test(x)));
});
