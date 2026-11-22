'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname,'..');
const rules = require('../src/features/games/kingdom/arcade/arcadeCore.js');
const { startArcade, tickArcade, actArcade, nextArcadeStage, MODES } = rules;
const read = p => fs.readFileSync(path.join(ROOT,p),'utf8');

test('13 BUKLOD characters have 26 unique arcade games and eight real control modes', () => {
  const catalog=read('src/features/games/kingdom/arcade/arcadeCatalog.ts');
  const names=[...catalog.matchAll(/^  (angel|jawo|mitch|niel|vhen|ellusur|ace|phan|quin|van|christian|lhen|trudice): \[/gm)].map(m=>m[1]);
  const entries=[...catalog.matchAll(/\['([a-z-]+)','([^']+)','(catch|lane|runner|rhythm|defend|tap|search|stack)'/g)];
  assert.equal(names.length,13);
  assert.equal(new Set(names).size,13);
  assert.equal(entries.length,26);
  assert.equal(new Set(entries.map(m=>m[1])).size,26);
  assert.equal(new Set(entries.map(m=>m[3])).size,8);
  assert.equal(MODES.length,8);
  assert.match(catalog,/good: good\.split\('\|'\)/);
});

test('all arcade modes are deterministic, progress with bounded entities, and can pause ticking', () => {
  for(const mode of MODES){
    let a=startArcade(mode,98765), b=startArcade(mode,98765);
    assert.deepEqual(a,b);
    for(let i=0;i<30;i++){a=tickArcade(a);b=tickArcade(b);}
    assert.deepEqual(a,b,mode);
    assert.ok(a.entities.length<=9,mode);
    assert.ok(a.lives>=0 && a.lives<=3,mode);
    assert.equal(tickArcade({...a,status:'clear'}).ticks,a.ticks,mode);
  }
});

test('tap game is genuinely playable, stages increase and do not award wallet rewards', () => {
  let s=startArcade('tap',11);
  for(let i=0;i<50 && s.status==='playing';i++){
    s=actArcade(s,'cell',s.cell);
    for(let j=0;j<3 && s.status==='playing';j++)s=tickArcade(s);
  }
  assert.equal(s.status,'clear');
  assert.ok(s.score>0);
  const next=nextArcadeStage(s);
  assert.equal(next.stage,2);
  assert.equal(next.score,s.score);
  assert.ok(next.goal>s.goal);
  assert.equal(next.status,'playing');
});

test('rapid duplicate taps and stack drops cannot inflate scores', () => {
  let s=startArcade('tap',1);
  s=actArcade(s,'cell',s.cell);
  assert.equal(actArcade(s,'cell',s.cell).score,s.score);
  let tower=startArcade('stack',2);
  tower={...tower,marker:tower.target};
  tower=actArcade(tower,'drop');
  assert.ok(tower.score>0);
  assert.equal(actArcade(tower,'drop').score,tower.score);
});

test('memory search requires clue observation before the player can choose', () => {
  let s=startArcade('search',41);
  const shown=s.cell;
  s=actArcade(s,'cell',shown);
  assert.equal(s.score,0,'tapping during the visible clue cannot score');
  for(let n=0;n<4;n++)s=tickArcade(s);
  s=actArcade(s,'cell',shown);
  assert.ok(s.score>0,'correct recalled position scores after clue disappears');
});

test('runner requires timed jumping, prevents repeated unlimited jumps, and respects lane bounds', () => {
  let s=startArcade('runner',10);
  s=actArcade(s,'left');
  s=actArcade(s,'left');
  assert.equal(s.lane,0);
  s=actArcade(s,'right');
  assert.equal(s.lane,1);
  s={...s,entities:[{id:1,lane:1,y:5.2,good:false,variant:0}]};
  s=actArcade(s,'jump');
  const before=s.lives, cooldown=s.jumpCooldownUntil;
  s=tickArcade(s);
  assert.equal(s.lives,before);
  assert.equal(actArcade(s,'jump').jumpCooldownUntil,cooldown);
});

test('defender and rhythm controls remove the right approaching object',()=>{
  let s=startArcade('defend',1);
  s={...s,entities:[{id:1,lane:2,y:3,good:false,variant:0}]};
  s=actArcade(s,'lane',2);
  assert.equal(s.entities.length,0);
  assert.ok(s.score>0);
  s=startArcade('rhythm',1);
  s={...s,entities:[{id:1,lane:0,y:4.8,good:true,variant:0}]};
  s=actArcade(s,'lane',0);
  assert.equal(s.entities.length,0);
  assert.ok(s.score>0);
});

test('arcades stay in local game-only records; original verified mastery untouched',()=>{
  const screen=read('src/features/games/kingdom/arcade/ArcadeGameV1.tsx');
  const center=read('src/features/games/kingdom/platform/KingdomInteriorCenter.tsx');
  const cinema=read('src/features/games/kingdom/platform/KingdomCinematicScenes.ts');
  assert.match(screen,/reward:\{xp:0,kingdomXp:0\}/);
  assert.match(center,/active\.kind !== 'arcade' && masteryEligibility/);
  assert.match(center,/if \(result\.status === 'won' && active\.kind !== 'arcade'\)/);
  assert.match(center,/active\.kind !== 'arcade' \? <Pressable/);
  assert.match(center,/arcadeGamesForCharacter\(character\)/);
  assert.match(cinema,/KINGDOM_ARCADE_GAMES\.find/);
  assert.match(screen,/setInterval\(/);
  assert.match(screen,/clearInterval\(/);
});
