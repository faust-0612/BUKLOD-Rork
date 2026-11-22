import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const arena = read('src/app/games/empire-arena.tsx');
const hud = read('src/features/games/empire/ArenaCombatHud.tsx');
const world = read('src/features/season2/world/Season2DevelopmentMap.tsx');

test('Arena core game input and mechanics are retained while controls become readable', () => {
  for (const token of ['<ArenaCombatHud', 'onPinchZoom(factor)', 'styles.tacticsCompact']) {
    assert.ok(arena.includes(token), token);
  }
  for (const token of ["joystick: 91, attack: 72", "mine: 44, bank: 44, train: 44, tactics: 44", "cooldownMs", "onPress={item.onPress}"]) {
    assert.ok(hud.includes(token), token);
  }
  assert.match(arena, /zoomButton: \{ minWidth: 44, minHeight: 44/);
  assert.match(arena, /controlLabel: \{ color: '#ffe7b5', fontSize: 10/);
  assert.match(arena, /teamCallButton: \{minWidth:73,minHeight:40/);
  assert.match(hud, /buttonLabel: \{position:'absolute',bottom:2,fontSize:10/);
  assert.match(hud, /utilityLabel: \{fontSize:10,bottom:0\}/);
});

test('Genesis World game control readability does not remove customization and server-authorized preview', () => {
  for (const token of ['SAVE DESIGN TO SERVER','previewCustomize', 'EstateConstructionConsole', 'getDevelopmentStageAsset(previewTrack,level,stage)']) {
    assert.ok(world.includes(token), token);
  }
  for (const pattern of [
    /previewToggle:\{minHeight:44/,
    /zoomButton:\{minWidth:44,minHeight:44/,
    /studioTab:\{flex:1,minHeight:44/,
    /stage:\{flex:1,minHeight:44/,
    /metricLabel:\{color:'#C4DBD1',fontSize:10/
  ]) assert.match(world, pattern);
});
