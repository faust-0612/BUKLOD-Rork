import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Godot premium animation is integrated into the real Arena root without changing economy authority',()=>{
  const root=read('godot/empire-arena/scripts/arena_root.gd');
  const animation=read('godot/empire-arena/scripts/hero_animation.gd');
  const fx=read('godot/empire-arena/scripts/arena_effects.gd');
  const shader=read('godot/empire-arena/shaders/arena_impact.gdshader');
  assert.match(root,/ANIM_SCRIPT = preload\("res:\/\/scripts\/hero_animation.gd"\)/);
  assert.match(root,/FX_SCRIPT = preload\("res:\/\/scripts\/arena_effects.gd"\)/);
  assert.match(root,/animator.sample\(str\(p\["id"\]\), pos, frames\)/);
  assert.match(root,/effect_layer.play_event/);
  for(const state of ['idle','walk','attack','skill'])assert.ok(animation.includes('"'+state+'"'));
  assert.match(animation,/const WALK_HOLD := 0\.17/);
  assert.match(animation,/posmod\(int\(floor\(/);
  assert.match(fx,/const LIMIT := 28/);
  assert.match(fx,/ImageTexture.create_from_image/);
  for(const event of ['skill','damage','defeat','seal_damage','field_pickup_claimed','construction_complete','level_up'])
    assert.ok(fx.includes('"'+event+'"'),'Missing event style '+event);
  assert.match(shader,/shader_type canvas_item;/);
  assert.match(shader,/render_mode blend_add, unshaded;/);
  for(const source of [root,animation,fx,shader])
    assert.doesNotMatch(source,/https?:\/\/|supabase\s*\.|service_role|award_bp|diamond_transfer/i);
});

test('Native Godot pack carries shader and animation controller instead of leaving them on disk',()=>{
  const pack=read('scripts/build-empire-godot-pack.mjs');
  assert.match(pack,/\\\.gdshader/);
  for(const p of ['scripts/arena_effects.gd','scripts/hero_animation.gd','shaders/arena_impact.gdshader'])
    assert.ok(pack.includes("'"+p+"'"),'Pack must fail closed without '+p);
  assert.match(read('godot/empire-arena/tests/premium_smoke.gd'),
    /BUKLOD_GODOT_PREMIUM_SMOKE_PASS/);
});

test('Blender kit is authored and Python-parsable, with separate team assets and canonical hero identity protected',t=>{
  const path='scripts/generate-arena-blender-kit.py';
  const source=read(path);
  for(const part of ['make_tower','make_seal','make_resource','make_tree','make_villager','export_scene.gltf'])
    assert.ok(source.includes(part));
  assert.match(source,/for team, x in \[\("A", -11\), \("B", 11\)\]/);
  assert.match(source,/no/i);
  assert.doesNotMatch(source,/http:\/\/|https:\/\/|service_role|supabase\/|bpy\.ops\.object\.delete\(.*production/);
  const python=spawnSync('python3',['-c',
    'import ast,sys;ast.parse(open(sys.argv[1],encoding="utf-8").read())',path],
    {cwd:new URL('../',import.meta.url),encoding:'utf8'});
  if(python.error?.code==='ENOENT'){t.diagnostic('python3 unavailable: Blender script AST parse deferred');return;}
  assert.equal(python.status,0,python.stderr);
});

test('Authoritative server cancels async reservation after client disconnect, no local ranked settlement',()=>{
  const backend=read('services/empire-arena/core.mjs');
  assert.match(backend,/player_disconnected_during_escrow/);
  assert.match(backend,/p.kind==='allocating'/);
  assert.match(backend,/this.store.abort\(\{matchId,reason:'match_initialization_failed'\}\)/);
  const regression=read('services/empire-arena/tests/core.test.mjs');
  assert.match(regression,/participant disconnects mid-allocation/);
  assert.match(regression,/No ghost live match/);
});
