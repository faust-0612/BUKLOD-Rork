import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const require=createRequire(import.meta.url);
const native=read('modules/buklod-genesis-godot/android/src/main/java/expo/modules/buklodgenesisgodot/GenesisGodotActivity.java');
const manifest=read('modules/buklod-genesis-godot/android/src/main/AndroidManifest.xml');
const gradle=read('modules/buklod-genesis-godot/android/build.gradle');
const proguard=read('modules/buklod-genesis-godot/android/consumer-rules.pro');
const arena=read('src/app/games/empire-arena.tsx');
const eas=require('../eas.json');
function configFor(variant){
  const keys=['APP_VARIANT','EXPO_PUBLIC_APP_ENV','EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW','EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED','EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_WORLDS','EXPO_PUBLIC_BUKLOD_ARENA_LIBRARY_BUNDLE','EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_V205'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  try {
    for(const key of keys)delete process.env[key];
    if(variant!=='production')Object.assign(process.env,{
      APP_VARIANT:'staging',EXPO_PUBLIC_APP_ENV:'staging',
      EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW:'true',
      EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED:'true',
      EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_WORLDS:'true',
      EXPO_PUBLIC_BUKLOD_ARENA_LIBRARY_BUNDLE:'true',
      EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_V205:variant==='new'?'true':'false'});
    return require('../app.config.js')({config:{}});
  }finally{
    for(const [key,value] of Object.entries(previous))
      if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
}
test('Godot Android new launcher uses documented APK-asset resource URL, never external pack',()=>{
  assert.match(native,/BUNDLED_MAIN_PACK = "res:\/\/" \+ BUNDLED_ARENA_ASSET/);
  assert.equal(native.split('result.add(BUNDLED_MAIN_PACK);').length-1,1);
  assert.doesNotMatch(native,/result\.add\(approved\.getAbsolutePath\(\)\)/);
  assert.doesNotMatch(native,/result\.add\("--scene"\)/);
  assert.match(native,/BUNDLED_ARENA_ASSET = "godot\/empire-arena.zip"/);
  assert.match(manifest,/android:exported="false"/);
  assert.match(manifest,/android:process=":genesis_godot"/);
});
test('R8 release shrinking stays enabled while JNI Godot method signatures survive',()=>{
  assert.match(gradle,/consumerProguardFiles 'consumer-rules.pro'/);
  assert.match(proguard,/-keep class org\.godotengine\.godot\.\*\* \{ \*; \}/);
  assert.doesNotMatch(gradle,/minifyEnabled\s+false/);
});
test('New native-first staging APK uses isolated 2.0.5 runtime and a fresh installable version code',()=>{
  const old=configFor('old'),next=configFor('new'),prod=configFor('production');
  assert.equal(old.android.package,'org.mzbministry.buklod.staging');
  assert.equal(old.runtimeVersion,'2.0.4-genesis-library-godot');
  assert.equal(next.version,'2.0.5');
  assert.equal(next.android.versionCode,17);
  assert.equal(next.runtimeVersion,'2.0.5-genesis-godot-launch');
  assert.equal(next.android.package,'org.mzbministry.buklod.staging');
  assert.equal(eas.build['season2-genesis-launch-recovery-staging'].channel,'season2-genesis-library-205-preview');
  assert.equal(eas.build['season2-genesis-launch-recovery-staging'].env.EXPO_PUBLIC_BUKLOD_ARENA_RANKED_ENABLED,'false');
  assert.equal(prod.android.package,'org.mzbministry.buklod');
  assert.equal(prod.runtimeVersion,'1.3.2');
});
test('Native-first route has persistent kill-switch after real Android process death',()=>{
  assert.match(arena,/function NativeGodotArenaPrimary\(\)/);
  assert.match(arena,/GODOT_ARENA_PENDING_KEY/);
  assert.match(arena,/await AsyncStorage.setItem\(GODOT_ARENA_PENDING_KEY, 'pending'\)/);
  assert.match(arena,/pending === 'pending' && !explicitRetry/);
  assert.match(arena,/const started = await openBundledEmpireArena\(\)/);
  assert.match(arena,/AppState\.addEventListener\('change'/);
  assert.match(arena,/setShowPractice\(true\)/);
  assert.match(arena,/EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_V205 === 'true'/);
  assert.match(arena,/return <EmpireArenaInApp\/>;/);
});

test('Both Expo native splash and embedded Godot engine use same approved Genesis green B',()=>{
 const config=read('app.config.js'),god=read('godot/empire-arena/project.godot');
 const pack=read('scripts/build-empire-godot-pack.mjs');
 assert.match(config,/expo-splash-screen/);
 assert.match(config,/genesis-green-b-transparent\.png/);
 assert.match(god,/image="res:\/\/splash\/buklod-green-b\.png"/);
 assert.match(god,/show_image=true/);
 assert.match(pack,/splash\/buklod-green-b\.png/);
 assert.match(pack,/nativeSplash\.subarray\(0,8\)/);
});
test('Cloud EAS staging build inherits all native flags, canonical backend, original signer and single versionCode',()=>{
 const profile=eas.build['season2-genesis-launch-recovery-staging'];
 assert.equal(profile.autoIncrement,false);
 assert.equal(profile.android.credentialsSource,'remote');
 assert.equal(profile.channel,'season2-genesis-library-205-preview');
 assert.equal(profile.env.EXPO_PUBLIC_SUPABASE_URL,'https://yhanxndaqbmuzbdqlblu.supabase.co');
 assert.equal(profile.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,eas.build['season2-genesis-preview'].env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
 for(const x of ['EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED','EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_WORLDS','EXPO_PUBLIC_BUKLOD_SOS_NATIVE_R3']){
  assert.equal(eas.build['season2-genesis-unified-worlds-staging'].env[x],'true');
 }
});

test('Native startup cannot depend on missing Godot global script cache in raw embedded ZIP',()=>{
 const root=read('godot/empire-arena/scripts/arena_root.gd');
 assert.doesNotMatch(root,/var sim:\s*BuklodArenaSimulation/);
 assert.match(root,/var sim\s*\n/);
 assert.match(root,/var me: Dictionary = sim\.actor\("A0"\)/);
 assert.match(root,/BUKLOD_GODOT_ARENA_SCENE_READY/);
});

test('Native 13-hero abilities and villager scripts never introduce cyclic global-class dependency',()=>{
 const actors=read('godot/empire-arena/scripts/arena_library_actors.gd');
 const skills=read('godot/empire-arena/scripts/arena_library_skills.gd');
 const sim=read('godot/empire-arena/scripts/arena_simulation.gd');
 assert.doesNotMatch(actors,/sim: BuklodArenaSimulation/);
 assert.doesNotMatch(skills,/sim: BuklodArenaSimulation/);
 assert.match(sim,/class_name BuklodArenaSimulation/);
 for(const token of ['seed_villagers','advance_waves','advance_villager','advance_minion'])assert.ok(actors.includes('static func '+token));
 assert.ok(skills.includes('static func cast'));
});

test('Hero dashes preserve explicit result types when Library simulation is dynamically linked',()=>{
 const source=read('godot/empire-arena/scripts/arena_library_skills.gd');
 for(const value of ['moved','dashed']) assert.match(source,new RegExp('var '+value+': bool = sim\\._move\\('));
 assert.doesNotMatch(source,/var (moved|dashed) := sim\._move/);
});
