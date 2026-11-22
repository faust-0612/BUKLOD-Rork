import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const config=require('../app.config.js');
const eas=require('../eas.json');
function app(values){
 const keys=['APP_VARIANT','EXPO_PUBLIC_APP_ENV','EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW','EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED','EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_WORLDS','EXPO_PUBLIC_BUKLOD_ARENA_LIBRARY_BUNDLE'];
 const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{
  for(const k of keys)delete process.env[k];
  Object.assign(process.env,values);
  return config({config:{}});
 }finally{
  for(const k of keys){
   if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];
  }
 }
}
test('2.0.4 Library unified Godot staging runtime and isolated channel without production ABI drift',()=>{
 const flags={APP_VARIANT:'staging',EXPO_PUBLIC_APP_ENV:'staging',EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW:'true',EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED:'true',EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_WORLDS:'true',EXPO_PUBLIC_BUKLOD_ARENA_LIBRARY_BUNDLE:'true'};
 const stage=app(flags);
 assert.equal(stage.runtimeVersion,'2.0.4-genesis-library-godot');
 assert.equal(stage.version,'2.0.4');
 assert.equal(stage.android.package,'org.mzbministry.buklod.staging');
 assert.equal(stage.extra.appTarget,'main');
 assert.ok(stage.plugins.includes('./plugins/withBuklodGodotArenaPack.js'));
 const ad=stage.plugins.find(p=>Array.isArray(p)&&p[0]==='react-native-google-mobile-ads');
 assert.equal(ad?.[1]?.androidAppId,'ca-app-pub-3940256099942544~3347511713');
 const prior=app({...flags,EXPO_PUBLIC_BUKLOD_ARENA_LIBRARY_BUNDLE:'false'});
 assert.equal(prior.runtimeVersion,'2.0.3-genesis-unified-godot');
 const prod=app({...flags,APP_VARIANT:'production',EXPO_PUBLIC_APP_ENV:'production'});
 assert.equal(prod.runtimeVersion,'1.3.2');
 assert.equal(prod.android.package,'org.mzbministry.buklod');
 assert.equal(prod.plugins.includes('./plugins/withBuklodGodotArenaPack.js'),false);
});
test('EAS stage remains a distinct internal channel without embedded credentials or ranked authority',()=>{
 const p=eas.build['season2-genesis-library-staging'];
 assert.equal(p.extends,'season2-genesis-unified-worlds-staging');
 assert.equal(p.channel,'season2-genesis-library-preview');
 assert.equal(p.android.buildType,'apk');
 assert.equal(p.env.EXPO_PUBLIC_BUKLOD_ARENA_LIBRARY_BUNDLE,'true');
 assert.equal(p.env.EXPO_PUBLIC_BUKLOD_ARENA_RANKED_ENABLED,'false');
 assert.equal(p.env.EXPO_PUBLIC_SUPABASE_URL,undefined);
 assert.equal(p.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,undefined);
 assert.equal(eas.build.production.channel,'production');
 assert.equal(eas.build.production.env.EXPO_PUBLIC_BUKLOD_ARENA_LIBRARY_BUNDLE,undefined);
});
test('native pack retains all three original unified worlds and Arena Library audio',()=>{
 const source=readFileSync(new URL('../scripts/build-empire-godot-pack.mjs',import.meta.url),'utf8');
 for(const key of ['arenaSfxEntries','classic_conquest','genesis_rift','dominion_frontier','special_event','world-art/kingdom.webp','world-art/community.webp','world-art/house.webp','world-audio/claim.wav','scenes/WorldPreview.tscn','tests/world_smoke.gd'])assert.ok(source.includes(key),'Missing '+key);
 const audioSmoke=readFileSync(new URL('../godot/empire-arena/tests/library_modes_audio_smoke.gd',import.meta.url),'utf8');
 assert.match(audioSmoke,/BUKLOD_GODOT_LIBRARY_MODES_AUDIO_PASS/);
 assert.match(source,/ranked: false, serverAccess: false/);
});
