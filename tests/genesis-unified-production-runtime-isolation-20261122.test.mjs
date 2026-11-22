import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const p=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('exact new staging signed APK config cannot reuse live backend, runtime or production OTA',()=>{
  const e=JSON.parse(p('eas.json'));
  const stage=e.build['season2-genesis-unified-worlds-staging'];
  assert.equal(stage.extends,'staging-user');
  assert.equal(stage.environment,'preview');
  assert.equal(stage.distribution,'internal');
  assert.equal(stage.android.buildType,'apk');
  assert.equal(stage.channel,'season2-genesis-unified-preview');
  assert.equal(stage.env.EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED,'true');
  assert.equal(stage.env.EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_WORLDS,'true');
  assert.equal(stage.env.EXPO_PUBLIC_BUKLOD_ARENA_RANKED_ENABLED,'false');
  assert.equal(stage.env.EXPO_PUBLIC_SUPABASE_URL,undefined);
  assert.equal(stage.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,undefined);
  assert.equal(e.build.production.channel,'production');
  const keys=['APP_VARIANT','EXPO_PUBLIC_APP_ENV','EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW',
    'EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED','EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_WORLDS',
    'EXPO_PUBLIC_BUKLOD_SOS_NATIVE_R3','BUKLOD_APP_TARGET'];
  const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  try{
    for(const env of ['staging','production']){
      Object.assign(process.env,{APP_VARIANT:env,EXPO_PUBLIC_APP_ENV:env,
        EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW:'true',
        EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED:'true',
        EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_WORLDS:'true',
        EXPO_PUBLIC_BUKLOD_SOS_NATIVE_R3:'true',BUKLOD_APP_TARGET:'main'});
      const mod=require.resolve('../app.config.js');delete require.cache[mod];
      const c=require('../app.config.js')({config:{extra:{}}});
      assert.equal(c.android.package,env==='staging'?'org.mzbministry.buklod.staging':'org.mzbministry.buklod');
      assert.equal(c.runtimeVersion,env==='staging'?'2.0.3-genesis-unified-godot':'1.3.2');
      assert.equal(c.version,env==='staging'?'2.0.3':'1.3.6');
      assert.equal(c.plugins.includes('./plugins/withBuklodGodotArenaPack.js'),env==='staging');
    }
  } finally {
    for(const [k,v] of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
  }
  const hold=JSON.parse(p('.buklod/releases/genesis-unified-signed-rc-hold-20261122.json'));
  assert.equal(hold.signedReleaseReady,false);
  assert.equal(hold.productionUntouched,true);
});
