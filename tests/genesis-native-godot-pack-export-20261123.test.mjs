import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const read=p=>readFileSync(new URL('../native-genesis/'+p,import.meta.url),'utf8');
const script=read('prepare-pack-local.sh'), preset=read('godot-export-presets.cfg');
const workflow=readFileSync(new URL('../.github/workflows/genesis-native-gha-godot-pack-20261123.yml',import.meta.url),'utf8');
test('real PCK export uses existing deterministic source and Godot native export, not a renamed ZIP',()=>{
 assert.match(script,/scripts\/build-empire-godot-pack\.mjs/);
 assert.match(script,/--export-pack "BUKLOD Native Pack"/);
 assert.match(script,/b"GDPC"/);
 assert.match(script,/BUKLOD_GODOT_ARENA_SCENE_READY/);
 assert.match(script,/BUKLOD_GENESIS_GODOT_WORLDS_PASS/);
 assert.match(script,/sha256sum/);
 assert.match(script,/rm -f "\$DEST\/empire-arena\.pck"/);
 assert.match(preset,/name="BUKLOD Native Pack"/);
 assert.match(preset,/platform="Linux"/);
 assert.match(preset,/export_filter="all_resources"/);
 assert.match(preset,/include_filter="[^"]*\.json/);
});
test('Godot pack QA is on a fixed DEV branch, bounded, read-only and cannot publish',()=>{
 assert.match(workflow,/dev\/genesis-native-gha-godot-pack-20261123/);
 assert.match(workflow,/github\.repository == 'faust-0612\/BUKLOD-Rork'/);
 assert.match(workflow,/GENESIS_NATIVE_GODOT_PACK_QA:/);
 assert.match(workflow,/timeout-minutes: 14/);
 assert.match(workflow,/permissions:\s*\n\s*contents: read/);
 assert.match(workflow,/persist-credentials: false/);
 for(const content of [script,workflow])assert.doesNotMatch(content,/assembleRelease|assembleDebug|upload-artifact|eas\s+build|expo\s+prebuild|vercel|secrets\./i);
});
test('PCK exporter fails fast without an actual Godot binary instead of fabricating a pack',()=>{
 const r=spawnSync('bash',[new URL('../native-genesis/prepare-pack-local.sh',import.meta.url).pathname],{
  env:{...process.env,GODOT_BIN:'definitely-not-installed-buklod-godot-472'},encoding:'utf8',timeout:7000});
 assert.notEqual(r.status,0);
 assert.match(r.stderr,/Godot 4\.7\.2 editor unavailable/);
});

test('All three backdrops and four audio cues survive genuine PCK export as imported resources',()=>{
 const gd=readFileSync(new URL('../godot/empire-arena/scripts/world_preview.gd',import.meta.url),'utf8');
 const smoke=readFileSync(new URL('../godot/empire-arena/tests/world_smoke.gd',import.meta.url),'utf8');
 for(const name of ['kingdom','community','house']) {
   assert.ok(gd.includes('preload("res://world-art/'+name+'.webp")'),name);
 }
 for(const name of ['navigation','build_start','build_complete','claim']) {
   assert.ok(gd.includes('preload("res://world-audio/'+name+'.wav")'),name);
 }
 assert.match(gd,/image_texture = WORLD_ART\[world_id\] as Texture2D/);
 assert.match(gd,/WORLD_AUDIO\[name\] as AudioStream/);
 assert.match(smoke,/picture\.get_width\(\)/);
 assert.match(smoke,/clip\.get_length\(\)/);
 assert.match(smoke,/world\.audio\.stop\(\)/);
 assert.match(smoke,/world\.free\(\)/);
 assert.match(smoke,/call_deferred\("quit", 0\)/);
 assert.doesNotMatch(smoke,/\n\s*quit\(0\)/);
 for(const c of [gd,smoke])assert.doesNotMatch(c,/Image\.load_from_file|AudioStreamWAV\.load_from_file/);
});
