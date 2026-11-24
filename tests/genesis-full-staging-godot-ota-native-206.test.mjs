import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const read = p => readFileSync(new URL('../'+p, import.meta.url),'utf8');
const req=createRequire(import.meta.url);
const saved=['APP_VARIANT','EXPO_PUBLIC_APP_ENV','BUKLOD_APP_TARGET',
 'EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW','EXPO_PUBLIC_BUKLOD_SOS_NATIVE_R3',
 'EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED','EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_WORLDS',
 'EXPO_PUBLIC_BUKLOD_ARENA_LIBRARY_BUNDLE','EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_V205',
 'EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_V206'].map(k=>[k,process.env[k]]);
const cfg=(()=>{
 try {
 const eas=req('../eas.json'), x=eas.build;
 const p=x['season2-genesis-godot-ota-native-staging'];
 assert.equal(p.extends,'season2-genesis-launch-recovery-staging');
 assert.equal(p.channel,'season2-genesis-library-206-preview');
 assert.equal(p.android.credentialsSource,'remote');
 assert.equal(p.autoIncrement,false);
 Object.assign(process.env,{
  APP_VARIANT:'staging',EXPO_PUBLIC_APP_ENV:'staging',BUKLOD_APP_TARGET:'main',
  EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW:'true',
  EXPO_PUBLIC_BUKLOD_SOS_NATIVE_R3:'true',EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED:'true',
  EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_WORLDS:'true',
  EXPO_PUBLIC_BUKLOD_ARENA_LIBRARY_BUNDLE:'true',
  EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_V205:'true',
  EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_V206:'true'});
 return req('../app.config.js')({config:{}});
 } finally {
   for(const [k,val] of saved) if(val===undefined)delete process.env[k];else process.env[k]=val;
 }
})();
test('staging 2.0.6 replaces original-signer staging, not BUKLOD production',()=>{
 assert.equal(cfg.android.package,'org.mzbministry.buklod.staging');
 assert.equal(cfg.android.versionCode,18);
 assert.equal(cfg.runtimeVersion,'2.0.6-genesis-godot-ota');
 assert.equal(cfg.version,'2.0.6');
 assert.ok(cfg.plugins.includes('./plugins/withBuklodGodotArenaPack.js'));
});
test('pack OTA uses fixed repo asset, generated SHA and native capability with bundled fallback',()=>{
 const source=read('modules/buklod-genesis-godot/index.ts');
 assert.match(source,/Asset\.fromModule\(require\('\.\.\/\.\.\/assets\/season2\/genesis\/ota\/empire-arena\.zip'\)\)/);
 assert.match(source,/asset\.downloadAsync\(\)/);
 assert.match(source,/getGodotCapabilities\(\)/);
 assert.match(source,/openApprovedWorldPack\(uri, GENESIS_GODOT_OTA_PACK\.sha256, world\)/);
 assert.match(source,/api\.openBundledArena\(\)/);
 assert.match(source,/api\.openBundledWorld\(world\)/);
 assert.doesNotMatch(source,/fetch\(|https:\/\/|new URL\(/);
 const metro=read('metro.config.js');
 assert.match(metro,/assetExts\.push\('zip'\)/);
});
test('native Godot bridge accepts only app-private SHA verified ZIP of approved project',()=>{
 const cls=read('modules/buklod-genesis-godot/android/src/main/java/expo/modules/buklodgenesisgodot/BuklodGenesisGodotModule.kt');
 const activity=read('modules/buklod-genesis-godot/android/src/main/java/expo/modules/buklodgenesisgodot/GenesisGodotActivity.java');
 assert.match(cls,/stageApprovedPack\(privateFileUri, expectedSha256\)/);
 assert.match(cls,/ZipFile\(tmp\)/);
 assert.match(cls,/zip\.getEntry\("scenes\/WorldPreview\.tscn"\)/);
 assert.match(cls,/OpenApproved|openApprovedWorldPack/);
 assert.match(cls,/file:|scheme != "file"/);
 assert.match(activity,/approved\.getName\(\)\.matches\("\[0-9a-f\]\{64\}\\\\\.zip"\)/);
 assert.match(activity,/root\.equals\(approved\.getParentFile\(\)\)/);
 assert.match(activity,/--buklod-world=/);
 assert.doesNotMatch(activity,/result\.add\(approved\.getAbsolutePath\(\)\)/);
 assert.doesNotMatch(activity,/result\.add\("--scene"\)/);
 assert.match(activity,/BUNDLED_MAIN_PACK = "res:\/\/" \+ BUNDLED_ARENA_ASSET/);
 const manifest=read('modules/buklod-genesis-godot/android/src/main/AndroidManifest.xml');
 assert.match(manifest,/android:exported="false"/);
});
test('new Godot graphics and fullscreen are included in the exact pack pipeline',()=>{
 const project=read('godot/empire-arena/project.godot');
 const prep=read('scripts/genesis-prepare-godot-ota-pack.mjs');
 const root=read('godot/empire-arena/scripts/arena_root.gd');
 const world=read('godot/empire-arena/scripts/world_preview.gd');
 assert.match(project,/window\/handheld\/orientation=0/);
 assert.match(project,/window\/stretch\/aspect="expand"/);
 assert.match(root,/load_png_from_buffer/);
 assert.match(world,/load_webp_from_buffer/);
 assert.match(prep,/scripts\/world_explore_controller\.gd/);
 assert.match(prep,/GENESIS_GODOT_OTA_PACK_PREPARED/);
 assert.match(prep,/scripts\/build-empire-godot-pack\.mjs/);
});
test('renderer stays offline and no client economy changes introduced',()=>{
 for(const path of ['godot/empire-arena/scripts/world_explore_controller.gd',
 'godot/empire-arena/scripts/world_preview.gd']){
 const s=read(path);
 assert.doesNotMatch(s,/service_role|supabase|purchase_property|grant_bp|payout|HTTPRequest|HTTPClient/i);
 }
});

test('new staging preserves native-first Arena crash-loop guard and manual practice fallback',()=>{
 const route=read('src/app/games/empire-arena.tsx');
 assert.match(route,/NativeGodotArenaPrimary/);
 assert.match(route,/GODOT_ARENA_PENDING_KEY/);
 assert.match(route,/pending === 'pending' && !explicitRetry/);
 assert.match(route,/setShowPractice\(true\)/);
 assert.match(route,/EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_V205 === 'true'/);
});
