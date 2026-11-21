import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  ARENA_SOUND_CUE,arenaCueForEvent,drainArenaSoundscape,
  nearbyArenaBuffCue,ARENA_VISUAL_EVENT_TYPES,
} from '../src/features/games/empire/arenaSoundscape.mjs';
import {createPractice,command,tick,HEROES} from '../experiments/empire-arena-v2/arena-v2-engine.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const load=name=>readFileSync(resolve(root,name),'utf8');
const players={
 A0:{id:'A0',team:'A'},A1:{id:'A1',team:'A'},B0:{id:'B0',team:'B'},B1:{id:'B1',team:'B'},
};
const structures={
 towers:[{id:'A-tower-0',team:'A'},{id:'B-tower-1',team:'B'}],
 buildings:[{id:'build-A',team:'A'},{id:'build-B',team:'B'}],
 units:[{id:'u1',team:'A'},{id:'u2',team:'B'}],
};
const ctx={team:'A',seat:'A0',players,...structures};
const cue=(event,context=ctx)=>arenaCueForEvent(event,context)?.id??null;

test('real hero knockouts distinguish my death, friendly death and enemy death',()=>{
  assert.equal(cue({type:'defeat',from:'B0',to:'A0'}),'self_down');
  assert.equal(cue({type:'defeat',from:'B0',to:'A1'}),'ally_down');
  assert.equal(cue({type:'defeat',from:'A1',to:'B0'}),'enemy_down');
  assert.equal(cue({type:'defeat',from:'A0',to:'B0'}),'enemy_down');
  assert.equal(cue({type:'unit_ko',target:'A1'}),'ally_down');
  assert.equal(cue({type:'unit_ko',target:'u1'}),'ally_unit_down');
  assert.equal(cue({type:'unit_ko',target:'B0'}),'enemy_down');
  assert.equal(cue({type:'unit_ko',target:'u2'}),'enemy_unit_down');
  assert.equal(cue({type:'tower_ko',target:'A0'}),'self_down');
  assert.equal(cue({type:'trap_ko',target:'A1'}),'ally_down');
  assert.equal(cue({type:'boss_ko',target:'B0'}),'enemy_down');
  assert.equal(cue({type:'storm_defeat',actor:'A0'}),'self_down');
  assert.equal(cue({type:'storm_defeat',actor:'A1'}),'ally_down');
  assert.equal(cue({type:'hazard_ko',actor:'B0'}),'enemy_down');
  assert.equal(cue({type:'defeat',from:'A0',to:'A1'}),'ally_down');
});

test('destroyed allied/enemy towers, buildings and seals use high priority side-specific sounds',()=>{
  assert.equal(cue({type:'tower_destroyed',team:'A'}),'tower_ally');
  assert.equal(cue({type:'tower_destroyed',team:'B'}),'tower_enemy');
  assert.equal(cue({type:'building_destroyed',team:'A'}),'building_ally');
  assert.equal(cue({type:'building_destroyed',team:'B'}),'building_enemy');
  assert.equal(cue({type:'seal_breached',team:'A'}),'seal_ally');
  assert.equal(cue({type:'seal_breached',team:'B'}),'seal_enemy');
  assert.equal(cue({type:'seal_restored',team:'A'}),'seal_restored');
  assert.equal(cue({type:'tower_upgrade',tower:'A-tower-0'}),'tower_upgrade');
  assert.equal(cue({type:'tower_upgrade',tower:'B-tower-1'}),null);
  assert.equal(cue({type:'tower_repair',actor:'A0'}),'tower_repair');
  assert.ok(ARENA_SOUND_CUE.tower_ally.priority>ARENA_SOUND_CUE.impact.priority);
  assert.ok(ARENA_SOUND_CUE.seal_enemy.priority>ARENA_SOUND_CUE.skill.priority);
});

test('resource, item, construction and specific wildlife buffs have distinct signatures',()=>{
  for(const [kind,id] of Object.entries({wood:'mining_wood',stone:'mining_stone',gold:'mining_gold'}))
    assert.equal(cue({type:'mine',actor:'A0',kind}),id);
  for(const [kind,id] of Object.entries({
    forest:'buff_forest',golden:'buff_golden',stone:'buff_stone',
    lumen:'buff_lumen',forager:'buff_forager',wisp:'buff_wisp',
  }))assert.equal(cue({type:'buff',actor:'A0',kind}),id);
  for(const [type,id] of Object.entries({
    deposit:'deposit',train_order:'recruit',army_order:'order',
    equipment_drop:'item_drop',loot:'item_pickup',equipment_equip:'item_equip',
    item_consumed:'item_use',construction_start:'build_start',
    construction_complete:'build_complete',tower_upgrade_start:'tower_upgrade_start',
    relic_reinforced:'item_equip',level_up:'level_up',
  }))assert.equal(cue({type,actor:'A0',team:'A'}),id);
  assert.equal(cue({type:'mine',actor:'B0',kind:'wood'}),null);
  assert.equal(cue({type:'construction_complete',team:'B'}),null);
  assert.equal(cue({type:'item_consumed',actor:'B0'}),null);
  assert.notDeepEqual(ARENA_SOUND_CUE.mining_wood,ARENA_SOUND_CUE.mining_stone);
});

test('ranked seat B2 receives own-team cues, not always A0',()=>{
  const teamB={...ctx,team:'B',seat:'B2',
    players:{...players,B2:{id:'B2',team:'B'}}};
  assert.equal(cue({type:'defeat',from:'A0',to:'B2'},teamB),'self_down');
  assert.equal(cue({type:'defeat',from:'B2',to:'A0'},teamB),'enemy_down');
  assert.equal(cue({type:'tower_destroyed',team:'B'},teamB),'tower_ally');
  assert.equal(cue({type:'result',winner:'B'},teamB),'victory');
  assert.equal(cue({type:'result',winner:'A'},teamB),'defeat');
});
test('audio sequence is bounded, never replays or drops crucial destruction amid hit spam',()=>{
  const events=Array.from({length:18},(_,index)=>({
    seq:index+1,type:'damage',from:'A0',to:'B0',
  }));
  events.push({seq:19,type:'tower_destroyed',team:'A'});
  events.push({seq:20,type:'equipment_drop',actor:'A0'});
  events.push({seq:21,type:'result',winner:'B'});
  const first=drainArenaSoundscape(events,0,21,ctx);
  assert.equal(first.lastSeq,21);
  assert.ok(first.cues.length<=3);
  assert.ok(first.cues.some(x=>x.id==='tower_ally'));
  assert.ok(first.cues.some(x=>x.id==='defeat'));
  assert.deepEqual(drainArenaSoundscape(events,21,21,ctx).cues,[]);
  const unseen=drainArenaSoundscape(events,18,21,ctx);
  assert.ok(unseen.cues.every(x=>ARENA_SOUND_CUE[x.id]));
});
test('soft buff chirps are proximity-aware, never periodic notifications without a nearby creature',()=>{
  const state=createPractice({mode:'duel',hero:'phan'});
  const p=state.players.A0;
  assert.equal(nearbyArenaBuffCue({...state,creatures:[]},'A0'),null);
  const buff={id:'buff-wisp',kind:'wisp',x:p.x+3,y:p.y,alive:true,hp:80};
  const got=nearbyArenaBuffCue({...state,creatures:[buff]},'A0');
  assert.equal(got.id,'nearby_wisp');
  assert.equal(got.cooldown,8500);
  assert.ok(got.volume<.15);
  assert.equal(nearbyArenaBuffCue({...state,creatures:[{...buff,x:p.x+100}]},'A0'),null);
  p.alive=false;
  assert.equal(nearbyArenaBuffCue({...state,creatures:[buff]},'A0'),null);
});
test('critical native visual assets and 13 x 4 fullbody heroes are actual Metro requires',()=>{
  const registry=load('src/features/games/empire/arenaGeneratedAssets.ts');
  const actor=load('src/features/games/empire/ArenaAnimatedActor.tsx');
  const field=load('src/app/games/empire-arena.tsx');
  const art=load('src/features/games/empire/ArenaWorldArt.tsx');
  assert.equal(Object.keys(HEROES).length,13);
  for(const hero of Object.keys(HEROES))for(const pose of ['idle','walk','attack','skill']) {
    const token="'fullbody:"+hero+"_"+pose+"': require('";
    const start=registry.indexOf(token);
    assert.ok(start>=0,hero+' '+pose+' must be registered');
    const relative=registry.slice(start+token.length).split("'")[0];
    assert.ok(existsSync(resolve(root,'src/features/games/empire',relative)),hero+' '+pose+' missing');
  }
  for(const scene of ['genesis_rift','aurora_foundry','verdant_fracture']){
    const token="'scene:"+scene+"': require('";
    const start=registry.indexOf(token);
    assert.ok(start>=0,scene+' not bundled');
    const relative=registry.slice(start+token.length).split("'")[0];
    assert.ok(existsSync(resolve(root,'src/features/games/empire',relative)),scene+' file missing');
  }
  for(const term of ["<ArenaStructureArt","<ArenaWildlifeArt","<ArenaResourceLootArt","<ArenaAnimatedActor","contentFit=\"cover\" cachePolicy=\"disk\""]){
    assert.ok(field.includes(term),term+' not mounted');
  }
  for(const term of ["t.upgrading","b.status==='building'","loot.filter","creatures.filter","nodes.filter","Math.sin(elapsed"]){
    assert.ok(art.includes(term),term+' art not state-driven');
  }
  assert.match(actor,/pose==='attack' \|\| pose==='skill'/);
  assert.match(field,/fullbody:' \+ p.hero \+ '_' \+ pose/);
  assert.doesNotMatch(field,/supabase\.|awardBp|awardDiamond/);
});
test('each score points to real, locally compiled CC0 SFX, not a remote placeholder',()=>{
  const audio=load('src/features/games/runtime/rorkAudio.ts');
  const assets=load('src/features/games/runtime/kingdomPremiumAudioAssets.ts');
  const valid=new Set(['build_hit','beat_combo','beat_hit','victory','victory_alt','enter',
    'retry','pickup','coins','unlock','ui_tap','ui_confirm','mission_go']);
  assert.ok(Object.keys(ARENA_SOUND_CUE).length>=35);
  for(const [id,cue] of Object.entries(ARENA_SOUND_CUE)){
    assert.ok(valid.has(cue.sound),id+': missing vendor sound alias');
    assert.ok(cue.volume>0&&cue.volume<.5,id+': volume must be bounded');
    assert.ok(cue.rate>=.7&&cue.rate<=1.3,id+': pitch rate must be bounded');
    assert.ok(cue.cooldown>=100&&cue.cooldown<=10000,id+': spam guard');
  }
  for(const name of ['victory.wav','victory-alt.wav','collect-crystal.wav','coins.wav',
    'impact-wood.wav','ui-soft.wav','failure.wav','unlock.wav','enter.wav']){
    assert.ok(assets.includes(name),name);
    assert.ok(existsSync(resolve(root,'assets/sounds/kingdom-premium',name)),name+' not bundled');
  }
  assert.ok(audio.includes('tryPlayArenaEventCue'));
  assert.ok(audio.includes('if (arena) for (const key of'), 'Arena voices must be prewarmed ONLY on Arena');
  assert.match(load('src/app/games/empire-arena.tsx'),/useRorkGameAmbience\(ARENA_SCENE_GAME_ID\[mapId\], \{arena:true\}\)/);
  assert.ok(audio.includes('getBuklodGameSoundVolume'));
  assert.ok(audio.includes("focusedKingdomViews <= 0"));
  assert.ok(audio.includes('ARENA_PACKAGED_SOUND_KEY'));
  assert.doesNotMatch(load('src/features/games/empire/arenaSoundscape.mjs'),
    /fetch\(|\.rpc\(|createAudioPlayer|supabase\.|awardDiamond|awardBp/);
});
test('visual presentation recognizes actual construction, loot, farming and casualty events',()=>{
  const presentation=load('src/features/games/empire/arenaPracticePresentation.mjs');
  const engine=load('experiments/empire-arena-v2/arena-v2-engine.mjs');
  const construction=load('experiments/empire-arena-v2/arena-v2-empire.mjs');
  for(const type of ['construction_start','construction_complete','tower_upgrade_start',
    'tower_upgrade','equipment_drop','buff','mine','damage','tower_ko','boss_ko','trap_ko'])
    assert.ok(presentation.includes("'"+type+"'"),type+' not in VFX registry');
  for(const type of ['tower_hit','tower_ko','boss_hit','boss_ko','unit_hit','unit_ko','trap_hit',
    'trap_ko','boss_defeat','equipment_drop','mine'])assert.ok(engine.includes("'"+type+"'"));
  for(const type of ['construction_start','construction_complete','tower_upgrade_start','tower_upgrade'])
    assert.ok(engine.includes("'"+type+"'")||construction.includes("'"+type+"'"));
  assert.ok(ARENA_VISUAL_EVENT_TYPES.has('building_destroyed'));
});


test('canonical engine emits actionable sound cues when hero defeats enemy and collects a buff',()=>{
  const s=createPractice({mode:'duel',hero:'phan'});
  const player=s.players.A0,foe=s.players.B0;
  player.x=foe.x-3;player.y=foe.y;foe.hp=1;
  assert.equal(command(s,'A0',{type:'attack',targetId:'B0'}),true);
  const kill=s.events.find(e=>e.type==='defeat'&&e.to==='B0');
  assert.ok(kill,'a real knockout must generate the event');
  assert.equal(cue(kill,{...ctx,players:s.players}),'enemy_down');
  const buff=s.creatures.find(c=>c.kind==='forest');
  player.x=buff.x-3;player.y=buff.y;buff.hp=1;
  s.elapsed+=1000;
  assert.equal(command(s,'A0',{type:'attack',targetId:buff.id}),true);
  const gained=s.events.find(e=>e.type==='buff'&&e.kind==='forest');
  assert.ok(gained,'buff pickup must be confirmed by engine event');
  assert.equal(cue(gained,{...ctx,players:s.players}),'buff_forest');
  const animalDefeat=s.events.find(e=>e.type==='defeat'&&e.to===buff.id);
  assert.equal(cue(animalDefeat,{...ctx,players:s.players}),null,
    'buff creature KO cannot play a fake enemy hero kill');
});

test('canonical tower combat emits distinct real hit and local casualty alerts',()=>{
  const s=createPractice({mode:'duel',hero:'phan'});
  const tower=s.towers.find(t=>t.team==='B');
  s.players.A0.x=tower.x;s.players.A0.y=tower.y;
  s.players.A0.hp=1;
  for(let i=0;i<12&&s.players.A0.alive;i++)tick(s);
  assert.equal(s.players.A0.alive,false,'tower should actually defeat exposed hero');
  const dead=s.events.find(e=>e.type==='tower_ko'&&e.target==='A0');
  assert.ok(dead,'tower KO must have engine-produced semantic metadata');
  assert.equal(cue(dead,{...ctx,players:s.players}),'self_down');
});

test('premium voice director announces real tactical events, never routine hit spam',async()=>{
  const {ARENA_ANNOUNCEMENTS,selectArenaAnnouncement}=await import(
    '../src/features/games/empire/arenaVoiceDirector.mjs');
  for(const id of ['self_down','ally_down','enemy_down','tower_ally','tower_enemy',
    'seal_ally','seal_enemy','build_complete','tower_upgrade','item_pickup',
    'item_equip','buff_forest','buff_golden','buff_stone','buff_lumen','buff_wisp',
    'buff_forager','hero_respawn','level_up','victory','defeat']){
    assert.ok(ARENA_ANNOUNCEMENTS[id]?.text,id+' missing spoken line');
  }
  assert.equal(ARENA_ANNOUNCEMENTS.impact,undefined,'normal hit must not trigger speech');
  assert.equal(ARENA_ANNOUNCEMENTS.mining_wood,undefined,'farming cannot spam speech');
  const priority=selectArenaAnnouncement([{id:'item_pickup'},{id:'seal_ally'}],0,10000);
  assert.equal(priority.id,'seal_ally','urgent defense overrides pickup');
  assert.equal(selectArenaAnnouncement([{id:'seal_ally'}],9000,10000),null,
    'announcer enforces minimum interval');
  const runtime=load('src/features/games/empire/ArenaVoiceRuntime.ts');
  assert.ok(runtime.includes('isBuklodGameSoundEnabled'));
  assert.ok(runtime.includes('AppState.currentState'));
  assert.ok(runtime.includes('setArenaVoiceFocus'));
  assert.ok(runtime.includes('Speech.stop()'));
  assert.ok(runtime.includes("Platform.OS==='web'"));
  assert.ok(runtime.includes("language:'en-US'"));
});
