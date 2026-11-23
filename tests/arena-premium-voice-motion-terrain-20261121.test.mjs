import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {HEROES,createPractice,command} from '../experiments/empire-arena-v2/arena-v2-engine.mjs';
import {arenaActionVisuals,ARENA_EFFECT_KIND} from '../src/features/games/empire/arenaActionVisuals.mjs';
import {arenaAnnouncementForCue,selectArenaAnnouncement,ARENA_ANNOUNCEMENTS}
 from '../src/features/games/empire/arenaVoiceDirector.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(resolve(root,path),'utf8');

test('priority-aware spoken Arena announcer never confuses allied and enemy events',()=>{
  for(const id of ['ally_down','enemy_down','self_down','tower_ally','tower_enemy',
    'seal_ally','seal_enemy','build_complete','tower_upgrade','round_win','round_loss']){
    assert.ok(arenaAnnouncementForCue({id}),id);
  }
  assert.notEqual(ARENA_ANNOUNCEMENTS.tower_enemy.text,ARENA_ANNOUNCEMENTS.tower_ally.text);
  assert.equal(arenaAnnouncementForCue({id:'mine'}),null);
  assert.equal(arenaAnnouncementForCue({id:'enemy_down'}).text,'Enemy defeated!');
  assert.equal(selectArenaAnnouncement([{id:'enemy_down'},{id:'seal_ally'}],0,10000).id,'seal_ally');
  assert.equal(selectArenaAnnouncement([{id:'seal_ally'}],9900,10000),null,
    'do not hammer device TTS at game frame rate');
  assert.equal(selectArenaAnnouncement([{id:'skill'}],0,10000),null);
});
test('announcer honors app audio focus, installed device engine and independent voice switch',()=>{
  const route=read('src/app/games/empire-arena.tsx');
  const runtime=read('src/features/games/empire/ArenaVoiceRuntime.ts');
  assert.match(route,/setArenaVoiceFocus\(true\)/);
  assert.match(route,/setArenaVoiceFocus\(false\)/);
  assert.match(route,/setVoiceEnabled\(!voiceEnabled\)/);
  assert.match(route,/stopArenaVoiceAnnouncements\(\)/);
  assert.match(route,/if \(voiceEnabled\) playArenaVoiceAnnouncements\(drained.cues, true\)/);
  assert.match(route,/if \(voiceEnabled\) playArenaVoiceAnnouncements\(drain.cues,true\)/);
  assert.match(route,/if \(sfxEnabled\) for \(const cue of drain.cues\)/);
  for(const token of ['AppState.currentState','isBuklodGameSoundEnabled',
    'getBuklodGameSoundVolume','subscribeBuklodAudioFocus','Speech.speak','Speech.stop',
    "Platform.OS==='web'"])assert.ok(runtime.includes(token),token);
  assert.doesNotMatch(runtime,/fetch\(|supabase|awardDiamond|\.rpc\(/);
});
test('simulation verified hit triggers real overlapping slash sparks and correct victim coordinates',()=>{
  const s=createPractice({mode:'duel',hero:'ace',foes:['phan']});
  const me=s.players.A0,enemy=s.players.B0;
  me.x=enemy.x-2.7;me.y=enemy.y;
  const hp=enemy.hp;
  assert.equal(command(s,'A0',{type:'attack',targetId:'B0'}),true);
  assert.ok(enemy.hp<hp);
  const hit=arenaActionVisuals(s,s.elapsed+100,1000).find(x=>x.kind==='hit');
  assert.ok(hit,'engine must create a real hit effect');
  assert.equal(hit.target,'B0');
  assert.equal(hit.x,enemy.x);
  assert.equal(hit.y,enemy.y);
  assert.ok(hit.amount>0);
  assert.ok(hit.fromX<enemy.x);
  assert.ok(hit.progress>0&&hit.alpha>0);
  assert.equal(ARENA_EFFECT_KIND.tower_destroyed,'tower_break');
});
test('only recent events make effects, capped for 5v5 and no outcome ownership',()=>{
  const s=createPractice({mode:'duel',hero:'phan'});
  const who=s.players.A0;
  for(let i=0;i<100;i++)s.events.push({
    seq:1000+i,type:'damage',time:500+i*10,from:'A0',to:'B0',
    amount:4,x:who.x+3,y:who.y,
  });
  const recent=arenaActionVisuals(s,1520,850,11);
  assert.ok(recent.length<=11);
  assert.ok(recent.every(x=>x.progress>=0&&x.progress<=1));
  assert.deepEqual(arenaActionVisuals(s,50000),[]);
});
test('hero animation follows server poses, flinches only on a damage sequence and folds on KO',()=>{
  const actor=read('src/features/games/empire/ArenaAnimatedActor.tsx');
  const route=read('src/app/games/empire-arena.tsx');
  for(const token of ['withSequence','hitSequence','knockedOut','stagger.value','hitGlow.value',
    'collapse.value','withRepeat','withTiming','cancelAnimation','AnimatedExpoImage'])
    assert.ok(actor.includes(token),token);
  assert.match(route,/hitSequence=\{lastDamage\?\.seq\?\?0\} knockedOut=\{!life\(p\)\}/);
  assert.match(route,/state\.events\.slice\(-35\)/);
  assert.match(route,/fullbody:' \+ p.hero \+ '_' \+ pose/);
  assert.equal(Object.keys(HEROES).length,13);
  assert.doesNotMatch(actor,/fetch\(|awardBp|awardDiamond|supabase/);
});
test('state-driven battle art now shows actual 2.5D citadels, three terrain types and hit fragments',()=>{
  const route=read('src/app/games/empire-arena.tsx');
  const base=read('src/features/games/empire/ArenaBaseArt.tsx');
  const terrain=read('src/features/games/empire/ArenaTerrainArt.tsx');
  const effect=read('src/features/games/empire/ArenaActionFx.tsx');
  for(const token of ['<ArenaTerrainArt','<ArenaBaseArt','<ArenaActionFx',
    'arenaActionVisuals(state, state.elapsed','<ArenaStructureArt','<ArenaWildlifeArt',
    '<ArenaResourceLootArt'])assert.ok(route.includes(token),token);
  for(const token of ['seal.breached','seal.hp','Rect','Polygon','BREACHED','A CAPITAL','B CAPITAL'])
    assert.ok(base.includes(token),token);
  for(const token of ['genesis_rift','aurora_foundry','verdant_fracture','cover.map',
    'Obstacle','Ellipse','Path','Polygon'])assert.ok(terrain.includes(token),token);
  for(const token of ['Streak','Shatter','Skill','Mining','Loot','Construction','Level',
    '<Polygon','<Path','<SvgText','fx.amount'])assert.ok(effect.includes(token),token);
  assert.doesNotMatch(effect,/awardBp|diamond|\.rpc\(/i);
});
