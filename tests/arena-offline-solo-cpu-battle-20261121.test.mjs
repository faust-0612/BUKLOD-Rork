import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {command,HEROES} from '../experiments/empire-arena-v2/arena-v2-engine.mjs';
import {
  createOfflineSoloBattle,tickOfflineSolo,SOLO_ROUND_MS,SOLO_INTERMISSION_MS,
  SOLO_TARGET_WINS,SOLO_CPU_DIFFICULTIES,
} from '../experiments/empire-arena-v2/arena-v2-solo.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=path=>readFileSync(resolve(root,path),'utf8');
const setup=options=>createOfflineSoloBattle({mapId:'verdant_fracture',...options});
const run=(s,steps)=>{for(let i=0;i<steps&&s.status==='active';i++)tickOfflineSolo(s);return s};

test('offline solo battle is a self-contained 1v1 using all 13 canonical BUKLOD characters',()=>{
  for(const hero of Object.keys(HEROES)){
    const opponent=Object.keys(HEROES).find(h=>h!==hero);
    const s=setup({hero,opponent});
    assert.equal(s.kind,'OFFLINE_SOLO_CPU');
    assert.equal(s.ranked,false);
    assert.equal(s.mode,'duel');
    assert.deepEqual(Object.keys(s.players),['A0','B0']);
    assert.equal(s.players.A0.hero,hero);
    assert.equal(s.players.B0.hero,opponent);
    assert.equal(s.players.A0.bot,false);
    assert.equal(s.players.B0.bot,false,'old miner bot must be replaced by combat CPU');
    assert.equal(s.players.A0.matchLevel,6,'all skills available in match-only sandbox');
    assert.equal(s.players.B0.matchLevel,6);
    assert.equal(s.players.A0.hp,s.players.B0.hp);
    assert.equal(s.creatures.length,0);
    assert.equal(s.towers.length,0);
    assert.equal(s.units.length,0);
    assert.equal(s.nodes.length,0);
    assert.equal(s.buildings.length,0);
    assert.equal(s.solo.difficulty,'normal');
    assert.equal(s.result,null);
  }
});

test('CPU navigates toward player and deals real, engine-verified HP damage without a connection',()=>{
  const s=setup({hero:'phan',opponent:'ace',difficulty:'hard'});
  const first=Math.hypot(s.players.A0.x-s.players.B0.x,s.players.A0.y-s.players.B0.y);
  run(s,250);
  const after=Math.hypot(s.players.A0.x-s.players.B0.x,s.players.A0.y-s.players.B0.y);
  assert.ok(after<first,'CPU moved from start to real combat range');
  assert.ok(s.events.some(e=>e.type==='damage'&&e.from==='B0')||
    s.solo.wins.B>0,'CPU can score verified melee/skill damage');
  assert.ok(s.solo.cpuDecisions>5,'CPU makes tactical decisions');
});

test('CPU skill use is bounded by the exact engine mana and cooldown checks',()=>{
  const s=setup({opponent:'niel',difficulty:'hard'});
  const cpu=s.players.B0;
  cpu.x=s.players.A0.x+3;cpu.y=s.players.A0.y;
  run(s,160);
  const skills=s.events.filter(e=>e.type==='skill'&&e.actor==='B0');
  assert.ok(skills.length>0,'CPU successfully triggered a real hero skill');
  const sameSlot=skills.filter(e=>e.slot==='primary');
  for(let i=1;i<sameSlot.length;i++)assert.ok(sameSlot[i].time-sameSlot[i-1].time>=5800,
    'no artificial bot cooldown bypass');
  assert.ok(cpu.mana>=0 && cpu.mana<=cpu.maxMana);
  assert.ok(s.players.A0.hp<s.players.A0.maxHp || s.solo.wins.B>0);
});

test('best-of-three scores genuine knockouts, respawns locally and ends with decisive victory',()=>{
  const s=setup();
  assert.equal(SOLO_TARGET_WINS,2);
  for(let round=1;round<=2;round++){
    s.players.B0.hp=0;s.players.B0.alive=false;
    tickOfflineSolo(s);
    assert.equal(s.solo.wins.A,round);
    if(round===1){
      assert.equal(s.status,'active');
      assert.ok(s.solo.intermissionUntil>s.elapsed);
      run(s,Math.ceil(SOLO_INTERMISSION_MS/100)+1);
      assert.equal(s.solo.round,2);
      assert.equal(s.players.A0.alive,true);
      assert.equal(s.players.B0.alive,true);
      assert.equal(s.players.A0.hp,s.players.A0.maxHp);
      assert.equal(s.players.B0.hp,s.players.B0.maxHp);
      assert.equal(s.players.A0.cooldowns.primary,-1e8);
    }
  }
  assert.equal(s.status,'finished');
  assert.deepEqual(s.result,{winner:'A',reason:'offline_cpu_best_of_three'});
  assert.equal(run(s,100).result.winner,'A');
  assert.equal(s.events.filter(e=>e.type==='result').length,1,'idempotent result');
});

test('CPU can win actual rounds; a defeat must not be auto-converted to player victory',()=>{
  const s=setup({opponent:'van',difficulty:'easy'});
  for(let i=0;i<2;i++){
    s.players.A0.hp=0;s.players.A0.alive=false;
    tickOfflineSolo(s);
    if(i===0)run(s,Math.ceil(SOLO_INTERMISSION_MS/100)+1);
  }
  assert.equal(s.status,'finished');
  assert.equal(s.result.winner,'B');
  assert.equal(s.solo.wins.B,2);
});

test('round timer decides using remaining real HP, not a coin-flip or scripted winner',()=>{
  const s=setup();
  assert.equal(SOLO_ROUND_MS,90000);
  s.players.A0.hp=130;s.players.B0.hp=70;
  s.solo.roundStartedAt=s.elapsed-SOLO_ROUND_MS;
  tickOfflineSolo(s);
  assert.equal(s.solo.wins.A,1);
  assert.ok(s.solo.intermissionUntil>0);
});

test('difficulty presets affect CPU decision rate without changing hidden attack or HP multipliers',()=>{
  assert.deepEqual(Object.keys(SOLO_CPU_DIFFICULTIES),['easy','normal','hard']);
  const recorded={};
  for(const diff of Object.keys(SOLO_CPU_DIFFICULTIES)){
    const s=setup({difficulty:diff,opponent:'ace'});
    assert.equal(s.players.A0.maxHp,s.players.B0.maxHp);
    assert.equal(s.players.A0.matchLevel,s.players.B0.matchLevel);
    run(s,35);
    recorded[diff]=s.solo.cpuDecisions;
  }
  assert.ok(recorded.hard>recorded.normal);
  assert.ok(recorded.normal>recorded.easy);
});

test('same inputs and seed produce identical local battle replay at fixed ticks',()=>{
  const a=setup({seed:3308,opponent:'mitch',difficulty:'normal'});
  const b=setup({seed:3308,opponent:'mitch',difficulty:'normal'});
  run(a,100);run(b,100);
  assert.deepEqual(a,b);
});

test('solo module requires neither signal nor backend and cannot modify the real economy',()=>{
  const solo=source('experiments/empire-arena-v2/arena-v2-solo.mjs');
  const route=source('src/app/games/empire-arena.tsx');
  // Comments can name forbidden services when documenting their absence;
  // validate executable code, not descriptive documentation.
  const executable = solo.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  assert.doesNotMatch(executable,/https?:|fetch\(|supabase|websocket|AsyncStorage|awardBp|awardDiamond|rpc\(|balance|withdrawal/i);
  assert.match(route,/createOfflineSoloBattle/);
  assert.match(route,/hero:soloHero,opponent:cpuHero/);
  assert.match(route,/const \[soloHero,setSoloHero\]/);
  assert.match(route,/soloHeroTouched\.current=true/);
  assert.match(route,/if\(!soloHeroTouched\.current\)setSoloHero/);
  assert.ok(route.indexOf('BATTLEFIELD')<route.indexOf('PLAY OFFLINE • VS CPU'),
    'offline map choices must be accessible before the Start button');
  assert.match(route,/tickOfflineSolo\(state\)/);
  assert.match(route,/onPress=\{startSolo\}/);
  assert.match(route,/PLAY OFFLINE • VS CPU/);
  assert.match(route,/Fight CPU/);
  assert.match(route,/CPU DIFFICULTY/);
  assert.match(route,/game\.solo\.wins\.A/);
  assert.match(route,/game\.solo \? startSolo : start/);
  assert.match(route,/if \(!user\) return <Redirect href="\/\(auth\)\/login"\/>/,
    'offline mode must not bypass account/security boundaries');
  assert.doesNotMatch(solo,/from ['"]@\/|from ['"]react-native/,'module should run in pure Node and Metro offline');
});
