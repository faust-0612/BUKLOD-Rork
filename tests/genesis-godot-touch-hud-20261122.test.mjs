import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const get = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('combat clock is sole cooldown source for live Godot HUD', () => {
  const sim = get('godot/empire-arena/scripts/arena_simulation.gd');
  const hud = get('godot/empire-arena/scripts/arena_hud.gd');
  const root = get('godot/empire-arena/scripts/arena_root.gd');
  assert.match(sim, /func cooldown_snapshot\(id: String\)/);
  assert.match(sim, /func _cooldown_seconds\(p: Dictionary, slot: String\)/);
  assert.match(root, /hud\.set_snapshot\(sim\.state, sim\.cooldown_snapshot\("A0"\)\)/);
  assert.match(hud, /func _cooldown_ring\(/);
  assert.match(hud, /func _draw_minimap\(/);
  assert.match(hud, /func release_joystick\(/);
  assert.match(hud, /active_joystick == -1 and event\.position\.x/);
});
test('inherited Godot scene contains actual multi-touch behavioral smoke', () => {
  assert.match(get('godot/empire-arena/scenes/ArenaTouchTest.tscn'), /res:\/\/scenes\/Arena\.tscn/);
  const smoke = get('godot/empire-arena/tests/hud_touch_smoke.gd');
  assert.match(smoke, /InputEventScreenTouch\.new\(\)/);
  assert.match(smoke, /InputEventScreenDrag\.new\(\)/);
  assert.match(smoke, /cooldown_snapshot\("A0"\)/);
  assert.match(smoke, /BUKLOD_GODOT_TOUCH_PASS/);
});
