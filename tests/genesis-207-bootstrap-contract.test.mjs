import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const req=createRequire(import.meta.url),read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const root='modules/buklod-genesis-godot/android/src/main/java/expo/modules/buklodgenesisgodot/';
test('native launcher never bypasses official Godot path restrictions',()=>{
 const activity=read(root+'GenesisGodotActivity.java');
 assert.equal((activity.match(/result\.add\("--main-pack"\)/g)||[]).length,1);
 assert.match(activity,/result\.add\(BUNDLED_MAIN_PACK\)/);
 assert.match(activity,/result\.add\("--"\)/);
 assert.match(activity,/--buklod-content=/);
 assert.doesNotMatch(activity,/result\.add\("--scene"\)|result\.add\(approved\.getAbsolutePath\(\)\)/);
 const bootstrap=read('godot/empire-arena/scripts/native_bootstrap.gd');
 assert.match(bootstrap,/ProjectSettings\.load_resource_pack\(content_path, true\)/);
 assert.match(bootstrap,/ResourceLoader\.CACHE_MODE_IGNORE_DEEP/);
 assert.match(bootstrap,/await get_tree\(\)\.scene_changed/);
 assert.match(bootstrap,/await RenderingServer\.frame_post_draw/);
 assert.match(bootstrap,/simulation\.available\(\)/);
 assert.match(bootstrap,/avatar\.texture == null/);
 assert.match(bootstrap,/_receipt\("ready"\)/);
 assert.match(read(root+'BuklodGenesisGodotModule.kt'),/getGodotLaunchStatus/);
 assert.match(read('scripts/build-empire-godot-pack.mjs'),/--native-bootstrap/);
 assert.match(read('plugins/withBuklodGodotArenaPack.js'),/--native-bootstrap/);
});
test('staging 207 identity isolated and canonical production unchanged',()=>{
 const profile=req('../eas.json').build['season2-genesis-bootstrap-native-staging'];
 assert.equal(profile.channel,'season2-genesis-library-207-preview');
 assert.equal(profile.env.EXPO_PUBLIC_BUKLOD_ARENA_RANKED_ENABLED,'false');
 assert.equal(profile.android.credentialsSource,'remote');
 const keys=['APP_VARIANT','EXPO_PUBLIC_APP_ENV','BUKLOD_APP_TARGET','EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW','EXPO_PUBLIC_BUKLOD_SOS_NATIVE_R3','EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED','EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_WORLDS','EXPO_PUBLIC_BUKLOD_ARENA_LIBRARY_BUNDLE','EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_V205','EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_V206','EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_V207'];
 const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{
  for(const k of keys) process.env[k]='true';
  process.env.BUKLOD_APP_TARGET='main';
  for(const env of ['staging','production']){
   process.env.APP_VARIANT=process.env.EXPO_PUBLIC_APP_ENV=env;
   const cfg=req('../app.config.js')({config:{}});
   assert.equal(cfg.android.package,env==='staging'?'org.mzbministry.buklod.staging':'org.mzbministry.buklod');
   assert.equal(cfg.runtimeVersion,env==='staging'?'2.0.7-genesis-bootstrap':'1.3.2');
   assert.equal(cfg.android.versionCode,env==='staging'?19:30);
  }
 }finally{for(const [k,v] of Object.entries(old))if(v===undefined)delete process.env[k];else process.env[k]=v;}
});
test('Native world primary preserves legacy tools, auth gates and matching engine receipt',()=>{
 const s=read('src/app/games/index.tsx');
 for(const token of ['isGenesisBootstrapEnabled','complianceLoading','runtimeLoading','requiresAcceptance','pilot_access_required','world="kingdom"','<GenesisKingdomPortal/>','<BuklodKingdomMap/>'])assert.ok(s.includes(token),token);
 const g=read('src/features/season2/world/GuardedSeason2DevelopmentWorld.tsx');
 assert.match(g,/world==='home'\?'house':'community'/);
 assert.match(g,/fallback=\{<Season2DevelopmentMap/);
 const entry=read('src/features/season2/genesis/GenesisNativeWorldEntry.tsx');
 for(const token of ['openBundledBuklodWorld(world)','getGenesisLaunchStatus','pendingKey','receipt.token===previousToken.current','receipt.world!==world','CHARACTER STATIONS & COLLECTION','HOUSE & PROPERTY TOOLS'])assert.ok(entry.includes(token),token);
 assert.match(read('src/app/games/empire-arena.tsx'),/receipt\.state==='ready'/);
});
test('Staging update identity is passive, not a forced restart or extra request',()=>{
 const d=read('src/features/season2/genesis/GenesisReleaseDiagnostics.native.tsx');
 for(const token of ['Updates.useUpdates()','active.updateId','active.runtimeVersion','active.channel','status.isDownloading','status.isUpdatePending','status.downloadProgress','GENESIS_GODOT_OTA_PACK.sha256'])assert.ok(d.includes(token),token);
 assert.doesNotMatch(d,/fetchUpdateAsync|checkForUpdateAsync|reloadAsync/);
 assert.match(read('src/app/buklod-map.tsx'),/EXPO_PUBLIC_APP_ENV==='staging'&&process.env.EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_V207==='true'/);
});
