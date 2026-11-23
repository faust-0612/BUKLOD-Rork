#!/usr/bin/env node
/** Fail-closed, pre-credit source inventory. No publish, backend mutation or physical-device claim. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const eas=JSON.parse(read('eas.json'));
const profile=eas.build['season2-genesis-launch-recovery-staging'];
assert.ok(profile,'Missing new isolated 2.0.5 cloud build profile');
const inherited=eas.build['season2-genesis-unified-worlds-staging']?.env||{};
const flags={...inherited,...eas.build['season2-genesis-library-staging']?.env,...profile.env};
const keys=['APP_VARIANT','EXPO_PUBLIC_APP_ENV','EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW',
  'EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED','EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_WORLDS',
  'EXPO_PUBLIC_BUKLOD_ARENA_LIBRARY_BUNDLE','EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_V205',
  'EXPO_PUBLIC_BUKLOD_SOS_NATIVE_R3'];
for(const key of keys)assert.equal(flags[key],key.startsWith('APP')||key==='EXPO_PUBLIC_APP_ENV'?'staging':'true',key);
assert.equal(flags.EXPO_PUBLIC_BUKLOD_ARENA_RANKED_ENABLED,'false');
assert.equal(profile.channel,'season2-genesis-library-205-preview');
assert.equal(profile.autoIncrement,false);
assert.equal(profile.android.credentialsSource,'remote');
assert.equal(profile.android.buildType,'apk');
assert.equal(profile.env.EXPO_PUBLIC_SUPABASE_URL,'https://yhanxndaqbmuzbdqlblu.supabase.co');
assert.equal(profile.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  eas.build['season2-genesis-preview'].env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
assert.equal(eas.cli.appVersionSource,'local');
const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
let cfg;
try{
  Object.assign(process.env,flags);
  cfg=require('../app.config.js')({config:{}});
} finally {
  for(const [key,value] of Object.entries(saved)){
    if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
}
assert.equal(cfg.android.package,'org.mzbministry.buklod.staging');
assert.equal(cfg.android.versionCode,17);
assert.equal(cfg.runtimeVersion,'2.0.5-genesis-godot-launch');
assert.equal(cfg.version,'2.0.5');
assert.equal(cfg.extra.eas.projectId,'23dad7d0-389a-406e-8dec-08965dab85d8');
assert.equal(cfg.extra.appTarget,'main');
assert.ok(cfg.plugins.includes('./plugins/withBuklodGodotArenaPack.js'));
const splash=cfg.plugins.find(x=>Array.isArray(x)&&x[0]==='expo-splash-screen')?.[1];
assert.ok(splash,'Expo native splash plugin missing');
assert.equal(splash.image,'./assets/season2/genesis/genesis-green-b-transparent.png');
assert.equal(splash.dark.image,splash.image);
assert.equal(splash.backgroundColor,'#050A19');
const admob=cfg.plugins.find(x=>Array.isArray(x)&&x[0]==='react-native-google-mobile-ads')?.[1];
assert.equal(admob?.androidAppId,'ca-app-pub-3940256099942544~3347511713');
const godot=read('godot/empire-arena/project.godot');
assert.match(godot,/boot_splash\/show_image=true/);
assert.match(godot,/boot_splash\/image="res:\/\/splash\/buklod-green-b\.png"/);
assert.match(godot,/run\/main_scene="res:\/\/scenes\/Arena\.tscn"/);
assert.doesNotMatch(godot,/\[application\/boot_splash\]/);
const packing=read('scripts/build-empire-godot-pack.mjs');
for(const item of ['splash/buklod-green-b.png','scenes/Arena.tscn','scenes/WorldPreview.tscn',
  'world-art/kingdom.webp','world-art/community.webp','world-art/house.webp',
  'audio/sfx/'])assert.ok(packing.includes(item),'Missing Godot pack '+item);
assert.match(packing,/Object\.keys\(catalog\.heroes\)\.length, 13/);
assert.match(packing,/catalog\.pickups\.length, 300/);
assert.match(packing,/audioEntries\.length, 70/);
assert.match(packing,/fullbody: 52, scene: 3, sprite: 13/);
const arenaScene=read('godot/empire-arena/scripts/arena_root.gd');
assert.doesNotMatch(arenaScene,/var sim:\\s*BuklodArenaSimulation/);
assert.match(arenaScene,/BUKLOD_GODOT_ARENA_SCENE_READY/);
const libraryActors=read('godot/empire-arena/scripts/arena_library_actors.gd');
const librarySkills=read('godot/empire-arena/scripts/arena_library_skills.gd');
assert.doesNotMatch(libraryActors,/sim: BuklodArenaSimulation/,'Cyclic Godot actor class reference');
assert.doesNotMatch(librarySkills,/sim: BuklodArenaSimulation/,'Cyclic Godot skill class reference');
const activity=read('modules/buklod-genesis-godot/android/src/main/java/expo/modules/buklodgenesisgodot/GenesisGodotActivity.java');
assert.match(activity,/BUNDLED_MAIN_PACK = "res:\/\/" \+ BUNDLED_ARENA_ASSET/);
assert.match(activity,/result\.add\(BUNDLED_MAIN_PACK\)/);
assert.match(activity,/getCommandLine\(\)/);
const manifest=read('modules/buklod-genesis-godot/android/src/main/AndroidManifest.xml');
assert.match(manifest,/android:exported="false"/);
assert.match(manifest,/android:process=":genesis_godot"/);
assert.match(manifest,/android:screenOrientation="landscape"/);
const gradle=read('modules/buklod-genesis-godot/android/build.gradle');
assert.match(gradle,/implementation 'org\.godotengine:godot:4\.7\.2\.stable'/);
assert.match(gradle,/consumerProguardFiles 'consumer-rules\.pro'/);
assert.match(read('modules/buklod-genesis-godot/android/consumer-rules.pro'),/-keep class org\.godotengine\.godot\.\*\*/);
const route=read('src/app/games/empire-arena.tsx');
assert.match(route,/function NativeGodotArenaPrimary\(\)/);
assert.match(route,/GODOT_ARENA_PENDING_KEY/);
assert.match(route,/EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_V205 === 'true'/);
assert.match(route,/openBundledEmpireArena\(\)/);
assert.match(route,/setShowPractice\(true\)/);
assert.match(route,/requiresAcceptance/);
assert.equal(eas.build.production.channel,'production');
console.log('BUKLOD_GENESIS_205_NATIVE_SOURCE_GATE_PASS '+JSON.stringify({
  package:cfg.android.package,version:cfg.version,versionCode:cfg.android.versionCode,
  runtime:cfg.runtimeVersion,channel:profile.channel,worlds:['arena','kingdom','community','house'],
  heroCount:13,pickupCount:300,animationAtlases:52,sceneImages:3,sprites:13,
  audioPrototypeCues:70,expoSplash:'green-B',godotSplash:'green-B',
  nativeR8Preserved:true,directGodot:true,crashLoopGuard:true,
  signedApk:'NOT_VERIFIED_BY_THIS_SOURCE_GATE',deviceQA:'SKIPPED_AT_OWNER_REQUEST',production:false
}));
