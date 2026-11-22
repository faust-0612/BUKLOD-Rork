import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const read = p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const require=createRequire(import.meta.url);
test('single locked Godot pack includes all native world entrypoints, no remote load',()=>{
  const pack=read('scripts/build-empire-godot-pack.mjs');
  const paths=['scenes/Arena.tscn','scenes/WorldPreview.tscn','scripts/world_preview.gd',
    'world-art/kingdom.webp','world-art/community.webp','world-art/house.webp',
    'world-audio/navigation.wav','world-audio/build_start.wav','world-audio/build_complete.wav','world-audio/claim.wav'];
  for(const path of paths)assert.ok(pack.includes(path),'missing pack resource '+path);
  const godot=read('godot/empire-arena/scripts/world_preview.gd');
  for(const mode of ['kingdom','community','house'])assert.ok(godot.includes(mode));
  assert.match(godot,/MAX_LEVEL := 10/);
  assert.match(godot,/STAGES := \[/);
  assert.match(godot,/AudioStreamWAV.load_from_file/);
  assert.doesNotMatch(godot,/supabase|service_role|fetch\(|https?:\/\//i);
});
test('native entrypoint is whitelisted and Android-only without a second app',()=>{
  const kt=read('modules/buklod-genesis-godot/android/src/main/java/expo/modules/buklodgenesisgodot/BuklodGenesisGodotModule.kt');
  const activity=read('modules/buklod-genesis-godot/android/src/main/java/expo/modules/buklodgenesisgodot/GenesisGodotActivity.java');
  const bridge=read('modules/buklod-genesis-godot/index.ts');
  for(const key of ['kingdom','community','house'])assert.ok(kt.includes('"'+key+'"'));
  assert.match(kt,/AsyncFunction\("openBundledWorld"\)/);
  assert.match(activity,/EXTRA_BUNDLED_WORLD/);
  assert.match(activity,/WorldPreview\.tscn/);
  assert.match(activity,/--main-pack/);
  assert.match(bridge,/openBundledBuklodWorld/);
  assert.match(bridge,/GENESIS_GODOT_WORLDS/);
  const nav=read('src/features/season2/world/Season2DevelopmentMap.tsx');
  assert.match(nav,/GODOT KINGDOM PREVIEW/);
  assert.match(nav,/openBundledBuklodWorld/);
});
test('new native ABI runtime only in exact staging opt-in; production remains frozen',()=>{
  const names=['APP_VARIANT','EXPO_PUBLIC_APP_ENV','EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED',
    'EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW','EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_WORLDS','BUKLOD_APP_TARGET'];
  const saved=Object.fromEntries(names.map(n=>[n,process.env[n]]));
  try{
    for(const variant of ['production','staging'])for(const flag of ['false','true']){
      Object.assign(process.env,{APP_VARIANT:variant,EXPO_PUBLIC_APP_ENV:variant,
        EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED:'true',
        EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW:'true',
        EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_WORLDS:flag,
        BUKLOD_APP_TARGET:'main'});
      const p=require.resolve('../app.config.js');delete require.cache[p];
      const cfg=require('../app.config.js')({config:{extra:{}}});
      assert.equal(cfg.android.package,variant==='staging'?'org.mzbministry.buklod.staging':'org.mzbministry.buklod');
      assert.equal(cfg.runtimeVersion,variant==='production'?'1.3.2':flag==='true'?'2.0.3-genesis-unified-godot':'2.0.2-genesis-godot-arena');
      assert.equal(cfg.plugins.includes('./plugins/withBuklodGodotArenaPack.js'),variant==='staging');
      if(variant==='production')assert.equal(cfg.version,'1.3.6');
    }
  }finally{for(const [n,v] of Object.entries(saved))if(v===undefined)delete process.env[n];else process.env[n]=v;}
});
