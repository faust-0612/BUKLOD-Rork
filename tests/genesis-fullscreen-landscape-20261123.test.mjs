import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const settings = source('godot/empire-arena/project.godot');
const manifest = source('native-genesis/android/app/src/main/AndroidManifest.xml');
const hud = source('godot/empire-arena/scripts/arena_hud.gd');
const arena = source('godot/empire-arena/scripts/arena_root.gd');
test('Godot and Android host agree on landscape, fullscreen and expanded aspect', () => {
  assert.match(settings, /^window\/handheld\/orientation=0$/m);
  assert.doesNotMatch(settings, /^window\/handheld\/orientation=1$/m);
  assert.match(manifest, /android:name="\.GenesisGameActivity"[\s\S]*?android:screenOrientation="landscape"/);
  assert.match(settings, /^window\/size\/mode=3$/m);
  assert.match(settings, /^window\/stretch\/aspect="expand"$/m);
  assert.match(settings, /^window\/stretch\/mode="canvas_items"$/m);
  assert.match(settings, /^window\/size\/viewport_width=1280$/m);
  assert.match(settings, /^window\/size\/viewport_height=720$/m);
});
test('HUD top control visual and touch hitboxes remain aligned', () => {
  assert.match(hud, /_panel\(Rect2\(10, 8, 98, 46\), "EXIT"\)/);
  assert.match(hud, /_panel\(Rect2\(116, 8, 106, 46\), "PAUSE"/);
  assert.match(hud, /if at\.y < 56 and at\.x < 112: exit_requested\.emit\(\); return/);
  assert.match(hud, /if at\.y < 56 and at\.x < 230: pause_requested\.emit\(\); return/);
  assert.match(hud, /_text\(Vector2\(x - 23, y \+ 7\), label, 19\)/);
  assert.match(hud, /str\(p\.get\("level", 1\)\), 18\)/);
});
test('Camera zoom preserves manual zoom and increases hero readability', () => {
  assert.match(arena, /clampf\(width \/ 900\.0, 0\.85, 1\.55\)/);
  assert.match(arena, /scale_zoom = clampf\(scale_zoom \* factor, 0\.65, 2\.6\)/);
});
