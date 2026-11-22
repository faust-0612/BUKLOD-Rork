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


test('endless challenge tiers grow, remain playable, and avoid repeating nearby procedural layouts',()=>{
  const {stageConfig,arcadeStagePoints,CHALLENGES,MAX_STAGE}=rules;
  assert.equal(CHALLENGES.length,8);
  assert.equal(stageConfig('catch',1).goal<stageConfig('catch',50).goal,true);
  assert.ok(stageConfig('catch',MAX_STAGE).goal<=30);
  assert.ok(stageConfig('rhythm',MAX_STAGE).spawnInterval>=3);
  assert.ok(stageConfig('runner',MAX_STAGE).speed<=0.82);
  assert.ok(arcadeStagePoints(500)>arcadeStagePoints(10));
  assert.notEqual(startArcade('runner',33,5).seed,startArcade('runner',33,6).seed);
  let s=startArcade('rhythm',17,25);
  for(let i=0;i<180;i++){
    s=tickArcade({...s,lives:4,remaining:1000});
    const recent=s.lastPatterns;
    assert.equal(new Set(recent).size,recent.length,'no short-range spawn repeat');
  }
  assert.ok(s.entitySeq>8);
});

test('game-only points and score rise across stage clears without double-settling',()=>{
  let s=startArcade('tap',91,12);
  const initial=s.score;
  for(let i=0;i<90&&s.status==='playing';i++){
    s=actArcade(s,'cell',s.cell);
    for(let j=0;j<3&&s.status==='playing';j++)s=tickArcade(s);
  }
  assert.equal(s.status,'clear');
  assert.ok(s.score>initial);
  assert.ok(s.stageBonus>0);
  assert.ok(s.stagePoints>=s.stageBonus);
  const result=tickArcade(s);
  assert.deepEqual(result,s,'clear state cannot grant stage bonus twice');
  const next=nextArcadeStage(s);
  assert.equal(next.stage,13);
  assert.ok(next.multiplier>=s.multiplier);
  assert.equal(next.score,s.score);
  assert.equal(next.stagePoints,0);
});


test('all eight mission modifiers change actual game rules and grant bounded rescue recovery',()=>{
  const {stageConfig}=rules;
  const stageFor=(mode,challenge)=>{
    for(let n=1;n<=8;n++)if(stageConfig(mode,n).challenge===challenge)return n;
    throw Error('missing challenge');
  };
  const rush=stageConfig('runner',stageFor('runner','rush'));
  const endurance=stageConfig('runner',stageFor('runner','endurance'));
  const storm=stageConfig('runner',stageFor('runner','storm'));
  const treasure=stageConfig('runner',stageFor('runner','treasure'));
  assert.ok(rush.duration<endurance.duration);
  assert.ok(storm.hazardRate<treasure.hazardRate);
  assert.ok(rush.speed>0);
  const rescueLevel=stageFor('tap','rescue');
  let s=startArcade('tap',88,rescueLevel,0,2);
  while(s.status==='playing'&&!s.rescueGranted){
    s=actArcade(s,'cell',s.cell);
    for(let i=0;i<3&&s.status==='playing';i++)s=tickArcade(s);
  }
  assert.equal(s.rescueGranted,true);
  assert.equal(s.lives,3,'one-time rescue life');
  const after=s.lives;
  s=actArcade(s,'cell',s.cell);
  assert.equal(s.lives,after,'rescue heal does not repeat');
});

test('account-local arcade mastery unlocks each stage exactly once without replay farming',()=>{
  const {blankArcadeProgress,normalizeArcadeProgress,clearArcadeStage}=
    require('../src/features/games/kingdom/arcade/arcadeProgressCore.js');
  const id='angel-treasure-rush';
  const blank=blankArcadeProgress(id);
  assert.equal(blank.unlockedStage,1);
  assert.equal(blank.lifetimeArcadePoints,0);
  const first=clearArcadeStage(blank,id,1,300,'run-abc123.stage:1','2026-11-22T12:00:00Z');
  assert.equal(first.unlockedStage,2);
  assert.ok(first.lifetimeArcadePoints>0);
  assert.equal(first.clearCount,1);
  const dupe=clearArcadeStage(first,id,1,900,'run-abc123.stage:1','2026-11-22T12:01:00Z');
  assert.equal(dupe.lifetimeArcadePoints,first.lifetimeArcadePoints);
  const replay=clearArcadeStage(dupe,id,1,999,'run-abc124.stage:1','2026-11-22T12:02:00Z');
  assert.equal(replay.lifetimeArcadePoints,first.lifetimeArcadePoints);
  assert.equal(replay.bestRunScore,999);
  assert.throws(()=>clearArcadeStage(replay,id,4,1000,'run-skip123.stage:4','now'),/Stage must be unlocked/);
  const second=clearArcadeStage(replay,id,2,1100,'run-abc125.stage:2','2026-11-22T12:03:00Z');
  assert.equal(second.unlockedStage,3);
  assert.equal(second.lifetimeArcadePoints,
    first.lifetimeArcadePoints+rules.arcadeStagePoints(2));
  const foreign=normalizeArcadeProgress('angel-vault-escape',second);
  assert.equal(foreign.unlockedStage,1,'game IDs isolate mastery');
});

test('invalid stage receipts, corrupted progress and duplicate checkpoint records fail closed',()=>{
  const {blankArcadeProgress,normalizeArcadeProgress,clearArcadeStage}=
    require('../src/features/games/kingdom/arcade/arcadeProgressCore.js');
  const id='angel-treasure-rush';
  const bad=normalizeArcadeProgress(id,{version:1,gameId:id,unlockedStage:99999999,
    lifetimeArcadePoints:-1,bestRunScore:Infinity,clearCount:NaN});
  assert.equal(bad.unlockedStage,1);
  assert.equal(bad.lifetimeArcadePoints,0);
  assert.equal(bad.bestRunScore,0);
  assert.throws(()=>clearArcadeStage(blankArcadeProgress(id),id,1,10,'short','now'),/receipt/);
  assert.throws(()=>clearArcadeStage(blankArcadeProgress(id),id,2,10,'run-abcdef.stage:2','now'),/unlocked/);
  assert.throws(()=>rules.startArcade('tap',1,Number.MAX_SAFE_INTEGER),/stage/);
});

test('premium arcade effects are bounded, local and never own a BP minting path',()=>{
  const screen=read('src/features/games/kingdom/arcade/ArcadeGameV1.tsx');
  const visuals=read('src/features/games/kingdom/arcade/ArcadePremiumFX.tsx');
  const progress=read('src/features/games/kingdom/arcade/arcadeProgressStore.ts');
  assert.match(screen,/readArcadeProgress/);
  assert.match(screen,/checkpointArcadeStage/);
  assert.match(screen,/STATION_SFX/);
  assert.match(screen,/playRorkSignatureSfx/);
  assert.match(screen,/ArcadeMovingItem/);
  assert.match(screen,/ArcadePremiumFX/);
  assert.match(screen,/ownerRef\\.current!==ownerId/);
  assert.match(screen,/setPhase\\('ready'\\)/);
  assert.match(visuals,/useNativeDriver:true/);
  assert.match(visuals,/react-native-svg/);
  assert.match(visuals,/BuklodProgressiveCharacterArt/);
  assert.match(visuals,/BuklodSpecialCharacterArtV2/);
  assert.match(screen,/ArcadeHeroSprite/);
  assert.match(visuals,/Array\\.from\\(\\{length:8\\}/);
  assert.match(progress,/@buklod\\/kingdom\\/arcade-stage-v1/);
  assert.doesNotMatch(progress,/rpc\\(|supabase\\.from\\(/i);
});

test('arcades stay in local game-only records; original verified mastery untouched',()=>{
  const screen=read('src/features/games/kingdom/arcade/ArcadeGameV1.tsx');
  const center=read('src/features/games/kingdom/platform/KingdomInteriorCenter.tsx');
  const cinema=read('src/features/games/kingdom/platform/KingdomCinematicScenes.ts');
  const language=read('src/features/games/runtime/BuklodGameLanguage.tsx');
  assert.match(screen,/reward:\{xp:0,kingdomXp:0\}/);
  assert.match(center,/active\.kind !== 'arcade' && masteryEligibility/);
  assert.match(center,/if \(result\.status === 'won' && active\.kind !== 'arcade'\)/);
  assert.match(center,/active\.kind !== 'arcade' \? <Pressable/);
  assert.match(center,/arcadeGamesForCharacter\(character\)/);
  assert.match(cinema,/KINGDOM_ARCADE_GAMES\.find/);
  assert.match(center,/setGuideGameId\(active\?\.kind === 'arcade' \? active\.id : undefined\)/);
  assert.match(language,/ARCADE_CONTROLS/);
  assert.match(language,/overrideGameId \?\? gameId/);
  assert.match(language,/controlsTl: ARCADE_CONTROLS\[arcade\.mode\]\[1\]/);
  assert.match(screen,/setInterval\(/);
  assert.match(screen,/clearInterval\(/);
  assert.match(screen,/AppState\.addEventListener/);
  assert.match(screen,/useFocusEffect/);
  assert.match(center,/compact && styles\.pageBelowGameControls/);
});
