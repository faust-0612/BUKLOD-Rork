import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Kingdom and personal worlds are Godot scenes but never new authorities',()=>{
  const scene=read('godot/empire-arena/scripts/world_preview.gd');
  const root=read('src/features/season2/world/Season2DevelopmentMap.tsx');
  const native=read('modules/buklod-genesis-godot/index.ts');
  assert.match(scene,/Thirteen permanent character stations/);
  assert.match(scene,/range\(13\)/);
  for(const mode of ['kingdom','community','house']){
    assert.ok(scene.includes('"' + mode + '"'));
    assert.ok(native.includes("'" + mode + "'"));
  }
  assert.match(scene,/MAX_LEVEL := 10/);
  assert.match(scene,/STAGES := \[/);
  assert.match(root,/openBundledBuklodWorld/);
  assert.match(root,/GODOT KINGDOM PREVIEW/);
  assert.doesNotMatch(scene,/supabase|awardBP|transfer|wallet|service_role|https?:\/\//i);
});
