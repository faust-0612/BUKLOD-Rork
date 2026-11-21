import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('native Godot minion wave logic has symmetric classes, caps, cooldowns and event hooks',()=>{
  const native=read('godot/empire-arena/scripts/native_minion_waves.gd');
  assert.match(native,/FIRST_WAVE := 8\.0/);
  assert.match(native,/WAVE_INTERVAL := 24\.0/);
  assert.match(native,/TEAM_CAP := 42/);
  for(const kind of ['vanguard','ranger','mender','siege_breaker'])
    assert.match(native,new RegExp('"'+kind+'"'));
  assert.match(native,/for team in \["A", "B"\]/);
  assert.match(native,/for lane in range\(3\)/);
  assert.match(native,/minion_heal/);
  assert.match(native,/minion_siege_hit/);
  assert.match(native,/tower_destroyed/);
  assert.match(native,/sim\._line_blocked/);
  assert.match(native,/sim\._move/);
  assert.doesNotMatch(native.split('\n').filter(s=>!s.trimStart().startsWith('#')).join('\n'),
    /supabase|awardBP|characterDiamonds|wallet|fetch\(|https?:\/\//i);
});
test('real Godot simulation and renderer carry minions in native scene and event stream',()=>{
  const sim=read('godot/empire-arena/scripts/arena_simulation.gd');
  const root=read('godot/empire-arena/scripts/arena_root.gd');
  assert.match(sim,/NATIVE_MINION_WAVES\.init\(self\)/);
  assert.match(sim,/NATIVE_MINION_WAVES\.step\(self\)/);
  assert.match(sim,/for category in \["units", "minions", "towers", "buildings"\]/);
  assert.match(root,/for minion in s\.get\("minions", \[\]\)/);
  for(const kind of ['vanguard','ranger','mender','siege_breaker'])
    assert.match(root,new RegExp('"'+kind+'"'));
  const sceneTest=read('godot/empire-arena/tests/native_minion_smoke.gd');
  assert.match(sceneTest,/BUKLOD_NATIVE_MINION_PASS/);
  assert.match(sceneTest,/lane tower protects B seal/);
  assert.match(sceneTest,/match minions never access persistent member economy/);
});
