import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { arenaCamera, arenaScreenToWorld, arenaNearby, arenaVisualEffects } from '../src/features/games/empire/arenaPracticePresentation.mjs';
import { command, createPractice, tick } from '../experiments/empire-arena-v2/arena-v2-engine.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const native = readFileSync(resolve(root, 'src/app/games/empire-arena.tsx'), 'utf8');

test('Camera follows players without clipping any edge, keeps aspect ratio', () => {
  const a = arenaCamera(160, 110, { x: 17, y: 55 }, 800, 400, 70);
  assert.deepEqual(a, { x: 0, y: 37.5, width: 70, height: 35 });
  const b = arenaCamera(160, 110, { x: 155, y: 105 }, 800, 400, 70);
  assert.equal(b.x, 90); assert.equal(b.y, 75);
  assert.equal(b.width / b.height, 2);
  const c = arenaCamera(40, 20, { x: 20, y: 10 }, 800, 400, 200);
  assert.equal(c.x, 0); assert.equal(c.y, 0);
  assert.deepEqual(arenaScreenToWorld(0, 0, 800, 400, a), {x:0, y:37.5});
  assert.deepEqual(arenaScreenToWorld(800, 400, 800, 400, a), {x:70, y:72.5});
});

test('Practice contextual controls reflect authoritative node distances, tower defense and seal gate', () => {
  const s = createPractice({mode:'duel',mapId:'genesis_rift',hero:'phan'});
  const player = s.players.A0;
  let nearby = arenaNearby(s, player);
  assert.equal(nearby.canBank, true);
  assert.equal(nearby.canSiege, false);
  assert.equal(nearby.canBuild, true);
  assert.equal(nearby.loot, null);
  player.x = s.w - 14; player.y = s.h / 2;
  nearby = arenaNearby(s, player);
  assert.equal(nearby.canSiege, false, 'two+ live enemy towers must block siege');
  for (const tower of s.towers.filter(t => t.team === 'B').slice(1)) tower.hp = 0;
  nearby = arenaNearby(s, player);
  assert.equal(nearby.canSiege, true);
  assert.equal(command(s, 'A0', { type: 'seal_attack' }), true);
  assert.equal(s.seals.B.hp < s.seals.B.maxHp, true);
  tick(s);
  assert.equal(arenaNearby(s, player).canBank, false);
});

test('Visual effects are only recent display metadata, not reward operations', () => {
  const sample = [
    {seq:1,time:100,type:'skill',actor:'A0'},
    {seq:2,time:200,type:'defeat',to:'B0'},
    {seq:3,time:350,type:'deposit',actor:'A0'},
    {seq:4,time:1200,type:'dash',actor:'A0'},
  ];
  assert.deepEqual(arenaVisualEffects(sample, 1500).map(e=>e.type), ['dash']);
  assert.deepEqual(arenaVisualEffects(sample, 1500, 1500).map(e=>e.type), ['skill','defeat','dash']);
  assert.deepEqual(arenaVisualEffects(sample, 3000), []);
  assert.equal(arenaVisualEffects(sample, 1200)[0].strength <= 1, true);
});

test('Native in-app Arena exposes every core combat and economic PRACTICE action', () => {
  for(const word of ['arenaCamera(', 'arenaNearby(', 'arenaVisualEffects(', 'minimap','type: \'seal_attack\'', 'type: \'loot\'', 'type: \'build\'', 'type: \'tower_repair\'', 'type: \'tower_upgrade\'', 'type: \'train\'', 'type: \'order\'', 'type: \'deposit\'', 'type: \'mine\'', 'type: \'attack\'', 'type: \'skill\'']){
    assert.ok(native.includes(word), 'Missing in-app command '+word);
  }
  assert.doesNotMatch(native, /supabase\.|\.rpc\(|awardDiamond|awardBp|settleWorldTrade/);
});
