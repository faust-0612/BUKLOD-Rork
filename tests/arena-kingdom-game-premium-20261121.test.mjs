import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import {
  ARENA_HUD_VERSION, ARENA_HUD_DEFAULT, ARENA_HUD_KEYS,
  clampArenaHudPoint, moveArenaHudPoint,
  sanitizeArenaHudLayout, serializeArenaHudLayout,
} from '../src/features/games/empire/arenaHudLayout.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root, path), 'utf8');

test('nine independent radial controls have ergonomic normalized anchors', () => {
  assert.equal(ARENA_HUD_VERSION, 2);
  assert.equal(ARENA_HUD_KEYS.length, 9);
  assert.deepEqual(Object.keys(ARENA_HUD_DEFAULT), ARENA_HUD_KEYS);
  assert.ok(ARENA_HUD_DEFAULT.joystick.x < .2);
  assert.ok(ARENA_HUD_DEFAULT.attack.x > .8);
  assert.ok(ARENA_HUD_DEFAULT.primary.x < ARENA_HUD_DEFAULT.attack.x);
  assert.notEqual(ARENA_HUD_DEFAULT.mine.y, ARENA_HUD_DEFAULT.bank.y,
    'Contextual tools should form a shallow arc, not a cheap row');
  assert.equal(ARENA_HUD_DEFAULT.bank.y, ARENA_HUD_DEFAULT.train.y);
  for (const key of ARENA_HUD_KEYS) {
    assert.ok(ARENA_HUD_DEFAULT[key].x >= 0 && ARENA_HUD_DEFAULT[key].x <= 1);
    assert.ok(ARENA_HUD_DEFAULT[key].y >= 0 && ARENA_HUD_DEFAULT[key].y <= 1);
  }
});

test('drag-to-position is bounded at screen edges and robust under rotations', () => {
  for (const [w,h] of [[812,360],[800,240],[390,780],[140,110]]) {
    const point=moveArenaHudPoint({x:.9,y:.9},100000,-100000,72,w,h);
    const b=clampArenaHudPoint({x:1,y:0},72,w,h);
    assert.ok(point.x <= b.x && point.x >= 0, String(w));
    assert.ok(point.y >= b.y && point.y <= 1, String(h));
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
  }
});

test('per-member locally stored preferences are versioned, validated and never grant gameplay rewards', () => {
  const defaults=sanitizeArenaHudLayout(null);
  assert.deepEqual(defaults, ARENA_HUD_DEFAULT);
  assert.deepEqual(sanitizeArenaHudLayout('{not json'), ARENA_HUD_DEFAULT);
  assert.deepEqual(sanitizeArenaHudLayout({version:1,positions:{attack:{x:0,y:0}}}), ARENA_HUD_DEFAULT);
  const custom = {...defaults, attack:{x:.75,y:.83}};
  assert.deepEqual(sanitizeArenaHudLayout(serializeArenaHudLayout(custom)).attack, custom.attack);
  const corrupted={version:2,positions:{attack:{x:Infinity,y:0},primary:{x:-1,y:999},joystick:{x:.22,y:.77}}};
  const recovered=sanitizeArenaHudLayout(corrupted);
  assert.deepEqual(recovered.attack, ARENA_HUD_DEFAULT.attack);
  assert.deepEqual(recovered.primary, ARENA_HUD_DEFAULT.primary);
  assert.deepEqual(recovered.joystick, corrupted.positions.joystick);
});

test('actual Arena uses themed circular glyphs, local asset menus, editor, cooldown and accurate game commands', () => {
  const route=read('src/app/games/empire-arena.tsx');
  const hud=read('src/features/games/empire/ArenaCombatHud.tsx');
  const animation=read('src/features/games/empire/ArenaAnimatedActor.tsx');
  const art=read('src/features/games/empire/arenaGeneratedAssets.ts');
  assert.match(route, /<ArenaCombatHud /);
  assert.match(route, /PRIMARY_GLYPH_BY_STYLE\[HEROES\[game\?\.solo \? soloHero : hero\]\?\.style\]/);
  assert.match(route, /@buklod_arena_hud_v2:/);
  assert.match(route, /setHudEditing\(true\)/);
  assert.match(route, /Save Arena control positions/);
  assert.match(route, /const cooldownFor =/);
  assert.match(route, /resolveGear\(me.hero, me.gear/);
  assert.match(route, /arenaKind === 'practice'/);
  assert.match(route, /ARENA_GENERATED_ART\['scene:' \+ m\]/);
  assert.match(route, /ARENA_GENERATED_ART\['fullbody:' \+ soloHero \+ '_idle'\]/);
  assert.match(hud, /RadialGradient/);
  assert.match(hud, /PanResponder.create/);
  assert.match(hud, /gesture\.dx/);
  assert.match(hud, /joystickHandlers/);
  assert.match(hud, /cooldownMs/);
  assert.match(animation, /health=1/);
  assert.match(animation, /abilityFlash/);
  assert.match(animation, /arena-hero-aura/);
  for (const pose of ['idle','walk','attack','skill']) assert.ok(art.includes('fullbody:phan_'+pose));
  for (const map of ['genesis_rift','aurora_foundry','verdant_fracture']) assert.ok(art.includes('scene:'+map));
  assert.doesNotMatch(route, /[.]rpc\(|awardDiamond|awardBp|settleWorldTrade/);
});
